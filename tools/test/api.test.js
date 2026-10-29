// Contract test: starts the service (helper/helper.js) on this machine with a stand-in for luna-send, a stand-in for the GitHub
// API and a temporary CleanYourTV folder, calls the HTTP API and compares the replies with tools/test/golden/api.json.
// It proves that a change inside the service leaves what the launcher, the manager and the scripts see unchanged.
//   node tools/test/contract.js                  compare with the golden file
//   node tools/test/contract.js --record         write the golden file (only when a change of the API is intended)
//   node tools/test/contract.js --helper <dir>   run another copy of the service, e.g. an older version to record from
// Runs on Node 16 and newer. Uses port 8765, like the service on the TV: stop anything else that listens there.
'use strict';
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  http = require('http'),
  cp = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const GOLDEN = path.join(__dirname, 'golden', 'api.json');
const args = process.argv.slice(2);
const record = args.indexOf('--record') >= 0;
const helperDir = args.indexOf('--helper') >= 0 ? path.resolve(args[args.indexOf('--helper') + 1]) : path.join(ROOT, 'helper');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-contract-'));
const D = path.join(tmp, 'cleanyourtv'),
  BIN = path.join(tmp, 'bin'),
  APPS = path.join(tmp, 'apps');
for (const d of [D, BIN, APPS, path.join(APPS, 'netflix'), path.join(tmp, 'svc'), path.join(tmp, 'themes')]) fs.mkdirSync(d);
// a stand-in for /proc: the uptime (log lines), the mounts (is our Home mounted) and one LG input process without the hook
const PROC = path.join(tmp, 'proc');
fs.mkdirSync(PROC);
fs.mkdirSync(path.join(PROC, '4242'));
fs.writeFileSync(path.join(PROC, 'uptime'), '123.45 100.00\n');
fs.writeFileSync(path.join(PROC, 'mounts'), '/dev/root / ext4 ro 0 0\n');
fs.writeFileSync(path.join(PROC, '4242', 'comm'), 'lginput2\n');
fs.writeFileSync(path.join(PROC, '4242', 'maps'), '00400000-00401000 r-xp 00000000 00:00 0 /usr/bin/lginput2\n');
fs.writeFileSync(path.join(APPS, 'netflix', 'icon.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
// TV health (metrics.js, exposure.js): /proc and /sys as a webOS 25 Realtek TV has them, two listening ports and their owner
const SYS = path.join(tmp, 'sys'),
  INITD = path.join(tmp, 'initd');
const put = (f, t) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, t);
};
const cpuStat = n =>
  'cpu  0 0 0 0 0 0 0 0 0 0\n' +
  [0, 1, 2, 3].map(i => 'cpu' + i + ' ' + [n * (i + 1), 0, n, 1000 + n * (3 - i), 0, 0, 0, 0, 0, 0].join(' ')).join('\n') +
  '\n';
