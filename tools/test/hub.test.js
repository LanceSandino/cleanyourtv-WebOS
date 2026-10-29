// The hub (hub/server.js): with a stand-in TV on this computer, it passes the phone remote through unchanged (the Host header too), keeps
// the phone page and learns the TV's MAC from an ARP table while the TV answers; with the TV gone it serves the kept page, says
// {off: true} and sends Wake-on-LAN magic packets (caught here by a UDP listener), at most one every few seconds, only from its page.
const http = require('http'),
  dgram = require('dgram'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const { root, ok, serve, sleep, run } = require('./lib');
const hubMod = require(path.join(root, 'hub', 'server.js'));

function ask(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host: '127.0.0.1', port, path: p, method, agent: false, headers: Object.assign({ host: 'hub.test:' + port }, headers || {}) },
      res => {
        const b = [];
        res.on('data', c => b.push(c));
        res.on('end', () => {
          const text = Buffer.concat(b).toString();
          let j = null;
          try {
            j = JSON.parse(text);
          } catch (_) {}
          resolve({ code: res.statusCode, text, j, headers: res.headers });
        });
      }
    );
    r.on('error', reject);
    r.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

run(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-hub-')),
    arp = path.join(dir, 'arp'),
    data = path.join(dir, 'data');
  fs.mkdirSync(data);
  const MAC = '02:00:5e:10:20:30';
  fs.writeFileSync(
    arp,
    'IP address       HW type     Flags       HW address            Mask     Device\n' +
      '127.0.0.5        0x1         0x0         00:00:00:00:00:00     *        eth0\n' +
      '127.0.0.1        0x1         0x2         ' +
      MAC +
      '     *        eth0\n'
  );
  // the TV's phone page and its API, as remote.js answers them
  const seen = [];
  const tv = await serve((rq, rs) => {
    const b = [];
    rq.on('data', c => b.push(c));
    rq.on('end', () => {
      seen.push({
        method: rq.method,
        url: rq.url,
        host: rq.headers.host,
        key: rq.headers['x-remote-key'],
        body: Buffer.concat(b).toString(),
      });
      if (rq.url === '/') {
        rs.writeHead(200, { 'content-type': 'text/html' });
        return rs.end('<!doctype html><title>TV remote</title>');
      }
      rs.writeHead(rq.url === '/press' ? 200 : 404, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ ok: rq.url === '/press' }));
    });
  });
  const tvPort = +tv.url.split(':').pop();
  // the Wake-on-LAN packets
  const packets = [],
    udp = dgram.createSocket('udp4');
  udp.on('message', m => packets.push(m));
  await new Promise(r => udp.bind(0, '127.0.0.1', r));
  const hub = hubMod.create({
    limits: { tempSamples: 1, samples: 1 },
    sampleMs: 3600000,
    exposureMs: 3600000,
    tv: '127.0.0.1',
    tvPort,
    data,
    arp,
    wakeAddr: '127.0.0.1',
    wakePorts: [udp.address().port],
    timeoutMs: 500,
    wakeEveryMs: 1500,
  });
  await new Promise(r => hub.server.listen(0, '127.0.0.1', r));
  const port = hub.server.address().port;

  ok(
    hubMod.homeAddress('192.168.4.30') &&
      hubMod.homeAddress('::ffff:10.0.0.2') &&
      !hubMod.homeAddress('8.8.8.8') &&
      !hubMod.homeAddress('172.32.0.1'),
    'the home network: private, link-local and loopback addresses only'
  );
  let r = await ask(port, 'GET', '/');
  ok(
    r.code === 200 && /TV remote/.test(r.text) && seen[0].host === 'hub.test:' + port,
    "the phone page comes from the TV, with the hub's Host header passed on"
  );
  r = await ask(port, 'POST', '/press', { key: 'UP' }, { 'x-remote-key': 'k'.repeat(43), 'content-type': 'application/json' });
  const last = seen[seen.length - 1];
  ok(
    r.code === 200 && r.j.ok && last.key === 'k'.repeat(43) && last.body === '{"key":"UP"}',
    "a press goes through with the phone's key and its body"
  );
  const kept = fs.readFileSync(path.join(data, 'page.html'), 'utf8'),
    mac = fs.readFileSync(path.join(data, 'tv-mac'), 'utf8').trim(),
    mode = fs.statSync(path.join(data, 'tv-mac')).mode & 0o777;
  ok(
    /TV remote/.test(kept) && mac === MAC && mode === 0o600,
    "it keeps the page and learns the TV's MAC from the ARP table (only a complete entry), readable only by itself"
  );
  r = await ask(port, 'GET', '/hub/status');
  ok(
    r.j.tv === 'on' && r.j.mac === true && r.j.page === true && JSON.stringify(r.j).indexOf(MAC) < 0,
    'its status says what it knows, never the MAC'
  );

  // the TV asleep
  tv.server.close();
  await sleep(100);
  r = await ask(port, 'GET', '/');
  const p = await ask(port, 'GET', '/ping', undefined, { 'x-remote-key': 'k'.repeat(43) });
  ok(
    r.code === 200 && r.headers['x-hub'] === 'kept' && /TV remote/.test(r.text) && p.code === 503 && p.j.off === true,
    'with the TV asleep the kept page opens and /ping says off'
  );
  r = await ask(port, 'POST', '/wake', {}, { origin: 'http://hub.test:' + port });
  await sleep(200);
  const pk = packets[0],
    m = Buffer.from(MAC.split(':').map(h => parseInt(h, 16)));
  ok(
    r.code === 200 &&
      r.j.sent === true &&
      packets.length === 1 &&
      pk.length === 102 &&
      pk.slice(0, 6).equals(Buffer.alloc(6, 0xff)) &&
      pk.slice(6, 12).equals(m) &&
      pk.slice(96).equals(m),
    'POST /wake sends a magic packet: six 0xff, then the MAC sixteen times'
  );
  r = await ask(port, 'POST', '/wake', {}, { origin: 'http://hub.test:' + port });
  const other = await ask(port, 'POST', '/wake', {}, { origin: 'http://evil.example' });
  await sleep(200);
  ok(
    r.j.sent === false && r.j.waiting && other.code === 403 && packets.length === 1,
    'at most one wake every few seconds, and only from its own page'
  );
  await sleep(1500);
  r = await ask(port, 'POST', '/wake');
  await sleep(200);
  ok(r.j.sent === true && packets.length === 2, 'later it wakes again');

  // the TV's own link (the TV listening on nothing): requests go down it, answers come back by POST /link/reply
  const K1 = 'a'.repeat(43),
    K2 = 'b'.repeat(43);
  const lines = [];
  const linkRes = await new Promise(resolve => {
    const rq = http.request(
      { host: '127.0.0.1', port, path: '/link', method: 'GET', agent: false, headers: { 'x-link-key': K1 } },
      resolve
    );
    rq.end();
  });
  let lbuf = '';
  linkRes.setEncoding('utf8');
  linkRes.on('data', d => {
    lbuf += d;
    let i;
    while ((i = lbuf.indexOf('\n')) >= 0) {
      const l = lbuf.slice(0, i);
      lbuf = lbuf.slice(i + 1);
      if (l.trim()) lines.push(JSON.parse(l));
    }
  });
  await sleep(100);
  const pinned = fs.readFileSync(path.join(data, 'link-key'), 'utf8').trim();
  const asked = ask(port, 'POST', '/press', { key: 'OK' }, { 'x-remote-key': 'k'.repeat(43), origin: 'http://hub.test:' + port });
  await sleep(150);
  const sent = lines[0];
  await ask(
    port,
    'POST',
    '/link/reply',
    { id: sent.id, status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":true}').toString('base64') },
    { 'x-link-key': K1 }
  );
  const got = await asked;
  ok(
    linkRes.statusCode === 200 &&
      /^[0-9a-f]{64}$/.test(pinned) &&
      pinned.indexOf(K1) < 0 &&
      sent.url === '/press' &&
      sent.headers['x-remote-key'] === 'k'.repeat(43) &&
      Buffer.from(sent.body, 'base64').toString() === '{"key":"OK"}' &&
      got.code === 200 &&
      got.j.ok === true,
    "the TV's link: its key pinned as a hash, a phone's request goes down it with its key and body, and the TV's answer comes back"
  );
  // the history: the hub's own question down the link (self), a sample kept in the day's file, the alerts it raises
  const MB = 1048576,
    reply = (id, status, obj) =>
      ask(
        port,
        'POST',
        '/link/reply',
        { id, status, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(obj)).toString('base64') },
        { 'x-link-key': K1 }
      );
  const nextLine = async n => {
    for (let i = 0; i < 40 && lines.length <= n; i++) await sleep(25);
    return lines[n];
  };
  let n0 = lines.length;
  const sampled = hub.history.sample();
  const q = await nextLine(n0);
  await reply(q.id, 200, {
    metrics: {
      at: Date.now(),
      cpu: { total: 12 },
      temp: { c: 80 },
      memory: { available: 500 * MB, swap: { total: 100, used: 95 } },
      disks: [{ path: '/var', free: 30 * MB }],
      self: { rss: 60 * MB },
      emmc: { eol: 'normal' },
    },
    settings: {},
  });
  await sampled;
  const day = new Date().toISOString().slice(0, 10),
    kept2 = fs
      .readFileSync(path.join(data, 'history', day + '.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map(x => JSON.parse(x)),
    al = JSON.parse(fs.readFileSync(path.join(data, 'alerts.json'), 'utf8'));
  ok(
    q.self === true &&
      q.url === '/status-data' &&
      kept2.length === 1 &&
      kept2[0].temp === 80 &&
      kept2[0].mem === 500 &&
      kept2[0].swap === 95 &&
      kept2[0].var === 30 &&
      !!al.active.hot &&
      !!al.active.swap &&
      !!al.active.var &&
      !al.active.memory,
    "a sample: the hub's own question down the link, one small line in the day's file, and the alerts it crosses (hot, swap, /var)"
  );
  // the history needs a phone the TV knows: asked once down the link (/ping with its key), then kept as a hash
  const noKey = await ask(port, 'GET', '/hub/history?hours=24');
  n0 = lines.length;
  const h1 = ask(port, 'GET', '/hub/history?hours=24', undefined, { 'x-remote-key': 'k'.repeat(43) });
  const pq = await nextLine(n0);
  await reply(pq.id, 200, { ok: true });
  const hist = await h1;
  const dash = await ask(port, 'GET', '/hub/dashboard');
  ok(
    noKey.code === 401 &&
      pq.url === '/ping' &&
      pq.headers['x-remote-key'] === 'k'.repeat(43) &&
      !pq.self &&
      hist.code === 200 &&
      hist.j.samples.length === 1 &&
      hist.j.alerts.active.length >= 3 &&
      dash.code === 200 &&
      /TV health/.test(dash.text),
    'the history opens for a phone the TV vouched for (once, over the link), not without a key; the dashboard page is served'
  );
  const wrong = await ask(port, 'GET', '/link', undefined, { 'x-link-key': K2 });
  const wrongReply = await ask(port, 'POST', '/link/reply', { id: 'x', status: 200 }, { 'x-link-key': K2 });
  ok(wrong.code === 403 && wrongReply.code === 403, 'a link or an answer with another key is refused');
  linkRes.destroy();
  await sleep(150);
  r = await ask(port, 'GET', '/ping', undefined, { 'x-remote-key': 'k'.repeat(43) });
  ok(r.code === 503 && r.j.off === true, 'the link gone (the TV asleep): off at once');
  r = await ask(port, 'GET', '/hub/history?hours=24', undefined, { 'x-remote-key': 'k'.repeat(43) });
  const stranger = await ask(port, 'GET', '/hub/history?hours=24', undefined, { 'x-remote-key': 'z'.repeat(43) });
  ok(r.code === 200 && stranger.code === 401, 'with the TV asleep the history still opens for a phone it vouched for, not for another key');

  hub.close();
  udp.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
