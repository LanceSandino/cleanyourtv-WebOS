// Phone remote: a phone on the same Wi-Fi as a remote for the TV: the arrows, OK, Back, Home, volume, play and pause, a touchpad for
// the pointer, typing into a search box, the apps of the dock. Off until a phone is paired. Pairing (the manager's Phone remote, or
// Customize > Phone remote in the launcher: POST /api/remote/pair) opens a window of five minutes with a six-digit code on the TV and in
// its QR code; five wrong codes close it. A phone that gives the code gets its own key (32 random bytes): only its SHA-256 is kept
// (config.remote.devices), the phone sends the key with every press (header x-remote-key), and a phone can be removed on the TV.
// The phone page and its API are a server on the LAN (port 8794) that runs only while a phone is paired or pairing is open, and that
// answers only addresses of the home network (private ranges). Keys go to LG's own network input (com.webos.service.networkinput): the
// keys it names through sendSpecialKey ({key: 'HOME'}), the others as Linux key codes through sendKeyCodes ({keyCode1: 103}), as seen
// working on the owner's webOS 25 TV (Home, the arrows, the quick settings, Exit). The volume and mute go to LG's audio service
// (com.webos.service.audio/master), as LG's own volume does: network input's volume keys did not reach a soundbar on eARC, the audio
// service does (it drives the soundbar over HDMI-CEC). The pointer moves, clicks and scrolls through network input's pointer socket
// (getPointerInputSocket, a local socket): each message is its text (type:move, dx, dy, down; type:click; type:scroll) after its
// length as 4 bytes, big-endian; network input then moves its own TouchPad device (seen on the owner's TV: REL_X/REL_Y, BTN_LEFT,
// the wheel; unframed text made it close the socket). Holding OK, Back, Home or Settings is LG's long press
// (sendLongKeyEvent). Text goes to LG's keyboard service (com.webos.service.ime).
// Nothing here presses a key by itself: every press comes from a paired phone.
//   GET  /api/remote/status    {on, url, devices: [{id, name, added, used}], pairing: {until} | null}
//   POST /api/remote/pair      {} opens pairing: {url, code, qr, seconds}; {stop: true} closes it
//   POST /api/remote/forget {id}    POST /api/remote/on {on}
//   POST /api/remote/via {via}      'hub': the TV listens on nothing for the phones; it keeps one connection to the hub (GET /link,
//                                   with its own link key) and answers the requests the hub passes down it with the same handler;
//                                   'tv' (the default): the LAN server on 8794
//   POST /api/remote/helper {url}   the address of a hub on the home network (hub/server.js: 'http://<private address>:<port>', ''
//                                   to clear) that stays on when the TV sleeps: the QR code and the address shown then point there, so
//                                   phones pair through it and it can wake the TV
// On the LAN server: GET / (the phone page), POST /pair {code, name} -> {key, id}; with the key: POST /press {key}, /move {dx, dy},
// /click, /scroll {dy}, /hold {key}, /text {text}, /backspace, /enter, /launch {id}, /power, GET /apps, GET /icon/<id>, GET /ping, and the
// TV tab's read-only GET /status-data, /status-exposure, /status-services (statusdata.js: TV health and a summary, nothing secret).
const http = require('http'),
  stream = require('stream'),
  net = require('net'),
  crypto = require('crypto');
const web = require('./web'),
  i18n = require('./i18n'),
  nc = require('./netcompat'),
  page = require('./remotepage'),
  statusdata = require('./statusdata'),
  fetch = require('./fetch');

const TELEMACHUS = () => process.env.CYTV_TELEMACHUS || 'http://127.0.0.1:8770', // another address only for the tests
  TELEMACHUS_APP = 'com.telemachus.screen';
const PORT = +process.env.CYTV_REMOTE_PORT || 8794, // after the phone pages' ports (8766-8792; Telemachus holds 8770 on the TV)
  PAIR_MS = 5 * 60 * 1000, // time to type the address by hand when the camera does not open it
  MAX_TRIES = 5,
  MAX_DEVICES = 10;