put(path.join(PROC, 'stat'), cpuStat(100));
put(path.join(PROC, 'loadavg'), '31.90 32.00 29.70 1/336 4242\n');
put(
  path.join(PROC, 'meminfo'),
  'MemTotal: 1754824 kB\nMemFree: 79164 kB\nMemAvailable: 406664 kB\nSwapTotal: 614396 kB\nSwapFree: 285276 kB\n'
);
put(path.join(PROC, 'swaps'), 'Filename Type Size Used Priority\n/dev/f2io-0 partition 614396 329120 -2\n');
put(path.join(PROC, 'net', 'dev'), 'h1\nh2\n wlan0: 1000 1 0 0 0 0 0 0 2000 1 0 0 0 0 0 0\n');
put(path.join(PROC, 'net', 'wireless'), 'h1\nh2\n wlan0: 0000    0.  216.    0.  0 0 0 0 0 0\n');
put(
  path.join(PROC, 'net', 'tcp'),
  'sl local rem st\n 0: 0100007F:223D 00000000:0000 0A 00000000:00000000 00:00000000 00000000 0 0 111 1\n' +
    ' 1: 00000000:270E 00000000:0000 0A 00000000:00000000 00:00000000 00000000 0 0 112 1\n'
);
put(path.join(PROC, '4242', 'stat'), '4242 (lginput2) S 1 1 1 0 -1 0 0 0 0 0 300 100 0 0 20 0 4 0 100 1000 2500 4294967295\n');
put(path.join(PROC, '4343', 'comm'), 'WebAppMgr\n');
put(path.join(PROC, '4343', 'stat'), '4343 (WebAppMgr) S 1 1 1 0 -1 0 0 0 0 0 900 300 0 0 20 0 30 0 100 1000 40000 4294967295\n');
fs.mkdirSync(path.join(PROC, '4343', 'fd'));
fs.symlinkSync('socket:[112]', path.join(PROC, '4343', 'fd', '7'));
put(path.join(SYS, 'devices', 'system', 'cpu', 'present'), '0-3\n');
for (let i = 0; i < 4; i++) put(path.join(SYS, 'devices', 'system', 'cpu', 'cpu' + i, 'cpufreq', 'scaling_cur_freq'), '1156000\n');
put(path.join(SYS, 'class', 'thermal', 'thermal_zone0', 'type'), 'rtk-thermal\n');
put(path.join(SYS, 'class', 'thermal', 'thermal_zone0', 'temp'), '66000\n');
put(path.join(SYS, 'block', 'mmcblk0', 'device', 'life_time'), '0x01 0x01\n');
put(path.join(SYS, 'block', 'mmcblk0', 'device', 'pre_eol_info'), '0x01\n');
put(path.join(INITD, '10-cleanyourtv-home'), '#!/bin/sh\n');
fs.writeFileSync(
  path.join(D, 'config.json'),
  JSON.stringify(
    {
      dock: ['netflix', 'youtube.leanback.v4'],
      hidden: ['com.webos.app.browser'],
      sort: 'usage',
      clock: 'auto',
      options: { debloat: false, inputKey: false, liveTv: true },
      keys: { input: '241', learned: true },
      theme: { id: 'classic' },
      // a photo feed set up (photofeed.js): the launcher must get whether there are photos, never this token or address
      photoFeed: { url: 'https://127.0.0.1:9', token: 'SECRET-feed-token-0123456789', ca: '' },
    },
    null,
    2
  )
);
fs.mkdirSync(path.join(D, 'app'));
fs.writeFileSync(path.join(D, 'app', 'version.json'), JSON.stringify({ version: '1.4.15', minService: '1.5.14' }));

// luna-send: the service calls it as  luna-send -n 1 -w <ms> -f <uri> <json>
const LUNA = {
  'com.webos.applicationManager/listApps': {
    returnValue: true,
    apps: [
      { id: 'netflix', title: 'Netflix', icon: 'icon.png', folderPath: path.join(APPS, 'netflix'), type: 'web', visible: true },
      // with its in-app search (as webOS 25's app manager lists it): for /api/search only, never in /api/apps
      {
        id: 'youtube.leanback.v4',
        title: 'YouTube',
        icon: 'missing.png',
        folderPath: path.join(APPS, 'youtube'),
        type: 'web',
        inAppSearchParams: '{ "contentTarget" : "q=$SEARCH_KEYWORD"}',
      },
      { id: 'com.webos.app.home', title: 'Home', icon: 'x.png', folderPath: APPS, visible: true },
      { id: 'com.webos.app.hidden', title: 'Hidden', icon: 'x.png', folderPath: APPS, visible: false },
    ],
  },
  'com.webos.applicationManager/getForegroundAppInfo': { returnValue: true, appId: 'netflix', windowId: '', processId: '' },
  'com.webos.service.eim/getAllInputStatus': {
    returnValue: true,
    devices: [{ id: 'HDMI_1', appId: 'com.webos.app.hdmi1', label: 'HDMI 1', connected: true }],
  },
  'com.webos.service.tv.systemproperty/getSystemInfo': {
    returnValue: true,
    sdkVersion: '10.2.2',
    firmwareVersion: '33.23.05',
    modelName: 'OLED65G26LA',
  },
};
fs.writeFileSync(
  path.join(BIN, 'luna-stub.js'),
  'var u=process.argv.slice(2).filter(function(a){return /^luna:/.test(a)})[0]||"";var k=u.replace("luna://","");' +
    'var t=' +
    JSON.stringify(LUNA) +
    ';fs=require("fs");fs.appendFileSync(' +
    JSON.stringify(path.join(tmp, 'luna.log')) +
    ',k+"\\n");' +
    'process.stdout.write(JSON.stringify(t[k]||{returnValue:true}))'
);
// systemctl list-units, for LG's running services
fs.writeFileSync(
  path.join(BIN, 'systemctl'),
  '#!/bin/sh\nprintf "sam.service loaded active running System and Application Manager\\nwebappmgr.service loaded active running Web App Manager\\n"\n',
  { mode: 0o755 }
);
fs.writeFileSync(
  path.join(BIN, 'luna-send'),
  '#!/bin/sh\nexec "' + process.execPath + '" "' + path.join(BIN, 'luna-stub.js') + '" "$@"\n',
  { mode: 0o755 }
);

