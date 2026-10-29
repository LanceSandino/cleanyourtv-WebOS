// The service's HTTP server (server.js): who may call the root API on 127.0.0.1:8765. Our apps and programs on the TV are answered;
// a web page is refused, by its origin, and also when DNS rebinding points its own name at 127.0.0.1 (the Host header still names it).
const http = require('http');
const { ok, req, run } = require('./lib');

run(async () => {
  const feature = {
    name: 'x',
    paths: ['/api/secret'],
    prefix: '/icon/',
    handle: (q, r) => {
      r.writeHead(200, { 'content-type': 'application/json' });
      r.end('{"token":"SECRET"}');
    },
  };
  const s = req('server').create({ features: () => [feature] });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  const get = headers =>
    new Promise(resolve =>
      http.get({ host: '127.0.0.1', port, path: '/api/secret', headers }, r => {
        let b = '';
        r.on('data', d => (b += d));
        r.on('end', () => resolve({ code: r.statusCode, body: b }));
      })
    );
  ok((await get({})).code === 200, 'a program on the TV (curl 127.0.0.1) is answered');
  ok((await get({ Host: 'localhost:' + port })).code === 200, 'localhost is answered');
  ok((await get({ Origin: 'null' })).code === 200, 'our apps (origin null) are answered');
  ok((await get({ Origin: 'https://evil.example' })).code === 403, 'a web page is refused by its origin');
  const rebound = await get({ Host: 'rebind.evil.example:' + port });
  ok(rebound.code === 403 && rebound.body.indexOf('SECRET') < 0, 'a page whose name was rebound to 127.0.0.1 is refused (Host)');
  ok((await get({ Host: '192.168.1.20:' + port })).code === 403, 'the API answers only under the loopback address');
  s.close();

  // with the API token required (apitoken.js): a page must send it, programs on the TV need none, a preflight is answered
  const guard = { allow: q => q.headers['x-cytv-token'] === 'T0K' };
  const g = req('server').create({ features: () => [feature], guard });
  await new Promise(r => g.listen(0, '127.0.0.1', r));
  const gp = g.address().port;
  const ask = (headers, method, p) =>
    new Promise(resolve => {
      const q = http.request({ host: '127.0.0.1', port: gp, path: p || '/api/secret', method: method || 'GET', headers }, r => {
        let b = '';
        r.on('data', d => (b += d));
        r.on('end', () => resolve({ code: r.statusCode, body: b, headers: r.headers }));
      });
      q.end();
    });
  const noTok = await ask({ Origin: 'null' });
  ok(
    noTok.code === 403 && noTok.body.indexOf('SECRET') < 0,
    'a page without the token (a sandboxed frame sends origin null too) is refused'
  );
  ok((await ask({ Origin: 'null', 'x-cytv-token': 'T0K' })).code === 200, 'our app with the token is answered');
  ok(
    (await ask({ Origin: 'file://com.webos.app.home-webos', 'x-cytv-token': 'T0K' })).code === 200,
    'the launcher on webOS 6 with the token too'
  );
  ok((await ask({})).code === 200, 'a program on the TV needs no token');
  const icon = await ask({ Origin: 'null' }, 'GET', '/icon/com.new.app'),
    iconPost = await ask({ Origin: 'null' }, 'POST', '/icon/com.new.app'),
    iconPath = await ask({ Origin: 'null' }, 'GET', '/icon/../api/secret');
  ok(
    icon.code === 200 && iconPost.code === 403 && iconPath.code === 403,
    "an app's icon is answered without the token (pages load it as an image), only as a GET of /icon/<id>: " +
      [icon.code, iconPost.code, iconPath.code].join()
  );
  const pre = await ask({ Origin: 'null', 'Access-Control-Request-Headers': 'x-cytv-token' }, 'OPTIONS');
  ok(
    pre.code === 204 && /x-cytv-token/.test(pre.headers['access-control-allow-headers'] || ''),
    'the preflight lets the token header through'
  );
  ok(
    (await ask({ Origin: 'file://com.cleanyourtv.live-webos', 'x-cytv-token': 'T0K' })).code === 403,
    'an app id that is not ours is refused'
  );
  g.close();
  // the bare "file://" of webOS 4's Chromium 53: one of our apps there, refused on a newer webOS
  let sdk = 4;
  const b = req('server').create({ features: () => [feature], guard, bareFile: () => !sdk || sdk < 5 });
  await new Promise(r => b.listen(0, '127.0.0.1', r));
  const bp = b.address().port;
  const bare = () =>
    new Promise(resolve => {
      http.get({ host: '127.0.0.1', port: bp, path: '/api/secret', headers: { Origin: 'file://', 'x-cytv-token': 'T0K' } }, r => {
        r.resume();
        r.on('end', () => resolve(r.statusCode));
      });
    });
  const on4 = await bare();
  sdk = 10;
  const on10 = await bare();
  sdk = 0;
  const unknown = await bare();
  ok(
    on4 === 200 && on10 === 403 && unknown === 200,
    'a bare file:// origin is our app on webOS 4 (and while the version is not known), refused on webOS 10: ' + [on4, on10, unknown].join()
  );
  b.close();
});
