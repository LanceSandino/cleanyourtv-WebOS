// Makes the documentation's screenshots in headless Chrome on this computer, with made-up data only: no TV and no hub is asked, and
// nothing leaves this machine. Small stand-ins answer the pages: the TV's service on 127.0.0.1:8765 (the launcher and the manager
// call that address), the phone remote's server and the hub on 127.0.0.1:8911 and 8912. The pages are the repository's own (the built
// app/index.html and manager/app/index.html, helper/remotepage.js, hub/dashboard.html); the clock in them is set to a made-up
// afternoon, so the pictures do not depend on the hour they are made at.
//   node tools/doc-shots.mjs [--out <folder>] [--only <name>] [--write]
// It writes <out>/<name>.jpg (JPEG quality 80): remote-keys, remote-touchpad, remote-feedback and remote-tv (a phone, 390 x 844 at
// twice the pixels: 780 wide), hub-dashboard (1280 wide, the whole page), search-where, tv-health and saver-frame (the TV's
// 1920 x 1080 page saved at 1280 x 720). --only <name> makes the shots whose name has that text; --write also copies them to
// docs/screenshots/. Needs Node.js 22 or newer and Google Chrome (set CHROME to its path when it is not found); nothing is
// installed. Ports 8765, 8911 and 8912 must be free (stop anything else that uses them).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const arg = n => (args.includes(n) ? args[args.indexOf(n) + 1] : '');
const out = path.resolve(arg('--out') || path.join(os.tmpdir(), 'cytv-doc-shots')),
  only = arg('--only'),
  write = args.includes('--write');
if (typeof WebSocket === 'undefined') {
  console.error('this needs Node.js 22 or newer (WebSocket)');
  process.exit(2);
}
const chromePath =
  process.env.CHROME ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ].find(p => fs.existsSync(p));
