// Sonos volume on screen (optional, off by default). When the TV's sound goes to a Sonos soundbar (HDMI ARC/eARC or optical), LG's own
// volume display has no number to show. This part follows the speaker's own volume and shows it as a small bar over whatever is on
// screen (the notify app, kind "volume") each time it changes, while the screen is on and the sound goes out of the TV.
// Read only, by construction: it finds Sonos players with SSDP, reads their device description and asks only GetVolume and GetMute
// (UPnP RenderingControl on port 1400 of the speaker, local, no account). Changes arrive as UPnP events (SUBSCRIBE) on a port the
// system picks, open only while the option is on, answered only for the chosen speaker's address and a random path; when no events
// arrive there it reads the volume once a second instead. Nothing here can change the volume, mute or any setting of the speaker.
// API (loopback only): GET /api/sonos/status, POST /api/sonos/find (search the network), POST /api/sonos/set {enabled, speaker, position}
const http = require('http'),
  dgram = require('dgram'),
  os = require('os'),
  crypto = require('crypto');
const web = require('./web');

const DEFAULTS = { enabled: false, speaker: null, position: 'top-left' }; // speaker null: found automatically
const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const ST = 'urn:schemas-upnp-org:device:ZonePlayer:1';
const RC = 'urn:schemas-upnp-org:service:RenderingControl:1';
const DESCRIPTION = '/xml/device_description.xml',
  CONTROL = '/MediaRenderer/RenderingControl/Control',
  EVENTS = '/MediaRenderer/RenderingControl/Event';
// the only actions this part ever sends to a speaker; both only read
const READ_ONLY = ['GetVolume', 'GetMute'];
// the Sonos models that take the TV's sound, for the automatic choice (a Sub or the surrounds of a set answer the search too)
const THEATER = /\b(Playbar|Playbase|Beam|Arc|Ray|Amp)\b/i;
const MAX_BYTES = 256 * 1024,
  SECONDS_SHOWN = 3;

// one request to a speaker; resolves {status, headers, body, local} (local: this TV's address on that connection) or {error}, never
// rejects, always ends (time limit) and reads at most MAX_BYTES
function request(host, port, method, path, headers, body, ms) {
  return new Promise(resolve => {
    let done = false,
      local = '',
      q = null;
    const end = r => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(r);
    };
    const t = setTimeout(() => {
      end({ error: 'no answer' });
      if (q) q.destroy();
    }, ms || 4000);
    const data = body ? Buffer.from(body) : Buffer.alloc(0);
    // a request without a body still says so: Node would send any other method than GET as chunked
    const h = Object.assign({ 'CONTENT-LENGTH': data.length, CONNECTION: 'close' }, headers);
    q = http.request({ host, port, method, path, headers: h, agent: false }, res => {
      const parts = [];
      let n = 0;
      res.on('data', c => {
        n += c.length;
        if (n > MAX_BYTES) {
          end({ error: 'answer too large' });
          return q.destroy();
        }
        parts.push(c);
      });
      res.on('aborted', () => end({ error: 'connection dropped' }));
      res.on('end', () => end({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts).toString('utf8'), local }));
    });
    q.on('socket', s => s.on('connect', () => (local = String(s.localAddress || '').replace(/^::ffff:/, ''))));
    q.on('error', e => end({ error: e.message }));
    q.end(data);
  });
}

