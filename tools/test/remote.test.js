// Phone remote (remote.js): pairing with the code shown on the TV (five wrong codes close it), a key per phone kept only as its hash,
// the presses reaching LG's network input (sendSpecialKey or a key code; the pointer on a stand-in socket), the volume LG's audio
// service, typing and the apps, the
// LAN server only for the home network and only from its own page, and a phone removed on the TV losing access.
const http = require('http'),
  net = require('net'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const { ok, call, sleep, req, memoryConfig, run } = require('./lib');

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
  let got = '';
  const input = net.createServer(c => c.on('data', d => (got += d.toString())));
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
      req('remote').homeAddress('192.168.4.30') &&
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
        [A + 'mute', { mute: true }],
      ]),
    "the volume goes to LG's audio service (which drives a soundbar on eARC), and Mute switches the mute it reads: " + JSON.stringify(calls)
  );
  calls.length = 0;
  await lan('POST', '/move', { dx: 12.6, dy: -900 }, key);
  await lan('POST', '/click', {}, key);
  await lan('POST', '/scroll', { dy: 3 }, key);
  await sleep(100);
  ok(
    got === 'type:move\ndx:13\ndy:-300\ndown:0\n\ntype:scroll\ndx:0\ndy:3\n\n' &&
      JSON.stringify(calls) === JSON.stringify([[N + 'sendSpecialKey', { key: 'ENTER' }]]),
    "the pointer moves and scrolls through LG's pointer socket (a move is held to 300 px); a tap is OK: " + JSON.stringify(got)
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
});
