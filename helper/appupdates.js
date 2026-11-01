// LG's app updates from the manager (Manager > App updates), so an app such as Disney+ can be updated without opening LG's store. LG
// checks for updates itself (its app update service, at every start and once a day) and keeps the answer: the list is read from there
// (com.webos.service.pkgUpdate/statusAll, else com.webos.appUpdateService/statusAll: {id, status, nsu, prohibit} per app; status Y an
// update, F one LG requires before the app opens, N and D none) and joined with the installed apps for their names and versions, since
// LG's list keeps an app removed since its last check. LG's own apps (systemApp) come with the TV's software and are left out. An
// update is started as LG's store starts one (its fnAppInstall: com.webos.service.pkgInstall/install {id, subscribe: false, silence:
// false, target: {deviceId: 'INTERNAL_STORAGE'}}, also in LG's install history on both of the owner's TVs), so LG downloads the app
// from its own servers with the TV's own sign-in and checks its signature; nothing here sees LG's credentials. One app at a time (webOS
// 22 has no queue for several), never the app on screen (an update closes it; LG's own updater waits for it too), and an update that
// is not done within ten minutes is cancelled (pkgInstall/cancel: an install can wait for an LG sign-in for ever). An app that needs
// newer TV software first (nsu) is listed but not offered: the TV's software updates are blocked to keep root.
// The list is read only when asked (it starts LG's install services), never on a timer. Read from LG's store code and the TVs' install
// history; the list was read on both TVs.
//   GET  /api/appupdates             {ok, apps: [{id, title, version, required, firmware, blocked}], updating, queued, last}
//   POST /api/appupdates/update {id} or {all: true}: queued, one at a time; {queued: [ids]} or {error}
//   GET  /api/appupdates/state       {updating, queued, last}, without asking LG (the manager reads it while updates run)
const LIST = ['luna://com.webos.service.pkgUpdate/statusAll', 'luna://com.webos.appUpdateService/statusAll'],
  INSTALL = 'luna://com.webos.service.pkgInstall/install',
  STATUS = 'luna://com.webos.service.pkgInstall/status',
  CANCEL = 'luna://com.webos.service.pkgInstall/cancel';
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const web = require('./web');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ctx: {luna}; o: {pollMs, limitMs, startMs} (the tests make them short)
function create(ctx, opts) {
  const o = Object.assign({ pollMs: 3000, limitMs: 10 * 60 * 1000, startMs: 60000 }, opts);
  const luna = (uri, p, w) => Promise.resolve(ctx.luna(uri, p, w)).catch(() => null);
  let queue = [],
    current = null,
    running = false;
  const last = []; // the last results: {id, title, ok, why, at}

  async function installed() {
    const r = await luna('luna://com.webos.applicationManager/listApps', {}, { wait: 10000 });
    const by = {};
    for (const a of (r && r.apps) || []) if (a && a.id) by[a.id] = a;
    return by;
  }
  // LG's update list: its apps, or null when neither service answers
  async function pending() {
    for (const u of LIST) {
      const r = await luna(u, {}, { wait: 10000 });
      if (r && r.returnValue !== false && r.status && Array.isArray(r.status.apps)) return r.status.apps;
    }
    return null;
  }
  async function updatable() {
    const p = await pending();
    if (!p) return null;
    const apps = await installed();
    const out = [];
    for (const x of p) {
      if (!x || (x.status !== 'Y' && x.status !== 'F')) continue;
      const a = apps[x.id];
      if (!a || a.systemApp) continue;
      out.push({
        id: String(x.id),
        title: String(a.title || x.id),
        version: String(a.version || ''),
        required: x.status === 'F',
        firmware: x.nsu === 'Y',
        blocked: x.prohibit === 'Y',
      });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }
  const state = () => ({
    updating: current ? { id: current.id, title: current.title, step: current.step || '' } : null,
    queued: queue.map(j => j.id),
    last: last.slice(-10),
  });
  async function list() {
    const apps = await updatable();
    if (!apps) return Object.assign({ ok: false, error: "LG's update list could not be read", apps: [] }, state());
    return Object.assign({ ok: true, apps }, state());
  }

  // LG's install list: the entry for this app, if LG is installing it
  async function installing(id) {
    const r = await luna(STATUS, {});
    const apps = (r && r.status && Array.isArray(r.status.apps) && r.status.apps) || [];
    return { busy: apps.length > 0, mine: apps.filter(a => a && a.id === id)[0] || null };
  }
  const stepOf = e => {
    const d = (e && e.details) || {};
    const s = String(d.state || e.state || 'updating');
    return typeof d.progress === 'number' ? s + ' ' + d.progress + '%' : s;
  };
  function done(job, ok, why) {
    last.push({ id: job.id, title: job.title, ok, why, at: new Date().toISOString() });
    if (last.length > 20) last.shift();
    console.log('appupdates: ' + job.id + (ok ? ' ' : ' not updated: ') + why);
  }
  async function updateOne(job) {
    const fg = await luna('luna://com.webos.applicationManager/getForegroundAppInfo', {});
    if (fg && fg.appId === job.id) return done(job, false, 'it is open on the TV: close it, then update');
    const now = await installing(job.id);
    if (now.busy) return done(job, false, 'LG is installing an app already: try again when it is done');
    const before = ((await installed())[job.id] || {}).version || '';
    job.step = 'starting';
    const r = await luna(
      INSTALL,
      { id: job.id, subscribe: false, silence: false, target: { deviceId: 'INTERNAL_STORAGE' } },
      { wait: 20000 }
    );
    if (!r || r.returnValue === false) return done(job, false, (r && r.errorText) || 'LG did not start the update');
    const t0 = Date.now();
    let seen = false;
    while (Date.now() - t0 < o.limitMs) {
      await sleep(o.pollMs);
      const s = await installing(job.id);
      if (s.mine) {
        seen = true;
        job.step = stepOf(s.mine);
        continue;
      }
      const v = ((await installed())[job.id] || {}).version || '';
      if (v && v !== before) return done(job, true, 'updated to ' + v);
      if (seen) return done(job, false, 'LG ended the update; the version is still ' + (v || before || 'unknown'));
      if (Date.now() - t0 > o.startMs) return done(job, false, 'LG did not start downloading it');
    }
    await luna(CANCEL, { id: job.id });
    return done(job, false, 'not done after ' + Math.round(o.limitMs / 60000) + ' minutes: cancelled');
  }
  async function work() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        current = queue.shift();
        try {
          await updateOne(current);
        } catch (e) {
          done(current, false, String((e && e.message) || e));
        }
        current = null;
      }
    } finally {
      running = false;
    }
  }
  // the apps asked for, if LG has an update for each that can be installed here
  async function update(b) {
    const apps = await updatable();
    if (!apps) return { error: "LG's update list could not be read", code: 502 };
    const ok = apps.filter(a => !a.firmware && !a.blocked);
    let pick;
    if (b && b.all === true) pick = ok;
    else {
      const id = String((b && b.id) || '');
      if (!ID.test(id)) return { error: 'no app named', code: 400 };
      pick = ok.filter(a => a.id === id);
      if (!pick.length) return { error: 'LG has no update for that app that can be installed here', code: 409 };
    }
    for (const a of pick)
      if (!queue.some(j => j.id === a.id) && !(current && current.id === a.id)) queue.push({ id: a.id, title: a.title });
    work();
    return Object.assign({ ok: true }, state());
  }

  return {
    name: 'appupdates',
    paths: ['/api/appupdates', '/api/appupdates/update', '/api/appupdates/state'],
    async handle(req, res, u, body) {
      if (u === '/api/appupdates' && req.method === 'GET') return web.json(res, await list());
      if (u === '/api/appupdates/state' && req.method === 'GET') return web.json(res, state());
      if (u === '/api/appupdates/update' && req.method === 'POST') {
        const r = await update(await (body || web.body)(req));
        return r.error ? web.json(res, { error: r.error }, r.code) : web.json(res, r);
      }
      web.notFound(res);
    },
    list,
    update,
    status: state,
  };
}

module.exports = { create };