const unxml = s =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
const tag = (x, name) => {
  const m = new RegExp('<' + name + '>([^<]*)</' + name + '>').exec(x);
  return m ? unxml(m[1]).trim() : '';
};
// the addresses of this TV: an answer to the search must not point the service at the TV itself
function ownAddresses() {
  const out = ['127.0.0.1'],
    n = os.networkInterfaces();
  for (const k of Object.keys(n))
    for (const a of n[k] || []) if (String(a.family) === 'IPv4' || String(a.family) === '4') out.push(a.address);
  return out;
}
// a player's device description: its id, room and model
function parseDescription(x) {
  const id = /^uuid:(RINCON_[A-Za-z0-9]+)$/.exec(tag(x, 'UDN'));
  if (!id) return null;
  const model = tag(x, 'modelName').slice(0, 60);
  return {
    id: id[1],
    name: (tag(x, 'roomName') || tag(x, 'displayName') || model || 'Sonos').slice(0, 60),
    model,
    theater: THEATER.test(model),
  };
}
// a RenderingControl event: {volume, muted} from its LastChange (the master channel), or null
function parseEvent(body) {
  const m = /<LastChange>([\s\S]*?)<\/LastChange>/.exec(body || '');
  if (!m) return null;
  const x = unxml(m[1]),
    r = {},
    re = /<(Volume|Mute)\b([^>]*)>/g;
  let e;
  while ((e = re.exec(x))) {
    const ch = /\bchannel="([^"]*)"/.exec(e[2]),
      val = /\bval="(\d+)"/.exec(e[2]);
    if (!ch || ch[1] !== 'Master' || !val) continue;
    if (e[1] === 'Volume') r.volume = Math.min(100, +val[1]);
    else r.muted = val[1] === '1';
  }
  return 'volume' in r || 'muted' in r ? r : null;
}

