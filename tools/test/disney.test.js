// Disney+ for Continue watching (disney.js and wsclient.js through watch.js), against stand-ins for disneyplus.com/begin, Disney's API
// and its socket: the TV sign-in with a code (the device registered with the key read from the sign-in page, the socket authenticated,
// the code, Disney's message that it was entered, the trade for the account's keys), the keys kept in the settings and never handed out,
// a key renewed when it ran out, the partly watched items as cards that open the film or the series in the Disney+ app, LG's own
// Disney+ row left out once linked, a dropped socket taken up again while the code waits, an expired code, and unlinking.
// Every title and id here is made up.
const crypto = require('crypto');
const { ok, call, req, run, serve, memoryConfig, sleep } = require('./lib');

const body = q =>
  new Promise(res => {
    let b = '';
    q.on('data', d => (b += d));
    q.on('end', () => res(b));
  });
const SERIES = '11111111-2222-4333-8444-555555555555',
  EPISODE = '22222222-3333-4444-8555-666666666666',
  FILM = '33333333-4444-4555-8666-777777777777',
  NEXT = '44444444-5555-4666-8777-888888888888',
  NEXT_SERIES = '55555555-6666-4777-8888-999999999999',
  IMG = '66666666-7777-4888-8999-aaaaaaaaaaaa';

// the server's side of a WebSocket: frames from the client are masked, the server's are not
function serverFrame(opcode, payload, fin) {
  const p = Buffer.from(payload);
  const head =
    p.length < 126
      ? Buffer.from([(fin === false ? 0 : 0x80) | opcode, p.length])
      : Buffer.from([0x80 | opcode, 126, p.length >> 8, p.length & 255]);
  return Buffer.concat([head, p]);
}
function readFrames(state, d, onFrame) {
  state.buf = Buffer.concat([state.buf, d]);
  while (state.buf.length >= 6) {
    let len = state.buf[1] & 0x7f,
      off = 2;
    if (len === 126) {
      len = state.buf.readUInt16BE(2);
      off = 4;
    }
    if (state.buf.length < off + 4 + len) return;
    const m = state.buf.slice(off, off + 4),
      p = Buffer.alloc(len);
    for (let i = 0; i < len; i++) p[i] = state.buf[off + 4 + i] ^ m[i % 4];
    const op = state.buf[0] & 0x0f;
    state.buf = state.buf.slice(off + 4 + len);
    onFrame(op, p);
  }
}