// GitHub: the latest release and the list of releases (test builds)
const release = {
  tag_name: 'v99.1.0',
  body: 'Release notes.',
  assets: [
    'frontend-99.1.0.tgz',
    'frontend-99.1.0.tgz.sha256',
    'com.cleanyourtv.manager_99.1.0_all.ipk',
    'com.cleanyourtv.manager_99.1.0_all.ipk.sha256',
  ].map(n => ({ name: n, browser_download_url: 'http://127.0.0.1:1/' + n })),
};
const gh = http.createServer((q, r) => {
  r.setHeader('content-type', 'application/json');
  if (/\/releases\/latest$/.test(q.url)) return r.end(JSON.stringify(release));
  if (/\/releases\/tags\/dev$/.test(q.url))
    return r.end(
      JSON.stringify({
        tag_name: 'dev',
        prerelease: true,
        body: 'build: abcdef1\nbranch: dev',
        published_at: '2026-01-02T00:00:00Z',
        assets: [],
      })
    );
  // a fixed catalogue (Classic and Bloom from this checkout), so a theme added to the repository does not change the recorded replies
  if (q.url === '/themes/index.json') {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', 'index.json'), 'utf8'));
    idx.themes = idx.themes.filter(t => t.id === 'classic' || t.id === 'bloom');
    r.setHeader('content-type', 'application/octet-stream');
    return r.end(JSON.stringify(idx));
  }
  const f = path.join(ROOT, 'themes', q.url.replace(/^\/themes\//, '').replace(/\.\./g, '')); // the themes folder of this checkout
  if (q.url.indexOf('/themes/') === 0 && fs.existsSync(f) && fs.statSync(f).isFile()) {
    r.setHeader('content-type', 'application/octet-stream');
    return r.end(fs.readFileSync(f));
  }
  r.statusCode = 404;
  r.end('{}');
});

function request(method, p, body, origin) {
  return new Promise(resolve => {
    const data = body === undefined ? '' : JSON.stringify(body),
      headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) };
    if (origin !== undefined) headers.origin = origin;
    const q = http.request({ host: '127.0.0.1', port: 8765, method, path: p, headers }, r => {
      const b = [];
      r.on('data', c => b.push(c));
      r.on('end', () =>
        resolve({
          status: r.statusCode,
          type: r.headers['content-type'] || '',
          cors: r.headers['access-control-allow-origin'] || '',
          body: Buffer.concat(b),
        })
      );
    });
    q.on('error', e => resolve({ status: 0, type: '', cors: '', body: Buffer.from('connection error ' + e.code) }));
    q.end(data);
  });
}

// what changes from run to run (times, temporary paths, the version under test) is replaced before comparing
// (TV health: the window its shares are over, this service's own CPU and memory, the free space of this computer's folders)
const VOLATILE = [
  'ip',
  'checking',
  'checkedAt',
  'at',
  'now',
  'pickerShownAt',
  'fetchedAt',
  'started',
  'seconds',
  'expires',
  'uptime',
  'window',
  'self',
  'disks',
];
function clean(v, version) {
  if (Array.isArray(v)) return v.map(x => clean(x, version));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = VOLATILE.indexOf(k) >= 0 ? '<time>' : clean(v[k], version);
    return o;
  }
  if (typeof v === 'string') return v.split(tmp).join('<tmp>').split(version).join('<version>');
  return v;
}

