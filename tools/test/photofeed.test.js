// The photo feed for the screensaver (photofeed.js) against a stand-in for a server's photo feed (family-calendar's, for one) over HTTPS, with a
// certificate authority of its own made for this test (openssl): the setup code, the pinned certificate, the token, one photo at a
// time into a small cache, the shuffled order, hidden photos leaving the TV, the server away, and the launcher never seeing the token.
const fs = require('fs'),
  path = require('path'),
  https = require('https'),
  cp = require('child_process');
const { ok, req, run, tmp, call, memoryConfig } = require('./lib');

// a certificate authority and a server certificate for 127.0.0.1 signed by it, and a second authority that signed nothing here
function pki() {
  const d = path.join(tmp, 'pki');
  fs.mkdirSync(d);
  const ssl = args => {
    const r = cp.spawnSync('openssl', args, { cwd: d, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('openssl ' + args[0] + ': ' + r.stderr);
  };
  for (const ca of ['ca', 'other'])
    ssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', ca + '.key', '-out', ca + '.pem', '-days', '2', '-subj', '/CN=Test ' + ca,
      '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']); // prettier-ignore
  ssl(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'leaf.key', '-out', 'leaf.csr', '-subj', '/CN=127.0.0.1']);
  fs.writeFileSync(path.join(d, 'ext.cnf'), 'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n');
  ssl(['x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'leaf.pem', '-days', '2', '-extfile', 'ext.cnf']); // prettier-ignore
  const der = f => {
    const p = fs.readFileSync(path.join(d, f), 'utf8');
    return p.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  };
  return {
    key: fs.readFileSync(path.join(d, 'leaf.key')),
    cert: fs.readFileSync(path.join(d, 'leaf.pem')),
    ca: der('ca.pem'),
    other: der('other.pem'),
  };
}
const TOKEN = 'feed-token-0123456789abcdefABCDEF';
const code = o => 'cyfp1.' + Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jpeg = id => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('photo ' + id), Buffer.alloc(2000)]);

