// The launcher's own API: the list of apps with their icons, how often each is used, the inputs, launching, and the launcher's
// settings (dock, hidden apps, sort order, clock, top buttons).
//   GET /api/apps  GET /api/inputs  GET /api/foreground  POST /api/launch {id, params}  POST /api/config {...}  GET /icon/<app id>
//   POST /api/inputs/pin {id, on}   pin an input (its input app, e.g. com.webos.app.hdmi2) to Home, or take it off again
// A pinned input is listed with the apps ({id, title, input: <port>, off: <nothing connected>}), so the dock, the grid, the saved
// layout and the order by use treat it as an app; it is kept in config.json (pinnedInputs), apart from the launcher's own keys.
const fs = require('fs'),
  path = require('path');
const P = require('./paths'),
  web = require('./web'),
  exec = require('./exec'),
  cardsShape = require('./cards'),
  { LAUNCHER_KEYS } = require('./config');

const HALF_LIFE = 30 * 24 * 3600 * 1000; // usage counts halve every 30 days
// apps that are never uninstalled from Home, whatever the app manager says: this project's, the Homebrew Channel (it keeps the TV
// rooted), the input hook the Input key runs on, and LG's own
const KEEP = /^(com\.cleanyourtv\.|org\.webosbrew\.hbchannel$|org\.webosbrew\.inputhook$|com\.webos\.|com\.lge\.)/;
const WALL_SECS = [0, 10, 30, 60, 180, 300, 900, 3600]; // the photo-change intervals Customise > Wallpapers offers
// Customise > Screensaver: how long Home is left alone before it starts, and how long each photo stays (seconds)
const SAVER_AFTER = [60, 120, 300, 600, 900, 1800],
  SAVER_SECS = [10, 15, 30, 60];
const HOME = 'com.webos.app.home';