function create(ctx, opts) {
  const o = Object.assign(
    {
      findMs: 2500, // how long a search waits for answers
      firstEventMs: 8000, // without an event by then, the events do not reach the TV: read the volume instead
      pollMs: 1000,
      retryMs: 15000, // the first wait after a failure; it doubles up to five minutes
      screenMs: 3000, // how long the TV's power state and sound output are trusted
      subSeconds: 1800, // how long a subscription is asked for; renewed at half
      ssdp: { address: '239.255.255.250', port: 1900 },
      selfOk: false, // the tests' stand-in speaker runs on this computer
    },
    opts
  );
  const { config } = ctx;
  const luna = ctx.luna;
  const notify = () => ctx.notify || ctx.feature('notify');
  const cfg = () => Object.assign({}, DEFAULTS, config.get().sonos || {});
  const save = n =>
    config.update('sonos', c => {
      c.sonos = n;
    });

  let gen = 0, // raised on every change of the settings, so work that was started before stops
    speaker = null, // the speaker followed: {id, host, port, name, model}
    srv = null,
    srvPort = 0,
    evPath = '', // the random path of the current subscription
    sid = '',
    evSeen = false,
    timers = [],
    /** @type {any} */ poll = null,
    wait = 0,
    searching = null;
  const found = new Map(); // id -> the speaker as last found, for set({speaker})
  const st = { state: 'off', mode: '', volume: null, muted: null, error: '' };

  const later = (ms, fn) => {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  };
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    if (poll) clearInterval(poll);
    poll = null;
  }

  // SSDP: the players that answer, each with the address of its description (which must be the address that answered)
  function ssdp() {
    return new Promise(resolve => {
      const out = new Map(),
        own = o.selfOk ? [] : ownAddresses();
      let s;
      try {
        s = dgram.createSocket('udp4');
      } catch (_) {
        return resolve([]);
      }
      const msg = Buffer.from(
        ['M-SEARCH * HTTP/1.1', 'HOST: 239.255.255.250:1900', 'MAN: "ssdp:discover"', 'MX: 1', 'ST: ' + ST, '', ''].join('\r\n')
      );
      const send = () => {
        try {
          s.send(msg, 0, msg.length, o.ssdp.port, o.ssdp.address);
        } catch (_) {}
      };
      s.on('error', () => {});
      s.on('message', (b, from) => {
        const t = b.toString('utf8', 0, Math.min(b.length, 4096));
        const loc = /^location:[ \t]*(\S+)/im.exec(t),
          usn = /^usn:[ \t]*uuid:(RINCON_[A-Za-z0-9]+)/im.exec(t);
        if (!loc || !usn || out.has(usn[1])) return;
        const u = /^http:\/\/(\d+\.\d+\.\d+\.\d+):(\d{1,5})(\/\S*)$/.exec(loc[1]);
        // a device may only point at its own Sonos description, never at another address or at this TV
        if (!u || u[1] !== from.address || u[3] !== DESCRIPTION || own.indexOf(u[1]) >= 0) return;
        out.set(usn[1], { host: u[1], port: +u[2] });
      });
      s.bind(0, () => {
        try {
          s.setMulticastTTL(2);
        } catch (_) {}
        send();
        setTimeout(send, 400); // a search is a single datagram: twice, in case one is lost
      });
      setTimeout(() => {
        try {
          s.close();
        } catch (_) {}
        resolve(Array.from(out.values()));
      }, o.findMs);
    });
  }
  async function describe(host, port) {
    const r = await request(host, port, 'GET', DESCRIPTION, {}, null, 4000);
    const d = r.status === 200 ? parseDescription(r.body) : null;
    return d ? Object.assign(d, { host, port }) : null;
  }
  // search the network; one search at a time, the others wait for it
  function find() {
    if (searching) return searching;
    searching = ssdp()
      .then(list => Promise.all(list.map(x => describe(x.host, x.port))))
      .then(list => {
        searching = null;
        const out = list.filter(Boolean);
        out.forEach(x => found.set(x.id, x));
        return out.sort((a, b) => Number(b.theater) - Number(a.theater) || a.name.localeCompare(b.name));
      });
    return searching;
  }
  const pub = x => ({ id: x.id, name: x.name, model: x.model, theater: !!x.theater });

  // only reads; anything else is refused before it is sent
  async function read(sp, action) {
    if (READ_ONLY.indexOf(action) < 0) throw new Error('not a read: ' + action);
    const body =
      '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
      's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:' +
      action +
      ' xmlns:u="' +
      RC +
      '"><InstanceID>0</InstanceID><Channel>Master</Channel></u:' +
      action +
      '></s:Body></s:Envelope>';
    const r = await request(
      sp.host,
      sp.port,
      'POST',
      CONTROL,
      { 'CONTENT-TYPE': 'text/xml; charset="utf-8"', SOAPACTION: '"' + RC + '#' + action + '"' },
      body
    );
    if (r.error || r.status !== 200) return { error: r.error || 'the speaker answered ' + r.status };
    return { body: r.body, local: r.local };
  }
  async function readState(sp) {
    const v = await read(sp, 'GetVolume');
    if (v.error) return v;
    const m = await read(sp, 'GetMute');
    if (m.error) return m;
    const vol = /<CurrentVolume>(\d+)<\/CurrentVolume>/.exec(v.body),
      mute = /<CurrentMute>([01])<\/CurrentMute>/.exec(m.body);
    if (!vol) return { error: 'no volume in the answer' };
    return { volume: Math.min(100, +vol[1]), muted: !!mute && mute[1] === '1', local: v.local };
  }

  // the TV's screen is on and its sound goes out (to the soundbar); asked at most every few seconds. A TV that does not answer the
  // sound question shows the bar anyway: the option was switched on for it.
  let screen = { at: 0, ok: true, p: null };
  function screenOk() {
    if (Date.now() - screen.at < o.screenMs) return Promise.resolve(screen.ok);
    if (screen.p) return screen.p;
    const q = Promise.all([
      luna('luna://com.webos.service.tvpower/power/getPowerState', {}),
      luna('luna://com.webos.service.audio/getSoundOutput', {}),
    ]).then(
      r => {
        const on = !r[0].state || r[0].state === 'Active',
          out = !/^tv_speaker/.test(String(r[1].soundOutput || ''));
        screen = { at: Date.now(), ok: on && out, p: null };
        return screen.ok;
      },
      () => {
        screen = { at: Date.now(), ok: true, p: null };
        return true;
      }
    );
    screen.p = q;
    return q;
  }

  // the bar over the running app: one launch of the notify app at a time, then the latest value
  let showing = false,
    queued = null;
  function overlay() {
    queued = { kind: 'volume', volume: st.volume, muted: !!st.muted, seconds: SECONDS_SHOWN, position: cfg().position };
    if (showing) return;
    showing = true;
    const next = () => {
      const p = queued;
      queued = null;
      if (!p) return void (showing = false);
      const n = notify();
      Promise.resolve(n ? n.show(p, true) : null)
        .catch(() => {})
        .then(next);
    };
    next();
  }
  // a new reading: the first after (re)connecting only sets what is current; a change shows the bar
  function apply(r) {
    const vol = st.volume,
      mut = st.muted;
    if (typeof r.volume === 'number') st.volume = r.volume;
    if (typeof r.muted === 'boolean') st.muted = r.muted;
    if (vol === null || (st.volume === vol && st.muted === mut)) return;
    screenOk().then(ok => {
      if (ok && st.state === 'listening') overlay();
    });
  }

  // the event port: NOTIFY from the followed speaker, on the current subscription's path, nothing else
  function onNotify(req, res) {
    const reply = c => {
      res.writeHead(c, { 'content-length': 0, connection: 'close' });
      res.end();
    };
    const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (req.method !== 'NOTIFY' || !speaker || ip !== speaker.host || !evPath || req.url !== evPath) {
      req.resume();
      return reply(403);
    }
    const g = gen,
      parts = [];
    let n = 0;
    req.on('data', c => {
      n += c.length;
      if (n <= MAX_BYTES) parts.push(c);
    });
    req.on('end', () => {
      if (n > MAX_BYTES) return reply(413);
      const s = String(req.headers.sid || '');
      if (sid && s !== sid) return reply(412); // UPnP: an unknown subscription
      reply(200);
      if (g !== gen) return;
      if (!evSeen) {
        evSeen = true;
        console.log('sonos: volume events arrive from the ' + speaker.model);
      }
      const r = parseEvent(Buffer.concat(parts).toString('utf8'));
      if (r) apply(r);
    });
  }
  function listen() {
    if (srv) return Promise.resolve(srvPort);
    return new Promise(resolve => {
      const s = http.createServer(onNotify);
      s.setTimeout(5000);
      s.on('error', e => {
        console.error('sonos: event port: ' + e.message);
        resolve(0);
      });
      s.listen(0, '0.0.0.0', () => {
        srv = s;
        srvPort = /** @type {any} */ (s.address()).port;
        resolve(srvPort);
      });
    });
  }
  function closePort() {
    if (srv)
      try {
        srv.close();
      } catch (_) {}
    srv = null;
    srvPort = 0;
  }
  function unsubscribe() {
    if (sid && speaker) request(speaker.host, speaker.port, 'UNSUBSCRIBE', EVENTS, { SID: sid }, null, 3000);
    sid = '';
    evPath = '';
  }

  function fail(g, state, error) {
    if (g !== gen) return;
    if (poll) clearInterval(poll);
    poll = null;
    st.state = state;
    st.mode = '';
    st.error = error;
    wait = Math.min(300000, wait ? wait * 2 : o.retryMs);
    console.log('sonos: ' + error + '; trying again in ' + Math.round(wait / 1000) + ' s');
    later(wait, () => g === gen && connect(g));
  }
  // the speaker to follow: the chosen one (found again by its id when its address changed), else the only soundbar on the network
  async function locate() {
    const c = cfg();
    if (c.speaker && c.speaker.id) {
      if (c.speaker.host) {
        const d = await describe(c.speaker.host, c.speaker.port || 1400);
        if (d && d.id === c.speaker.id) return d;
      }
      const list = await find();
      const d = list.filter(x => x.id === c.speaker.id)[0];
      if (!d) st.error = 'the chosen speaker was not found on the network';
      else if (cfg().speaker && cfg().speaker.id === d.id) save(Object.assign(cfg(), { speaker: d })); // its new address
      return d || null;
    }
    const list = await find(),
      bars = list.filter(x => x.theater);
    if (bars.length === 1) return bars[0];
    if (list.length === 1) return list[0];
    st.error = list.length ? 'several speakers: choose one' : '';
    return null;
  }
  async function connect(g) {
    clearTimers();
    unsubscribe();
    st.state = 'searching';
    st.mode = '';
    st.error = '';
    const sp = await locate();
    if (g !== gen) return;
    if (!sp) return fail(g, 'not found', st.error || 'no Sonos speaker found on the network');
    speaker = sp;
    const r = await readState(sp);
    if (g !== gen) return;
    if (r.error) return fail(g, 'error', r.error);
    st.volume = r.volume;
    st.muted = r.muted;
    st.error = '';
    st.state = 'listening';
    wait = 0;
    const port = await listen();
    if (g !== gen) return;
    if (!port || !r.local) return polling(g, 'no event port');
    evPath = '/sonos/' + crypto.randomBytes(12).toString('hex');
    evSeen = false;
    const s = await request(sp.host, sp.port, 'SUBSCRIBE', EVENTS, {
      CALLBACK: '<http://' + r.local + ':' + port + evPath + '>',
      NT: 'upnp:event',
      TIMEOUT: 'Second-' + o.subSeconds,
    });
    if (g !== gen) return;
    if (s.status !== 200 || !s.headers.sid) return polling(g, 'the speaker refused the subscription');
    sid = String(s.headers.sid);
    st.mode = 'events';
    console.log('sonos: following the volume of the ' + sp.model); // the model, not the room: the log goes into Share log
    renewLater(g, s.headers.timeout);
    later(o.firstEventMs, () => {
      if (g === gen && !evSeen) polling(g, 'no events reach the TV');
    });
  }
  function renewLater(g, timeout) {
    const m = /Second-(\d+)/i.exec(String(timeout || '')),
      secs = m ? +m[1] : o.subSeconds;
    later(Math.max(1000, (secs * 1000) / 2), async () => {
      if (g !== gen || !sid) return;
      const s = await request(speaker.host, speaker.port, 'SUBSCRIBE', EVENTS, { SID: sid, TIMEOUT: 'Second-' + o.subSeconds });
      if (g !== gen) return;
      if (s.status === 200) return renewLater(g, s.headers.timeout);
      // the speaker restarted or moved: subscribe again
      sid = '';
      connect(g);
    });
  }
  function polling(g, why) {
    unsubscribe();
    st.mode = 'polling';
    console.log('sonos: ' + why + '; reading the volume every ' + o.pollMs / 1000 + ' s');
    let busy = false,
      misses = 0;
    poll = setInterval(async () => {
      if (busy || g !== gen) return;
      busy = true;
      if (await screenOk()) {
        const r = await readState(speaker);
        if (g === gen) {
          if (!r.error) {
            misses = 0;
            apply(r);
          } else if (++misses >= 5) {
            busy = false;
            return fail(g, 'error', r.error);
          }
        }
      }
      busy = false;
    }, o.pollMs);
  }

  // make the running work match the settings: at start and after every change
  function sync() {
    const c = cfg();
    gen++;
    clearTimers();
    unsubscribe();
    wait = 0;
    if (!c.enabled) {
      closePort();
      speaker = null;
      Object.assign(st, { state: 'off', mode: '', volume: null, muted: null, error: '' });
      return;
    }
    st.volume = st.muted = null;
    connect(gen);
  }
  function status() {
    const c = cfg();
    return {
      enabled: !!c.enabled,
      speaker: c.speaker ? pub(c.speaker) : null, // null: found automatically
      using: c.enabled && speaker ? pub(speaker) : null,
      position: c.position,
      state: st.state,
      mode: st.mode,
      volume: st.volume,
      muted: st.muted,
      error: st.error,
    };
  }
  function set(b) {
    const n = cfg();
    if (typeof b.enabled === 'boolean') n.enabled = b.enabled;
    if (typeof b.speaker === 'string') {
      if (!b.speaker) n.speaker = null;
      else if (found.has(b.speaker)) n.speaker = found.get(b.speaker);
      else return { error: 'unknown speaker: search again' };
    }
    if (POSITIONS.indexOf(b.position) >= 0) n.position = b.position;
    save(n);
    sync();
    return status();
  }

  async function handle(req, res, u, body) {
    if (u === '/api/sonos/status') return web.json(res, status());
    if (req.method !== 'POST') return web.json(res, { error: 'POST expected' }, 405);
    const b = await body(req);
    if (u === '/api/sonos/find') return web.json(res, { speakers: (await find()).map(pub) });
    if (u === '/api/sonos/set') {
      const r = set(b);
      return web.json(res, r, r.error ? 400 : 200);
    }
    web.notFound(res);
  }

  return { name: 'sonos', prefix: '/api/sonos/', handle, start: sync, sync, status, set, find, stop: () => set({ enabled: false }) };
}

module.exports = { create, parseEvent, parseDescription, READ_ONLY, POSITIONS };