run(async () => {
  const k = pki();
  // the stand-in feed: GET /api/feed/photos (ETag) and GET /api/feed/photos/<id>?w=
  const seen = { lists: 0, notModified: 0, photos: [], widths: [], auth: [] };
  let ids = ['p1', 'p2', 'p3'],
    down = false;
  const etag = () => '"' + ids.join(',') + '"';
  const srv = https.createServer({ key: k.key, cert: k.cert }, (q, r) => {
    seen.auth.push(q.headers.authorization || '');
    if (down) return q.socket.destroy();
    if (q.headers.authorization !== 'Bearer ' + TOKEN) {
      r.writeHead(401);
      return r.end();
    }
    const u = q.url.split('?')[0];
    if (u === '/api/feed/photos') {
      seen.lists++;
      if (q.headers['if-none-match'] === etag()) {
        seen.notModified++;
        r.writeHead(304);
        return r.end();
      }
      r.writeHead(200, { 'content-type': 'application/json', etag: etag() });
      // the first photo with everything a frame can show, the others with only the day they were added
      return r.end(
        JSON.stringify({
          stamp: etag(),
          photos: ids.map((id, i) =>
            i === 0
              ? {
                  id,
                  createdAt: '2026-10-27T00:00:00Z',
                  takenAt: '2026-08-14T15:20:00Z',
                  caption: 'Lake\u0007 day',
                  width: 3024,
                  height: 4032,
                  color: '#8A7B70',
                }
              : { id, createdAt: '2026-10-27T00:00:00Z', color: 'red' }
          ),
        })
      );
    }
    const m = /^\/api\/feed\/photos\/([\w-]+)$/.exec(u);
    if (m && m[1] === 'broken') {
      r.writeHead(422); // a photo the server cannot convert
      return r.end();
    }
    if (m && ids.indexOf(m[1]) >= 0) {
      seen.photos.push(m[1]);
      seen.widths.push((/[?&]w=(\d+)/.exec(q.url) || [])[1]);
      r.writeHead(200, { 'content-type': 'image/jpeg' });
      return r.end(jpeg(m[1]));
    }
    r.writeHead(404);
    r.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = 'https://127.0.0.1:' + srv.address().port;

  const fam = req('photofeed');
  ok(
    fam.parseCode('hello').error && fam.parseCode(code({ u: 'http://x', t: TOKEN })).error,
    'a code that is not one, or plain http, is refused'
  );
  ok(!!fam.parseCode(code({ u: url, t: TOKEN, ca: 'AAAA' + k.ca.slice(4, 60) })).error, 'a damaged certificate is refused');
  const parsed = fam.parseCode('  ' + code({ u: url + '/ignored/path', t: TOKEN, ca: k.ca }) + '\n');
  ok(
    parsed.url === url && parsed.token === TOKEN && /BEGIN CERTIFICATE/.test(parsed.ca),
    'a setup code gives the address, the token and the certificate'
  );

  const config = memoryConfig({});
  const features = {};
  const ctx = { config, feature: n => features[n] || null };
  const f = (features.photofeed = fam.create(ctx));

  // another authority than the server's: nothing is saved
  const wrongCa = await f.setup(code({ u: url, t: TOKEN, ca: k.other }));
  ok(/certificate/.test(wrongCa.error || '') && !config.get().photoFeed, 'a server whose certificate the code does not name is refused');
  const wrongToken = await f.setup(code({ u: url, t: 'not-the-token-0123456789', ca: k.ca }));
  ok(/token/.test(wrongToken.error || '') && !config.get().photoFeed, 'a token the server refuses is not saved');

  const st = await f.setup(code({ u: url, t: TOKEN, ca: k.ca }));
  ok(st.configured && st.photos === 3 && st.pinned && st.tokenHint === '…' + TOKEN.slice(-4), 'set up: three photos, certificate pinned');
  ok(JSON.stringify(st).indexOf(TOKEN) < 0, 'the status never carries the token');
  ok(
    seen.auth.every(a => a === '' || a.indexOf('Bearer ') === 0),
    'the token is sent as a bearer token'
  );

  // one photo at a time: next names a photo that is already on the TV, and the one after it is fetched meanwhile
  const n1 = await call(f, '/api/photofeed/next');
  ok(n1.j && ids.indexOf(n1.j.id) >= 0, 'next names one of the photos');
  await new Promise(r => setTimeout(r, 200));
  ok(seen.photos.length === 2 && seen.widths.every(w => w === '1920'), 'the photo and the one after it are fetched, at 1920 pixels');
  const order = [n1.j.id];
  for (let i = 0; i < 5; i++) order.push((await call(f, '/api/photofeed/next')).j.id);
  const firstThree = order.slice(0, 3).sort().join(),
    nextThree = order.slice(3).sort().join();
  ok(firstThree === 'p1,p2,p3' && nextThree === 'p1,p2,p3', 'every photo once before any comes back');
  // what the frame shows: the day taken (else added), a caption without control characters, the size
  const metas = [];
  for (let i = 0; i < ids.length; i++) metas.push((await call(f, '/api/photofeed/next')).j);
  const first = metas.filter(m => m.id === ids[0])[0],
    other = metas.filter(m => m.id !== ids[0])[0];
  ok(
    first &&
      first.date === '2026-08-14' &&
      first.caption === 'Lake day' &&
      first.width === 3024 &&
      first.height === 4032 &&
      first.color === '#8a7b70',
    'next says when the photo was taken, its caption, its size and its colour: ' + JSON.stringify(first)
  );
  ok(
    other && other.date === '2026-10-27' && !other.caption && !other.width && !other.color,
    'a photo with less: the day it was added only (a colour that is not #rrggbb is dropped)'
  );

  ok(
    order.every((x, i) => i === 0 || x !== order[i - 1]),
    'never the same photo twice in a row'
  );
  const fetchedBefore = seen.photos.length;
  await call(f, '/api/photofeed/next');
  ok(seen.photos.length === fetchedBefore, 'a photo already on the TV is not downloaded again');

  // the photo itself, from the cache
  let body = Buffer.alloc(0),
    type = '';
  await new Promise(resolve => {
    const res = {
      writeHead(c, h) {
        type = (h || {})['content-type'];
      },
      write(b) {
        body = Buffer.concat([body, Buffer.from(b)]);
        return true;
      },
      end(b) {
        if (b) body = Buffer.concat([body, Buffer.from(b)]);
        resolve();
      },
      on() {
        return this;
      },
      once() {
        return this;
      },
      emit() {},
      removeListener() {},
    };
    f.handle({ method: 'GET', url: '/api/photofeed/photo/p2', headers: {} }, res, '/api/photofeed/photo/p2');
  });
  ok(type === 'image/jpeg' && body.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), 'the photo is served from the TV as JPEG');

  // the launcher gets whether there are photos, never the address or the token
  ok(f.count() === 3, 'the launcher can tell there are photos in the feed');
  ok(config.get().photoFeed.token === TOKEN, 'the token is kept in the settings (config.json, root only)');

  // a photo hidden on the server leaves the TV at the next read; an unchanged list is a 304
  const cacheDir = path.join(process.env.CYTV_DIR, 'photofeed', 'cache');
  await f.refresh();
  ok(seen.notModified === 1, 'an unchanged list is not sent again (ETag, 304)');
  ids = ['p1', 'p3'];
  await f.refresh();
  ok(!fs.existsSync(path.join(cacheDir, 'p2.jpg')) && f.status().photos === 2, 'a photo hidden on the server is removed from the TV');

  // a bigger library shown for a long time: photos are shown from memory, and the flash storage gets only the first few (then at most
  // one new photo every half hour), so a long evening of photos does not wear it
  ids = [];
  for (let i = 0; i < 42; i++) ids.push('q' + i);
  await f.refresh();
  const before42 = seen.photos.length;
  for (let i = 0; i < ids.length; i++) await call(f, '/api/photofeed/next');
  await new Promise(r => setTimeout(r, 300));
  const files = fs.readdirSync(cacheDir).filter(n => /\.jpg$/.test(n));
  ok(seen.photos.length - before42 >= 42, 'all 42 photos were shown');
  ok(
    files.length <= fam.DISK_WARM + 1,
    'only a few of them were written to the storage (' +
      files.length +
      ' files; at most ' +
      fam.DISK_WARM +
      ' at once, then one per half hour)'
  );

  // a photo the server cannot convert (422) is skipped, like one that is gone (404)
  ids = ids.concat(['broken']);
  await f.refresh();
  const shown = [];
  for (let i = 0; i < ids.length + 2; i++) shown.push((await call(f, '/api/photofeed/next')).j.id);
  ok(
    shown.indexOf('broken') < 0 && shown.every(Boolean) && f.status().photos === ids.length - 1,
    'a photo the server cannot convert is skipped'
  );

  // the server away: the screensaver goes on with what is on the TV
  down = true;
  const away = [];
  for (let i = 0; i < 12; i++) away.push((await call(f, '/api/photofeed/next')).j);
  ok(
    away.every(x => x && x.id && ids.indexOf(x.id) >= 0) && away.some(x => x.offline),
    'with the server away the screensaver goes on with the photos in memory and on the storage'
  );
  down = false;

  // disconnect: the settings and the photos leave the TV
  f.disconnect();
  ok(
    !config.get().photoFeed && !fs.readdirSync(cacheDir).filter(n => /\.jpg$/.test(n)).length,
    'disconnect removes the token and the photos'
  );
  const none = await call(f, '/api/photofeed/next');
  ok(none.j && none.j.id === null, 'not set up: no photo');
  // a restart goes on with the round where it was: no photo comes back before every one was shown (saved at each pick here)
  ids = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  const ctx2 = { config, feature: () => null, saveMs: 0 };
  const before = fam.create(ctx2);
  await before.setup(code({ u: url, t: TOKEN, ca: k.ca }));
  const firstHalf = [];
  for (let i = 0; i < 3; i++) firstHalf.push((await call(before, '/api/photofeed/next')).j.id);
  const after = fam.create(ctx2); // a new start of the service: the same folder, nothing in memory
  const secondHalf = [];
  for (let i = 0; i < 3; i++) secondHalf.push((await call(after, '/api/photofeed/next')).j.id);
  ok(
    firstHalf.concat(secondHalf).sort().join() === ids.join() && secondHalf[0] !== firstHalf[2],
    'after a restart the round goes on where it was (' + firstHalf.join(',') + ' | ' + secondHalf.join(',') + ')'
  );
  // in the middle of a round a photo added on the server joins it, and one removed leaves it
  const started = [];
  for (let i = 0; i < 2; i++) started.push((await call(after, '/api/photofeed/next')).j.id);
  const gone = ids.filter(x => started.indexOf(x) < 0)[0];
  ids = ids.filter(x => x !== gone).concat(['r7']);
  await after.refresh();
  const rest = [];
  for (let i = 0; i < 4; i++) rest.push((await call(after, '/api/photofeed/next')).j.id);
  ok(
    rest.indexOf('r7') >= 0 && rest.indexOf(gone) < 0 && rest.every(x => started.indexOf(x) < 0),
    'a photo added on the server joins the round, a removed one leaves it, the rest is not shown twice (' +
      started.join(',') +
      ' | ' +
      rest.join(',') +
      ')'
  );

  // offline with part of the library on the TV: what is shown never repeats at once, also when the next photo cannot be fetched
  // (no memory here, so a3 is gone once its file is)
  ids = ['a1', 'a2', 'a3'];
  const g = fam.create({ config, feature: () => null, memFiles: 0 });
  await g.setup(code({ u: url, t: TOKEN, ca: k.ca }));
  for (let i = 0; i < 3; i++) await call(g, '/api/photofeed/next');
  await new Promise(r => setTimeout(r, 200));
  fs.unlinkSync(path.join(cacheDir, 'a3.jpg'));
  down = true;
  const seq = [];
  for (let i = 0; i < 24; i++) seq.push((await call(g, '/api/photofeed/next')).j.id);
  down = false;
  ok(
    seq.every((x, i) => x && (i === 0 || x !== seq[i - 1])),
    'offline with part of the library on the TV: never the same photo twice in a row (' + seq.join(',') + ')'
  );

  // the photo chosen as the wallpaper stays on the storage; with the storage nearly full nothing else is written
  const tight = fam.create({ config, feature: () => null, freeKb: () => 1024 });
  ids = ['w1', 'w2', 'w3'];
  await tight.setup(code({ u: url, t: TOKEN, ca: k.ca }));
  config.update('test', c => {
    c.wall = { on: true, secs: 900, pick: 'f/w2' };
  });
  for (let i = 0; i < 3; i++) await call(tight, '/api/photofeed/next');
  await new Promise(r => setTimeout(r, 200));
  ok(!fs.readdirSync(cacheDir).filter(n => /\.jpg$/.test(n)).length, 'with the storage nearly full no photo is written to it');
  const roomy = fam.create({ config, feature: () => null, diskEveryMs: 0, freeKb: () => 4e6 });
  await roomy.setup(code({ u: url, t: TOKEN, ca: k.ca }));
  ids = [];
  for (let i = 0; i < 30; i++) ids.push('z' + i);
  ids.push('w2');
  await roomy.refresh();
  for (let i = 0; i < ids.length; i++) await call(roomy, '/api/photofeed/next');
  await new Promise(r => setTimeout(r, 200));
  const kept = fs.readdirSync(cacheDir).filter(n => /\.jpg$/.test(n));
  ok(
    kept.indexOf('w2.jpg') >= 0 && kept.length <= fam.DISK_FILES + 1,
    'the chosen wallpaper stays on the storage, and the offline set keeps to ' + fam.DISK_FILES + ' photos (' + kept.length + ')'
  );
  srv.close();
});
