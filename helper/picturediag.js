// A black picture with only the sound or the subtitles, in every app: LG mutes each app's video as its stream starts and never lifts it
// (its avmutemanager: setAvMute videoMute on, by com.webos.service.videooutput, and no videoMute off), seen on the owner's living-room TV
// on 2026-11-01 and 2026-11-03 right after a start of the TV; LG recorded no crash, and the next restart cleared it. LG keeps its logs
// in RAM (/var/log, turned over within minutes), so a restart wipes what would say why. This part keeps copies on the TV's storage:
//   - a few minutes into each start of the TV (when the service starts with the TV up less than 15 minutes, so not after an update):
//     LG's logs from the start (boot-<time>), the last 2 starts kept;
//   - Fix the picture (the phone remote's TV sheet, the manager): LG's logs at that moment (picture-<time>), the last 3 kept, then the
//     TV restarts, the one fix seen to work; at most once in 5 minutes.
// Each copy is a folder in diag/ that only root can read, with a summary.json (the TV's uptime, the app in front, LG's video mutes on
// and off and its punch-through warnings in the log): LG's logs carry the TV's own sign-in headers (sdx), so they never leave the TV.
//   POST /api/picture/fix   {restart: true} the logs kept, then the TV restarts 2 s later: {saved, restarting}; without restart only kept
//   GET  /api/picture/diag  the copies kept: {copies: [{name, files, bytes}]}
const fs = require('fs'),
  os = require('os'),
  path = require('path');
const P = require('./paths'),
  web = require('./web');

const SOURCES = [
  '/var/log/dbg-log',
  '/var/log/dbg-log.0.gz',
  '/var/log/dbg-log.1.gz',
  '/var/log/dbg-log.2.gz',
  '/var/log/messages',
  '/var/log/messages.0.gz',
  '/var/log/bootd.log',
  '/tmp/cleanyourtv-boot.log',
  '/tmp/cleanyourtv-helper.log',
];
const MAX_FILE = 8 << 20; // a log larger than this is left out
const KEEP = { boot: 2, picture: 3 };

// ctx: {luna, profile}; o: {dir, sources, uptime, bootAtS, restartMs, everyMs, now} (tests)
function create(ctx, opts) {
  const o = Object.assign(
    {
      dir: path.join(P.D, 'diag'),
      sources: SOURCES,
      uptime: () => os.uptime(),
      bootAtS: 240, // the start's copy, this long into it
      lateS: 900, // a service started later than this is not a start of the TV
      restartMs: 2000,
      everyMs: 5 * 60 * 1000,
      now: () => new Date(),
    },
    opts
  );
  let lastFix = 0,
    timer = null;
  const stamp = () => o.now().toISOString().replace(/[:.]/g, '-');
  // LG's video mutes and punch-through warnings in its current log, for the summary
  function counts() {
    let t = '';
    try {
      t = fs.readFileSync(o.sources[0], 'utf8');
    } catch (_) {}
    const n = re => (t.match(re) || []).length;
    return {
      videoMuteOn: n(/setAvMute[^\n]*"muteOn":true[^\n]*"muteType":"videoMute"/g),
      videoMuteOff: n(/setAvMute[^\n]*"muteOn":false[^\n]*"muteType":"videoMute"/g),
      punchThrough: n(/Punch through is not working/g),
    };
  }
  function prune(kind) {
    let names = [];
    try {
      names = fs
        .readdirSync(o.dir)
        .filter(n => n.indexOf(kind + '-') === 0)
        .sort();
    } catch (_) {}
    while (names.length > KEEP[kind]) {
      const d = path.join(o.dir, names.shift());
      try {
        for (const f of fs.readdirSync(d)) fs.unlinkSync(path.join(d, f));
        fs.rmdirSync(d);
      } catch (_) {}
    }
  }
  // a copy of the logs now, as <kind>-<time>; its name, or '' when nothing could be written
  async function keep(kind, why) {
    const name = kind + '-' + stamp(),
      d = path.join(o.dir, name);
    try {
      fs.mkdirSync(o.dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(o.dir, 0o700);
      fs.mkdirSync(d, { mode: 0o700 });
    } catch (_) {
      return '';
    }
    const files = [];
    for (const f of o.sources)
      try {
        const st = fs.statSync(f);
        if (!st.isFile() || st.size > MAX_FILE) continue;
        const to = path.join(d, path.basename(f));
        fs.copyFileSync(f, to);
        fs.chmodSync(to, 0o600);
        files.push(path.basename(f));
      } catch (_) {}
    let fg = '';
    try {
      const r = await ctx.luna('luna://com.webos.applicationManager/getForegroundAppInfo', {});
      fg = (r && r.appId) || '';
    } catch (_) {}
    const p = (ctx.profile && ctx.profile.get && ctx.profile.get()) || {};
    const summary = Object.assign(
      { why, at: o.now().toISOString(), uptime: Math.round(o.uptime()), foreground: fg, sdk: p.sdk || '' },
      counts(),
      {
        files,
      }
    );
    try {
      fs.writeFileSync(path.join(d, 'summary.json'), JSON.stringify(summary, null, 1) + '\n', { mode: 0o600 });
    } catch (_) {}
    prune(kind);
    console.log('picturediag: ' + why + ': LG logs kept in diag/' + name + ' (' + files.length + ' files)');
    return name;
  }
  // Fix the picture: the logs kept, then (with restart) the TV restarted
  async function fix(b) {
    const restart = !!(b && b.restart);
    if (restart && Date.now() - lastFix < o.everyMs) return { error: 'the TV was restarted for this a moment ago', code: 429 };
    const saved = await keep('picture', (b && b.why) || 'Fix the picture');
    if (!restart) return { saved };
    lastFix = Date.now();
    setTimeout(() => {
      Promise.resolve(ctx.luna('luna://com.webos.service.tvpower/power/reboot', { reason: 'remoteKey' })).catch(() => {});
    }, o.restartMs);
    return { saved, restarting: true };
  }
  function copies() {
    let names = [];
    try {
      names = fs.readdirSync(o.dir).sort();
    } catch (_) {}
    return names.map(name => {
      let files = [],
        bytes = 0;
      try {
        files = fs.readdirSync(path.join(o.dir, name));
        for (const f of files) bytes += fs.statSync(path.join(o.dir, name, f)).size;
      } catch (_) {}
      return { name, files: files.length, bytes };
    });
  }
  function start() {
    const up = o.uptime();
    if (up >= o.lateS) return;
    timer = setTimeout(() => keep('boot', 'a start of the TV').catch(() => {}), Math.max(0, o.bootAtS - up) * 1000);
    if (timer.unref) timer.unref();
  }
  return {
    name: 'picturediag',
    paths: ['/api/picture/fix', '/api/picture/diag'],
    async handle(req, res, u, body) {
      if (u === '/api/picture/fix' && req.method === 'POST') {
        const r = await fix(await (body || web.body)(req));
        return r.error ? web.json(res, { error: r.error }, r.code) : web.json(res, r);
      }
      if (u === '/api/picture/diag' && req.method === 'GET') return web.json(res, { copies: copies() });
      web.notFound(res);
    },
    start,
    keep,
    fix,
    copies,
  };
}

module.exports = { create, SOURCES };