run(async () => {
  const seen = { auth: [], protocol: '', pongs: 0, exchanges: 0, refreshes: 0, keyAsked: 0, cwAuth: '', registerAuth: '', plateAuth: '' };
  let socks = [],
    plates = 0,
    refuseRefresh = false;
  const web = await serve((q, r) => {
    if (q.url === '/begin') {
      seen.keyAsked++;
      r.writeHead(200, { 'content-type': 'text/html' });
      return r.end('<html><script>window.cfg={"clientApiKey":"WEBKEY-0123456789abcdef","other":1}</script></html>');
    }
    r.writeHead(404);
    r.end();
  });
  const api = await serve(async (q, r) => {
    const json = (o, code) => (r.writeHead(code || 200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    const auth = q.headers.authorization || '';
    const sdk = token => ({ data: {}, extensions: { sdk: { token } } });
    if (q.method === 'POST') {
      const b = JSON.parse(await body(q));
      if (q.url === '/graph/v1/device/graphql' && b.operationName === 'registerDevice') {
        seen.registerAuth = auth;
        return json(sdk({ accessToken: 'DEVTOK', refreshToken: 'DEVREF', expiresIn: 14400 }));
      }
      if (q.url === '/graph/v1/device/graphql' && b.operationName === 'refreshToken') {
        seen.refreshes++;
        if (refuseRefresh || auth !== 'Bearer WEBKEY-0123456789abcdef' || b.variables.input.refreshToken !== 'ACCREF')
          return json({ errors: [{ code: 'invalid_grant', description: 'refresh token invalid' }] }, 400);
        return json(sdk({ accessToken: 'ACCTOK2', refreshToken: 'ACCREF2', expiresIn: 14400 }));
      }
      if (q.url === '/v1/public/graphql' && /activeSession/.test(b.query))
        return json({ data: { activeSession: { sessionId: 'SESSION1' } } });
      if (q.url === '/v1/public/graphql' && b.operationName === 'requestLicensePlate') {
        seen.plateAuth = auth;
        plates++;
        // the third code expires at once
        return json({
          data: {
            requestLicensePlate: {
              licensePlate: ['', '12345678', '23456789', '87654321'][plates],
              expiresInSeconds: plates === 3 ? 0.2 : 600,
            },
          },
        });
      }
      if (q.url === '/v1/public/graphql' && b.operationName === 'exchangeAccountDelegationRefreshToken') {
        seen.exchanges++;
        const i = b.variables.input;
        if (auth !== 'Bearer DEVTOK' || i.accountDelegationRefreshToken !== 'ADRT' || i.deviceRefreshToken !== 'DEVREF')
          return json({ errors: [{ code: 'unauthorized' }] }, 401);
        // a key that has already run out: the cards renew it first
        return json(sdk({ accessToken: 'ACCTOK', refreshToken: 'ACCREF', expiresIn: 1 }));
      }
    }
    // the newer feed version is not there on this stand-in: the older one answers
    if (q.url === '/explore/v1.21/partner/continueWatching') return json({ errors: [{ code: 'not-found' }] }, 404);
    if (q.url === '/explore/v1.4/partner/continueWatching') {
      seen.cwAuth = auth;
      if (auth !== 'Bearer ACCTOK2') return json({ errors: [{ code: 'access-token.invalid' }] }, 401);
      return json({
        data: {
          continueWatching: {
            items: [
              {
                type: 'episode',
                id: EPISODE,
                title: 'Harbor Lights',
                episodicMetadata: { seasonNumber: 2, episodeNumber: 3, episodeTitle: 'Low Tide' },
                watchHistory: { progressPercentage: 40 },
                browse: { deeplinkId: 'entity-' + SERIES },
                artwork: { standard: { tile: { '1.78': { imageId: IMG } } } },
              },
              {
                type: 'movie',
                id: FILM,
                title: 'Paper Kites',
                watchHistory: { progressPercentage: 25 },
                browse: { deeplinkId: 'entity-' + FILM },
                artwork: { standard: { background: { '1.78': { imageId: IMG } } } },
              },
              {
                type: 'episode',
                id: NEXT,
                title: 'Night Market',
                episodicMetadata: { seasonNumber: 1, episodeNumber: 4 },
                watchHistory: { progressPercentage: 0 },
                browse: { deeplinkId: 'entity-' + NEXT_SERIES },
                artwork: { standard: { tile: { '1.78': { imageId: 'not-an-id' } } } },
              },
              { type: 'extra', id: '77777777-8888-4999-8aaa-bbbbbbbbbbbb', title: 'A Trailer' },
              { type: 'movie', id: '../../etc', title: 'Bad id' },
            ],
          },
        },
      });
    }
    r.writeHead(404);
    r.end();
  });
  // Disney's socket: the client's authentication frame first; a ping, then "authenticated" in two parts (a continued message)
  api.server.on('upgrade', (q, s) => {
    seen.protocol = q.headers['sec-websocket-protocol'] || '';
    const accept = crypto
      .createHash('sha1')
      .update(q.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    s.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
        accept +
        '\r\nSec-WebSocket-Protocol: vnd.dss.edge+json\r\n\r\n'
    );
    const st = { buf: Buffer.alloc(0) };
    socks.push(s);
    s.on('error', () => {});
    s.on('data', d =>
      readFrames(st, d, (op, p) => {
        if (op === 10) return seen.pongs++;
        if (op !== 1) return;
        const m = JSON.parse(p.toString());
        if (m.type !== 'urn:dss:event:edge:sdk:authentication:v2') return;
        seen.auth.push(m);
        if (m.data.accessToken !== 'DEVTOK') {
          s.write(
            serverFrame(1, JSON.stringify({ type: 'urn:dss:transport:edge:event:unauthenticated', data: { code: 'access-token.invalid' } }))
          );
          return s.end(serverFrame(8, Buffer.from([0x0f, 0xa1])));
        }
        s.write(serverFrame(9, 'hi'));
        const ok1 = JSON.stringify({ data: null, type: 'urn:dss:transport:edge:event:authenticated' });
        s.write(serverFrame(1, ok1.slice(0, 10), false));
        s.write(serverFrame(0, ok1.slice(10)));
      })
    );
  });
  // what Disney sends once the code was entered (twice, as Disney does: the v2 message and the older one)
  const enter = () =>
    socks
      .filter(s => !s.destroyed)
      .forEach(s => {
        const data = { refreshToken: 'ADRT', actionGrant: 'GRANT', offDeviceRedemptionFlow: 'LOGIN' };
        s.write(serverFrame(1, JSON.stringify({ type: 'urn:dss:event:offDeviceLogin:refresh:v2', data })));
        s.write(serverFrame(1, JSON.stringify({ type: 'urn:dss:event:offDeviceLogin:refresh', data })));
      });

  process.env.CYTV_DISNEY_WEB = web.url;
  process.env.CYTV_DISNEY_API = api.url;
  process.env.CYTV_DISNEY_EDGE = api.url.replace(/^http/, 'ws') + '/c800b6/connection';
  process.env.CYTV_TELEMACHUS = 'http://127.0.0.1:9'; // no Telemachus here
  const config = memoryConfig({});
  // LG's own Disney+ row (its picks of the season), and YouTube's
  const lgLuna = async (uri, payload, opts) => {
    if (/db\/find$/.test(uri) && opts && opts.as === 'com.webos.service.contentminer')
      return {
        returnValue: true,
        results: ['com.disney.disneyplus-prod', 'youtube.leanback.v4'].map(app => ({
          appId: app,
          contents: [
            {
              _id: app + '1',
              type: 'content',
              titleText: 'LG pick for ' + app,
              image: { url: 'https://example.com/' + app + '.jpg' },
              onClick: { contentId: 'id=' + app, targetAppId: app },
            },
          ],
        })),
      };
    return { returnValue: true };
  };
  const w = req('watch').create({ config, luna: lgLuna, feature: () => null, retryMs: 50 });
  const lgDisney = (await call(w, '/api/watch/rows')).j.items.filter(i => i.source === 'lg' && i.app === 'com.disney.disneyplus-prod');
  ok(lgDisney.length === 1, "not linked: LG's own Disney+ row is shown");

  // ---- linking ----
  const ln = (await call(w, '/api/watch/link', 'POST', { service: 'disney' })).j;
  ok(ln.code === '12345678' && ln.url === 'disneyplus.com/begin', 'Disney+: the TV shows a code for disneyplus.com/begin');
  ok(
    seen.keyAsked === 1 && seen.registerAuth === 'Bearer WEBKEY-0123456789abcdef' && seen.plateAuth === 'Bearer DEVTOK',
    "the device is registered with the key read from Disney's sign-in page, the code asked for with the device's key"
  );
  const a = seen.auth[0] || { data: {} };
  ok(
    seen.protocol === 'vnd.dss.edge+json' &&
      a.data.accessToken === 'DEVTOK' &&
      a.data.sessionId === 'SESSION1' &&
      a.subject === 'sessionId=SESSION1' &&
      a.data.application.id === 'disneyplus' &&
      a.data.sdk.clientId === 'disney-svod-3d9324fc',
    "the socket is opened with Disney's protocol and authenticated with the device's key and session"
  );
  ok(seen.pongs === 1, "the server's ping is answered");
  ok((await call(w, '/api/watch/accounts')).j.disney.state === 'waiting', 'Disney+: waiting until the code is entered');

  // the socket drops while the code waits: taken up again
  socks.forEach(s => s.destroy());
  await sleep(300);
  ok(seen.auth.length === 2, 'a dropped socket is opened and authenticated again while the code waits');
  enter();
  await sleep(300);
  const acc = (await call(w, '/api/watch/accounts')).j;
  ok(acc.disney.linked && acc.disney.state === 'linked', 'Disney+: linked once Disney says the code was entered');
  ok(seen.exchanges === 1, "Disney's two messages for one code trade it once (" + seen.exchanges + ')');
  ok(config.get().watchAccounts.disney.refreshToken === 'ACCREF', 'the refresh key is kept in the settings');
  ok(JSON.stringify(acc).indexOf('TOK') < 0 && JSON.stringify(acc).indexOf('REF') < 0, 'the account status never carries a key');

  // ---- the cards ----
  const rows = (await call(w, '/api/watch/rows')).j.items;
  const mine = rows.filter(i => i.source === 'disney');
  ok(
    seen.refreshes === 1 && seen.cwAuth === 'Bearer ACCTOK2' && config.get().watchAccounts.disney.refreshToken === 'ACCREF2',
    'a key that ran out is renewed with the refresh key (and the new refresh key kept) before the feed is read'
  );
  ok(
    mine.map(i => i.key).join() === ['disney-' + EPISODE, 'disney-' + FILM, 'disney-' + NEXT].join(),
    "Disney's partly watched in its order; a trailer and a malformed id are left out (" + mine.map(i => i.title).join() + ')'
  );
  const ep = mine[0],
    film = mine[1],
    next = mine[2];
  ok(
    ep.title === 'Harbor Lights' && ep.sub === 'S2 E3 · Low Tide' && ep.progress === 0.4 && ep.group === 'disney:' + SERIES && !ep.next,
    'an episode card: the series, the episode, how far it got; removing it removes the series'
  );
  ok(
    ep.launch.id === 'com.disney.disneyplus-prod' &&
      ep.launch.params.contentTarget ===
        'distributionPartner=lg&programType=episode&contentId=' + EPISODE + '&page=play&id=' + EPISODE + '&type=episode&contentType=Full',
    'an episode card opens that episode playing in the Disney+ app'
  );
  ok(
    film.sub === '' &&
      film.progress === 0.25 &&
      film.launch.params.contentTarget ===
        'distributionPartner=lg&programType=movie&contentId=' + FILM + '&page=play&id=' + FILM + '&type=movie&contentType=Full',
    'a film card opens the film playing'
  );
  ok(
    next.next === true &&
      next.progress === null &&
      next.img === '' &&
      next.launch.params.contentTarget.indexOf('&page=play&id=' + NEXT + '&') > 0,
    "Disney's next episode: marked next, no bar, no picture from a bad id, opens that next episode playing"
  );
  ok(/^\/api\/watch\/img\/[0-9a-f]{16}$/.test(ep.img) && /^\/api\/watch\/img\//.test(film.img), 'pictures are ids');
  ok(JSON.stringify(rows).indexOf('TOK') < 0 && JSON.stringify(rows).indexOf('WEBKEY') < 0, 'no key reaches the page');
  ok(
    !rows.some(i => i.source === 'lg' && i.app === 'com.disney.disneyplus-prod') &&
      rows.some(i => i.source === 'lg' && i.app === 'youtube.leanback.v4'),
    "linked: LG's own Disney+ row is left out, the other apps' rows stay"
  );

  // ---- linking again while linked (as after Disney asked for it): the new code is shown, the old keys stay until it is entered ----
  const again = (await call(w, '/api/watch/link', 'POST', { service: 'disney' })).j;
  const agAcc = (await call(w, '/api/watch/accounts')).j.disney;
  ok(
    again.code === '23456789' && agAcc.state === 'waiting' && agAcc.code === '23456789' && agAcc.linked,
    'linking again shows the new code (' + agAcc.state + ')'
  );
  enter();
  await sleep(300);
  ok((await call(w, '/api/watch/accounts')).j.disney.state === 'linked' && seen.exchanges === 2, 'and links again once it is entered');

  // ---- a refresh key Disney no longer takes (a changed password): the account says to link again ----
  refuseRefresh = true;
  const d = req('disney').create({
    config: memoryConfig({ watchAccounts: { disney: { token: 'OLD', refreshToken: 'ACCREF', until: 0 } } }),
  });
  ok((await d.items(() => '')).length === 0, 'a refused refresh key gives no cards');
  const ds = d.status();
  ok(ds.linked && ds.state === 'linked' && /linked again/.test(ds.error), 'and the account says the TV has to be linked again');
  refuseRefresh = false;

  // ---- unlinking ----
  await call(w, '/api/watch/unlink', 'POST', { service: 'disney' });
  ok(!(config.get().watchAccounts || {}).disney && !(await call(w, '/api/watch/accounts')).j.disney.linked, 'unlinking forgets the keys');

  // a code that expires ends the wait, as expired
  ok((await call(w, '/api/watch/link', 'POST', { service: 'disney' })).j.code === '87654321', 'Disney+: a new code');
  await sleep(400);
  ok((await call(w, '/api/watch/accounts')).j.disney.state === 'expired', 'Disney+: a code that ran out has expired');
  // the code is entered after it expired, or after unlinking: nothing is linked
  enter();
  await sleep(200);
  ok(!(config.get().watchAccounts || {}).disney && seen.exchanges === 2, 'a message after the code expired links nothing');

  // a socket that refuses the device: an error, not a code
  const wsc = req('wsclient');
  const refused = await new Promise(res => {
    const s = wsc.open(process.env.CYTV_DISNEY_EDGE, { protocol: 'vnd.dss.edge+json' });
    let said = '';
    s.on('open', () => s.send(JSON.stringify({ type: 'urn:dss:event:edge:sdk:authentication:v2', data: { accessToken: 'WRONG' } })));
    s.on('message', m => (said = JSON.parse(m).type));
    s.on('close', code => res({ said, code }));
  });
  ok(
    refused.said === 'urn:dss:transport:edge:event:unauthenticated' && refused.code === 4001,
    "wsclient: the server's message and its close code arrive (" + refused.code + ')'
  );
  // a server that answers the upgrade with an ordinary page
  const plain = require('net').createServer(c => c.on('data', () => c.end('HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nhi')));
  await new Promise(r => plain.listen(0, '127.0.0.1', r));
  const nobody = await new Promise(res => {
    const s = wsc.open('ws://127.0.0.1:' + plain.address().port + '/x', {});
    s.on('error', () => {});
    s.on('close', (code, reason) => res(code + ' ' + reason));
  });
  plain.close();
  ok(/^1002 refused/.test(nobody), 'wsclient: a server that does not switch to WebSocket is refused (' + nobody + ')');
  for (const x of [web, api]) x.server.close();
  socks.forEach(s => s.destroy());
});
