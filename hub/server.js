// The CleanYourTV hub: a small server that stays on when the TV does not (a home server, here in Docker on Ubuntu), so the phone remote
// can turn the TV on. Everything for the phone remote passes through it to the TV's own LAN server (remote.js, port 8794) unchanged,
// the Host header too, so the TV's checks (paired key, home network, Origin = Host) work as before and the phones pair at the hub's
// address. It keeps the last copy of the phone page (no key or secret is in it), so the page still opens while the TV sleeps; then
// /ping answers {off: true} and the page offers "Turn the TV on": POST /wake sends Wake-on-LAN magic packets (UDP broadcast, ports 9
// and 7) to the TV's MAC, which it learns from this host's ARP table while the TV is on and keeps in its data folder (never logged).
// It answers only addresses of the home network, forwards only to the TV, and keeps one connection open to the TV for the touchpad.
//   TV_HOST (required) the TV's address · TV_PORT (8794) · HUB_PORT (8794) · HUB_DATA (/data) · WAKE_ADDR (255.255.255.255; a LAN's
//   broadcast address such as 192.168.7.255 is better) · WAKE_PORTS (9,7) · TV_MAC (instead of learning it) · ARP_FILE (/proc/net/arp)
//   GET /hub/status -> {tv: 'on' | 'off', mac: known?, page: cached?}    POST /wake -> {sent: true} | {error}
'use strict';
const http = require('http'),
  dgram = require('dgram'),
  fs = require('fs'),
  path = require('path');

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
      tv: process.env.TV_HOST,
      tvPort: +process.env.TV_PORT || 8794,
      data: process.env.HUB_DATA || '/data',
      wakeAddr: process.env.WAKE_ADDR || '255.255.255.255',
      wakePorts: (process.env.WAKE_PORTS || '9,7').split(',').map(Number),
      mac: (process.env.TV_MAC || '').toLowerCase(),
      arp: process.env.ARP_FILE || '/proc/net/arp',
      timeoutMs: 4000,
      wakeEveryMs: 10000,
    },
    opts
  );
  if (!o.tv) throw new Error('TV_HOST is not set');
  const agent = new http.Agent({ keepAlive: true, maxSockets: 16 }); // the touchpad's moves reuse one connection
  const macFile = path.join(o.data, 'tv-mac'),
    pageFile = path.join(o.data, 'page.html');
  const read = f => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch (_) {
      return '';
    }
  };
  let mac = MAC.test(o.mac) ? o.mac : read(macFile).trim(),
    page = read(pageFile),
    manifest = '',
    tvOn = false,
    lastWake = 0;
  // the TV's MAC, learned while it answers; written only when it changes, readable only by this user
  function learn() {
    if (MAC.test(o.mac)) return;
    const m = macFromArp(read(o.arp), o.tv);
    if (!m || m === mac) return;
    mac = m;
    try {
      fs.writeFileSync(macFile + '.tmp', mac + '\n', { mode: 0o600 });
      fs.renameSync(macFile + '.tmp', macFile);
    } catch (_) {}
    console.log("hub: learned the TV's MAC address");
  }
  function keepPage(body) {
    if (body === page) return;
    page = body;
    try {
      fs.writeFileSync(pageFile + '.tmp', body);
      fs.renameSync(pageFile + '.tmp', pageFile);
    } catch (_) {}
  }
  const json = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  function wake(req, res) {
    const origin = req.headers.origin;
    if (origin && origin !== 'http://' + req.headers.host) return json(res, 403, { error: 'not from this page' });
    if (!mac) return json(res, 503, { error: "the TV's address is not known yet: switch it on once while the hub runs" });
    if (Date.now() - lastWake < o.wakeEveryMs) return json(res, 200, { sent: false, waiting: true });
    lastWake = Date.now();
    const s = dgram.createSocket('udp4'),
      pkt = magic(mac);
    s.on('error', () => s.close());
    s.bind(() => {
      s.setBroadcast(true);
      let left = o.wakePorts.length;
      for (const p of o.wakePorts)
        s.send(pkt, p, o.wakeAddr, () => {
          if (--left === 0) s.close();
        });
    });
    console.log('hub: Wake-on-LAN sent');
    json(res, 200, { sent: true });
  }
  // the TV does not answer: the kept page (the phone page asks /ping next and offers to turn the TV on), else a short answer
  function off(req, res) {
    tvOn = false;
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
  function forward(req, res) {
    const up = http.request(
      { host: o.tv, port: o.tvPort, method: req.method, path: req.url, headers: req.headers, agent, timeout: o.timeoutMs },
      r => {
        if (!tvOn || !mac) learn();
        tvOn = true;
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
      if (!res.headersSent) off(req, res);
      else res.destroy();
    });
    req.pipe(up);
  }
  const server = http.createServer((req, res) => {
    if (!homeAddress(req.socket.remoteAddress)) return json(res, 403, { error: 'only for the home network' });
    const u = req.url.split('?')[0];
    if (u === '/wake' && req.method === 'POST') return wake(req, res);
    if (u === '/hub/status') return json(res, 200, { tv: tvOn ? 'on' : 'off', mac: !!mac, page: !!page });
    forward(req, res);
  });
  const timer = setInterval(learn, 60000);
  timer.unref();
  learn();
  return {
    server,
    close: () => {
      clearInterval(timer);
      agent.destroy();
      server.close();
    },
    learn,
  };
}

module.exports = { create, homeAddress, magic, macFromArp };

if (require.main === module) {
  const hub = create();
  const port = +process.env.HUB_PORT || 8794;
  hub.server.listen(port, '0.0.0.0', () =>
    console.log('hub: on port ' + port + ', the TV at ' + process.env.TV_HOST + ':' + (process.env.TV_PORT || 8794))
  );
  process.on('SIGTERM', () => {
    hub.close();
    process.exit(0);
  });
}
