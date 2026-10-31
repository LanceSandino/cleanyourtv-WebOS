// Plex and Stremio for Continue watching (plex.js, stremio.js through watch.js), against stand-ins for plex.tv, a Plex server and
// Stremio's link and library services: the TV sign-in with a code, the keys kept in the settings and never handed out, the partly
// watched items as cards, Plex's pictures through the service with the server's key, and unlinking.
const { ok, call, req, run, serve, memoryConfig, sleep } = require('./lib');

const body = q =>
  new Promise(res => {
    let b = '';
    q.on('data', d => (b += d));
    q.on('end', () => res(b));
  });

run(async () => {
  let pinPolls = 0,
    photoToken = '',
    identityToken = '';
  const pms = await serve((q, r) => {
    const json = o => (r.writeHead(200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    // who the server is, asked without a key (as Plex's /identity answers)
    if (q.url === '/identity') {
      identityToken = q.headers['x-plex-token'] || '';
      return json({ MediaContainer: { size: 0, machineIdentifier: 'MID' } });
    }
    // the picture route takes its key from the address, as Plex's does
    if (q.url.indexOf('/photo/:/transcode?') === 0) {
      photoToken = (/X-Plex-Token=([^&]+)/.exec(q.url) || [])[1] || '';
      r.writeHead(200, { 'content-type': 'image/jpeg' });
      return r.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    }
    if (q.headers['x-plex-token'] !== 'SRVTOK') return r.writeHead(401), r.end();
    if (q.url === '/status/sessions')
      return json({
        MediaContainer: {
          Metadata: [
            { type: 'movie', title: 'Elsewhere', Player: { platform: 'Chrome', state: 'playing' } },
            {
              type: 'episode',
              grandparentTitle: 'Show',
              parentIndex: 1,
              index: 2,
              title: 'Two',
              Player: { platform: 'webOS', state: 'paused' },
            },
          ],
        },
      });
    if (q.url === '/hubs/continueWatching/items')
      return json({
        MediaContainer: {
          Metadata: [
            {
              ratingKey: '11',
              type: 'episode',
              grandparentTitle: 'Show',
              parentIndex: 1,
              index: 2,
              title: 'Two',
              viewOffset: 600000,
              duration: 2400000,
              grandparentArt: '/library/metadata/1/art/9',
            },
            { ratingKey: '12', type: 'movie', title: 'A Film', year: 2001, viewOffset: 0, duration: 100 },
          ],
        },
      });
    r.writeHead(404);
    r.end();
  });
  // another Plex server on the network: answers, but is not the account's
  const other = await serve((q, r) => {
    r.writeHead(200, { 'content-type': 'application/json' });
    r.end(JSON.stringify({ MediaContainer: { machineIdentifier: 'SOMEONE-ELSE' } }));
  });
  const pmsPort = pms.url.split(':')[2];
  let pins = 0;
  const plextv = await serve(async (q, r) => {
    const json = (o, code) => (r.writeHead(code || 200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    // a new code is "201 Created" at plex.tv, not 200
    if (q.method === 'POST' && q.url === '/api/v2/pins')
      return await body(q), json([0, { id: 7, code: 'AB12' }, { id: 8, code: 'CD34' }, { id: 9, code: 'EF56' }][++pins], 201);
    // the first answer is a busy plex.tv, then not entered yet, then entered
    if (q.url === '/api/v2/pins/7') {
      if (++pinPolls === 1) return json({ errors: [{ code: 0, message: 'busy', status: 503 }] }, 503);
      return json(pinPolls < 3 ? { id: 7, authToken: null } : { id: 7, authToken: 'USERTOK' });
    }
    // Plex forgets a code once it expires
    if (q.url === '/api/v2/pins/8') return json({ errors: [{ code: 1020, message: 'Code not found or expired', status: 404 }] }, 404);
    // entered, but the answer is slow
    if (q.url === '/api/v2/pins/9') return setTimeout(() => json({ id: 9, authToken: 'USERTOK' }), 150);
    if (q.url.indexOf('/api/v2/resources') === 0 && q.headers['x-plex-token'] === 'USERTOK')
      return json([
        { name: 'A player', provides: 'client,player', owned: true, connections: [{ uri: other.url, local: true }] },
        {
          name: 'Home server',
          provides: 'server',
          owned: true,
          clientIdentifier: 'MID',
          accessToken: 'SRVTOK',
          httpsRequired: false,
          connections: [
            // its secure name (plex.direct) does not work here, as behind a router that blocks such names; the plain address does
            { protocol: 'https', address: '127.0.0.1', port: Number(pmsPort), uri: 'https://127.0.0.1:' + pmsPort, local: true },
            { protocol: 'http', address: '127.0.0.1', port: 1, uri: other.url, local: true },
            { protocol: 'https', address: '203.0.113.9', port: 32400, uri: 'https://203.0.113.9:1', local: false, relay: true },
          ],
        },
      ]);
    r.writeHead(404);
    r.end();
  });
  let reads = 0,
    sawKey = '';
  const st = await serve(async (q, r) => {
    const json = o => (r.writeHead(200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    if (q.url === '/api/v2/create?type=Create') return json({ result: { code: 'XYZ', link: 'https://link.stremio.com/XYZ' } });
    if (q.url === '/api/v2/read?type=Read&code=XYZ') return json(++reads < 2 ? { error: 'not yet' } : { result: { authKey: 'STKEY' } });
    if (q.url === '/api/datastoreGet') {
      sawKey = JSON.parse(await body(q)).authKey;
      return json({
        result: [
          { _id: 'tt1', name: 'Movie', type: 'movie', state: { timeOffset: 100, duration: 400, lastWatched: '2026-10-26' } },
          {
            _id: 'tt2',
            name: 'Series',
            type: 'series',
            state: { timeOffset: 5, duration: 10, lastWatched: '2026-10-27', video_id: 'tt2:3:4' },
          },
          { _id: 'tt3', name: 'Removed', type: 'movie', removed: true, state: { timeOffset: 5, duration: 10 } },
          { _id: 'tt4', name: 'Not started', type: 'movie', state: { timeOffset: 0 } },
        ],
      });
    }
    r.writeHead(404);
    r.end();
  });
  process.env.CYTV_PLEXTV = plextv.url;
  process.env.CYTV_STREMIO_LINK = st.url;
  process.env.CYTV_STREMIO_API = st.url;
  process.env.CYTV_TELEMACHUS = 'http://127.0.0.1:9'; // no Telemachus here
  const config = memoryConfig({});
  const w = req('watch').create({ config, luna: async () => ({ returnValue: true }), feature: () => null, pollMs: 50 });

  // ---- Plex ----
  const pl = (await call(w, '/api/watch/link', 'POST', { service: 'plex' })).j;
  ok(pl.code === 'AB12' && pl.url === 'plex.tv/link', 'Plex: the TV shows a code for plex.tv/link');
  ok((await call(w, '/api/watch/accounts')).j.plex.state === 'waiting', 'Plex: waiting until the code is entered');
  await sleep(600);
  const acc = (await call(w, '/api/watch/accounts')).j;
  ok(acc.plex.linked && acc.plex.server === 'Home server' && acc.plex.state === 'linked', "Plex: linked to the owner's server");
  ok(pinPolls === 3, 'Plex: a busy plex.tv is asked again, not taken as a failed link (' + pinPolls + ' asks)');
  ok(
    config.get().watchAccounts.plex.token === 'USERTOK' && config.get().watchAccounts.plex.server.token === 'SRVTOK',
    'Plex: the keys are kept in the settings'
  );
  ok(
    config.get().watchAccounts.plex.server.uri === pms.url && identityToken === '',
    "Plex: the server's first address that answers as that server (here plain http when its secure name fails), asked without a key"
  );
  ok(JSON.stringify(acc).indexOf('TOK') < 0, 'Plex: the account status never carries a key');
  const pnow = await w.services.plex.now();
  ok(
    !!pnow && pnow.show === 'Show' && pnow.season === 1 && pnow.episode === 2 && pnow.title === 'Two' && pnow.state === 'paused',
    "Plex: what plays now, the session on an LG TV first (the server's /status/sessions): " + JSON.stringify(pnow)
  );

  // ---- Stremio ----
  const sl = (await call(w, '/api/watch/link', 'POST', { service: 'stremio' })).j;
  ok(sl.code === 'XYZ' && sl.url === 'link.stremio.com/XYZ', 'Stremio: the TV shows the link to open');
  await sleep(400);
  ok(
    config.get().watchAccounts.stremio.authKey === 'STKEY' && (await call(w, '/api/watch/accounts')).j.stremio.linked,
    'Stremio: linked, the key kept in the settings'
  );

  // ---- the cards ----
  const rows = (await call(w, '/api/watch/rows')).j.items;
  const keys = rows.map(i => i.key);
  ok(
    keys.join() === 'plex-11,plex-12,stremio-tt2,stremio-tt1',
    "Plex's own Continue Watching, then Stremio's partly watched, newest first (" + keys.join() + ')'
  );
  const byKey = k => rows.filter(i => i.key === k)[0];
  const p = byKey('plex-11'),
    s2 = byKey('stremio-tt2');
  ok(
    byKey('plex-12').sub === '2001' && byKey('plex-12').progress === null && !byKey('plex-12').img,
    'a Plex film not started: its year, no bar, no picture'
  );
  ok(
    p.title === 'Show' && p.sub === 'S1 E2 · Two' && p.progress === 0.25 && p.launch.id === 'cdp-30',
    'a Plex episode card: the show, the episode, how far it got; it opens Plex'
  );
  ok(
    s2.title === 'Series' && s2.sub === 'S3 E4' && s2.progress === 0.5 && s2.launch.id === 'io.strem.tv',
    'a Stremio card: the series, the episode, how far it got; it opens Stremio'
  );
  ok(sawKey === 'STKEY', "Stremio's library is read with the linked key");
  ok(
    JSON.stringify(rows).indexOf('TOK') < 0 && JSON.stringify(rows).indexOf('STKEY') < 0 && /^\/api\/watch\/img\/[0-9a-f]{16}$/.test(p.img),
    'no key reaches the page; pictures are ids'
  );
  // the Plex picture, through the service, with the server's key added there (never by the page)
  const got = await call(w, p.img);
  ok(got.code === 200 && photoToken === 'SRVTOK', "a Plex picture is fetched by the service with the server's key");

  // ---- unlinking ----
  await call(w, '/api/watch/unlink', 'POST', { service: 'plex' });
  await call(w, '/api/watch/unlink', 'POST', { service: 'stremio' });
  const after = config.get().watchAccounts || {};
  ok(!(after.plex && after.plex.token) && !after.stremio, 'unlinking forgets the keys');
  ok((await call(w, '/api/watch/link', 'POST', { service: 'nope' })).code === 400, 'an unknown service is refused');

  // a code Plex no longer knows (expired) ends the wait, as expired, not as an error
  ok((await call(w, '/api/watch/link', 'POST', { service: 'plex' })).j.code === 'CD34', 'Plex: a new code');
  await sleep(200);
  ok((await call(w, '/api/watch/accounts')).j.plex.state === 'expired', 'Plex: a code plex.tv no longer knows has expired');
  // unlinked while plex.tv's answer is on its way: the TV does not link after all
  await call(w, '/api/watch/link', 'POST', { service: 'plex' });
  await sleep(100);
  await call(w, '/api/watch/unlink', 'POST', { service: 'plex' });
  await sleep(300);
  const late = (await call(w, '/api/watch/accounts')).j.plex;
  ok(
    !late.linked && late.state === 'idle' && !(config.get().watchAccounts.plex || {}).token,
    'Plex: an answer that arrives after unlinking links nothing'
  );
  for (const x of [pms, other, plextv, st]) x.server.close();
});