// the remote's buttons: the ones LG's network input knows by name (sendSpecialKey; MENU is the gear key, LG's quick settings), the
// others by their Linux key code (sendKeyCodes: the arrows, play, info, blue, the digits)
const SPECIAL = {
  ENTER: 'ENTER',
  BACK: 'BACK',
  HOME: 'HOME',
  EXIT: 'EXIT',
  MENU: 'QMENU',
  VOLUMEUP: 'VOLUMEUP',
  VOLUMEDOWN: 'VOLUMEDOWN',
  MUTE: 'MUTE',
  CHANNELUP: 'CHANNELUP',
  CHANNELDOWN: 'CHANNELDOWN',
  PAUSE: 'PAUSE',
  FASTFORWARD: 'FASTFORWARD',
  REWIND: 'REWIND',
  RED: 'RED',
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  DASH: 'DASH',
};
const CODES = { UP: 103, DOWN: 108, LEFT: 105, RIGHT: 106, PLAY: 207, INFO: 358, BLUE: 401, 0: 11 };
for (let d = 1; d <= 9; d++) CODES[d] = d + 1; // KEY_1 is 2 ... KEY_9 is 10
const KEYS = Object.keys(SPECIAL).concat(Object.keys(CODES));
const LONG = ['ENTER', 'BACK', 'HOME', 'MENU']; // held on the phone: LG's long press
const AUDIO = 'luna://com.webos.service.audio/master/';

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
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
function sameHex(a, b) {
  const x = Buffer.from(String(a), 'hex'),
    y = Buffer.from(String(b), 'hex');
  return x.length === 32 && y.length === 32 && crypto.timingSafeEqual(x, y);
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+n || 0)));

