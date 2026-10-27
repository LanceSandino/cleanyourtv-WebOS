// The API token: what tells our own apps apart from a web page on the TV. Our apps' requests carry the origin "null" (a local file;
// "file://<app id>-webos" on webOS 6, which server.js treats the same), and so does a sandboxed frame of any web page, so the origin
// alone cannot refuse a page. The service keeps a random token (D/api-token, root only) and writes it as cytv-token.js
// (var CYTV_TOKEN = '...') into the launcher (D/app) and the manager and picker apps, which load it and send it in the header
// x-cytv-token; a web page cannot read those files. Programs on the TV (curl, scripts) send no origin and need no token.
// It is enforced only once it is known to work on this TV, so a TV where the token cannot be handed out keeps working: after every
// app got the file (written at each start and into a new launcher before it is swapped in) and a request with the right token came
// from a page. Enforcing is remembered (D/api-token-on) and dropped again when a later write fails.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const P = require('./paths');

const FILE = 'cytv-token.js',
  HEADER = 'x-cytv-token';
const TOKEN = P.D + '/api-token',
  ON = P.D + '/api-token-on';
// the folders of our apps that call the service: the launcher (D/app), the manager, the picker. The launcher runs from the copy
// stage-home.sh mounts over LG's Home (D/home-overlay), made when Home is taken over: it gets the token too, where it exists (a TV
// that keeps LG's Home has none), or the launcher could never send it.
const appDirs = () => [P.APP, path.join(P.APPS, 'com.cleanyourtv.manager'), path.join(P.APPS, 'com.cleanyourtv.picker')];
const optionalDirs = () => [P.HOME_OVERLAY];

function create() {
  let token = '',
    writesOk = false,
    on = false;
  try {
    token = fs.readFileSync(TOKEN, 'utf8').trim();
  } catch (_) {}
  if (!/^[0-9a-f]{64}$/.test(token)) {
    token = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(TOKEN, token + '\n', { mode: 0o600 });
  }
  try {
    fs.chmodSync(TOKEN, 0o600);
  } catch (_) {}
  on = fs.existsSync(ON);

  const script = () => "var CYTV_TOKEN = '" + token + "';\n";
  // into one folder (a new launcher before it is swapped in); true when it is there
  function writeTo(dir) {
    try {
      if (!fs.existsSync(dir)) return false;
      const f = path.join(dir, FILE);
      fs.writeFileSync(f + '.tmp', script(), { mode: 0o644 });
      fs.renameSync(f + '.tmp', f);
      return true;
    } catch (e) {
      console.error('api token: could not write ' + dir + ': ' + e.message);
      return false;
    }
  }
  // into every app; a folder that could not be written stops the enforcing, so that app keeps working
  function writeAll() {
    writesOk = appDirs().map(writeTo).every(Boolean) && optionalDirs().every(d => !fs.existsSync(d) || writeTo(d));
    if (!writesOk && on) setOn(false);
    return writesOk;
  }
  function setOn(v) {
    on = v;
    try {
      if (v) fs.writeFileSync(ON, '1\n');
      else fs.unlinkSync(ON);
    } catch (_) {}
    console.log('api token: ' + (v ? 'required from our apps from now on' : 'not required (an app may not have it)'));
  }
  const valid = req => {
    const got = Buffer.from(String((req.headers && req.headers[HEADER]) || ''));
    const want = Buffer.from(token);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  };
  // may this request from a page (origin null or one of our apps) go on?
  function allow(req) {
    if (valid(req)) {
      if (!on && writesOk) setOn(true);
      return true;
    }
    return !on;
  }
  return { allow, writeAll, writeTo, header: HEADER, file: FILE, enforcing: () => on, token: () => token };
}

module.exports = { create, FILE, HEADER };
