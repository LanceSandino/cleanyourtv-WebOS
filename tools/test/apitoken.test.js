// The API token (apitoken.js): a random token for root only, handed to our apps as cytv-token.js, and required from pages only once
// every app got it and a page sent it back (audit F1: a sandboxed frame of a web page sends origin null, like our apps).
const fs = require('fs'),
  path = require('path');
const { ok, run, tmp } = require('./lib');
process.env.CYTV_APPS_DIR = path.join(tmp, 'applications');
const T = require(path.join(__dirname, '..', '..', 'helper', 'apitoken.js'));
const P = require(path.join(__dirname, '..', '..', 'helper', 'paths.js'));
const nc = require(path.join(__dirname, '..', '..', 'helper', 'netcompat.js'));

run(async () => {
  const dirs = [P.APP, path.join(P.APPS, 'com.cleanyourtv.manager'), path.join(P.APPS, 'com.cleanyourtv.picker')];
  const tokenFile = path.join(process.env.CYTV_DIR, 'api-token');
  const page = tok => ({ headers: tok === undefined ? {} : { 'x-cytv-token': tok } });

  const a = T.create();
  const tok = a.token();
  ok(/^[0-9a-f]{64}$/.test(tok) && (fs.statSync(tokenFile).mode & 0o777) === 0o600, 'a random token, readable by root only');
  ok(a.allow(page()) && a.allow(page(tok)) && !a.enforcing(), 'not required while the apps may not have it yet');
  ok(!a.writeAll(), 'the apps are not there: nothing is required');

  for (const d of dirs) nc.mkdirp(d);
  ok(a.writeAll(), "written into the launcher, the manager and the picker (a TV that keeps LG's Home has no overlay to write)");
  const overlay = path.join(process.env.CYTV_DIR, 'home-overlay');
  fs.mkdirSync(overlay);
  ok(
    a.writeAll() && fs.readFileSync(path.join(overlay, 'cytv-token.js'), 'utf8').indexOf(tok) >= 0,
    "the copy mounted over LG's Home gets the token too, or the launcher could never send it"
  );
  ok(
    dirs.every(d => fs.readFileSync(path.join(d, 'cytv-token.js'), 'utf8') === "var CYTV_TOKEN = '" + tok + "';\n"),
    'each app gets cytv-token.js with the token'
  );
  ok(a.allow(page()) && !a.enforcing(), 'still not required until a page sent it back');
  ok(a.allow(page(tok)) && a.enforcing(), 'a page sent the right token: required from now on');
  ok(!a.allow(page()) && !a.allow(page('0'.repeat(64))) && a.allow(page(tok)), 'a page without the token, or with a wrong one, is refused');

  const b = T.create(); // the next start of the service
  ok(b.token() === tok && b.enforcing(), 'the token and the requirement stay over a restart');
  fs.unlinkSync(path.join(dirs[2], 'cytv-token.js'));
  fs.rmdirSync(dirs[2]); // the picker app removed
  ok(!b.writeAll() && !b.enforcing() && b.allow(page()), 'an app that could not get the token: not required, so it keeps working');

  const fresh = path.join(tmp, 'new-launcher');
  fs.mkdirSync(fresh);
  ok(b.writeTo(fresh) && fs.existsSync(path.join(fresh, 'cytv-token.js')), 'a new launcher gets the token before it is swapped in');
});
