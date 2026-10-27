// LG's app pre-loading, stopped (Debloat > "Stop LG pre-loading apps": a debloat group, on with the debloat unless switched off). LG's
// preload manager (com.webos.service.preloadmanager) starts apps such as LG Channels, Netflix and YouTube in the background so they open
// faster. Its own call setPreloadPolicy {"application": {"id", "isEnabled"}} switches one app's pre-loading off or on; that lasts until the
// preload manager restarts (with the TV), and is not saved. While this is on, every app it would pre-load (isEnabled and isAllowed in
// getPreloadPolicy) is switched off except com.webos.app.home (our launcher: its preload keeps Home quick) and anything of the Homebrew
// Channel's; shortly after the service starts and every two minutes it switches off what came back. Switching off switches those apps on
// again (only the ones this switched off). Apps it already started stay until closed or until the TV restarts.
// Found on webOS 25: setPreloadPolicy also marks every app it is called for as allowed, which the preload manager saves in
// /var/preferences/webos-preload-manager-conf.json, so it is only called for apps that are allowed already (the file stays as it is). The
// app list in configd (supportAppList) is not what it follows while it runs: it keeps its own state.
// Not while LG's Home is chosen (DISABLE), like the rest of the debloat at boot. Only where tvprofile.js says lgPreload: 'api'.
const fs = require('fs');
const P = require('./paths');

const SVC = 'luna://com.webos.service.preloadmanager/',
  HOME = 'com.webos.app.home',
  GROUP = 'preload'; // its name in options.debloatOff
const RECORD = process.env.CYTV_LGPRELOAD_RECORD || '/tmp/cleanyourtv-lgpreload.json'; // the apps switched off, while the TV runs

// apps whose pre-loading is never switched off: Home (our launcher) and anything of the Homebrew Channel's
const KEEP = id => id === HOME || /^org\.webosbrew\./.test(String(id || ''));
// the apps the preload manager would pre-load now and that are switched off here
const toStop = apps => apps.filter(a => a && a.id && a.isEnabled === true && a.isAllowed === true && !KEEP(a.id)).map(a => a.id);

// ctx: {config, luna, profile}; o: {record, startMs, checkMs} (tests)
function create(ctx, opts) {
  const o = Object.assign({ record: RECORD, startMs: 5000, checkMs: 2 * 60 * 1000 }, opts);
  const luna = ctx.luna;
  const supported = () => {
    const p = ctx.profile && ctx.profile.get ? ctx.profile.get() : {};
    return p.lgPreload === 'api';
  };
  const wanted = () => {
    const op = ctx.config.options();
    return op.debloat !== false && (op.debloatOff || []).indexOf(GROUP) < 0 && !fs.existsSync(P.DISABLE) && supported();
  };
  const readRec = () => {
    try {
      const r = JSON.parse(fs.readFileSync(o.record, 'utf8'));
      return Array.isArray(r) ? r.filter(x => typeof x === 'string') : [];
    } catch (_) {
      return [];
    }
  };
  const writeRec = list => {
    if (!list.length) {
      try {
        fs.unlinkSync(o.record);
      } catch (_) {}
      return;
    }
    fs.writeFileSync(o.record + '.tmp', JSON.stringify(list));
    fs.renameSync(o.record + '.tmp', o.record);
  };
  let busy = false,
    again = false,
    last = '';
  const note = m => {
    last = m;
    console.log('lgpreload: ' + m);
  };
  const policy = async () => {
    const r = await luna(SVC + 'getPreloadPolicy', {});
    return r && Array.isArray(r.applications) ? r.applications : null;
  };
  const setApp = (id, on) => luna(SVC + 'setPreloadPolicy', { application: { id, isEnabled: on } });

  async function stop() {
    const apps = await policy();
    if (!apps) return; // the preload manager does not answer (yet)
    const ids = toStop(apps);
    if (!ids.length) return;
    const rec = readRec();
    for (const id of ids) {
      const r = await setApp(id, false);
      if (r && r.returnValue !== false && rec.indexOf(id) < 0) rec.push(id);
    }
    writeRec(rec);
    const left = toStop((await policy()) || []).filter(id => ids.indexOf(id) >= 0);
    note(
      left.length
        ? 'the preload manager kept pre-loading ' + left.join(', ')
        : 'LG pre-loading stopped for ' + ids.join(', ') + ' (Home kept)'
    );
  }
  async function restore() {
    const rec = readRec();
    if (!rec.length) return;
    const apps = (await policy()) || [];
    const back = rec.filter(id => apps.some(a => a && a.id === id && a.isEnabled === false));
    for (const id of back) await setApp(id, true);
    writeRec([]);
    if (back.length) note("LG's pre-loading back for " + back.join(', '));
  }
  // make it match the settings; one at a time, a change meanwhile looks again
  async function sync() {
    if (busy) return void (again = true);
    busy = true;
    try {
      do {
        again = false;
        if (wanted()) await stop();
        else await restore();
      } while (again);
    } catch (e) {
      note('failed: ' + ((e && e.message) || e));
    }
    busy = false;
  }
  const status = () => ({ supported: supported(), on: wanted(), stopped: readRec(), last });
  function start() {
    // the earlier way (a configd list the preload manager does not follow) may have left its file: removed, only if it is that one
    require('./lgconfig')
      .create(ctx)
      .clear('com.webos.service.preloadmanager')
      .catch(() => {});
    setTimeout(sync, o.startMs);
    setInterval(sync, o.checkMs);
    require('./debloat').onChange(sync); // the manager switched the debloat or a group
  }
  return { name: 'lgpreload', start, sync, status };
}

module.exports = { create, toStop, KEEP, HOME, GROUP };