function create(ctx) {
  const { config, luna } = ctx;

  // ---- the installed apps. The app manager takes a moment to answer (a luna-send each time), and Home is opened often: after the first
  // answer the list is given at once from memory and asked again in the background when it is older than 5 seconds, so an app installed
  // a moment ago shows up on the next opening of Home ----
  let appCache = null,
    appCacheAt = 0,
    asking = null;
  function askApps() {
    if (!asking)
      asking = luna('luna://com.webos.applicationManager/listApps', {}).then(r => {
        asking = null;
        if (!Array.isArray(r.apps)) return appCache || [];
        appCache = r.apps
          .filter(a => a.visible !== false && a.id !== HOME)
          .map(a => ({
            id: a.id,
            title: a.title,
            icon: a.largeIcon || a.icon,
            folder: a.folderPath,
            type: a.type,
            removable: a.removable === true && !KEEP.test(a.id),
          }));
        appCacheAt = Date.now();
        return appCache;
      });
    return asking;
  }
  async function installed() {
    if (!appCache) return askApps();
    if (Date.now() - appCacheAt > 5000) askApps();
    return appCache;
  }

  // ---- the inputs, read like the apps: the last answer at once, asked again in the background when older than 5 seconds ----
  let inputCache = null,
    inputCacheAt = 0,
    askingInputs = null;
  function askInputs() {
    if (!askingInputs)
      askingInputs = luna('luna://com.webos.service.eim/getAllInputStatus', {}).then(r => {
        askingInputs = null;
        if (Array.isArray(r.devices)) {
          inputCache = r;
          inputCacheAt = Date.now();
        }
        return r;
      });
    return askingInputs;
  }
  function knownInputs() {
    if (!inputCache || Date.now() - inputCacheAt > 5000) askInputs();
    return (inputCache && inputCache.devices) || [];
  }
  const portLabel = d => 'HDMI ' + d.port;
  // the inputs pinned to Home, with the name and state the TV reports now (or what was saved when it was pinned)
  function pinned() {
    const now = {};
    for (const d of knownInputs()) if (d.appId) now[d.appId] = d;
    return (config.get().pinnedInputs || [])
      .filter(p => p && typeof p.id === 'string')
      .map(p => {
        const d = now[p.id];
        const label = (d && d.label) || p.label || 'HDMI ' + p.port;
        return { id: p.id, title: label, input: (d && d.port) || p.port || 0, off: d ? !d.hdmiPlugIn : false };
      });
  }
  async function apps() {
    return (await installed()).concat(pinned());
  }
  // ---- uninstalling (hold OK on an app > Uninstall): what the app manager calls removable (LG's store apps, developer apps), never
  // LG's system apps, this project's own apps, the Homebrew Channel (root) or the input hook the Input key uses ----
  async function uninstall(id) {
    if (!/^[\w.\-]+$/.test(id)) return { returnValue: false, error: 'bad id' };
    appCache = null; // the app manager's own answer, not a list from before
    const a = (await askApps()).find(x => x.id === id);
    if (!a) return { returnValue: false, error: 'This app is not installed.' };
    if (!a.removable)
      return { returnValue: false, error: 'This app cannot be uninstalled: it is part of the TV, or CleanYourTV needs it.' };
    const dev = /^\/media\/developer\//.test(a.folder || '');
    const r = await luna(
      'luna://com.webos.appInstallService/' + (dev ? 'dev/remove' : 'remove'),
      { id, subscribe: false },
      { wait: 30000 }
    );
    if (r.returnValue === false) return { returnValue: false, error: r.errorText || 'The TV did not remove the app.' };
    console.log('apps: uninstalled ' + id);
    config.update('launcher', c => {
      if (Array.isArray(c.dock)) c.dock = c.dock.filter(i => i !== id);
      if (Array.isArray(c.hidden)) c.hidden = c.hidden.filter(i => i !== id);
    });
    appCache = null;
    return { returnValue: true };
  }
  async function pin(b) {
    const id = String(b.id || '');
    const r = await askInputs();
    const d = (r.devices || (inputCache && inputCache.devices) || []).find(x => x.appId === id);
    if (b.on !== false && !d) return { returnValue: false, error: 'not an input of this TV' };
    config.update('launcher', c => {
      const list = (c.pinnedInputs || []).filter(p => p && p.id !== id);
      if (b.on !== false) list.push({ id, label: d.label && d.label !== portLabel(d) ? d.label : '', port: d.port });
      c.pinnedInputs = list.slice(0, 20);
      if (b.on === false && Array.isArray(c.dock)) c.dock = c.dock.filter(i => i !== id); // taken off Home: off the dock too
    });
    return { returnValue: true, pinned: b.on !== false };
  }

  // ---- usage: which apps get used (foreground changes), with a 30-day half-life ----
  let usage = {};
  try {
    usage = JSON.parse(fs.readFileSync(P.USAGE, 'utf8'));
  } catch (_) {}
  const decayed = (u, now) => u.s * Math.pow(0.5, (now - u.t) / HALF_LIFE);
  function usageScores() {
    const now = Date.now(),
      out = {};
    for (const id in usage) out[id] = Math.round(decayed(usage[id], now) * 1000) / 1000;
    return out;
  }
  let saveTimer = null;
  function bump(id) {
    const now = Date.now(),
      u = usage[id];
    usage[id] = { s: (u ? decayed(u, now) : 0) + 1, t: now };
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        fs.writeFileSync(P.USAGE + '.tmp', JSON.stringify(usage));
        fs.renameSync(P.USAGE + '.tmp', P.USAGE);
      } catch (_) {}
    }, 15000);
  }
  // the apps that were on the screen, each with the process it had then (running.js lists only those as open: LG's preload manager
  // starts some apps in the background, e.g. LG Channels, Netflix and YouTube, and those were never opened). Kept in /tmp (RAM), so
  // a restart of the service keeps it and a restart of the TV, which ends every app, clears it.
  const SEEN = P.ONSCREEN;
  let onScreen = {};
  try {
    onScreen = JSON.parse(fs.readFileSync(SEEN, 'utf8')) || {};
  } catch (_) {}
  let lastFg = '';
  async function seenOnScreen(id) {
    if (!id || id === lastFg) return;
    lastFg = id;
    const r = await luna('luna://com.webos.applicationManager/running', {});
    const me = (Array.isArray(r && r.running) ? r.running : []).filter(x => x && x.id === id)[0];
    if (!me || !me.processid) return;
    onScreen[id] = String(me.processid);
    try {
      fs.writeFileSync(SEEN + '.tmp', JSON.stringify(onScreen));
      fs.renameSync(SEEN + '.tmp', SEEN);
    } catch (_) {}
  }
  // an app counts as used once it stayed in the foreground for two polls in a row; going back to Home arms it again
  let cand = null,
    streak = 0,
    counted = null;
  async function onForeground(id) {
    seenOnScreen(id).catch(() => {});
    if (id === HOME) {
      counted = null;
      cand = id;
      streak = 1;
      return;
    }
    if (!id) return;
    if (id === cand) streak++;
    else {
      cand = id;
      streak = 1;
    }
    if (streak >= 2 && id !== counted) {
      counted = id;
      if ((await apps()).some(a => a.id === id)) bump(id);
    }
  }
  // poll every few seconds: a subscription's output is block-buffered by luna-send, so it would arrive late
  function pollForeground() {
    exec.execFile(
      'luna-send',
      ['-n', '1', '-w', '3000', '-f', 'luna://com.webos.applicationManager/getForegroundAppInfo', '{}'],
      { timeout: 6000 },
      (e, out) => {
        try {
          const o = JSON.parse(out);
          if (o.returnValue !== false) onForeground(o.appId || '');
        } catch (_) {}
      }
    );
  }

  // ---- the launcher's settings: only its own keys are replaced; options, keys, theme and the rest stay as they are ----
  function saveLauncherConfig(b) {
    const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 200) : undefined);
    const out = {};
    if (strs(b.dock)) out.dock = strs(b.dock).slice(0, 8);
    if (strs(b.hidden)) out.hidden = strs(b.hidden);
    if (b.sort === 'usage' || b.sort === 'alpha') out.sort = b.sort;
    if (['auto', '24', '12'].includes(b.clock)) out.clock = b.clock;
    if (b.runDots === true) out.runDots = true; // the green dot on open apps (off unless switched on)
    // Wallpapers in the launcher: on or off, and how often the photo changes
    if (b.wall && typeof b.wall === 'object') {
      // secs: how often the photo changes while Home is shown, in seconds (0: each time Home opens); "every" (minutes) came before it
      const secs = typeof b.wall.secs === 'number' ? b.wall.secs : typeof b.wall.every === 'number' ? b.wall.every * 60 : 900;
      out.wall = { on: b.wall.on === true, secs: WALL_SECS.indexOf(secs) >= 0 ? secs : 900 };
      // one chosen photo (Customise > Wallpapers > Choose a photo): an id as the wallpapers list names it, u/<id>, i/<asset id> or f/<feed id>
      if (typeof b.wall.pick === 'string' && /^([ui]\/[0-9a-f-]{16,36}|f\/[A-Za-z0-9_-]{1,64})$/i.test(b.wall.pick))
        out.wall.pick = b.wall.pick;
    }
    // the screensaver: on or off, when it starts, how long a photo stays, the clock over the photos
    if (b.saver && typeof b.saver === 'object') {
      const s = b.saver;
      out.saver = {
        on: s.on === true,
        after: SAVER_AFTER.indexOf(s.after) >= 0 ? s.after : 300,
        secs: SAVER_SECS.indexOf(s.secs) >= 0 ? s.secs : 15,
        clock: s.clock !== false,
      };
    }
    // Continue watching on Home (watch.js): on unless switched off; the shows and films removed from it (hold OK > Remove)
    if (b.watch && typeof b.watch === 'object') {
      out.watch = { on: b.watch.on !== false };
      if (b.watch.lg === false) out.watch.lg = false; // LG's rows of the other apps (lgrows.js)
      const hide = (Array.isArray(b.watch.hide) ? b.watch.hide : []).filter(
        (g, i, a) => typeof g === 'string' && /^[a-z]+:[^\u0000-\u001f]{1,160}$/.test(g) && a.indexOf(g) === i
      );
      if (hide.length) out.watch.hide = hide.slice(-100);
    }
    // the cards in the theme's slots (Customise > Cards), checked for shape only (cards.js)
    const cards = cardsShape.sanitize(b.cards);
    if (cards) out.cards = cards;
    if (Array.isArray(b.topbar))
      out.topbar = b.topbar
        .slice(0, 12)
        .filter(o => o && typeof o.label === 'string')
        .map(o => {
          const t = { label: o.label.slice(0, 40), icon: String(o.icon || 'grid').slice(0, 20) };
          if (typeof o.action === 'string') t.action = o.action;
          if (typeof o.app === 'string') t.app = o.app;
          if (o.params && typeof o.params === 'object') t.params = o.params;
          return t;
        });
    config.update('launcher', c => {
      for (const k of LAUNCHER_KEYS) delete c[k];
      return Object.assign(c, out);
    });
  }

  // what the launcher gets: its settings and the resolved theme, not the secrets (voice, notification token)
  function launcherConfig() {
    const c = config.get();
    delete c.voice;
    delete c.notifyApi;
    delete c.theme;
    delete c.wallpapers; // holds the Immich key; the launcher gets only a stamp that changes with the set of photos
    delete c.photoFeed; // holds the photo feed's token; the launcher gets only whether there are photos
    delete c.watchAccounts; // Plex's and Stremio's keys (plex.js, stremio.js); the launcher gets the cards only
    const theme = ctx.feature('theme'),
      wp = ctx.feature('wallpapers'),
      feed = ctx.feature('photofeed');
    if (wp) c.wallpapers = { stamp: wp.stamp() };
    if (feed) c.photoFeed = { photos: feed.count() };
    return theme ? Object.assign(c, { theme: theme.resolved() }) : c;
  }

  async function handle(req, res, u, body) {
    if (u === '/api/apps')
      return web.json(res, { apps: await apps(), config: launcherConfig(), usage: usageScores(), version: ctx.version });
    if (u === '/api/inputs') return web.json(res, await askInputs());
    if (u === '/api/inputs/pin' && req.method === 'POST') return web.json(res, await pin(await body(req)));
    if (u === '/api/foreground') return web.json(res, await luna('luna://com.webos.applicationManager/getForegroundAppInfo', {}));
    if (u === '/api/launch' && req.method === 'POST') {
      const b = await body(req);
      if (!/^[\w.\-]+$/.test(b.id || '')) return web.json(res, { error: 'bad id' }, 400);
      return web.json(res, await luna('luna://com.webos.applicationManager/launch', { id: b.id, params: b.params || {} }));
    }
    if (u === '/api/uninstall' && req.method === 'POST') return web.json(res, await uninstall(String((await body(req)).id || '')));
    if (u === '/api/config' && req.method === 'POST') {
      saveLauncherConfig(await body(req));
      return web.json(res, { returnValue: true });
    }
    const m = u.match(/^\/icon\/([\w.\-]+)$/);
    if (m) {
      const a = (await apps()).find(x => x.id === m[1]);
      const f = a && a.icon && path.join(a.folder, a.icon);
      if (!f || !path.resolve(f).startsWith(path.resolve(a.folder)) || !fs.existsSync(f)) return web.notFound(res);
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=3600' });
      return fs.createReadStream(f).pipe(res);
    }
    web.notFound(res);
  }

  return {
    name: 'apps',
    paths: ['/api/apps', '/api/inputs', '/api/inputs/pin', '/api/foreground', '/api/launch', '/api/config', '/api/uninstall'],
    prefix: '/icon/',
    handle,
    start: () => setInterval(pollForeground, 4000),
    apps,
    onScreen: () => onScreen,
    foreground: onForeground, // the poll's handler, for the tests
  };
}

module.exports = { create };