function create(ctx, opts) {
  // linkQuietMs: the hub writes a line every 20 s, so a link quiet for longer is dead (a TV that slept keeps a connection the hub
  // closed long ago); watchMs: how often that is looked at; wakeGapMs: a clock jump this long means the TV slept
  const lo = Object.assign({ linkQuietMs: 50000, watchMs: 10000, wakeGapMs: 60000 }, opts);
  const config = ctx.config,
    luna = ctx.luna;
  const conf = () => config.get().remote || {};
  const devices = () => (Array.isArray(conf().devices) ? conf().devices : []);
  const isOn = () => conf().on !== false && devices().length > 0;
  // the hub's address when one is set (a private IPv4 address and a port only: phones are never sent off the home network)
  const hubOk = h => {
    const m = /^http:\/\/(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$/.exec(h);
    return !!m && homeAddress(m[1]) && +m[2] < 65536;
  };
  const helper = () => (hubOk(String(conf().helper || '')) ? conf().helper : '');
  const tvStatus = statusdata.create(ctx); // the TV tab's read-only data

  // ---- LG's network input: one socket, opened when a press comes and again after it closed ----
  let sock = null,
    opening = null;
  function pointer() {
    if (sock) return Promise.resolve(sock);
    if (opening) return opening;
    opening = (
      process.env.CYTV_REMOTE_SOCK
        ? Promise.resolve({ socketPath: process.env.CYTV_REMOTE_SOCK })
        : luna('luna://com.webos.service.networkinput/getPointerInputSocket', {})
    )
      .then(
        r =>
          new Promise((resolve, reject) => {
            if (!r || !r.socketPath) return reject(new Error('the TV gave no input socket'));
            const s = net.connect(r.socketPath);
            s.once('connect', () => {
              sock = s;
              resolve(s);
            });
            s.once('error', reject);
            s.on('close', () => {
              if (sock === s) sock = null;
            });
            s.on('error', () => {
              if (sock === s) sock = null;
            });
          })
      )
      .then(
        s => {
          opening = null;
          return s;
        },
        e => {
          opening = null;
          throw e;
        }
      );
    return opening;
  }
  // a message as LG's network input reads them: lines of name:value and an empty line at the end, after its length (4 bytes,
  // big-endian)
  function send(fields) {
    const msg = Buffer.from(
        Object.keys(fields)
          .map(k => k + ':' + fields[k])
          .join('\n') + '\n\n'
      ),
      len = Buffer.alloc(4);
    len.writeUInt32BE(msg.length, 0);
    return pointer().then(s => {
      s.write(Buffer.concat([len, msg]));
      return { returnValue: true };
    });
  }

  // ---- pairing ----
  /** @type {{code: string, tries: number, until: number, timer: any} | null} */
  let pairing = null;
  function openPairing() {
    closePairing();
    pairing = {
      code: String(nc.randomInt(100000, 1000000)),
      tries: 0,
      until: Date.now() + PAIR_MS,
      timer: setTimeout(closePairing, PAIR_MS),
    };
    return listen().then(() => {
      const url = helper() || 'http://' + web.lanIp() + ':' + PORT;
      return { url, code: pairing.code, qr: url + '/#p=' + pairing.code, seconds: PAIR_MS / 1000 };
    });
  }
  function closePairing() {
    if (pairing) clearTimeout(pairing.timer);
    pairing = null;
    if (!isOn()) unlisten();
  }
  function pair(b) {
    if (!pairing) return { error: 'pairing is closed: start it again on the TV', code: 403 };
    const code = String(b.code || '');
    if (code.length !== 6 || !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(pairing.code))) {
      if (++pairing.tries >= MAX_TRIES) closePairing();
      return { error: 'wrong code', code: 403 };
    }
    const key = crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      id = crypto.randomBytes(6).toString('hex'),
      name =
        String(b.name || '')
          .replace(/[\u0000-\u001f<>]/g, '')
          .trim()
          .slice(0, 40) || 'Phone';
    config.update('remote (paired ' + name + ')', c => {
      const r = Object.assign({}, c.remote);
      r.devices = (Array.isArray(r.devices) ? r.devices : []).concat([{ id, name, hash: sha(key), added: Date.now() }]).slice(-MAX_DEVICES);
      delete r.on; // a new phone switches the remote on
      c.remote = r;
    });
    clearTimeout(pairing.timer);
    pairing = null;
    return { key, id, name };
  }
  // the phone the key belongs to, or null
  function deviceOf(req) {
    const k = String(req.headers['x-remote-key'] || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(k)) return null;
    const h = sha(k);
    return devices().filter(d => sameHex(d.hash, h))[0] || null;
  }
  // the last time a phone was used, kept at most once a minute (flash writes)
  function used(d) {
    if (d.used && Date.now() - d.used < 60000) return;
    config.update('remote (used)', c => {
      const r = Object.assign({}, c.remote);
      r.devices = (r.devices || []).map(x => (x.id === d.id ? Object.assign({}, x, { used: Date.now() }) : x));
      c.remote = r;
    });
  }

  // ---- what a phone asks for ----
  async function appsList() {
    const a = ctx.feature('apps'),
      c = config.get();
    if (!a) return [];
    const all = (await a.apps()).filter(x => x.id && !x.input),
      hidden = c.hidden || [],
      dock = (c.dock || []).filter(id => all.some(x => x.id === id));
    const rest = all
      .filter(x => dock.indexOf(x.id) < 0 && hidden.indexOf(x.id) < 0)
      .sort((x, y) => String(x.title).localeCompare(String(y.title)));
    return dock
      .map(id => all.filter(x => x.id === id)[0])
      .concat(rest)
      .slice(0, 60)
      .map(x => ({ id: x.id, title: String(x.title || x.id) }));
  }
  async function act(u, b, res) {
    if (u === '/ping') return { ok: true, now: await nowOn() };
    if (statusdata.PATHS.indexOf(u) >= 0) return tvStatus.get(u);
    if (u === '/press') {
      const k = String(b.key || '');
      if (KEYS.indexOf(k) < 0) return { error: 'unknown key', code: 400 };
      if (k === 'VOLUMEUP') return luna(AUDIO + 'volumeUp', {});
      if (k === 'VOLUMEDOWN') return luna(AUDIO + 'volumeDown', {});
      if (k === 'MUTE') {
        const v = await luna(AUDIO + 'getVolume', {});
        // master/muteVolume {mute} (there is no master/mute: that call did nothing); seen muting the soundbar over eARC too
        return luna(AUDIO + 'muteVolume', { mute: !(v && v.volumeStatus && v.volumeStatus.muteStatus) });
      }
      if (SPECIAL[k]) return luna('luna://com.webos.service.networkinput/sendSpecialKey', { key: SPECIAL[k] });
      return luna('luna://com.webos.service.networkinput/sendKeyCodes', { keyCode1: CODES[k] });
    }
    if (u === '/move') return send({ type: 'move', dx: clamp(b.dx, -300, 300), dy: clamp(b.dy, -300, 300), down: 0 });
    if (u === '/click') return send({ type: 'click' });
    if (u === '/hold') {
      const k = String(b.key || '');
      if (LONG.indexOf(k) < 0) return { error: 'unknown key', code: 400 };
      return luna('luna://com.webos.service.networkinput/sendLongKeyEvent', { key: SPECIAL[k] });
    }
    if (u === '/scroll') return send({ type: 'scroll', dx: 0, dy: clamp(b.dy, -50, 50) });
    if (u === '/text') {
      const t = String(b.text || '')
        .replace(/[\u0000-\u001f]/g, '')
        .slice(0, 200);
      if (!t) return { error: 'no text', code: 400 };
      return luna('luna://com.webos.service.ime/insertText', { text: t, replace: 0 });
    }
    if (u === '/backspace') return luna('luna://com.webos.service.ime/deleteCharacters', { count: clamp(b.count || 1, 1, 50) });
    if (u === '/enter') return luna('luna://com.webos.service.ime/sendEnterKey', {});
    if (u === '/power') return luna('luna://com.webos.service.networkinput/controls/power', {});
    if (u === '/apps') return { apps: await appsList() };
    if (u === '/launch') {
      const id = String(b.id || '');
      if (!(await appsList()).some(x => x.id === id)) return { error: 'unknown app', code: 400 };
      return luna('luna://com.webos.applicationManager/launch', { id, params: {} });
    }
    const m = /^\/icon\/([\w.-]{1,128})$/.exec(u);
    if (m && ctx.feature('apps')) {
      // the app's own icon, through the apps part's handler (it answers /icon/<id>)
      await ctx.feature('apps').handle({ method: 'GET', headers: {} }, res, '/icon/' + m[1]);
      return undefined;
    }
    return { error: 'not found', code: 404 };
  }

  // ---- the LAN server ----
  let srv = null;
  const conns = new Set(); // the phones' open connections: closed with the server, so switching off ends them at once
  function lan(req, res) {
    const u = req.url.split('?')[0],
      json = (o, c) => {
        res.writeHead(c || 200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(o));
      };
    if (!homeAddress(req.socket.remoteAddress)) return json({ error: 'only for the home network' }, 403);
    // no other site may call it from a phone's browser: no CORS answers, and a request from another page is refused
    const origin = req.headers.origin;
    if (origin && origin !== 'http://' + req.headers.host) return json({ error: 'not from this page' }, 403);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    if (req.method === 'GET' && (u === '/' || u === '/index.html')) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob:",
      });
      return res.end(page.html(i18n.lang(req, config.get().lang)));
    }
    if (req.method === 'GET' && u === '/manifest.json') {
      res.writeHead(200, { 'content-type': 'application/manifest+json' });
      return res.end(page.manifest());
    }
    web.body(req, 4096).then(
      async b => {
        if (u === '/pair' && req.method === 'POST') {
          const r = pair(b || {});
          return json(r, r.code || 200);
        }
        const d = deviceOf(req);
        if (!d) return json({ error: 'this phone is not paired' }, 401);
        if (!isOn()) return json({ error: 'the phone remote is off on the TV' }, 403);
        used(d);
        try {
          const r = await act(u, b || {}, res);
          if (r !== undefined) json(r, r.code || 200);
        } catch (e) {
          json({ error: String((e && e.message) || e) }, 502);
        }
      },
      () => json({ error: 'bad request' }, 400)
    );
  }
  // ---- what is on the screen, for the phone page (with every /ping): the app or the input in front (apps.js's poll, no extra call),
  // and with Telemachus in front what it plays (its own /api/brief, as its TV page reads it). Kept two seconds. ----
  let nowCache = null,
    nowAt = 0;
  async function telemachusNow() {
    try {
      const r = await fetch.read(TELEMACHUS() + '/api/brief', {
        headers: { accept: 'application/json', 'X-Telemachus': 'cli' },
        totalMs: 1500,
        idleMs: 1500,
        maxBytes: 512 * 1024,
        redirects: 0,
      });
      const j = JSON.parse(r.body.toString('utf8')),
        n = j && j.state && j.state.now_playing;
      if (!n || n.known === false || typeof n.show !== 'string' || !n.show.trim()) return null;
      const num = v => (Number.isInteger(v) && v >= 0 && v < 10000 ? v : null);
      return {
        show: n.show.trim().slice(0, 120),
        season: num(n.season),
        episode: num(n.episode),
        title: typeof n.title === 'string' ? n.title.trim().slice(0, 160) : '',
        state: n.player_state === 'playing' || n.player_state === 'paused' ? n.player_state : '',
      };
    } catch (_) {
      return null;
    }
  }
  async function nowOn() {
    if (Date.now() - nowAt < 2000) return nowCache;
    const a = ctx.feature && ctx.feature('apps'),
      c = a && a.current ? a.current() : null;
    let out = null;
    if (c) {
      out = /** @type {any} */ ({ app: c.id, title: c.title, input: c.input || null });
      if (c.id === TELEMACHUS_APP) out.playing = await telemachusNow();
    }
    nowCache = out;
    nowAt = Date.now();
    return out;
  }

  // ---- through the hub (via 'hub'): no server on the LAN; one connection out to the hub, the phones' requests coming down it ----
  const via = () => (conf().via === 'hub' && helper() ? 'hub' : 'tv');
  let link = null,
    linkState = 'off',
    linkTimer = null,
    linkWait = 1000,
    linkSeen = 0,
    linkWatch = null,
    tick = Date.now();
  const replyAgent = new http.Agent({ keepAlive: true, maxSockets: 4 });
  function linkKey() {
    let k = String(conf().linkKey || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(k)) {
      k = crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      config.update('remote (hub link key)', c => {
        c.remote = Object.assign({}, c.remote, { linkKey: k });
      });
    }
    return k;
  }
  function linkUp() {
    if (link || via() !== 'hub' || !(isOn() || pairing)) return;
    const h = new URL(helper());
    linkState = 'connecting';
    const r = http.request({
      host: h.hostname,
      port: +h.port,
      path: '/link',
      method: 'GET',
      headers: { 'x-link-key': linkKey() },
      agent: false,
    });
    link = r;
    r.on('response', res => {
      if (res.statusCode !== 200) {
        res.resume();
        return linkDrop('the hub refused the link (' + res.statusCode + ')', r);
      }
      linkState = 'linked';
      linkWait = 1000;
      linkSeen = Date.now();
      console.log('remote: linked to the hub');
      // a link that goes quiet is dead: the hub writes a line every 20 s, and a TV that slept in standby keeps a connection the hub
      // closed meanwhile (nothing tells the TV, as it only reads); seen on the owner's TV on 2026-10-30, the phone page then said the
      // TV was off. Also after the TV wakes (its clock jumps while it sleeps), the link is made again at once.
      clearInterval(linkWatch);
      tick = Date.now();
      linkWatch = setInterval(() => {
        const now = Date.now(),
          slept = now - tick > lo.wakeGapMs;
        tick = now;
        if (link !== r) return clearInterval(linkWatch);
        if (slept) {
          linkWait = 0;
          return linkDrop('the TV woke up', r);
        }
        if (now - linkSeen > lo.linkQuietMs) linkDrop('the hub went quiet', r);
      }, lo.watchMs);
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', d => {
        linkSeen = Date.now();
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (line.trim()) linked(line);
        }
      });
      res.on('end', () => linkDrop('the hub closed it', r));
      res.on('error', () => linkDrop('error', r));
    });
    r.on('error', () => linkDrop('no answer', r));
    r.end();
  }
  // only the link in use is dropped: a link already dropped and destroyed still fires its own end and error events, which must not
  // drop the next one or stretch the wait before it
  function linkDrop(why, which) {
    if (which && link !== which) return;
    const was = linkState;
    clearInterval(linkWatch);
    if (link) {
      try {
        link.destroy();
      } catch (_) {}
    }
    link = null;
    linkState = 'off';
    if (was === 'linked') console.log('remote: the hub link dropped (' + why + ')');
    clearTimeout(linkTimer);
    if (via() === 'hub' && (isOn() || pairing)) {
      linkTimer = setTimeout(linkUp, linkWait);
      linkWait = Math.min(15000, Math.max(1000, linkWait * 2));
    }
  }
  function linkStop() {
    clearTimeout(linkTimer);
    clearInterval(linkWatch);
    const l = link;
    link = null;
    linkState = 'off';
    if (l) {
      try {
        l.destroy();
      } catch (_) {}
    }
  }
  // one phone request from the hub, answered by the same handler as on the LAN (its checks too: the phone's key, the home network,
  // the page's origin), the answer posted back
  function linked(line) {
    let m = null;
    try {
      m = JSON.parse(line);
    } catch (_) {}
    if (!m || typeof m.id !== 'string') return;
    const body = Buffer.from(String(m.body || ''), 'base64'),
      req = /** @type {any} */ (new stream.Readable({ read() {} }));
    if (body.length) req.push(body);
    req.push(null);
    req.method = String(m.method || 'GET');
    req.url = String(m.url || '/');
    req.headers = Object.assign({}, m.headers || {});
    req.socket = { remoteAddress: String(m.ip || '') };
    const out = [],
      headers = {};
    let code = 200;
    const res = /** @type {any} */ (
      new stream.Writable({
        write(c, e, cb) {
          out.push(Buffer.from(c));
          cb();
        },
      })
    );
    res.headersSent = false;
    res.setHeader = (k, v) => {
      headers[String(k).toLowerCase()] = v;
    };
    res.getHeader = k => headers[String(k).toLowerCase()];
    res.writeHead = (c, h) => {
      code = c;
      for (const k of Object.keys(h || {})) headers[k.toLowerCase()] = h[k];
      res.headersSent = true;
      return res;
    };
    res.on('finish', () => {
      const data = JSON.stringify({ id: m.id, status: code, headers, body: Buffer.concat(out).toString('base64') }),
        h = new URL(helper()),
        r = http.request(
          {
            host: h.hostname,
            port: +h.port,
            path: '/link/reply',
            method: 'POST',
            agent: replyAgent,
            headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'x-link-key': linkKey() },
          },
          x => x.resume()
        );
      r.on('error', () => {});
      r.end(data);
    });
    // the hub's own request (its TV health history, hub/server.js): only the read-only status, without a phone's key; the link
    // itself is the proof (the hub's key, pinned there, and the TV's own connection). A phone's request never carries this mark
    if (m.self === true) {
      res.setHeader('content-type', 'application/json');
      if (req.method !== 'GET' || statusdata.PATHS.indexOf(req.url) < 0) {
        res.writeHead(403);
        return res.end(JSON.stringify({ error: 'the hub may only read the status' }));
      }
      return Promise.resolve(tvStatus.get(req.url)).then(
        r => {
          res.writeHead((r && r.code) || 200);
          res.end(JSON.stringify(r));
        },
        e => {
          res.writeHead(502);
          res.end(JSON.stringify({ error: String((e && e.message) || e) }));
        }
      );
    }
    lan(req, res);
  }
  function listen() {
    if (via() === 'hub') {
      if (srv) unlisten();
      linkUp();
      return Promise.resolve();
    }
    if (srv) return Promise.resolve();
    return new Promise(resolve => {
      const s = http.createServer(lan);
      s.on('connection', c => {
        conns.add(c);
        c.on('close', () => conns.delete(c));
      });
      s.on('error', e => {
        console.log('remote: the phone page could not start: ' + e.message);
        if (srv === s) srv = null;
        resolve();
      });
      s.listen(PORT, '0.0.0.0', () => {
        srv = s;
        resolve();
      });
    });
  }
  function unlisten() {
    linkStop();
    if (!srv) return;
    try {
      srv.close();
    } catch (_) {}
    // a moment later, so a reply on its way (the fifth wrong code) still goes out
    const open = [];
    conns.forEach(c => open.push(c));
    conns.clear();
    setTimeout(() => open.forEach(c => c.destroy()), 200);
    srv = null;
    if (sock) sock.destroy();
    sock = null;
  }

  function status() {
    return {
      on: isOn(),
      url: srv || via() === 'hub' ? helper() || 'http://' + web.lanIp() + ':' + PORT : '',
      helper: helper(),
      via: via(),
      link: via() === 'hub' ? linkState : '',
      devices: devices().map(d => ({ id: d.id, name: d.name, added: d.added || 0, used: d.used || 0 })),
      pairing: pairing ? { until: pairing.until } : null,
    };
  }
  async function handle(req, res, u, body) {
    if (u === '/api/remote/status') return web.json(res, status());
    if (req.method !== 'POST') return web.json(res, { error: 'POST expected' }, 405);
    const b = (await body(req)) || {};
    if (u === '/api/remote/pair') {
      if (b.stop) {
        closePairing();
        return web.json(res, status());
      }
      return web.json(res, await openPairing());
    }
    if (u === '/api/remote/forget') {
      config.update('remote (removed a phone)', c => {
        const r = Object.assign({}, c.remote);
        r.devices = (r.devices || []).filter(d => d.id !== String(b.id || ''));
        c.remote = r;
      });
      if (!isOn() && !pairing) unlisten();
      return web.json(res, status());
    }
    if (u === '/api/remote/helper') {
      const url = String(b.url || '').replace(/\/+$/, '');
      if (url && !hubOk(url)) return web.json(res, { error: 'the hub must be http://<home network address>:<port>' }, 400);
      config.update('remote (hub ' + (url ? 'set' : 'cleared') + ')', c => {
        const r = Object.assign({}, c.remote);
        if (url) r.helper = url;
        else delete r.helper;
        c.remote = r;
      });
      // a cleared hub goes back to the LAN server; a new one gets the link
      unlisten();
      if (isOn() || pairing) await listen();
      return web.json(res, status());
    }
    if (u === '/api/remote/via') {
      const v = b.via === 'hub' ? 'hub' : 'tv';
      if (v === 'hub' && !helper()) return web.json(res, { error: 'set the hub first' }, 400);
      config.update('remote (through ' + (v === 'hub' ? 'the hub' : 'the TV') + ')', c => {
        const r = Object.assign({}, c.remote);
        if (v === 'hub') r.via = 'hub';
        else delete r.via;
        c.remote = r;
      });
      // the other way down, then this way up when a phone is paired or pairing is open
      unlisten();
      if (isOn() || pairing) await listen();
      return web.json(res, status());
    }
    if (u === '/api/remote/on') {
      config.update('remote (switched ' + (b.on === false ? 'off' : 'on') + ')', c => {
        const r = Object.assign({}, c.remote);
        if (b.on === false) r.on = false;
        else delete r.on;
        c.remote = r;
      });
      if (isOn()) await listen();
      else if (!pairing) unlisten();
      return web.json(res, status());
    }
    web.notFound(res);
  }

  return {
    name: 'remote',
    paths: ['/api/remote/status', '/api/remote/pair', '/api/remote/forget', '/api/remote/on', '/api/remote/helper', '/api/remote/via'],
    handle,
    start: () => {
      if (isOn()) listen();
    },
    stop: () => {
      closePairing();
      unlisten();
    },
  };
}

module.exports = { create, homeAddress, KEYS, PORT };
