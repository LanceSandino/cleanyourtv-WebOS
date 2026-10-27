// The service's HTTP server on 127.0.0.1. Each feature answers the paths it lists (feature.paths, exact) or the paths that begin
// with its prefix (feature.prefix); a feature's handle(req, res, path, body) may be async, and an error in it becomes a 500 reply.
// Who may call: our own apps (local files; their requests carry Origin "null", or "file://<app id>-webos" on webOS 6) and programs
// on the TV (curl, scripts: no Origin). A web page opened in the TV's browser has an http(s) origin and is refused, and so is a request
// whose Host is not the loopback address (DNS rebinding). A sandboxed frame sends origin null like our apps: our apps also send the API
// token (apitoken.js), which a page cannot read, and once that works on the TV a request with origin null and no token is refused.
const http = require('http');
const web = require('./web');

const OUR_APPS = /^file:\/\/(com\.webos\.app\.home|com\.cleanyourtv\.(manager|picker|notify))-webos$/;
// DNS rebinding: a web page whose own name was made to point at 127.0.0.1 still sends that name as Host. Only requests addressed to
// the loopback address or localhost are answered; a request without Host comes from a program on the TV.
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

function create(opts) {
  const features = opts.features; // a function returning the loaded features, in order
  const guard = opts.guard || null; // apitoken.js: tells our apps apart from a web page that also sends origin null
  const route = u => {
    for (const f of features()) {
      if (f.paths && f.paths.indexOf(u) >= 0) return f;
      if (f.prefix && u.indexOf(f.prefix) === 0) return f;
    }
    return null;
  };
  return http.createServer(async (req, res) => {
    const host = req.headers.host;
    if (host !== undefined && !LOOPBACK_HOST.test(host)) {
      console.log('refused host ' + String(host).slice(0, 60) + ' ' + req.method + ' ' + req.url.slice(0, 60));
      return web.json(res, { error: 'host not allowed' }, 403);
    }
    let origin = req.headers.origin;
    const rawOrigin = origin;
    if (OUR_APPS.test(origin || '')) origin = 'null';
    if (origin !== undefined && origin !== 'null') {
      console.log('refused origin ' + origin + ' ' + req.method + ' ' + req.url.slice(0, 60));
      return web.json(res, { error: 'origin not allowed' }, 403);
    }
    // Chromium 79 (webOS 6) compares the answer with its own serialisation of a file origin, so for those origins echoing fails
    // CORS: answer * there. Only origins accepted above get this far.
    if (origin === 'null') {
      res.setHeader('Access-Control-Allow-Origin', rawOrigin === 'null' ? 'null' : '*');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-cytv-token');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    if (origin === 'null' && guard && !guard.allow(req)) {
      console.log('refused a page without the API token ' + req.method + ' ' + req.url.split('?')[0].slice(0, 60));
      return web.json(res, { error: 'token required' }, 403);
    }
    const u = req.url.split('?')[0];
    const f = route(u);
    if (!f) return web.notFound(res);
    try {
      return await f.handle(req, res, u, web.body);
    } catch (e) {
      console.error(f.name + ': ' + u + ': ' + ((e && e.stack) || e));
      if (!res.headersSent) web.json(res, { error: String(e) }, 500);
      else res.end();
    }
  });
}

module.exports = { create };
