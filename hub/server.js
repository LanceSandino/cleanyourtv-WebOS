// The CleanYourTV hub: a small server that stays on when the TV does not (a home server, here in Docker on Ubuntu), so the phone remote
// can turn the TV on. Everything for the phone remote passes through it to the TV's own LAN server (remote.js, port 8794) unchanged,
// the Host header too, so the TV's checks (paired key, home network, Origin = Host) work as before and the phones pair at the hub's
// address. It keeps the last copy of the phone page (no key or secret is in it), so the page still opens while the TV sleeps; then
// /ping answers {off: true} and the page offers "Turn the TV on": POST /wake sends Wake-on-LAN magic packets (UDP broadcast, ports 9
// and 7) to the TV's MAC, which it learns from this host's ARP table while the TV is on and keeps in its data folder (never logged).
// It answers only addresses of the home network, forwards only to the TV, and keeps one connection open to the TV for the touchpad.
//   TV_HOST (required) the TV's address, or TV_HOSTS: several, comma-separated (the first is the one a phone gets when it names none;
//   a phone names one with the header x-tv; GET /hub/tvs lists them) · TV_PORT (8794) · HUB_PORT (8794) · HUB_DATA (/data) · WAKE_ADDR (255.255.255.255; a LAN's
//   broadcast address such as 192.168.1.255 is better) · WAKE_PORTS (9,7) · TV_MAC (instead of learning it) · ARP_FILE (/proc/net/arp)
// With the TV's Phone remote set to go through the hub (remote.js: via 'hub'), the TV listens on nothing: it keeps one connection to
// the hub (GET /link, only from TV_HOST, with a link key the hub pins the first time it sees one, as a SHA-256 in its data folder), and
// the hub writes each phone's request down it as a line of JSON; the TV answers with POST /link/reply. Without that link the hub passes
// requests to the TV's own LAN server, as before.
// While linked it also keeps the TV's health over time (history.js: a sample every 25 s, alerts), shown at GET /hub/dashboard; its
// data (GET /hub/history?hours=) needs a phone's paired key, which the TV vouches for once over the link, then the hub keeps only its
// SHA-256 for a week (data/keys.json), so the history opens while the TV sleeps. ALERT_WEBHOOK: where alerts are posted (optional).
//   GET /hub/status -> {tv: 'on' | 'off', link: bool, mac: known?, page: cached?, tvs}    GET /hub/tvs -> {tvs: [{id, name, on, link,
//   mac}]}    POST /wake (x-tv: which) -> {sent: true} | {error}
'use strict';
const http = require('http'),
  crypto = require('crypto'),
  dgram = require('dgram'),
  fs = require('fs'),
  path = require('path'),
  history = require('./history');

// an address of the home network: 10/8, 172.16/12, 192.168/16, link-local, loopback, IPv6 unique local and link-local
function homeAddress(a) {
  const ip = String(a || '').replace(/^::ffff:/, '');
  return (
    /^(10|127)\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^(::1|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip)
  );
}
const MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;
// a Wake-on-LAN magic packet: six 0xff, then the MAC sixteen times
function magic(mac) {
  const m = Buffer.from(mac.split(':').map(h => parseInt(h, 16)));
  return Buffer.concat([Buffer.alloc(6, 0xff)].concat(Array(16).fill(m)));
}
// the TV's MAC from an ARP table (/proc/net/arp): a complete entry (flags 0x2) for its address
function macFromArp(text, ip) {
  for (const line of String(text || '')
    .split('\n')
    .slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f[0] === ip && f[2] === '0x2' && MAC.test(f[3]) && f[3] !== '00:00:00:00:00:00') return f[3];
  }
  return '';
}

