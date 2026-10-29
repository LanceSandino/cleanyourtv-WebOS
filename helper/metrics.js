// TV health, read only when someone looks (the manager's TV health screen; a paired phone's TV tab through statusdata.js): per-core
// CPU from /proc/stat deltas, the temperature, each core's clock, memory and swap, the eMMC's wear, the Wi-Fi signal and traffic,
// free space, the uptime, and this service's own CPU and memory. Everything is read in this process from /proc and /sys, never with
// a program per reading; free space comes from fs.statfs where Node has it (webOS 26) and from one df at most once a minute where it
// does not (Node 16 on webOS 25). Where the temperature and the clock are is decided in tvprofile.js (sensors).
// Speed and cost: nothing runs while nobody asks (no timer, no history kept on the TV: hours of history belong on a computer that
// stays on, docs/remote.md). One reading is shared by every caller for 2 s, and callers that come together wait for the same one.
// CPU shares are the change since the previous reading, which must be at least 2 s and at most 30 s old; the first reading after a
// pause has none yet ("measuring"). A core that goes offline (LG hot-plugs them) counts as idle, so the total never goes backwards.
// /proc/loadavg is never read: on the Realtek TVs about 30 kernel threads wait in D state for ever and hold it near 32 while idle.
//   GET /api/metrics             the reading
//   GET /api/metrics/processes   the top processes by CPU (two sweeps of /proc/<pid>/stat at least 2 s apart; the previous sweep is
//                                reused when it is 2 to 30 s old) and by memory; ?n=1..20 (8)
//   GET /api/metrics/exposure    the ports open on the TV, how each is guarded, and the services (exposure.js; cached 30 s)
//   GET /api/metrics/services    LG's running systemd services (exposure.js; cached a minute)
const fs = require('fs');
const P = require('./paths'),
  web = require('./web'),
  exec = require('./exec'),
  tvprofile = require('./tvprofile');

const MIN_MS = 2000, // the shortest window for a CPU share and the life of a cached reading
  MAX_MS = 30000, // a previous reading older than this is not used for shares (they would be a long average, not "now")
  DF_MS = 60000, // df at most once a minute (Node 16 has no statfs)
  EMMC_MS = 10 * 60000, // the eMMC's wear changes over months
  HZ = 100, // USER_HZ: /proc/<pid>/stat counts in hundredths of a second on Linux
  CHUNK = 64; // processes read between two turns of the event loop, so a sweep never holds the service for long

const read = f => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch (_) {
    return '';
  }
};
const num = s => {
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};
const round = (n, d) => (n === null || n === undefined ? null : Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0));

// ---- the parsers (pure, tested with fake files in tools/test/metrics.test.js) ----

