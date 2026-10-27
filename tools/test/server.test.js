// The service's HTTP server (server.js): who may call the root API on 127.0.0.1:8765. Our apps and programs on the TV are answered;
// a web page is refused, by its origin, and also when DNS rebinding points its own name at 127.0.0.1 (the Host header still names it).
const http = require('http');
const { ok, req, run } = require('./lib');

run(async () => {
  const feature = {
    name: 'x',
    paths: ['/api/secret'],
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
});
