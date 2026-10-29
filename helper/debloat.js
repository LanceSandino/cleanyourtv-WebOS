// Switching the debloat on and off while the TV runs (the boot script 15-cleanyourtv-debloat applies it at every start). What it
// stops and blocks is in scripts/debloat-stop.sh; scripts/debloat-undo.sh reverses it. Its groups can be switched off one by
// one: options.debloatOff in config.json lists those, and debloat-stop.sh reads it. The group "preload" (LG's app pre-loading) is
// the service's own (lgpreload.js, which hears of every change through onChange); the scripts leave it alone, and so are "lgads"
// (LG's ad and promotion settings) and the opt-in "hbbtv" (lgsettings.js), which is on only when listed in options.debloatOn. The
// opt-in "miner" (LG's content miner stopped from the start, kept from starting again) is the scripts' own, listed in debloatOn too.
const P = require('./paths'),
  exec = require('./exec');

const GROUPS = ['ads', 'adapps', 'tracking', 'logs', 'suggestions', 'preload', 'lgads'],
  OPT_IN = ['hbbtv', 'miner'],
  SCRIPT_OPT_IN = ['miner']; // the opt-in groups debloat-stop.sh and debloat-undo.sh apply

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

// while the debloat is on: undo the groups that were switched off, apply the ones switched on again; of the opt-in groups (onBefore,
// onAfter: the lists of those on), the scripts' own the same way
async function change(offBefore, offAfter, onBefore, onAfter) {
  const was = (onBefore || []).filter(g => SCRIPT_OPT_IN.indexOf(g) >= 0),
    now = (onAfter || []).filter(g => SCRIPT_OPT_IN.indexOf(g) >= 0);
  const undo = offAfter.filter(g => offBefore.indexOf(g) < 0).concat(was.filter(g => now.indexOf(g) < 0)),
    redo = offBefore.filter(g => offAfter.indexOf(g) < 0).concat(now.filter(g => was.indexOf(g) < 0));
  if (undo.length) await exec.sh('sh ' + P.D + '/debloat-undo.sh ' + undo.join(' '), 60000);
  if (redo.length) await exec.sh('sh ' + P.D + '/debloat-stop.sh ' + redo.join(' '), 60000);
  changed();
}

// the groups that are off, from a request: known names only, each once
const cleanOff = list => GROUPS.filter(g => Array.isArray(list) && list.indexOf(g) >= 0);
// the opt-in groups that are on
const cleanOn = list => OPT_IN.filter(g => Array.isArray(list) && list.indexOf(g) >= 0);

module.exports = { apply, change, cleanOff, cleanOn, onChange, GROUPS, OPT_IN, SCRIPT_OPT_IN };