if (!chromePath) {
  console.error('Chrome was not found: set CHROME to its path');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
const PHONE_PORT = 8911,
  HUB_PORT = 8912,
  MB = 1048576;
// the made-up afternoon every page lives in: Saturday 24 October 2026, 15:40, in this computer's time zone
const NOW = new Date(2026, 9, 24, 15, 40, 0).getTime();
const CLOCK = `(function(){var R=Date,off=${NOW}-R.now();class D extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off)}static now(){return R.now()+off}}window.Date=D})();`;

// ---- made-up data ----
// a small random generator with a fixed seed, so the curves are the same every time
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round1 = x => Math.round(x * 10) / 10;
// apps with plain coloured icons and their names on them
const APPS = [
  ['youtube', 'YouTube', 0],
  ['disney', 'Disney+', 222],
  ['cdp-30', 'Plex', 40],
  ['prime', 'Prime Video', 200],
  ['stremio', 'Stremio', 268],
  ['com.telemachus.screen', 'Telemachus', 160],
  ['photos', 'Photos', 120],
  ['music', 'Music', 330],
  ['weather', 'Weather', 190],
  ['browser', 'Browser', 230],
  ['games', 'Games', 290],
  ['radio', 'Radio', 20],
  ['news', 'News', 10],
  ['fitness', 'Fitness', 90],
].map(([id, title, hue]) => ({ id, title, hue }));
const iconSvg = a =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="hsl(${a.hue},55%,42%)"/>` +
  `<circle cx="128" cy="108" r="50" fill="rgba(255,255,255,.85)"/><text x="128" y="210" font-family="Helvetica,Arial,sans-serif" font-size="38" font-weight="700" text-anchor="middle" fill="#fff">${a.title.slice(0, 7)}</text></svg>`;

// the TV's health (helper/metrics.js reading())
const metrics = () => ({
  at: Date.now(),
  window: 2.5,
  uptime: 3 * 86400 + 4 * 3600 + 17 * 60,
  cpu: {
    total: 23.4,
    cores: [
      { id: 0, online: true, busy: 31.5, mhz: 1156 },
      { id: 1, online: true, busy: 24.2, mhz: 1156 },
      { id: 2, online: true, busy: 19.8, mhz: 1100 },
      { id: 3, online: true, busy: 18.1, mhz: 1100 },
    ],
  },
  temp: { c: 54, source: 'thermal_zone0' },
  memory: {
    total: 1796939776,
    available: 487 * MB,
    swap: { total: 600 * MB, used: 251 * MB, devices: [{ name: 'zram0', type: 'partition', size: 600 * MB, used: 251 * MB }] },
  },
  disks: [
    { path: '/var', size: 966 * MB, free: 525 * MB },
    { path: '/tmp', size: 729 * MB, free: 712 * MB },
    { path: '/media/developer', size: 3890 * MB, free: 2710 * MB },
  ],
  emmc: { used: ['0-10%', '10-20%'], eol: 'normal' },
  net: [{ name: 'wlan0', rx: 186000, tx: 9400, dbm: -52, quality: null }],
  self: { cpu: 1.1, rss: 61 * MB, heap: 9 * MB },
});
// the summary of the settings (helper/statusdata.js summary())
const settings = () => ({
  versions: { service: '1.6.41', launcher: '1.5.29', node: 'v16.20.2' },
  tv: { model: 'OLED55C46LA', firmware: '33.20.65', sdk: '10.2.0' },
  updates: { channel: 'stable', available: '', checkedAt: NOW - 3600000, fromThisProject: true },
  home: { takeover: true, active: true },
  debloat: {
    on: true,
    groups: ['ads', 'adapps', 'tracking', 'logs', 'suggestions', 'lan', 'preload', 'lgads', 'hbbtv', 'miner', 'lgservers'].map(id => ({
      id,
      on: ['hbbtv', 'miner', 'lgservers'].indexOf(id) < 0,
    })),
    check: {
      at: NOW - 600000,
      groups: ['ads', 'adapps', 'tracking', 'logs', 'suggestions', 'lan', 'preload', 'lgads'].map(id => ({ id, ok: true, notes: [] })),
    },
  },
  remote: { on: true, phones: 2 },
  linked: { plex: true, stremio: false, disney: true },
  options: { liveTv: true, inputKey: true },
  security: { telnetOff: true, apiToken: true, devtoolsClosed: true },
});
// the open ports, classified by the service's own table (helper/exposure.js) from made-up listeners
const E = require(path.join(ROOT, 'helper', 'exposure.js'));
const LISTENERS = [
  { proto: 'tcp', port: 22, bind: 'all', program: 'dropbear', cmdline: 'dropbear\0-R\0' },
  { proto: 'tcp', port: 515, bind: 'all', program: 'systemd' },
  { proto: 'tcp', port: 8765, bind: 'loopback', program: 'node helper.js' },
  { proto: 'tcp', port: 8794, bind: 'all', program: 'node helper.js' },
  { proto: 'tcp', port: 18181, bind: 'all', program: 'xinetd' },
  { proto: 'tcp', port: 36866, bind: 'all', program: 'xinetd' },
  { proto: 'udp', port: 1900, bind: 'all', program: 'iconnectivity' },
  { proto: 'udp', port: 5353, bind: 'all', program: 'mdnsd' },
  { proto: 'udp', port: 41234, bind: 'all', program: 'iconnectivity' },
  { proto: 'udp', port: 50112, bind: 'all', program: 'iconnectivity' },
];
const exposure = () => {
  const m = E.merge(LISTENERS.map(s => E.classify(s, { rootPw: 'locked', devtoolsClosed: true })));
  return {
    at: Date.now(),
    ports: E.devtoolsRow(m.ports, true),
    udpReplies: m.udpReplies,
    services: {
      parts: {
        running: [
          'core',
          'notify',
          'live',
          'theme',
          'wallpapers',
          'photofeed',
          'watch',
          'search',
          'cards',
          'remote',
          'inputkey',
          'manager',
          'apps',
          'running',
          'metrics',
        ],
        failed: [],
      },
      boot: {
        home: true,
        scripts: [
          { name: '10-cleanyourtv-home', ours: true },
          { name: '15-cleanyourtv-debloat', ours: true },
        ],
        watchdog: true,
      },
      telemachus: null,
      debloat: {
        at: NOW - 600000,
        on: true,
        groups: [],
        daemons: [
          ['acr2', 'tracking'],
          ['livepick-plus', 'tracking'],
          ['uploadd', 'logs'],
          ['remotelogger', 'logs'],
          ['service-logger', 'logs'],
          ['rdxd', 'logs'],
        ].map(([name, group]) => ({ name, group, state: 'stopped' })),
      },
    },
  };
};
const lgServices = () => ({
  at: Date.now(),
  error: '',
  units: [
    ['sam.service', 'System and Application Manager'],
    ['webappmgr.service', 'Web App Manager'],
    ['audiod.service', 'Audio daemon'],
    ['connman.service', 'Connection service'],
  ].map(([unit, description]) => ({ unit, description })),
});
const processes = () => ({
  window: 2,
  tasks: 331,
  byCpu: [
    { pid: 1201, name: 'WebAppMgr', cpu: 14.5, rss: 168 * MB, threads: 31 },
    { pid: 802, name: 'lginput2', cpu: 2.1, rss: 10 * MB, threads: 4 },
    { pid: 1450, name: 'node helper.js', ours: true, cpu: 1.1, rss: 61 * MB, threads: 11 },
  ],
  byMemory: [
    { pid: 1201, name: 'WebAppMgr', cpu: 14.5, rss: 168 * MB, threads: 31 },
    { pid: 1450, name: 'node helper.js', ours: true, cpu: 1.1, rss: 61 * MB, threads: 11 },
    { pid: 802, name: 'lginput2', cpu: 2.1, rss: 10 * MB, threads: 4 },
  ],
});

// the hub's history (hub/history.js data()): 24 h of samples every 2 minutes, while the TV was on, with natural-looking curves
function history() {
  const r = rng(20261024),
    step = 120000,
    since = NOW - 24 * 3600000;
  const hourOf = t => {
    const d = new Date(t);
    return d.getHours() + d.getMinutes() / 60;
  };
  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const bump = (h, a, b, e) => smooth((h - a) / e) * smooth((b - h) / e);
  // how much the TV is being used at an hour: the evening, the morning news and the early afternoon
  const use = h =>
    0.08 + 0.6 * bump(h, 18.7, 23.6, 0.4) + 0.3 * bump(h, 0, 1.2, 0.3) + 0.35 * bump(h, 7.3, 8.7, 0.25) + 0.45 * bump(h, 12.7, 16, 0.3);
  // off overnight and in the late morning
  const off = h => (h >= 1.84 && h < 7.17) || (h >= 9.5 && h < 12.33);
  const samples = [];
  let temp = 40,
    swap = 24,
    rss = 52,
    dbm = -53,
    wasOff = true;
  for (let t = since; t <= NOW; t += step) {
    const h = hourOf(t);
    if (off(h)) {
      wasOff = true;
      continue;
    }
    if (wasOff) {
      temp = 39 + r() * 2; // a cold start
      if (h > 6 && h < 8) {
        swap = 22;
        rss = 51;
      }
      wasOff = false;
    }
    const a = Math.min(1, Math.max(0, use(h) + (r() - 0.5) * 0.12));
    const spike = r() < 0.02 ? 25 + r() * 20 : 0; // an app starting
    temp += (43 + 18 * a + 1.5 * Math.sin(t / 2400000) - temp) * 0.1 + (r() - 0.5) * 0.8;
    swap = Math.min(68, Math.max(18, swap + (a * 0.22 - 0.05) + (r() - 0.5) * 0.2));
    rss = Math.min(68, Math.max(50, rss + 0.012 + (r() - 0.5) * 0.4));
    dbm = Math.min(-47, Math.max(-60, dbm + Math.round((r() - 0.5) * 2.2)));
    // a short dip in free memory in the evening (the alert that passed)
    const dip = h >= 21.6 && h < 21.75 ? 1 : 0;
    samples.push({
      t,
      cpu: round1(Math.min(96, 4 + 30 * a + (r() - 0.5) * 6 + spike + dip * 30)),
      temp: Math.round(temp),
      mem: Math.round(dip ? 132 + r() * 12 : 660 - 340 * a + (r() - 0.5) * 50),
      swap: Math.round(swap + dip * 18),
      var: 525,
      dbm,
      rss: Math.round(rss),
      scpu: round1(0.6 + r() * 1.2),
    });
  }
  const last = Object.assign({}, samples[samples.length - 1], { tmp: 712, dev: 2710, rx: 186000, tx: 9400, eol: 'normal' });
  const at = (daysAgo, hh, mm) => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d.getTime();
  };
  const port = { id: 'port:tcp/515', text: 'New on the network: tcp/515', at: at(0, 13, 35) };
  const memory = { id: 'memory', text: 'The TV is low on memory: 138 MB free' };
  return {
    hours: 24,
    step,
    samples,
    alerts: {
      active: [port],
      recent: [
        Object.assign({ state: 'raised' }, port),
        Object.assign({ state: 'cleared', at: at(1, 21, 45) }, memory),
        Object.assign({ state: 'raised', at: at(1, 21, 37) }, memory),
      ],
    },
    ports: { at: at(0, 15, 0), ports: exposure().ports },
    last,
  };
}

// Search (/api/search and /api/search/where): made-up titles; three apps on this TV have the first, the long one has seven offers
// in six apps (more than a row holds: the rest are named on its Also line)
const offer = (provider, name, kind, app, price, exact) =>
  Object.assign(
    { key: 'where-' + provider + '-' + kind, provider, name, offer: kind, price: price || null, currency: price ? 'USD' : '' },
    app ? { app, appTitle: name, launch: { id: app, params: {} }, exact: !!exact } : {}
  );
function search(words) {
  if (!/^harbo/i.test(words)) return { q: words, groups: [] };
  return {
    q: words,
    groups: [
      {
        id: 'have',
        items: [
          {
            key: 'have-tm-1',
            app: 'com.telemachus.screen',
            appTitle: 'Telemachus',
            title: 'Harbor Lights',
            sub: 'S1 E4',
            source: 'telemachus',
            launch: { id: 'com.telemachus.screen', params: { play: { show: 'Harbor Lights', season: 1, episode: 4 } } },
          },
        ],
      },
      {
        id: 'search',
        items: [
          {
            key: 'search-youtube',
            app: 'youtube',
            appTitle: 'YouTube',
            launch: { id: 'youtube', params: { contentTarget: 'q=' + words } },
          },
        ],
      },
    ],
  };
}
function where(words) {
  if (!/^harbo/i.test(words)) return { q: words, on: true, groups: [] };
  return {
    q: words,
    on: true,
    groups: [
      {
        id: 'where',
        items: [
          {
            key: 'where-0-harbor-lights',
            title: 'Harbor Lights',
            year: 2019,
            kind: 'series',
            offers: [
              offer('disney-plus', 'Disney+', 'subscription', 'disney', 0, true),
              offer('telemachus', 'Telemachus', 'catalogue', 'com.telemachus.screen'),
              offer('plex', 'Plex', 'library', 'cdp-30'),
              offer('hulu', 'Hulu', 'subscription'),
              offer('apple-itunes', 'Apple iTunes', 'buy', '', 2.99),
            ],
          },
          {
            key: 'where-1-harbor-keepers',
            title: 'The Keepers of Harbor Point and the Long Winter Crossing of the Northern Sea',
            year: 1993,
            kind: 'movie',
            offers: [
              offer('telemachus', 'Telemachus', 'catalogue', 'com.telemachus.screen'),
              offer('youtube-rent', 'YouTube', 'rent', 'youtube', 3.99),
              offer('youtube-buy', 'YouTube', 'buy', 'youtube', 4.99),
              offer('prime', 'Prime Video', 'buy', 'prime', 14.99),
              offer('disney-plus', 'Disney+', 'subscription', 'disney'),
              offer('stremio', 'Stremio', 'catalogue', 'stremio'),
              offer('plex', 'Plex', 'library', 'cdp-30'),
              offer('fubotv', 'Fubo', 'subscription'),
            ],
          },
        ],
      },
    ],
  };
}

// the screensaver's photos: two landscape pictures from the repository's themes (no people), cut to 3:2 so the frame hangs them side
// by side in its mat (an SVG round the JPEG: the browser sees a 1620 x 1080 picture)
const PHOTOS = {
  p1: { file: 'themes/dawn/dawn.jpg', caption: 'Rainforest at dawn', date: '2026-06-02', color: '#8a7a52' },
  p2: { file: 'themes/lake-dock/moon-lake.jpg', caption: 'Moonlight on the lake', date: '2026-08-14', color: '#5d7286' },
};
const photoSvg = f =>
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1620" height="1080" viewBox="150 0 1620 1080">' +
  '<image width="1920" height="1080" xlink:href="data:image/jpeg;base64,' +
  fs.readFileSync(path.join(ROOT, f)).toString('base64') +
  '"/></svg>';

// ---- the stand-ins ----
const body = req =>
  new Promise(res => {
    let b = '';
    req.on('data', c => (b += c));
    req.on('end', () => res(b));
  });
const listen = (srv, port) =>
  new Promise((res, rej) => {
    srv.on('error', rej);
    srv.listen(port, '127.0.0.1', res);
  });
const send = (r, type, data, code) => {
  r.writeHead(code || 200, { 'content-type': type, 'cache-control': 'no-store' });
  r.end(data);
};
const json = (r, o, code) => send(r, 'application/json', JSON.stringify(o), code);
const inject = html =>
  html.replace(
    '<script>',
    '<script>' +
      CLOCK +
      'window.webOSSystem={launchParams:"{}",locale:"en-US",hide(){},activate(){},platformBack(){},setInputRegion(){},setKeyMask(){}};',
    1
  );

// the TV's service on 127.0.0.1:8765, as the launcher and the manager see it
const theme = require(path.join(ROOT, 'helper', 'theme.js')).create({
  config: require(path.join(ROOT, 'helper', 'config.js')).memory({}),
  noStartup: true,
});
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'test', 'golden', 'api.json'), 'utf8'));
const managerStatus = () => {
  const s = JSON.parse(JSON.stringify(golden['manager status'].body));
  Object.assign(s, { checkedAt: NOW - 3600000, checking: false, job: { at: 0, message: '', state: 'idle' } });
  Object.assign(s.service, { version: '1.6.41', updateTo: null });
  Object.assign(s.frontend, { version: '1.5.29', updateTo: null });
  Object.assign(s.release, { version: '1.6.41', service: '1.6.41', frontend: '1.5.29', date: '2026-10-22' });
  Object.assign(s.options, { debloat: true, inputKey: true });
  s.security = {
    devtools: { closed: true, listening: false },
    source: s.security.source,
    telnet: { off: true },
    token: { enforced: true },
  };
  return s;
};
let photoN = 0;
const tv = http.createServer(async (q, r) => {
  const u = q.url.split('?')[0],
    qs = new URL(q.url, 'http://127.0.0.1').searchParams;
  r.setHeader('Access-Control-Allow-Origin', '*');
  r.setHeader('Access-Control-Allow-Headers', 'content-type, x-cytv-token');
  if (q.method === 'OPTIONS') return r.writeHead(204), r.end();
  if (u === '/home.html') return send(r, 'text/html', inject(fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8')));
  if (u === '/manager.html') return send(r, 'text/html', inject(fs.readFileSync(path.join(ROOT, 'manager', 'app', 'index.html'), 'utf8')));
  if (u === '/cytv-token.js') return send(r, 'text/javascript', "var CYTV_TOKEN = 'doc-shots';\n");
  if (u === '/qrcode.js')
    return send(r, 'text/javascript', fs.readFileSync(path.join(ROOT, 'third-party', 'qrcode-generator', 'qrcode.js')));
  if (/^\/saver-[a-z-]+\.webp$/.test(u) && fs.existsSync(path.join(ROOT, 'app', u)))
    return send(r, 'image/webp', fs.readFileSync(path.join(ROOT, 'app', u)));
  if (u.startsWith('/api/theme/')) return theme.handle(q, r, u, async () => JSON.parse((await body(q)) || '{}'));
  if (u === '/api/apps')
    return json(r, {
      apps: APPS.map(a => ({ id: a.id, title: a.title })),
      config: {
        dock: APPS.slice(0, 5).map(a => a.id),
        theme: theme.resolved(),
        saver: { on: false },
        photoFeed: { photos: 2 },
        search: { where: true },
      },
      usage: Object.fromEntries(APPS.map((a, i) => [a.id, 1000 - i])),
      version: '1.5.29',
    });
  if (u === '/api/inputs')
    return json(r, { devices: [{ id: 'HDMI_1', appId: 'com.webos.app.hdmi1', label: 'Game console', connected: true }] });
  if (u === '/api/watch/rows') return json(r, { items: [] });
  if (u === '/api/search') return json(r, search(qs.get('q') || ''));
  if (u === '/api/search/where') return json(r, where(qs.get('q') || ''));
  if (u === '/api/photofeed/next') {
    const id = 'p' + ((photoN++ % 2) + 1);
    return json(r, { id, date: PHOTOS[id].date, caption: PHOTOS[id].caption, color: PHOTOS[id].color });
  }
  const ph = /^\/api\/photofeed\/photo\/(p[12])$/.exec(u);
  if (ph) return send(r, 'image/svg+xml', photoSvg(PHOTOS[ph[1]].file));
  if (u === '/api/manager/status') return json(r, managerStatus());
  if (u === '/api/metrics') return json(r, metrics());
  if (u === '/api/metrics/processes') return json(r, processes());
  if (u === '/api/metrics/exposure') return json(r, exposure());
  if (u === '/api/metrics/services') return json(r, lgServices());
  const ic = APPS.find(a => u === '/icon/' + a.id);
  if (ic) return send(r, 'image/svg+xml', iconSvg(ic));
  json(r, { returnValue: true });
});

// the phone remote's server (helper/remote.js on the TV's port 8794): the page, the presses and the TV tab's three readings
const remotepage = require(path.join(ROOT, 'helper', 'remotepage.js'));
const phone = http.createServer(async (q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/') return send(r, 'text/html; charset=utf-8', remotepage.html('en'));
  if (u === '/manifest.json') return send(r, 'application/manifest+json', remotepage.manifest());
  const ic = APPS.find(a => u === '/icon/' + a.id);
  if (ic) return send(r, 'image/svg+xml', iconSvg(ic));
  if (u === '/status-data') return json(r, { metrics: metrics(), settings: settings() });
  if (u === '/status-exposure') return json(r, exposure());
  if (u === '/status-services') return json(r, lgServices());
  if (q.method === 'POST') {
    await body(q);
    if (u === '/apps') return json(r, { apps: APPS.slice(0, 8).map(a => ({ id: a.id, title: a.title })) });
    return json(r, {});
  }
  json(r, { error: 'not found' }, 404); // /hub/status too: this is the TV's own server, not a hub
});

// the hub (hub/server.js): its dashboard and the history behind it
const hub = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/hub/dashboard') return send(r, 'text/html; charset=utf-8', fs.readFileSync(path.join(ROOT, 'hub', 'dashboard.html'), 'utf8'));
  if (u === '/hub/history') return json(r, history());
  if (u === '/hub/status') return json(r, { tv: 'on', link: true, mac: true, page: true });
  json(r, { error: 'not found' }, 404);
});

for (const [srv, port] of [
  [tv, 8765],
  [phone, PHONE_PORT],
  [hub, HUB_PORT],
])
  try {
    await listen(srv, port);
  } catch (e) {
    console.error('port ' + port + ' is in use: ' + e.message);
    process.exit(2);
  }

// ---- Chrome, over its DevTools protocol ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dport = 9700 + Math.floor(Math.random() * 200),
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-doc-shots-chrome-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--lang=en-US',
    '--remote-debugging-port=' + dport,
    '--user-data-dir=' + profile,
    '--window-size=1920,1080',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
const done = code => {
  try {
    chrome.kill();
  } catch (_) {}
  tv.close();
  phone.close();
  hub.close();
  setTimeout(() => {
    fs.rmSync(profile, { recursive: true, force: true });
    process.exit(code);
  }, 500);
};
// a new tab: send(method, params), js(expression) (its value), until(expression) (waits until it is true), shot(file, opts)
async function tab() {
  const t = await (await fetch('http://127.0.0.1:' + dport + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let n = 0;
  const pend = new Map();
  ws.addEventListener('message', m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) {
      pend.get(d.id)(d);
      pend.delete(d.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++n;
      pend.set(i, d => (d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const js = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('in the page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const until = async (expression, what, ms = 15000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(150)) if (await js('!!(' + expression + ')').catch(() => false)) return;
    throw new Error('waited in vain for ' + what);
  };
  const key = async (code, name) => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: code, key: name });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, key: name });
    await sleep(300);
  };
  const shot = async (name, clip) => {
    const r = await send(
      'Page.captureScreenshot',
      Object.assign({ format: 'jpeg', quality: 80 }, clip ? { clip, captureBeyondViewport: true } : {})
    );
    const f = path.join(out, name + '.jpg');
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    const kb = Math.round(fs.statSync(f).size / 1024);
    console.log(f + ' (' + kb + ' kB)' + (kb > 250 ? '  over 250 kB' : ''));
    return f;
  };
  const open = async (url, metrics, extra) => {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', metrics);
    if (metrics.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK + (extra || '') });
    await send('Page.navigate', { url });
  };
  return { send, js, until, key, shot, open, close: () => (ws.close(), fetch('http://127.0.0.1:' + dport + '/json/close/' + t.id)) };
}
// the TV's page is 1920 x 1080; drawn at two thirds of the pixels it is saved at 1280 x 720
const TV = { width: 1920, height: 1080, deviceScaleFactor: 2 / 3, mobile: false };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const PAIRED = "try{localStorage.setItem('cytv-remote-key','made-up-key-for-the-screenshots')}catch(e){}";

const SHOTS = {
  // the phone remote: the Remote tab, the Touchpad, the gear's Feedback sheet and the TV tab
  async remote() {
    const p = await tab();
    await p.open('http://127.0.0.1:' + PHONE_PORT + '/', PHONE, PAIRED);
    await p.until("document.getElementById('dot').className==='on'", 'the remote to say it is connected');
    await sleep(500);
    if (wanted('remote-keys')) await p.shot('remote-keys');
    await p.js("document.querySelector('nav button[data-p=touch]').click()");
    await sleep(400);
    if (wanted('remote-touchpad')) await p.shot('remote-touchpad');
    await p.js("document.querySelector('nav button[data-p=keys]').click();document.getElementById('fbset').click()");
    await p.until("document.getElementById('sheet').className===''", 'the Feedback sheet');
    await sleep(400);
    if (wanted('remote-feedback')) await p.shot('remote-feedback');
    await p.js("document.getElementById('sheetno').click();document.querySelector('nav button[data-p=tv]').click()");
    await p.until(
      "document.getElementById('tvcores').children.length===4&&document.getElementById('tvset').children.length>5",
      'the TV tab'
    );
    await sleep(800); // the meters' fill (a transform transition)
    if (wanted('remote-tv')) await p.shot('remote-tv');
    await p.close();
  },
  // the hub's dashboard, the whole page at a desktop's width
  async hub() {
    if (!wanted('hub-dashboard')) return;
    const p = await tab();
    await p.open(
      'http://127.0.0.1:' + HUB_PORT + '/hub/dashboard',
      { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
      PAIRED
    );
    await p.until("document.querySelectorAll('#charts svg').length===6&&document.querySelectorAll('#ports tr').length>3", 'the charts');
    const h = await p.js('Math.ceil(document.documentElement.scrollHeight)');
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await p.shot('hub-dashboard');
    await p.close();
  },
  // Search on Home: words typed, the Where to watch rows in, the focus on the first title's second app
  async search() {
    if (!wanted('search-where')) return;
    const p = await tab();
    await p.open('http://127.0.0.1:8765/home.html', TV);
    await p.until("document.querySelector('.tile')", 'the home screen');
    await sleep(1000);
    await p.js("SEARCH.show();var q=document.getElementById('sr-q');q.value='harbor';q.dispatchEvent(new Event('input'))");
    await p.until(
      "document.querySelectorAll('#sr .wrow .wchip').length>=4&&document.querySelectorAll('#sr .srow:not(.wrow)').length===2",
      'Where to watch'
    );
    await sleep(400);
    await p.key(40, 'ArrowDown');
    await p.key(40, 'ArrowDown');
    await p.key(39, 'ArrowRight');
    await sleep(500);
    await p.shot('search-where');
    await p.close();
  },
  // the manager's TV health screen
  async health() {
    if (!wanted('tv-health')) return;
    const p = await tab();
    await p.open('http://127.0.0.1:8765/manager.html', TV);
    await p.until("typeof rows!=='undefined'&&rows.some(function(r){return r.label==='TV health'})", 'the manager');
    await sleep(800);
    await p.js("for(var i=0;i<rows.length;i++)if(rows[i].label==='TV health'){idx=i;act();break}");
    await p.until(
      "view==='health'&&rows.some(function(r){return r.label==='Processor'})&&document.querySelectorAll('#list .row').length>8",
      'the health screen'
    );
    await sleep(1200);
    await p.shot('tv-health');
    await p.close();
  },
  // the screensaver with its frame: two landscape photos side by side in the mat, the caption and the day pencilled under each
  async saver() {
    if (!wanted('saver-frame')) return;
    const p = await tab();
    await p.open('http://127.0.0.1:8765/home.html', TV);
    await p.until("document.querySelector('.tile')", 'the home screen');
    await sleep(800);
    await p.js(
      "cfg.saver={on:true,style:'frame',frame:'walnut',profile:'modern',layout:'two',label:'under',clock:true,secs:600};SAVER.start(true)"
    );
    await p.until(
      "document.querySelectorAll('#sv .svp.on .svw').length===2&&document.querySelectorAll('#svfr .svside').length===4",
      'the framed photos'
    );
    await sleep(2500); // the cross-fade
    await p.shot('saver-frame');
    await p.close();
  },
};
const NAMES = [
  'remote-keys',
  'remote-touchpad',
  'remote-feedback',
  'remote-tv',
  'hub-dashboard',
  'search-where',
  'tv-health',
  'saver-frame',
];
const wanted = n => !only || n.indexOf(only) >= 0;

try {
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    try {
      ready = (await fetch('http://127.0.0.1:' + dport + '/json/version')).ok;
    } catch (_) {
      await sleep(250);
    }
  }
  if (NAMES.some(n => n.startsWith('remote') && wanted(n))) await SHOTS.remote();
  await SHOTS.hub();
  await SHOTS.search();
  await SHOTS.health();
  await SHOTS.saver();
  if (write)
    for (const n of NAMES.filter(wanted)) {
      fs.copyFileSync(path.join(out, n + '.jpg'), path.join(ROOT, 'docs', 'screenshots', n + '.jpg'));
      console.log('docs/screenshots/' + n + '.jpg');
    }
  done(0);
} catch (e) {
  console.error(e.message || e);
  done(1);
}