function create(opts) {
  const o = Object.assign(
    {
      tv: process.env.TV_HOSTS || process.env.TV_HOST,
      tvPort: +process.env.TV_PORT || 8794,
      data: process.env.HUB_DATA || '/data',
      wakeAddr: process.env.WAKE_ADDR || '255.255.255.255',
      wakePorts: (process.env.WAKE_PORTS || '9,7').split(',').map(Number),
      mac: (process.env.TV_MAC || '').toLowerCase(),
      arp: process.env.ARP_FILE || '/proc/net/arp',
      timeoutMs: 4000,
      wakeEveryMs: 10000,
      // a linked TV is asked a small question every beatMs and dropped when it does not answer within aliveMs: a TV in standby keeps
      // its connection open but answers nothing (seen on the living-room TV, 18:58 to 19:10 on 2026-11-01: the phone's presses went
      // down the link and waited 8 s each for "the TV did not answer in time", where an off TV gets the Turn the TV on button)
      beatMs: 20000,
      aliveMs: 6000,
      answerMs: 8000,
      webhook: process.env.ALERT_WEBHOOK || '',
      keepDays: +process.env.HISTORY_DAYS || 30,
      peer: null, // the tests' stand-in for the address a request came from
    },
    opts
  );
  // the TVs: their addresses, the first is the one a phone gets when it names none (and the one the history follows)
  const ips = String(o.tv || '')
    .split(',')
    .map(x => x.trim())
    .filter(x => /^[0-9a-f.:]{3,45}$/i.test(x));
  if (!ips.length) throw new Error('TV_HOST (or TV_HOSTS) is not set');
  const agent = new http.Agent({ keepAlive: true, maxSockets: 16 }); // the touchpad's moves reuse one connection
  const pageFile = path.join(o.data, 'page.html'),
    namesFile = path.join(o.data, 'tvs.json');
  const read = f => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch (_) {
      return '';
    }
  };
  const write = (f, text) => {
    try {
      fs.writeFileSync(f + '.tmp', text, { mode: 0o600 });
      fs.renameSync(f + '.tmp', f);
    } catch (_) {}
  };
  const peerOf = req => String((o.peer ? o.peer(req) : req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
  let names = {};
  try {
    names = JSON.parse(read(namesFile) || '{}') || {};
  } catch (_) {}
  // one entry per TV; the first keeps the file names it had when the hub knew one TV (link-key, tv-mac)
  const tvs = ips.map((ip, i) => {
    const suffix = i === 0 ? '' : '-' + ip.replace(/[^0-9a-f.]/gi, '_');
    const t = {
      ip,
      keyFile: path.join(o.data, 'link-key' + suffix),
      macFile: path.join(o.data, 'tv-mac' + suffix),
      link: null,
      beat: null,
      on: false,
      lastWake: 0,
      name: typeof names[ip] === 'string' ? names[ip].slice(0, 60) : '',
    };
    t.mac = i === 0 && MAC.test(o.mac) ? o.mac : read(t.macFile).trim();
    return t;
  });
  const byIp = ip => tvs.filter(t => t.ip === ip)[0] || null;
  // the TV a phone's request is for: the one it names (x-tv), else the first
  const pick = req => byIp(String(req.headers['x-tv'] || '')) || tvs[0];
  let page = read(pageFile),
    manifest = '';
  // a TV's MAC, learned while it answers; written only when it changes, readable only by this user
  function learn() {
    const arp = read(o.arp);
    tvs.forEach((t, i) => {
      if (i === 0 && MAC.test(o.mac)) return;
      const m = macFromArp(arp, t.ip);
      if (!m || m === t.mac) return;
      t.mac = m;
      write(t.macFile, m + '\n');
      console.log("hub: learned a TV's MAC address (" + (t.name || 'TV ' + (i + 1)) + ')');
    });
  }
  function keepPage(body) {
    if (body === page) return;
    page = body;
    write(pageFile, body);
  }
  const json = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  // ---- each TV's own link: one stream the phones' requests go down, answered with POST /link/reply ----
  const sha = k => crypto.createHash('sha256').update(String(k)).digest('hex');
  const pending = new Map();
  // the TV a link request comes from: one of the TVs' addresses, with the key pinned for that TV the first time (a later link with
  // another key is refused); null otherwise
  function linkTv(req) {
    const t = byIp(peerOf(req));
    if (!t) return null;
    const k = String(req.headers['x-link-key'] || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(k)) return null;
    const pinned = read(t.keyFile).trim();
    if (!pinned) {
      write(t.keyFile, sha(k) + '\n');
      console.log('hub: a TV linked for the first time; its link key is pinned');
      return t;
    }
    const a = Buffer.from(pinned, 'hex'),
      b = Buffer.from(sha(k), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? t : null;
  }
  // a question of the hub's own down a TV's link: {status, body}, or an error when it is not linked or does not answer
  function linkAsk(t, msg, ms) {
    return new Promise((resolve, reject) => {
      if (!t || !t.link) return reject(new Error('the TV is not linked'));
      const id = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, ''),
        timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('the TV did not answer in time'));
        }, ms || o.answerMs);
      pending.set(id, { tv: t.ip, timer, cb: r => (r ? resolve(r) : reject(new Error('the TV link closed'))) });
      t.link.write(JSON.stringify(Object.assign({ id, method: 'GET', headers: {}, ip: '127.0.0.1', body: '' }, msg)) + '\n');
    });
  }
  // is the linked TV awake: its own small answer (/tv-info, a name it keeps) within aliveMs; else the link is dropped, the TV counts as
  // off (the phone offers to turn it on) and the TV links again when it wakes (remote.js notices the gap)
  function alive(t) {
    const l = t.link;
    if (!l || t.asking) return;
    t.asking = true;
    linkAsk(t, { url: '/tv-info', self: true }, o.aliveMs)
      .catch(() => {
        if (t.link !== l) return;
        console.log('hub: a TV stopped answering (' + (t.name || t.ip) + '): asleep or off, link dropped');
        l.destroy();
      })
      .then(() => {
        t.asking = false;
      });
  }
  // the TV's own name (remote.js /tv-info), kept so the phone can list a TV that sleeps
  function askName(t) {
    linkAsk(t, { url: '/tv-info', self: true })
      .then(r => {
        let j = null;
        try {
          j = JSON.parse(r.body);
        } catch (_) {}
        const n = j && typeof j.name === 'string' ? j.name.trim().slice(0, 60) : '';
        if (r.status !== 200 || !n || n === t.name) return;
        t.name = n;
        names[t.ip] = n;
        write(namesFile, JSON.stringify(names));
      })
      .catch(() => {});
  }
  function openLink(req, res) {
    const t = linkTv(req);
    if (!t) return json(res, 403, { error: 'not a TV of this hub' });
    if (t.link) t.link.end();
    res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' });
    res.write('\n');
    t.link = res;
    t.on = true;
    if (!t.mac) learn();
    clearInterval(t.beat);
    t.beat = setInterval(() => {
      if (!t.link) return;
      t.link.write('\n');
      alive(t);
    }, o.beatMs);
    console.log('hub: a TV is linked (' + (t.name || t.ip) + ')');
    setTimeout(() => askName(t), 300);
    res.on('close', () => {
      if (t.link !== res) return;
      t.link = null;
      t.on = false;
      clearInterval(t.beat);
      console.log('hub: a TV link closed (' + (t.name || t.ip) + ')');
      for (const [id, p] of pending) {
        if (p.tv !== t.ip) continue;
        pending.delete(id);
        clearTimeout(p.timer);
        if (p.cb) p.cb(null);
        else off(p.req, p.res, t);
      }
    });
  }
  const PASS = ['x-remote-key', 'origin', 'host', 'content-type', 'accept-language'];
  // ---- the first TV's health over time (history.js), and who may see it: a phone that TV knows ----
  const hist = history.create({
    data: o.data,
    ask: url => linkAsk(tvs[0], { url, self: true }),
    linked: () => !!tvs[0].link,
    sampleMs: o.sampleMs,
    exposureMs: o.exposureMs,
    keepDays: o.keepDays,
    limits: o.limits,
    webhook: o.webhook,
  });
  const phoneFile = path.join(o.data, 'keys.json');
  let keys = {};
  try {
    keys = JSON.parse(fs.readFileSync(phoneFile, 'utf8')) || {};
  } catch (_) {}
  async function phoneKnown(req) {
    const k = String(req.headers['x-remote-key'] || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(k)) return false;
    const h = sha(k);
    if (keys[h] > Date.now()) return true;
    const t = pick(req);
    if (!t.link) return false;
    let r = null;
    try {
      r = await linkAsk(t, {
        method: 'POST',
        url: '/ping',
        headers: { host: String(req.headers.host || ''), 'x-remote-key': k },
        ip: String(req.socket.remoteAddress || ''),
      });
    } catch (_) {}
    if (!r || r.status !== 200) return false;
    keys[h] = Date.now() + 7 * 86400000;
    for (const x of Object.keys(keys)) if (keys[x] < Date.now()) delete keys[x];
    write(phoneFile, JSON.stringify(keys));
    return true;
  }
  const dashboard = () => read(path.join(__dirname, 'dashboard.html'));
  function viaLink(req, res, t) {
    const b = [];
    let size = 0;
    req.on('data', d => {
      size += d.length;
      if (size <= 65536) b.push(d);
    });
    req.on('end', () => {
      if (size > 65536) return json(res, 413, { error: 'too large' });
      if (!t.link) return off(req, res, t);
      const id = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, ''),
        headers = {};
      for (const h of PASS) if (req.headers[h] !== undefined) headers[h] = String(req.headers[h]);
      const timer = setTimeout(() => {
        pending.delete(id);
        json(res, 504, { error: 'the TV did not answer in time' });
        alive(t); // asleep? then the next press gets the off answer
      }, o.answerMs);
      pending.set(id, { tv: t.ip, req, res, timer });
      t.link.write(
        JSON.stringify({
          id,
          method: req.method,
          url: req.url,
          headers,
          ip: String(req.socket.remoteAddress || ''),
          body: Buffer.concat(b).toString('base64'),
        }) + '\n'
      );
    });
  }
  function linkReply(req, res) {
    const t = linkTv(req);
    if (!t) return json(res, 403, { error: 'not a TV of this hub' });
    const b = [];
    let size = 0;
    req.on('data', d => {
      size += d.length;
      if (size <= 8 << 20) b.push(d);
    });
    req.on('end', () => {
      let m = null;
      try {
        m = JSON.parse(Buffer.concat(b).toString('utf8'));
      } catch (_) {}
      const p = m && pending.get(String(m.id));
      // only the TV the request went to may answer it
      if (!p || p.tv !== t.ip) return json(res, 404, { error: 'no such request' });
      pending.delete(String(m.id));
      clearTimeout(p.timer);
      if (p.cb) {
        p.cb({ status: +m.status || 502, body: Buffer.from(String(m.body || ''), 'base64').toString('utf8') });
        return json(res, 200, { ok: true });
      }
      const body = Buffer.from(String(m.body || ''), 'base64'),
        u = p.req.url.split('?')[0],
        status = +m.status || 502;
      if (p.req.method === 'GET' && status === 200 && u === '/') keepPage(body.toString('utf8'));
      if (p.req.method === 'GET' && status === 200 && u === '/manifest.json') manifest = body.toString('utf8');
      const h = {};
      for (const k of Object.keys(m.headers || {})) if (/^[a-z0-9-]{1,40}$/.test(k)) h[k] = String(m.headers[k]);
      h['content-length'] = String(body.length);
      p.res.writeHead(status, h);
      p.res.end(body);
      json(res, 200, { ok: true });
    });
  }
  function wake(req, res) {
    const origin = req.headers.origin;
    if (origin && origin !== 'http://' + req.headers.host) return json(res, 403, { error: 'not from this page' });
    const t = pick(req);
    if (!t.mac) return json(res, 503, { error: "the TV's address is not known yet: switch it on once while the hub runs" });
    if (Date.now() - t.lastWake < o.wakeEveryMs) return json(res, 200, { sent: false, waiting: true });
    t.lastWake = Date.now();
    const s = dgram.createSocket('udp4'),
      pkt = magic(t.mac);
    s.on('error', () => s.close());
    s.bind(() => {
      s.setBroadcast(true);
      let left = o.wakePorts.length;
      for (const p of o.wakePorts)
        s.send(pkt, p, o.wakeAddr, () => {
          if (--left === 0) s.close();
        });
    });
    console.log('hub: Wake-on-LAN sent (' + (t.name || t.ip) + ')');
    json(res, 200, { sent: true });
  }
  // a TV does not answer: the kept page (the phone page asks /ping next and offers to turn the TV on), else a short answer
  function off(req, res, t) {
    (t || pick(req)).on = false;
    const u = req.url.split('?')[0];
    if (req.method === 'GET' && u === '/' && page) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-hub': 'kept' });
      return res.end(page);
    }
    if (req.method === 'GET' && u === '/manifest.json' && manifest) {
      res.writeHead(200, { 'content-type': 'application/manifest+json' });
      return res.end(manifest);
    }
    json(res, 503, { off: true, error: 'the TV does not answer: it is off or asleep' });
  }
  function forward(req, res, t) {
    const up = http.request(
      { host: t.ip, port: o.tvPort, method: req.method, path: req.url, headers: req.headers, agent, timeout: o.timeoutMs },
      r => {
        if (!t.on || !t.mac) learn();
        t.on = true;
        const u = req.url.split('?')[0],
          keep = req.method === 'GET' && r.statusCode === 200 && (u === '/' || u === '/manifest.json');
        if (!keep) {
          res.writeHead(r.statusCode, r.headers);
          return r.pipe(res);
        }
        const b = [];
        r.on('data', d => b.push(d));
        r.on('end', () => {
          const body = Buffer.concat(b);
          if (u === '/') keepPage(body.toString('utf8'));
          else manifest = body.toString('utf8');
          res.writeHead(r.statusCode, r.headers);
          res.end(body);
        });
      }
    );
    up.on('timeout', () => up.destroy(new Error('timeout')));
    up.on('error', () => {
      if (!res.headersSent) off(req, res, t);
      else res.destroy();
    });
    req.pipe(up);
  }
  // the TVs as the phone lists them (their addresses are the ids it names one by; never a MAC)
  const list = () =>
    tvs.map((t, i) => ({ id: t.ip, name: t.name || 'TV ' + (i + 1), on: !!(t.on || t.link), link: !!t.link, mac: !!t.mac }));
  const server = http.createServer((req, res) => {
    if (!homeAddress(req.socket.remoteAddress)) return json(res, 403, { error: 'only for the home network' });
    const u = req.url.split('?')[0];
    if (u === '/link' && req.method === 'GET') return openLink(req, res);
    if (u === '/link/reply' && req.method === 'POST') return linkReply(req, res);
    if (u === '/wake' && req.method === 'POST') return wake(req, res);
    if (u === '/hub/status') {
      const t = tvs[0];
      return json(res, 200, { tv: t.on || t.link ? 'on' : 'off', link: !!t.link, mac: !!t.mac, page: !!page, tvs: list() });
    }
    if (u === '/hub/tvs' && req.method === 'GET') {
      // the names asked again, at most every 20 s (a TV renamed from the phone shows in the next list)
      for (const x of tvs)
        if (x.link && Date.now() - (x.namedAt || 0) > 20000) {
          x.namedAt = Date.now();
          askName(x);
        }
      return json(res, 200, { tvs: list() });
    }
    if (u === '/hub/dashboard' && req.method === 'GET') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-frame-options': 'DENY',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      });
      return res.end(dashboard());
    }
    if (u === '/hub/history' && req.method === 'GET') {
      return phoneKnown(req).then(okKey => {
        if (!okKey) return json(res, 401, { error: 'open the TV remote on this phone first (it must be paired)' });
        const hours = +(/[?&]hours=(\d+)/.exec(req.url) || [])[1] || 24;
        json(res, 200, hist.data(hours));
      });
    }
    const t = pick(req);
    // the page itself is the same on every TV: from whichever TV is linked when the one asked for is not
    if (req.method === 'GET' && (u === '/' || u === '/manifest.json') && !t.link) {
      const other = tvs.filter(x => x.link)[0];
      if (other) return viaLink(req, res, other);
    }
    if (t.link) return viaLink(req, res, t);
    forward(req, res, t);
  });
  const timer = setInterval(learn, 60000);
  timer.unref();
  learn();
  return {
    server,
    close: () => {
      clearInterval(timer);
      for (const t of tvs) {
        clearInterval(t.beat);
        if (t.link) t.link.destroy();
      }
      hist.stop();
      agent.destroy();
      server.close();
    },
    learn,
    history: hist,
  };
}

module.exports = { create, homeAddress, magic, macFromArp };

if (require.main === module) {
  const hub = create();
  const port = +process.env.HUB_PORT || 8794;
  hub.server.listen(port, '0.0.0.0', () =>
    console.log(
      'hub: on port ' +
        port +
        ', the TVs at ' +
        (process.env.TV_HOSTS || process.env.TV_HOST) +
        ' (port ' +
        (process.env.TV_PORT || 8794) +
        ')'
    )
  );
  process.on('SIGTERM', () => {
    hub.close();
    process.exit(0);
  });
}