const CALLS = [
  ['version', 'GET', '/api/version'],
  ['apps', 'GET', '/api/apps'],
  ['inputs', 'GET', '/api/inputs'],
  ['foreground', 'GET', '/api/foreground'],
  ['launch a bad id', 'POST', '/api/launch', { id: 'bad id!' }],
  ['launch', 'POST', '/api/launch', { id: 'netflix', params: { a: 1 } }],
  ['a web page is refused', 'GET', '/api/apps', undefined, 'http://evil.example'],
  ['preflight from our app', 'OPTIONS', '/api/apps', undefined, 'null'],
  ['webOS 6 app origin', 'GET', '/api/version', undefined, 'file://com.webos.app.home-webos'],
  ['a bare file:// origin on webOS 10 (only webOS 4 sends it)', 'GET', '/api/version', undefined, 'file://'],
  ['another app origin is refused', 'GET', '/api/version', undefined, 'file://com.other.app-webos'],
  [
    'save the launcher settings',
    'POST',
    '/api/config',
    { dock: ['netflix'], hidden: [], sort: 'alpha', clock: '24', junk: 1, options: { inputKey: true } },
  ],
  ['the launcher settings are kept, the rest too', 'GET', '/api/apps'],
  ['manager check', 'POST', '/api/manager/check'],
  ['manager status', 'GET', '/api/manager/status'],
  ['test builds', 'GET', '/api/manager/tests'],
  ['an option', 'POST', '/api/manager/options', { debloat: false, inputKey: false, liveTv: false }],
  ['notification api', 'GET', '/api/manager/notify-api'],
  ['sonos volume (off)', 'GET', '/api/sonos/status'],
  ['live status', 'GET', '/api/live/status'],
  ['live channels', 'GET', '/api/live/channels'],
  ['live state', 'GET', '/api/live/state'],
  ['themes', 'GET', '/api/theme/list'],
  ['voice', 'GET', '/api/voice/status'],
  // TV health: the first reading has no CPU shares yet; 2 s later the cores' counters have moved (and the load average was never read)
  ['tv health, first reading', 'GET', '/api/metrics'],
  [
    'tv health, 2 s later',
    'GET',
    '/api/metrics',
    undefined,
    undefined,
    async () => {
      fs.writeFileSync(path.join(PROC, 'stat'), cpuStat(200));
      await sleep(2100);
    },
  ],
  ['top processes', 'GET', '/api/metrics/processes?n=3'],
  ['open ports and services', 'GET', '/api/metrics/exposure'],
  ["LG's running services", 'GET', '/api/metrics/services'],
  ['icon', 'GET', '/icon/netflix'],
  ['icon of an app without the file', 'GET', '/icon/youtube.leanback.v4'],
  ['icon of an unknown app', 'GET', '/icon/nope'],
  ['log line', 'GET', '/api/log?m=contract%20test'],
  ['unknown route', 'GET', '/nope'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => gh.listen(0, '127.0.0.1', r));
  const ghUrl = 'http://127.0.0.1:' + gh.address().port;
  const env = Object.assign({}, process.env, {
    PATH: BIN + ':' + process.env.PATH,
    CYTV_DIR: D,
    CYTV_SERVICE_DIR: path.join(tmp, 'svc'),
    CYTV_LIVE_DIR: path.join(D, 'live'),
    CYTV_THEMES: path.join(tmp, 'themes'),
    CYTV_THEMES_URL: ghUrl + '/themes',
    CYTV_API: ghUrl,
    CYTV_RUNFILE: path.join(tmp, 'run.json'),
    CYTV_PROC: PROC,
    CYTV_SYS: SYS,
    CYTV_INITD: INITD,
    CYTV_DISKS: [D, tmp].join(':'),
    CYTV_SYSTEMCTL: path.join(BIN, 'systemctl'),
  });
  const log = fs.openSync(path.join(tmp, 'service.log'), 'w');
  const svc = cp.spawn(process.execPath, [path.join(helperDir, 'helper.js')], { env, cwd: helperDir, stdio: ['ignore', log, log] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(200);
    up = (await request('GET', '/api/version')).status === 200;
  }
  let failed = 0;
  const finish = code => {
    try {
      svc.kill('SIGKILL');
    } catch (_) {}
    gh.close();
    if (process.env.CYTV_CONTRACT_KEEP) console.error('kept ' + tmp);
    else cp.spawnSync('rm', ['-rf', tmp]);
    process.exit(code);
  };
  if (!up) {
    console.error('FAIL the service did not start:\n' + fs.readFileSync(path.join(tmp, 'service.log'), 'utf8').slice(-2000));
    return finish(1);
  }
  await sleep(1500); // let the start-up work (system info, theme catalogue) settle
  const version = JSON.parse((await request('GET', '/api/version')).body).version;
  const out = {};
  for (const [name, method, p, body, origin, before] of CALLS) {
    if (before) await before();
    const r = await request(method, p, body, origin === undefined ? 'null' : origin);
    let b;
    try {
      b = JSON.parse(r.body.toString());
    } catch (_) {
      b = r.body.length ? { bytes: r.body.length } : '';
    }
    out[name] = clean({ status: r.status, type: r.type, cors: r.cors, body: b }, version);
  }
  const conf = JSON.parse(fs.readFileSync(path.join(D, 'config.json'), 'utf8'));
  out['config.json afterwards'] = clean(conf, version);
  if (record) {
    fs.writeFileSync(GOLDEN, JSON.stringify(out, null, 1) + '\n');
    console.log('wrote ' + path.relative(ROOT, GOLDEN));
    return finish(0);
  }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  for (const k of Object.keys(want).concat(Object.keys(out).filter(k => !(k in want)))) {
    const a = JSON.stringify(want[k]),
      b = JSON.stringify(out[k]);
    if (a === b) {
      console.log('ok   api: ' + k);
      continue;
    }
    failed++;
    // show where the two first differ
    let d = 0;
    while (a && b && d < a.length && a[d] === b[d]) d++;
    const at = Math.max(0, d - 120);
    console.log(
      'FAIL api: ' + k + '\n  expected …' + (a || 'nothing').slice(at, d + 200) + '\n  got      …' + (b || 'nothing').slice(at, d + 200)
    );
  }
  // routes added after 1.5.16 (not in the golden file): the TV profile and which parts of the service run
  if (!/^1\.5\./.test(version)) {
    const tv = JSON.parse((await request('GET', '/api/tv', undefined, 'null')).body);
    const sv = JSON.parse((await request('GET', '/api/service', undefined, 'null')).body);
    const want = [
      'core',
      'notify',
      'voice',
      'live',
      'theme',
      'wallpapers',
      'photofeed',
      'watch',
      'search',
      'cards',
      'remote',
      'inputkey',
      'notifyapi',
      'sonos',
      'lgpreload',
      'lgsettings',
      'lgscreensaver',
      'debloatcheck',
      'manager',
      'apps',
      'running',
      'metrics',
    ];
    const okTv = tv.sdk === '10.2.2' && tv.pickerMode === 'overlay' && tv.notifyWindow === 'topui';
    const okSv = JSON.stringify(sv.features) === JSON.stringify(want) && !Object.keys(sv.failed).length;
    console.log((okTv ? 'ok   ' : 'FAIL ') + 'api: /api/tv gives the TV profile');
    console.log((okSv ? 'ok   ' : 'FAIL ') + 'api: /api/service lists every part as running: ' + JSON.stringify(sv));
    if (!okTv) failed++;
    if (!okSv) failed++;
    const appsBody = (await request('GET', '/api/apps', undefined, 'null')).body;
    const okFam =
      appsBody.indexOf('SECRET-feed-token') < 0 && appsBody.indexOf('127.0.0.1:9') < 0 && /"photoFeed":\{"photos":0\}/.test(appsBody);
    console.log(
      (okFam ? 'ok   ' : 'FAIL ') + 'api: the launcher gets whether there are photos in the feed, never the feed token or address'
    );
    if (!okFam) failed++;
    // Search (search.js, added after 1.6.32): YouTube's own search with the words, nothing else on this TV; the same checks as the
    // other routes (a web page is refused); the launcher's app list does not carry the apps' search parameters
    const sr = await request('GET', '/api/search?q=' + encodeURIComponent('  Cats & dogs  '), undefined, 'null');
    let srJ = null;
    try {
      srJ = JSON.parse(sr.body.toString());
    } catch (_) {}
    const okSearch =
      sr.status === 200 &&
      JSON.stringify(srJ) ===
        JSON.stringify({
          q: 'Cats & dogs',
          groups: [
            {
              id: 'search',
              items: [
                {
                  key: 'search-youtube.leanback.v4',
                  app: 'youtube.leanback.v4',
                  appTitle: 'YouTube',
                  launch: { id: 'youtube.leanback.v4', params: { contentTarget: 'q=Cats %26 dogs' } },
                },
              ],
            },
          ],
        });
    console.log((okSearch ? 'ok   ' : 'FAIL ') + 'api: /api/search gives YouTube searching for the words: ' + sr.status + ' ' + sr.body);
    if (!okSearch) failed++;
    const srWeb = await request('GET', '/api/search?q=cats', undefined, 'http://evil.example');
    const okWeb = srWeb.status === 403 && srWeb.body.indexOf('groups') < 0;
    console.log((okWeb ? 'ok   ' : 'FAIL ') + 'api: /api/search refuses a web page');
    if (!okWeb) failed++;
    const okHidden = appsBody.indexOf('SEARCH_KEYWORD') < 0 && appsBody.indexOf('inAppSearch') < 0;
    console.log((okHidden ? 'ok   ' : 'FAIL ') + "api: /api/apps does not carry the apps' search parameters");
    if (!okHidden) failed++;
  }
  console.log(failed ? failed + ' API contract check(s) failed' : 'the API answers as recorded');
  finish(failed ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
