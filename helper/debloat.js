// Switching the debloat on and off while the TV runs (the boot script 15-cleanyourtv-debloat applies it at every start). What it
// stops and blocks is in scripts/debloat-stop.sh; scripts/debloat-undo.sh reverses it. Its groups can be switched off one by
// one: options.debloatOff in config.json lists those, and debloat-stop.sh reads it. The group "preload" (LG's app pre-loading) is
// the service's own (lgpreload.js, which hears of every change through onChange); the scripts leave it alone.
const P = require('./paths'),
  exec = require('./exec');

const GROUPS = ['ads', 'tracking', 'logs', 'suggestions', 'preload'];

// parts of the service that follow the debloat settings (lgpreload.js); told after every switch, once config.json has the change
const hooks = [];
const onChange = fn => hooks.push(fn);
function changed() {
  for (const fn of hooks)
    try {
      fn();
    } catch (_) {}
}

async function apply(on) {
  const link = P.INITD + '/15-cleanyourtv-debloat';
  const r = on
    ? await exec.sh('ln -sf ' + P.D + '/15-cleanyourtv-debloat ' + link + '; sh ' + P.D + '/debloat-stop.sh', 60000)
    : await exec.sh('rm -f ' + link + '; sh ' + P.D + '/debloat-undo.sh', 60000);
  changed();
  return r;
}

// while the debloat is on: undo the groups that were switched off, apply the ones switched on again
async function change(offBefore, offAfter) {
  const undo = offAfter.filter(g => offBefore.indexOf(g) < 0),
    redo = offBefore.filter(g => offAfter.indexOf(g) < 0);
  if (undo.length) await exec.sh('sh ' + P.D + '/debloat-undo.sh ' + undo.join(' '), 60000);
  if (redo.length) await exec.sh('sh ' + P.D + '/debloat-stop.sh ' + redo.join(' '), 60000);
  changed();
}

// the groups that are off, from a request: known names only, each once
const cleanOff = list => GROUPS.filter(g => Array.isArray(list) && list.indexOf(g) >= 0);

module.exports = { apply, change, cleanOff, onChange, GROUPS };
