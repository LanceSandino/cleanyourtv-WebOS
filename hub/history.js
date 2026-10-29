// The TV's health over time, kept on the hub and not on the TV (D-20261029-6): while the TV is linked (server.js) the hub asks it for
// its read-only status every 25 s (metrics.js answers in about 3.5 ms; under 30 s apart so every reading has CPU shares) and keeps a
// small line per sample in a file per day (data/history/YYYY-MM-DD.ndjson, about 0.5 MB a day, kept 30 days). Every hour it reads the
// open ports too. Alerts: the TV hot for 5 minutes, little memory or swap left, /var nearly full, the service using a lot of memory,
// the flash wearing out, a debloat group no longer in place, a new port open to the network or a red one; each is raised once and
// cleared when it passes, kept in data/alerts.json, and posted to a webhook (ALERT_WEBHOOK: ntfy, Home Assistant...) when one is set.
//   create({data, ask(url) -> Promise<{status, body}>, linked() -> bool, sampleMs, exposureMs, keepDays, limits, webhook})
//   -> {sample(), exposureCheck(), data(hours) -> {samples, alerts, ports, last}, stop()}
'use strict';
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  https = require('https');

const MB = 1048576;
const DEFAULT_LIMITS = { temp: 75, tempSamples: 12, memMB: 150, swapPct: 90, varMB: 50, rssMB: 250, samples: 3 };

// one sample, small: what the graphs and the alerts use, nothing else of the reading
function compact(m, st) {
  if (!m || typeof m !== 'object') return null;
  const free = p => {
    const d = (m.disks || []).filter(x => x && x.path === p)[0];
    return d && d.free != null ? Math.round(d.free / MB) : null;
  };
  const mem = m.memory || {},
    swap = mem.swap || {},
    wl = (m.net || {}).wlan0 || {},
    self = m.self || {};
  const groups = ((st && st.debloat && st.debloat.check && st.debloat.check.groups) || []).filter(g => g && g.ok === false).map(g => g.id);
  return {
    t: +m.at || Date.now(),
    cpu: m.cpu && m.cpu.total != null ? m.cpu.total : null,
    temp: m.temp && m.temp.c ? m.temp.c : null,
    mem: mem.available != null ? Math.round(mem.available / MB) : null,
    swap: swap.total ? Math.round((swap.used / swap.total) * 100) : null,
    var: free('/var'),
    tmp: free('/tmp'),
    dev: free('/media/developer'),
    dbm: wl.dbm != null ? wl.dbm : null,
    rx: wl.rx != null ? wl.rx : null,
    tx: wl.tx != null ? wl.tx : null,
    scpu: self.cpu != null ? self.cpu : null,
    rss: self.rss != null ? Math.round(self.rss / MB) : null,
    eol: m.emmc && m.emmc.eol ? m.emmc.eol : null,
    off: groups.length ? groups : undefined,
  };
}