// /proc/stat: the counters of each core (user nice system idle iowait irq softirq steal, in ticks); the "cpu" line of all cores is
// left out: it sums only the cores online at that moment, so it can go backwards when LG takes one offline
function parseCpu(text) {
  const cores = {};
  for (const line of String(text).split('\n')) {
    const m = /^cpu(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim().split(/\s+/).map(Number);
    let total = 0;
    for (let i = 0; i < 8 && i < v.length; i++) total += v[i] || 0;
    cores[m[1]] = { total, idle: (v[3] || 0) + (v[4] || 0) };
  }
  return cores;
}
// the busy share (0..1) of each of `count` cores between two parses; a core missing from either (offline) or whose counters went
// backwards counts as idle
function cpuShares(prev, cur, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = prev && prev[i],
      b = cur && cur[i];
    const dt = a && b ? b.total - a.total : 0,
      di = a && b ? b.idle - a.idle : 0;
    out.push({ id: i, online: !!b, busy: dt > 0 && di >= 0 && di <= dt ? (dt - di) / dt : 0 });
  }
  return out;
}
// "0-3" or "0-1,3" (the cores there are, sys/devices/system/cpu/present): how many, counting from 0
function coreCount(present) {
  let n = 0;
  for (const part of String(present || '')
    .trim()
    .split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (m) n = Math.max(n, +(m[2] || m[1]) + 1);
  }
  return n;
}
// /proc/meminfo in bytes: total, available (MemAvailable, or free + buffers + cached on an old kernel), swap total and free
function parseMeminfo(text) {
  const kb = {};
  for (const line of String(text).split('\n')) {
    const m = /^(\w+(?:\(\w+\))?):\s+(\d+)/.exec(line);
    if (m) kb[m[1]] = +m[2];
  }
  const avail = kb.MemAvailable !== undefined ? kb.MemAvailable : (kb.MemFree || 0) + (kb.Buffers || 0) + (kb.Cached || 0);
  return {
    total: (kb.MemTotal || 0) * 1024,
    available: avail * 1024,
    swapTotal: (kb.SwapTotal || 0) * 1024,
    swapFree: (kb.SwapFree || 0) * 1024,
  };
}
// /proc/swaps: each swap device or file by its last name (f2io-0, zram0), its kind, size and use in bytes
function parseSwaps(text) {
  return String(text)
    .split('\n')
    .slice(1)
    .map(l => l.trim().split(/\s+/))
    .filter(c => c.length >= 4 && /^\d+$/.test(c[2]))
    .map(c => ({ name: c[0].split('/').pop(), type: c[1], size: +c[2] * 1024, used: +c[3] * 1024 }));
}
// /proc/net/dev: bytes received and sent per interface
function parseNetDev(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const m = /^\s*([\w.-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim().split(/\s+/).map(Number);
    if (v.length >= 9) out[m[1]] = { rx: v[0], tx: v[8] };
  }
  return out;
}
// /proc/net/wireless: the signal in dBm (the level is an unsigned byte on some drivers: 216 is -40) and the link quality
function parseWireless(text) {
  const out = {};
  for (const line of String(text).split('\n').slice(2)) {
    const m = /^\s*([\w.-]+):\s+\S+\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(line);
    if (!m) continue;
    let level = parseFloat(m[3]);
    if (level > 63) level -= 256;
    out[m[1]] = { dbm: level ? Math.round(level) : null, quality: Math.round(parseFloat(m[2])) || null };
  }
  return out;
}
// the eMMC's wear (JEDEC): life_time "0x01 0x01" (each 0x01..0x0A is 0-10% .. 90-100% used, 0x0B past its life) and pre_eol_info
// (0x01 normal, 0x02 warning: 80% of the reserve used, 0x03 urgent)
function parseEmmc(lifeTime, preEol) {
  const level = h => {
    const n = parseInt(h, 16);
    if (!(n >= 1 && n <= 11)) return null;
    return n === 11 ? 'past its life' : (n - 1) * 10 + '-' + n * 10 + '%';
  };
  const lt = String(lifeTime || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const eol = { 1: 'normal', 2: 'warning', 3: 'urgent' }[parseInt(String(preEol || '').trim(), 16)] || null;
  if (!lt.length && !eol) return null;
  return { used: lt.map(level).filter(Boolean), eol };
}
// df -Pk <paths>: the size and free space of each path, in the order asked
function parseDf(text, paths) {
  const lines = String(text)
    .split('\n')
    .slice(1)
    .map(l => l.trim().split(/\s+/))
    .filter(c => c.length >= 6 && /^\d+$/.test(c[1]));
  return paths.map((p, i) =>
    lines[i] ? { path: p, size: +lines[i][1] * 1024, free: +lines[i][3] * 1024 } : { path: p, size: null, free: null }
  );
}
// /proc/<pid>/stat: the name (comm, 15 characters), the state, CPU ticks (user + system), the threads and the resident pages
function parsePidStat(text) {
  const s = String(text),
    a = s.indexOf('('),
    b = s.lastIndexOf(')');
  if (a < 0 || b < a) return null;
  const f = s.slice(b + 2).split(' ');
  if (f.length < 22) return null;
  return { comm: s.slice(a + 1, b), state: f[0], ticks: (+f[11] || 0) + (+f[12] || 0), threads: +f[17] || 0, rss: +f[21] || 0 };
}
// a readable name for an interpreter's process: the script it runs ("node helper.js" -> helper.js), only when that looks like a file
// name (nothing that could be an address or a key)
function scriptName(comm, cmdline) {
  if (!/^(node|sh|bash|python[\d.]*|busybox|ash)$/.test(comm)) return comm;
  const args = String(cmdline || '')
    .split('\0')
    .slice(1)
    .filter(x => x && x.charAt(0) !== '-');
  const base = args.length ? args[0].split('/').pop() : '';
  return /^[\w.+-]{1,40}$/.test(base) && /\.(js|sh|py)$/.test(base) ? comm + ' ' + base : comm;
}

// ---- the part ----
function create(ctx) {
  const sensors = tvprofile.sensors(P.PROC, P.SYS, f => fs.existsSync(f));
  let cores = 0,
    zones = null,
    pageSize = 0;
  let base = null, // the previous raw sample: {at, cpu, net, self}
    last = null, // the last reply and when it was made
    inflight = null;
  let disks = null, // {at, list}
    dfRun = null,
    emmc = null;

  function coreTotal(cpu) {
    if (!cores) cores = coreCount(read(sensors.cpu + '/present'));
    const seen = Object.keys(cpu).reduce((n, k) => Math.max(n, +k + 1), 0);
    return Math.max(cores, seen);
  }
  function mhz(i) {
    const k = num(read(sensors.cpu + '/cpu' + i + '/cpufreq/scaling_cur_freq'));
    return k ? Math.round(k / 1000) : null;
  }
  function temperature() {
    const t = sensors.temperature;
    if (t.kind === 'lg') {
      const c = num(read(t.path));
      return c ? { c: Math.round(c), source: 'lg' } : null; // 0 for about 80 s after a start
    }
    if (!zones)
      try {
        zones = fs
          .readdirSync(t.dir)
          .filter(z => /^thermal_zone\d+$/.test(z))
          .sort();
      } catch (_) {
        zones = [];
      }
    let best = null;
    for (const z of zones) {
      let v = num(read(t.dir + '/' + z + '/temp'));
      if (v === null) continue;
      if (Math.abs(v) >= 1000) v /= 1000; // millidegrees
      if (v <= 0 || v > 150) continue;
      if (!best || v > best.c)
        best = {
          c: Math.round(v),
          source:
            read(t.dir + '/' + z + '/type')
              .trim()
              .slice(0, 30) || z,
        };
    }
    return best;
  }
  function emmcWear() {
    if (emmc && Date.now() - emmc.at < EMMC_MS) return emmc.value;
    const value = parseEmmc(read(sensors.emmc + '/life_time'), read(sensors.emmc + '/pre_eol_info'));
    emmc = { at: Date.now(), value };
    return value;
  }
  // free space: statfs where Node has it (18.15 and newer), else one df for every path, at most once a minute
  function storage() {
    if (disks && Date.now() - disks.at < DF_MS) return Promise.resolve(disks.list);
    if (dfRun) return dfRun;
    const statfs = /** @type {any} */ (fs).statfs;
    const job = statfs
      ? Promise.all(
          P.DISKS.map(
            p =>
              new Promise(resolve =>
                statfs(p, (e, s) =>
                  resolve(e ? { path: p, size: null, free: null } : { path: p, size: s.blocks * s.bsize, free: s.bavail * s.bsize })
                )
              )
          )
        )
      : exec.run('df', ['-Pk'].concat(P.DISKS), { timeout: 5000 }).then(r => parseDf(r.out, P.DISKS));
    dfRun = job.then(list => {
      disks = { at: Date.now(), list };
      dfRun = null;
      return list;
    });
    return dfRun;
  }

  async function take() {
    const now = Date.now(),
      cpu = parseCpu(read(P.PROC + '/stat')),
      net = parseNetDev(read(P.PROC + '/net/dev')),
      self = process.cpuUsage();
    const prev = base && now - base.at >= MIN_MS && now - base.at <= MAX_MS ? base : null;
    const secs = prev ? (now - prev.at) / 1000 : 0;
    const n = coreTotal(cpu);
    const shares = prev ? cpuShares(prev.cpu, cpu, n) : null;
    const coreList = [];
    for (let i = 0; i < n; i++)
      coreList.push({ id: i, online: !!cpu[i], busy: shares ? round(shares[i].busy * 100, 1) : null, mhz: cpu[i] ? mhz(i) : null });
    const mem = parseMeminfo(read(P.PROC + '/meminfo'));
    const wl = parseWireless(read(P.PROC + '/net/wireless'));
    const ifaces = ['wlan0', 'eth0']
      .filter(k => net[k] && (k === 'wlan0' || net[k].rx + net[k].tx > 0))
      .map(k => {
        const p = prev && prev.net[k];
        return Object.assign(
          {
            name: k,
            rx: p && net[k].rx >= p.rx ? Math.round((net[k].rx - p.rx) / secs) : null,
            tx: p && net[k].tx >= p.tx ? Math.round((net[k].tx - p.tx) / secs) : null,
          },
          wl[k] || {}
        );
      });
    const m = process.memoryUsage();
    if (!base || now - base.at >= MIN_MS) base = { at: now, cpu, net, self };
    return {
      at: now,
      window: prev ? round(secs, 1) : null, // seconds the CPU shares and rates are over; null: measuring (the next reading has them)
      uptime: Math.round(num(read(P.PROC + '/uptime')) || 0),
      cpu: {
        total: shares ? round((shares.reduce((s, c) => s + c.busy, 0) / Math.max(1, n)) * 100, 1) : null,
        cores: coreList,
      },
      temp: temperature(),
      memory: {
        total: mem.total,
        available: mem.available,
        swap: { total: mem.swapTotal, used: mem.swapTotal - mem.swapFree, devices: parseSwaps(read(P.PROC + '/swaps')) },
      },
      disks: await storage(),
      emmc: emmcWear(),
      net: ifaces,
      // this service: its CPU in % of one core over the same window, its memory
      self: {
        cpu: prev ? round(((self.user - prev.self.user + self.system - prev.self.system) / 1000 / (secs * 1000)) * 100, 1) : null,
        rss: m.rss,
        heap: m.heapUsed,
      },
    };
  }
  // the reading: one every 2 s at most, shared
  function reading() {
    if (last && Date.now() - last.at < MIN_MS) return Promise.resolve(last.reply);
    if (!inflight)
      inflight = take().then(
        r => {
          inflight = null;
          last = { at: Date.now(), reply: r };
          return r;
        },
        e => {
          inflight = null;
          throw e;
        }
      );
    return inflight;
  }

  // ---- processes, only on request ----
  let procBase = null, // {at, map pid -> {ticks}}
    procLast = null,
    procRun = null;
  // bytes per page, from this process's own resident pages against what Node reports (4096 on the TVs seen)
  function page() {
    if (pageSize) return pageSize;
    const st = parsePidStat(read(P.PROC + '/' + process.pid + '/stat'));
    const ratio = st && st.rss ? process.memoryUsage().rss / st.rss : 0;
    pageSize = ratio > 1024 ? Math.pow(2, Math.round(Math.log(ratio) / Math.LN2)) : 4096;
    return pageSize;
  }
  async function sweep() {
    let pids = [];
    try {
      pids = fs.readdirSync(P.PROC).filter(p => /^\d+$/.test(p));
    } catch (_) {}
    const map = new Map();
    for (let i = 0; i < pids.length; i += CHUNK) {
      for (const pid of pids.slice(i, i + CHUNK)) {
        const s = parsePidStat(read(P.PROC + '/' + pid + '/stat'));
        if (s) map.set(+pid, s);
      }
      if (i + CHUNK < pids.length) await new Promise(r => setImmediate(r));
    }
    return { at: Date.now(), map };
  }
  async function measure(n) {
    let a = procBase && Date.now() - procBase.at >= MIN_MS && Date.now() - procBase.at <= MAX_MS ? procBase : null;
    if (!a) {
      a = await sweep();
      await new Promise(r => setTimeout(r, MIN_MS));
    }
    const b = await sweep();
    procBase = b;
    const secs = (b.at - a.at) / 1000,
      ps = page();
    const all = [];
    b.map.forEach((s, pid) => {
      const p = a.map.get(pid);
      all.push({ pid, s, cpu: p && s.ticks >= p.ticks ? ((s.ticks - p.ticks) / HZ / secs) * 100 : 0 });
    });
    const named = new Map();
    const row = x => {
      if (!named.has(x.pid)) named.set(x.pid, scriptName(x.s.comm, read(P.PROC + '/' + x.pid + '/cmdline')));
      return {
        pid: x.pid,
        name: named.get(x.pid),
        ours: x.pid === process.pid || undefined,
        cpu: round(x.cpu, 1),
        rss: x.s.rss * ps,
        threads: x.s.threads,
      };
    };
    return {
      window: round(secs, 1),
      tasks: all.length,
      byCpu: all
        .slice()
        .sort((x, y) => y.cpu - x.cpu || y.s.rss - x.s.rss)
        .slice(0, n)
        .map(row),
      byMemory: all
        .slice()
        .sort((x, y) => y.s.rss - x.s.rss)
        .slice(0, n)
        .map(row),
    };
  }
  function processes(n) {
    const want = Math.max(1, Math.min(20, Math.round(+n || 8)));
    if (procLast && procLast.n >= want && Date.now() - procLast.at < MIN_MS) return Promise.resolve(trim(procLast.reply, want));
    if (!procRun)
      procRun = measure(Math.max(want, 8)).then(
        r => {
          procRun = null;
          procLast = { at: Date.now(), n: Math.max(want, 8), reply: r };
          return r;
        },
        e => {
          procRun = null;
          throw e;
        }
      );
    return procRun.then(r => trim(r, want));
  }
  const trim = (r, n) => Object.assign({}, r, { byCpu: r.byCpu.slice(0, n), byMemory: r.byMemory.slice(0, n) });

  const exposure = require('./exposure').create(ctx);

  async function handle(req, res, u) {
    if (req.method !== 'GET') return web.json(res, { error: 'GET expected' }, 405);
    if (u === '/api/metrics') return web.json(res, await reading());
    if (u === '/api/metrics/processes') {
      const m = /[?&]n=(\d+)/.exec(req.url || '');
      return web.json(res, await processes(m ? +m[1] : 8));
    }
    if (u === '/api/metrics/exposure') return web.json(res, await exposure.report());
    if (u === '/api/metrics/services') return web.json(res, await exposure.lgServices());
    web.notFound(res);
  }

  return {
    name: 'metrics',
    paths: ['/api/metrics', '/api/metrics/processes', '/api/metrics/exposure', '/api/metrics/services'],
    handle,
    reading,
    processes,
    exposure: exposure.report,
    lgServices: exposure.lgServices,
  };
}

module.exports = {
  create,
  parseCpu,
  cpuShares,
  coreCount,
  parseMeminfo,
  parseSwaps,
  parseNetDev,
  parseWireless,
  parseEmmc,
  parseDf,
  parsePidStat,
  scriptName,
};
