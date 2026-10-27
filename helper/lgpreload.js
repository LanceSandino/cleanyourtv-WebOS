// LG's app pre-loading, stopped (Debloat > "Stop LG pre-loading apps": a debloat group, on with the debloat unless switched off). LG's
// preload manager (webos-preload-manager, preload-manager.service) starts apps such as LG Channels, Netflix and YouTube in the
// background so they open faster. It takes its list from the configd setting com.webos.service.preloadmanager.supportAppList and reads
// it only when it starts. While this is on, that setting is LG's own list with every app switched off except com.webos.app.home (our
// launcher: its preload keeps Home quick), set through lgconfig.js (in RAM), and the preload manager is restarted to read it: once
// switched on, after every start of the TV (the setting lives in RAM) and when the setting was lost. Switching off removes it and
// restarts the preload manager again, so LG's list comes back. Apps it already started stay until closed or until the TV restarts.
// Not while LG's Home is chosen (DISABLE), like the rest of the debloat at boot. Only where tvprofile.js says lgPreload: 'configd'.
const fs = require('fs');
const P = require('./paths'),
  exec = require('./exec');

const NS = 'com.webos.service.preloadmanager',
  KEY = NS + '.supportAppList',
  HOME = 'com.webos.app.home',
  GROUP = 'preload'; // its name in options.debloatOff

// apps whose pre-loading is never switched off: Home (our launcher) and anything of the Homebrew Channel's, should LG ever list it
const KEEP = id => id === HOME || /^org\.webosbrew\./.test(String(id || ''));
// LG's list with every app off but those (as LG has them); nothing is added to it
function homeOnly(list) {
  return list.map(a => Object.assign({}, a, { isEnabled: a && KEEP(a.id) ? a.isEnabled !== false : false }));
}

// ctx: {config, luna, profile}; o: {dir, record, startMs, checkMs, restart} (tests)
function create(ctx, opts) {
  const o = Object.assign(
    {
      startMs: 60000, // after the service starts, like the debloat at boot: the TV settles first
      checkMs: 10 * 60 * 1000, // how often it looks whether the setting is still there
      restart: () => exec.sh('systemctl restart preload-manager.service', 30000),
    },
    opts
  );
  const layer = require('./lgconfig').create(ctx, { dir: o.dir, record: o.record });
  const supported = () => {
    const p = ctx.profile && ctx.profile.get ? ctx.profile.get() : {};
    return p.lgPreload === 'configd' && layer.supported();
  };
  const wanted = () => {
    const op = ctx.config.options();
    return op.debloat !== false && (op.debloatOff || []).indexOf(GROUP) < 0 && !fs.existsSync(P.DISABLE) && supported();
  };
  let busy = false,
    again = false,
    broken = false, // configd did not take the list on this TV: not tried again until the settings change
    last = '';
  const note = m => {
    last = m;
    console.log('lgpreload: ' + m);
  };
  async function restart(why) {
    const r = await o.restart();
    note(why + (r && r.ok === false ? '; restarting preload-manager failed: ' + (r.error || r.err || '') : '; preload-manager restarted'));
  }
  async function apply() {
    const now = (await layer.get([KEY]))[KEY];
    if (!Array.isArray(now) || !now.length) return note('configd gave no app list; nothing changed');
    const list = homeOnly(now);
    await layer.set(NS, { supportAppList: list });
    // only restart when configd really gives the new list (the layer works on this TV)
    const after = (await layer.get([KEY]))[KEY];
    if (!Array.isArray(after) || after.length !== list.length || !after.every(a => a && (KEEP(a.id) || a.isEnabled === false))) {
      broken = true;
      await layer.clear(NS);
      return note('configd did not take the list; taken away again, preload-manager left as it is');
    }
    const off = list.filter(a => !KEEP(a.id)).length;
    await restart('LG pre-loading stopped (' + off + ' apps off, Home kept)');
  }
  // make it match the settings; one at a time, a change meanwhile looks again
  async function sync() {
    if (busy) return void (again = true);
    busy = true;
    try {
      do {
        again = false;
        if (wanted()) {
          if (!layer.owned(NS) && !broken) await apply();
        } else if (await layer.clear(NS)) await restart("LG's pre-loading back");
      } while (again);
    } catch (e) {
      note('failed: ' + ((e && e.message) || e));
    }
    busy = false;
  }
  const status = () => ({ supported: supported(), on: wanted(), set: layer.owned(NS), last });
  function start() {
    setTimeout(sync, o.startMs);
    setInterval(sync, o.checkMs);
    // the manager switched the debloat or a group: try again, also where configd did not take it before
    require('./debloat').onChange(() => {
      broken = false;
      sync();
    });
  }
  return { name: 'lgpreload', start, sync, status };
}

module.exports = { create, homeOnly, NS, KEY, HOME, GROUP };