function create(opts) {
  const o = { sampleMs: 25000, exposureMs: 3600000, keepDays: 30, limits: {}, webhook: '' };
  for (const k of Object.keys(opts || {})) if (opts[k] != null) o[k] = opts[k]; // an option left unset keeps its default
  const L = Object.assign({}, DEFAULT_LIMITS, o.limits);
  const dir = path.join(o.data, 'history'),
    alertFile = path.join(o.data, 'alerts.json'),
    portFile = path.join(o.data, 'ports.json');
  try {
    fs.mkdirSync(dir);
  } catch (_) {}
  const load = (f, d) => {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (_) {
      return d;
    }
  };
  const save = (f, v) => {
    try {
      fs.writeFileSync(f + '.tmp', JSON.stringify(v));
      fs.renameSync(f + '.tmp', f);
    } catch (_) {}
  };
  let alerts = load(alertFile, { active: {}, recent: [] }),
    known = load(portFile, null), // the ports open to the network last time: a new one is an alert
    exposure = null,
    last = null;
  const streak = {};

  function post(text) {
    if (!/^https?:\/\//.test(o.webhook || '')) return;
    try {
      const u = new URL(o.webhook),
        body = JSON.stringify({ title: 'TV', message: text, text });
      const r = (u.protocol === 'https:' ? https : http).request(
        u,
        { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 5000 },
        x => x.resume()
      );
      r.on('error', () => {});
      r.on('timeout', () => r.destroy());
      r.end(body);
    } catch (_) {}
  }
  function raise(id, text) {
    if (alerts.active[id]) return;
    const a = { id, text, at: Date.now() };
    alerts.active[id] = a;
    alerts.recent = [Object.assign({ state: 'raised' }, a)].concat(alerts.recent).slice(0, 50);
    save(alertFile, alerts);
    console.log('hub: alert: ' + text);
    post(text);
  }
  function clear(id) {
    const a = alerts.active[id];
    if (!a) return;
    delete alerts.active[id];
    alerts.recent = [{ id, text: a.text, at: Date.now(), state: 'cleared' }].concat(alerts.recent).slice(0, 50);
    save(alertFile, alerts);
    console.log('hub: cleared: ' + a.text);
  }
  // a rule that must hold for n samples in a row before it is raised, and clears as soon as it no longer holds
  function rule(id, bad, n, text) {
    streak[id] = bad ? (streak[id] || 0) + 1 : 0;
    if (bad && streak[id] >= n) raise(id, text);
    else if (!bad) clear(id);
  }
  function check(s) {
    rule('hot', s.temp != null && s.temp >= L.temp, L.tempSamples, 'The TV is hot: ' + s.temp + ' °C');
    rule('memory', s.mem != null && s.mem < L.memMB, L.samples, 'The TV is low on memory: ' + s.mem + ' MB free');
    rule('swap', s.swap != null && s.swap >= L.swapPct, L.samples, "The TV's swap is " + s.swap + '% full');
    rule('var', s.var != null && s.var < L.varMB, L.samples, "The TV's /var has " + s.var + ' MB left');
    rule('service', s.rss != null && s.rss >= L.rssMB, L.samples, 'The CleanYourTV service uses ' + s.rss + ' MB');
    rule('flash', !!s.eol && s.eol !== 'normal', 1, "The TV's flash memory reports " + s.eol + ' wear');
    rule('debloat', !!s.off, 2, 'Debloat not in place: ' + (s.off || []).join(', '));
  }
  function day(t) {
    return new Date(t).toISOString().slice(0, 10);
  }
  async function sample() {
    if (!o.linked()) return;
    let r = null;
    try {
      r = await o.ask('/status-data');
    } catch (_) {}
    if (!r || r.status !== 200) return;
    let d = null;
    try {
      d = JSON.parse(r.body);
    } catch (_) {}
    const s = d && compact(d.metrics, d.settings);
    if (!s) return;
    last = s;
    try {
      fs.appendFileSync(path.join(dir, day(s.t) + '.ndjson'), JSON.stringify(s) + '\n');
    } catch (_) {}
    check(s);
  }
  // the ports: a port open to the network that was not open before, or one marked red, is an alert
  async function exposureCheck() {
    if (!o.linked()) return;
    let r = null;
    try {
      r = await o.ask('/status-exposure');
    } catch (_) {}
    if (!r || r.status !== 200) return;
    let d = null;
    try {
      d = JSON.parse(r.body);
    } catch (_) {}
    const ports = d && Array.isArray(d.ports) ? d.ports : null;
    if (!ports) return;
    exposure = { at: Date.now(), ports: ports.slice(0, 80) };
    const lan = ports.filter(p => p && p.bind === 'LAN').map(p => p.proto + '/' + p.port);
    if (known) {
      const fresh = lan.filter(k => known.indexOf(k) < 0);
      if (fresh.length) raise('port:' + fresh.join(','), 'New on the network: ' + fresh.join(', '));
    }
    for (const p of ports)
      if (p && p.bind === 'LAN' && p.tone === 'r')
        raise('red:' + p.proto + '/' + p.port, 'Open without protection: ' + p.proto + ' ' + p.port + (p.what ? ' (' + p.what + ')' : ''));
    known = lan;
    save(portFile, known);
  }
  function prune() {
    const cut = day(Date.now() - o.keepDays * 86400000);
    try {
      for (const f of fs.readdirSync(dir))
        if (/^\d{4}-\d\d-\d\d\.ndjson$/.test(f) && f.slice(0, 10) < cut) fs.unlinkSync(path.join(dir, f));
    } catch (_) {}
  }
  // the samples of the last hours, at most about 720 points (averaged in buckets), gaps kept where the TV was off
  function data(hours) {
    const h = Math.max(1, Math.min(24 * o.keepDays, +hours || 24)),
      since = Date.now() - h * 3600000,
      out = [];
    for (let t = since - 86400000; t <= Date.now() + 86400000; t += 86400000) {
      let text = '';
      try {
        text = fs.readFileSync(path.join(dir, day(t) + '.ndjson'), 'utf8');
      } catch (_) {}
      for (const line of text.split('\n')) {
        if (!line) continue;
        try {
          const s = JSON.parse(line);
          if (s.t >= since) out.push(s);
        } catch (_) {}
      }
    }
    out.sort((a, b) => a.t - b.t);
    const per = Math.max(1, Math.ceil(out.length / 720)),
      samples = [];
    for (let i = 0; i < out.length; i += per) {
      const b = out.slice(i, i + per),
        avg = k => {
          const v = b.map(x => x[k]).filter(x => typeof x === 'number');
          return v.length ? Math.round((v.reduce((a, c) => a + c, 0) / v.length) * 10) / 10 : null;
        };
      samples.push({
        t: b[b.length - 1].t,
        cpu: avg('cpu'),
        temp: avg('temp'),
        mem: avg('mem'),
        swap: avg('swap'),
        var: avg('var'),
        dbm: avg('dbm'),
        rss: avg('rss'),
        scpu: avg('scpu'),
      });
    }
    return {
      hours: h,
      step: o.sampleMs * per,
      samples,
      alerts: { active: Object.keys(alerts.active).map(k => alerts.active[k]), recent: alerts.recent },
      ports: exposure,
      last,
    };
  }
  const timers = [setInterval(sample, o.sampleMs), setInterval(exposureCheck, o.exposureMs), setInterval(prune, 6 * 3600000)];
  timers.forEach(t => t.unref && t.unref());
  // the first exposure reading a little after the first link, not an hour later
  const first = setTimeout(exposureCheck, Math.min(o.exposureMs, 60000));
  if (first.unref) first.unref();
  prune();
  return {
    sample,
    exposureCheck,
    data,
    stop: () => {
      timers.forEach(clearInterval);
      clearTimeout(first);
    },
  };
}

module.exports = { create, compact, DEFAULT_LIMITS };
