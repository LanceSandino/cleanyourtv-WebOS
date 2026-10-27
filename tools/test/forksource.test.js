// The fork's source: updates, themes, the compatibility list, the installer and the Homebrew Channel listing all come from
// LanceSandino/cleanyourtv-WebOS, never from the upstream repository, unless D/source names another one on purpose.
const fs = require('fs'),
  path = require('path');
const { ok, req, run, root } = require('./lib');

const FORK = 'LanceSandino/cleanyourtv-WebOS';

run(async () => {
  const updates = req('updates');
  const D = process.env.CYTV_DIR;
  ok(updates.repo() === FORK, 'the updater reads the fork when no source is set');
  ok(/\/repos\/LanceSandino\/cleanyourtv-WebOS\/releases\/latest$/.test(updates.releaseUrl({})), 'stable updates are read from the fork');
  fs.writeFileSync(path.join(D, 'source'), 'o/r main\n');
  ok(updates.repo() === 'o/r', 'a source set on purpose still wins');
  fs.unlinkSync(path.join(D, 'source'));

  const read = f => fs.readFileSync(path.join(root, f), 'utf8');
  ok(read('scripts/bootstrap.sh').indexOf('COMPATREPO=' + FORK) >= 0, 'the compatibility list is read from the fork');
  ok(read('ipk/build.py').indexOf("or '" + FORK + "'") >= 0, 'the Homebrew Channel listing points at the fork by default');
  ok(read('install.sh').indexOf('REPO="${CYTV_REPO:-' + FORK + '}"') >= 0, 'install.sh downloads from the fork by default');
  const shipped = ['helper/updates.js', 'helper/theme.js', 'scripts/bootstrap.sh', 'install.sh', 'ipk/build.py'];
  ok(
    shipped.every(f => read(f).indexOf("'lasharor/") < 0 && read(f).indexOf('=lasharor/') < 0 && read(f).indexOf('-lasharor/') < 0),
    'no shipped default names the upstream repository'
  );
});
