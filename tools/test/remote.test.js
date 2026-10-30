// Phone remote (remote.js): pairing with the code shown on the TV (five wrong codes close it), a key per phone kept only as its hash,
// the presses reaching LG's network input (sendSpecialKey or a key code; the pointer on a stand-in socket), the volume LG's audio
// service, typing and the apps, the
// LAN server only for the home network and only from its own page, and a phone removed on the TV losing access.
const http = require('http'),
  net = require('net'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const { ok, call, sleep, serve, req, memoryConfig, run } = require('./lib');

function lan(method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        host: '127.0.0.1',
        port: +process.env.CYTV_REMOTE_PORT,
        path: p,
        method,
        agent: false,
        headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      },
      res => {
        const b = [];
        res.on('data', c => b.push(c));
        res.on('end', () => {
          const t = Buffer.concat(b).toString();
          let j = null;
          try {
            j = JSON.parse(t);
          } catch (_) {}
          resolve({ code: res.statusCode, text: t, j, headers: res.headers });
        });
      }
    );
    r.on('error', reject);
    r.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

run(async () => {
  // LG's network input, as a local socket that keeps what it is sent
  const sockPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-remote-')), 'pointer.sock');
  let raw = Buffer.alloc(0);
  const input = net.createServer(c => c.on('data', d => (raw = Buffer.concat([raw, d]))));
  // the messages as network input reads them: each after its length (4 bytes, big-endian)
  const frames = () => {
    const out = [];
    for (let i = 0; i + 4 <= raw.length; ) {
      const n = raw.readUInt32BE(i);
      out.push(raw.slice(i + 4, i + 4 + n).toString());
      i += 4 + n;
    }
    return out;
  };
  await new Promise(r => input.listen(sockPath, r));
  process.env.CYTV_REMOTE_SOCK = sockPath;
  const calls = [];
  const config = memoryConfig({ dock: ['b.two'], hidden: ['c.hide'] });
  const apps = {
    name: 'apps',
    apps: async () => [
      { id: 'a.one', title: 'Zed' },
      { id: 'b.two', title: 'Plex' },
      { id: 'c.hide', title: 'Hidden' },
      { id: 'com.webos.app.hdmi1', title: 'HDMI 1', input: 1 },
    ],
    handle: async (rq, rs) => {
      rs.writeHead(200, { 'content-type': 'image/png' });
      rs.end('png');
    },
  };
  const R = req('remote').create({
    config,
    luna: async (uri, p) => (
      calls.push([uri, p]), /getVolume/.test(uri) ? { returnValue: true, volumeStatus: { muteStatus: false } } : { returnValue: true }
    ),
    feature: n => (n === 'apps' ? apps : null),
  });
  R.start();
  ok(
    R.homeAddress === undefined &&
      req('remote').homeAddress('192.168.1.30') &&
      req('remote').homeAddress('::ffff:10.0.0.2') &&
      req('remote').homeAddress('fd12::1') &&
      !req('remote').homeAddress('8.8.8.8') &&
      !req('remote').homeAddress('172.32.0.1'),
    'the home network: private, link-local and loopback addresses only'
  );
  let r = await call(R, '/api/remote/status', 'GET');
  ok(r.j.on === false && r.j.devices.length === 0 && r.j.url === '', 'off, and no server on the LAN, until a phone is paired');
  r = await call(R, '/api/remote/pair', 'POST', {});
  const code = r.j.code;
  ok(
    /^\d{6}$/.test(code) && r.j.qr === r.j.url + '/#p=' + code && r.j.seconds === 300,
    'pairing opens for five minutes with a six-digit code, carried in the QR code'
  );
  const pageR = await lan('GET', '/');
  ok(
    pageR.code === 200 &&
      /TV remote/.test(pageR.text) &&
      /x-remote-key/.test(pageR.text) &&
      /frame-ancestors|DENY/.test(JSON.stringify(pageR.headers)),
    'the phone page is served, and may not be framed by another site'
  );
  // an iPhone's tap: two ways to flip a hidden switch, the one chosen in the vibration test kept on the phone, and the iPhone's own switch
  ok(
    /fbs\.way === 2 \? 2 : 1/.test(pageR.text) &&
      /\(way \|\| fb\.way\) === 2/.test(pageR.text) &&
      /document\.body\.appendChild\(l\)/.test(pageR.text) &&
      /document\.head\.appendChild\(l\)/.test(pageR.text) &&
      /Vibration test/.test(pageR.text) &&
      /The iPhone's own switch/.test(pageR.text),
    'the vibration test offers both ways and the iPhone switch, and the chosen way is kept'
  );
  // wrong codes: five of them close pairing
  for (let i = 0; i < 4; i++) await lan('POST', '/pair', { code: '000000' });
  r = await lan('POST', '/pair', { code: '000000' });
  await sleep(300);
  const closed = await lan('POST', '/pair', { code }).catch(() => ({ code: 0 }));
  ok(
    r.code === 403 && closed.code === 0,
    'five wrong codes close pairing (and the server, with no phone paired): even the right one is refused'
  );
  r = await call(R, '/api/remote/pair', 'POST', {});
  const p1 = await lan('POST', '/pair', { code: r.j.code, name: 'Sam’s <b>phone</b>' });
  const dev = config.get().remote.devices[0];
  ok(
    p1.code === 200 &&
      /^[A-Za-z0-9_-]{43}$/.test(p1.j.key) &&
      dev.name === 'Sam’s bphone/b' &&
      /^[0-9a-f]{64}$/.test(dev.hash) &&
      JSON.stringify(config.get()).indexOf(p1.j.key) < 0,
    'the right code gives the phone its own key; only its hash is kept, with the name cleaned'
  );
  const key = { 'x-remote-key': p1.j.key };
  calls.length = 0;
  r = await lan('POST', '/press', { key: 'UP' }, key);
  await lan('POST', '/press', { key: 'ENTER' }, key);
  await lan('POST', '/press', { key: 'MENU' }, key);
  await lan('POST', '/press', { key: '7' }, key);
  const N = 'luna://com.webos.service.networkinput/';
  ok(
    r.code === 200 &&
      JSON.stringify(calls) ===
        JSON.stringify([
          [N + 'sendKeyCodes', { keyCode1: 103 }],
          [N + 'sendSpecialKey', { key: 'ENTER' }],
          [N + 'sendSpecialKey', { key: 'QMENU' }],
          [N + 'sendKeyCodes', { keyCode1: 8 }],
        ]),
    'keys LG names go through sendSpecialKey (the gear key is its QMENU), the others as Linux key codes: ' + JSON.stringify(calls)
  );
  calls.length = 0;
  await lan('POST', '/press', { key: 'VOLUMEUP' }, key);
  await lan('POST', '/press', { key: 'VOLUMEDOWN' }, key);
  await lan('POST', '/press', { key: 'MUTE' }, key);
  const A = 'luna://com.webos.service.audio/master/';
  ok(
    JSON.stringify(calls) ===
      JSON.stringify([
        [A + 'volumeUp', {}],
        [A + 'volumeDown', {}],
        [A + 'getVolume', {}],
        [A + 'muteVolume', { mute: true }],
      ]),
    "the volume goes to LG's audio service (which drives a soundbar on eARC), and Mute switches the mute it reads: " + JSON.stringify(calls)
  );
  calls.length = 0;
  await lan('POST', '/move', { dx: 12.6, dy: -900 }, key);
  await lan('POST', '/click', {}, key);
  await lan('POST', '/scroll', { dy: 3 }, key);
  await sleep(100);
  ok(
    JSON.stringify(frames()) ===
      JSON.stringify(['type:move\ndx:13\ndy:-300\ndown:0\n\n', 'type:click\n\n', 'type:scroll\ndx:0\ndy:3\n\n']) && !calls.length,
    "the pointer moves, clicks and scrolls through LG's pointer socket, each message after its length (a move is held to 300 px): " +
      JSON.stringify(frames())
  );
  r = await lan('POST', '/hold', { key: 'ENTER' }, key);
  const r2 = await lan('POST', '/hold', { key: 'RIGHT' }, key);
  ok(
    r.code === 200 && r2.code === 400 && JSON.stringify(calls) === JSON.stringify([[N + 'sendLongKeyEvent', { key: 'ENTER' }]]),
    "holding OK on the phone is LG's long press; a key it does not hold is refused: " + JSON.stringify(calls)
  );
  r = await lan('POST', '/press', { key: 'rm -rf' }, key);
  const nokey = await lan('POST', '/press', { key: 'UP' });
  const badkey = await lan(
    'POST',
    '/press',
    { key: 'UP' },
    { 'x-remote-key': p1.j.key.slice(0, 42) + (p1.j.key.slice(-1) === 'A' ? 'E' : 'A') }
  );
  const other = await lan('POST', '/press', { key: 'UP' }, Object.assign({ origin: 'http://evil.example' }, key));
  ok(
    r.code === 400 && nokey.code === 401 && badkey.code === 401 && other.code === 403,
    'an unknown key, no key, a wrong key and another site are refused: ' + [r.code, nokey.code, badkey.code, other.code].join()
  );
  calls.length = 0;
  await lan('POST', '/text', { text: 'blu\u0007ey' }, key);
  await lan('POST', '/backspace', {}, key);
  await lan('POST', '/enter', {}, key);
  ok(
    JSON.stringify(calls) ===
      JSON.stringify([
        ['luna://com.webos.service.ime/insertText', { text: 'bluey', replace: 0 }],
        ['luna://com.webos.service.ime/deleteCharacters', { count: 1 }],
        ['luna://com.webos.service.ime/sendEnterKey', {}],
      ]),
    "typing goes to LG's keyboard service: " + JSON.stringify(calls)
  );
  r = await lan('POST', '/apps', {}, key);
  calls.length = 0;
  const l1 = await lan('POST', '/launch', { id: 'a.one' }, key);
  const l2 = await lan('POST', '/launch', { id: 'c.hide' }, key);
  const icon = await lan('GET', '/icon/a.one', undefined, key);
  ok(
    JSON.stringify(r.j.apps.map(a => a.id)) === '["b.two","a.one"]' &&
      l1.code === 200 &&
      l2.code === 400 &&
      calls.length === 1 &&
      calls[0][0] === 'luna://com.webos.applicationManager/launch' &&
      icon.text === 'png',
    'the apps come in the order of the dock (hidden apps and inputs left out), and only those open'
  );
  // a hub on the home network (hub/server.js): the QR code and the address shown point there; only http://<home address>:<port>
  const bad = await call(R, '/api/remote/helper', 'POST', { url: 'http://8.8.8.8:8794' });
  const bad2 = await call(R, '/api/remote/helper', 'POST', { url: 'https://192.168.1.40:8794/x' });
  r = await call(R, '/api/remote/helper', 'POST', { url: 'http://192.168.1.40:8794/' });
  const pr = await call(R, '/api/remote/pair', 'POST', {});
  ok(
    bad.code === 400 &&
      bad2.code === 400 &&
      r.j.helper === 'http://192.168.1.40:8794' &&
      r.j.url === 'http://192.168.1.40:8794' &&
      pr.j.qr === 'http://192.168.1.40:8794/#p=' + pr.j.code,
    'a hub on the home network is where the QR code and the address point; any other address is refused'
  );
  await call(R, '/api/remote/pair', 'POST', { stop: true });
  // through the hub: the LAN server closes, the TV links out to the hub and answers what comes down the link with the same handler
  const replies = [];
  let linkKeys = [];
  const fakeHub = await serve((rq, rs) => {
    if (rq.url === '/link') {
      linkKeys.push(rq.headers['x-link-key']);
      rs.writeHead(200, { 'content-type': 'application/x-ndjson' });
      rs.write('\n');
      rs.write(
        JSON.stringify({ id: 'a1', method: 'GET', url: '/', headers: { host: 'hub.test:8794' }, ip: '192.168.1.30', body: '' }) + '\n'
      );
      rs.write(
        JSON.stringify({
          id: 'a2',
          method: 'POST',
          url: '/press',
          headers: { host: 'hub.test:8794', 'x-remote-key': p1.j.key },
          ip: '8.8.8.8',
          body: Buffer.from('{"key":"UP"}').toString('base64'),
        }) + '\n'
      );
      rs.write(JSON.stringify({ id: 'a3', method: 'GET', url: '/status-data', headers: {}, ip: '127.0.0.1', body: '', self: true }) + '\n');
      rs.write(JSON.stringify({ id: 'a4', method: 'POST', url: '/press', headers: {}, ip: '127.0.0.1', body: '', self: true }) + '\n');
      return;
    }
    const b = [];
    rq.on('data', d => b.push(d));
    rq.on('end', () => {
      replies.push(JSON.parse(Buffer.concat(b).toString()));
      rs.end('{}');
    });
  });
  const hubPort = fakeHub.url.split(':').pop();
  // the fake hub listens on 127.0.0.1, a home address the hub setting accepts
  await call(R, '/api/remote/helper', 'POST', { url: 'http://127.0.0.1:' + hubPort });
  r = await call(R, '/api/remote/via', 'POST', { via: 'hub' });
  await sleep(400);
  const lanGone = await lan('GET', '/').then(
    () => false,
    () => true
  );
  const page = replies.filter(x => x.id === 'a1')[0],
    far = replies.filter(x => x.id === 'a2')[0];
  ok(
    r.j.via === 'hub' &&
      lanGone &&
      /^[A-Za-z0-9_-]{43}$/.test(linkKeys[0] || '') &&
      !!page &&
      page.status === 200 &&
      /TV remote/.test(Buffer.from(page.body, 'base64').toString()) &&
      !!far &&
      far.status === 403,
    "through the hub the TV listens on nothing, links out with its own key, and answers the hub's requests with the same checks (an address off the home network refused)"
  );
  const hubRead = replies.filter(x => x.id === 'a3')[0],
    hubPress = replies.filter(x => x.id === 'a4')[0];
  ok(
    !!hubRead && hubRead.status !== 401 && hubRead.status !== 403 && !!hubPress && hubPress.status === 403,
    "the hub's own request (self) may read the status without a phone's key, and do nothing else"
  );
  r = await call(R, '/api/remote/via', 'POST', { via: 'tv' });
  await sleep(200);
  const back = await lan('GET', '/').then(
    x => x.code,
    () => 0
  );
  ok(r.j.via === 'tv' && back === 200, 'back to the TV: the LAN server answers again');
  fakeHub.server.close();
  r = await call(R, '/api/remote/helper', 'POST', { url: '' });
  ok(r.j.helper === '' && r.j.url.indexOf('http://192.168.1.40:') !== 0, 'clearing the hub points back at the TV');
  // off on the TV: the phone is refused; on again; removed: the key no longer works and the server stops
  await call(R, '/api/remote/on', 'POST', { on: false });
  await sleep(300);
  r = await call(R, '/api/remote/status', 'GET');
  const offTry = await lan('POST', '/press', { key: 'UP' }, key).catch(() => ({ code: 0 }));
  ok(r.j.on === false && offTry.code === 0, 'switched off on the TV, the LAN server stops');
  await call(R, '/api/remote/on', 'POST', { on: true });
  r = await lan('POST', '/ping', {}, key);
  ok(r.code === 200, 'switched on again, the paired phone works');
  await call(R, '/api/remote/forget', 'POST', { id: dev.id });
  await sleep(300);
  const gone = await lan('POST', '/ping', {}, key).catch(() => ({ code: 0 }));
  ok(gone.code === 0 && config.get().remote.devices.length === 0, 'a phone removed on the TV: no key works and the server stops');
  R.stop();
  input.close();
  // a link that goes quiet is made again (a TV that slept keeps a connection the hub closed long ago); one the hub keeps writing to
  // (its heartbeat every 20 s) is kept
  {
    let connects = 0,
      beat = null;
    const quiet = await serve((rq, rs) => {
      if (rq.url !== '/link') return rs.end('{}');
      connects++;
      rs.writeHead(200, { 'content-type': 'application/x-ndjson' });
      rs.write('\n');
      if (rq.headers['x-beat'] === undefined && quiet.beating) beat = setInterval(() => rs.write('\n'), 40);
    });
    const conf2 = memoryConfig({
      remote: {
        on: true,
        via: 'hub',
        helper: quiet.url,
        devices: [{ id: 'aaaaaaaaaaaa', name: 'Phone', hash: 'x'.repeat(64), added: 1, used: 1 }],
      },
    });
    const R2 = req('remote').create({ config: conf2, luna: async () => ({ returnValue: true }) }, { linkQuietMs: 250, watchMs: 50 });
    R2.start();
    await sleep(1600);
    const quietConnects = connects;
    R2.stop();
    connects = 0;
    quiet.beating = true;
    const R3 = req('remote').create({ config: conf2, luna: async () => ({ returnValue: true }) }, { linkQuietMs: 250, watchMs: 50 });
    R3.start();
    await sleep(700);
    R3.stop();
    clearInterval(beat);
    quiet.server.closeAllConnections && quiet.server.closeAllConnections();
    quiet.server.close();
    ok(
      quietConnects >= 2 && connects === 1,
      'a quiet link is made again (' + quietConnects + ' links in 1.6 s); one with a heartbeat is kept (' + connects + ')'
    );
  }
});
