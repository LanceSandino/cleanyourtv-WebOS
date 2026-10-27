// Photo feed for the screensaver: photos from any server that offers the read-only photo feed (docs/screensaver.md has the contract;
// family-calendar's Admin > Photo feeds is one): GET /api/feed/photos gives the photo ids with an ETag, GET /api/feed/photos/<id>?w=1920
// one photo as JPEG, both with Authorization: Bearer <token>. It is set up with the server's setup code, "cyfp1." + base64url JSON
// {u: the https address, t: the token, ca: the server's root certificate as base64 DER}; with ca, that certificate is the only one
// trusted for the server.
// The TV never holds the library: the ids are read every hour, and a photo is fetched when the screensaver is about to show it (and
// the one after it) into a small cache (CACHE_FILES photos, CACHE_BYTES), the least recently shown leaving first. A photo hidden or
// removed on the server leaves the cache at the next read of the ids. The shuffled order is saved with the ids, so a restart goes on
// where it was instead of starting a new round. The token stays in config.json (root only), never returned.
//   GET  /api/photofeed/status        {configured, host, tokenHint, pinned, photos, cached, lastSync, tried, error}
//   GET  /api/photofeed/next          {id}: the photo to show next, already in the cache ({id: null, reason} when there is none)
//   GET  /api/photofeed/photo/<id>    the photo (JPEG)
//   POST /api/photofeed/setup {code}  POST /api/photofeed/refresh  POST /api/photofeed/disconnect
// The wallpapers phone page calls setup() too: a setup code is too long to type with a remote.
const fs = require('fs'),
  path = require('path');
const P = require('./paths'),
  web = require('./web'),
  fetch = require('./fetch'),
  nc = require('./netcompat'),
  { URL } = nc;
const { imageType } = require('./wallpapers');

const DIR = P.D + '/photofeed',
  CACHE = DIR + '/cache',
  STATE = DIR + '/list.json';
const CACHE_FILES = 30,
  CACHE_BYTES = 40 * 1024 * 1024,
  PHOTO_MAX = 8 * 1024 * 1024,
  WIDTH = 1920,
  LIST_MS = 3600 * 1000;
const ID = /^[A-Za-z0-9_-]{1,64}$/,
  PREFIX = 'cyfp1.';

const b64 = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
// a certificate (DER, base64 or base64url) as PEM; '' when it does not look like one
function pem(s) {
  const der = b64(s);
  if (der.length < 100 || der[0] !== 0x30) return '';
  const lines = der.toString('base64').match(/.{1,64}/g) || [];
  return '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----\n';
}
// the setup code -> {url, token, ca} or {error}
function parseCode(code) {
  const s = String(code || '').replace(/\s+/g, '');
  if (s.indexOf(PREFIX) !== 0) return { error: 'This is not a photo feed setup code.' };
  let j = null;
  try {
    j = JSON.parse(b64(s.slice(PREFIX.length)).toString('utf8'));
  } catch (_) {}
  if (!j || typeof j !== 'object' || typeof j.u !== 'string' || typeof j.t !== 'string')
    return { error: 'The setup code is damaged. Copy it again.' };
  let u;
  try {
    u = new URL(j.u);
  } catch (_) {
    return { error: 'The setup code has no valid address.' };
  }
  if (u.protocol !== 'https:') return { error: 'The photo feed must use https.' };
  if (!/^[\x21-\x7e]{20,200}$/.test(j.t)) return { error: 'The setup code has no valid token.' };
  let ca = '';
  if (j.ca !== undefined) {
    ca = typeof j.ca === 'string' && /^[A-Za-z0-9+/=_-]{100,8000}$/.test(j.ca) ? pem(j.ca) : '';
    if (!ca) return { error: 'The certificate in the setup code is damaged.' };
  }
  return { url: u.protocol + '//' + u.host, token: j.t, ca };
}
// a TLS or connection error in words a person can act on
function plain(e) {
  const m = String((e && e.message) || e);
  if (e && e.status === 401) return 'The photo feed refused the token. Set it up again with a new setup code.';
  if (e && e.status === 403) return 'The photo feed refused the token. Set it up again with a new setup code.';
  if (/certificate|self.signed|altnames|issuer|CERT_|SSL|TLS/i.test(m))
    return "The photo feed's certificate does not match the setup code.";
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|timed out/i.test(m)) return 'The photo feed did not answer.';
  return m;
}
// Fisher-Yates with an unbiased random index
function shuffled(ids) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = nc.randomInt(0, i + 1),
      t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function create(ctx) {
  const config = ctx.config;
  const feedCfg = () => {
    const f = config.get().photoFeed;
    return f && typeof f.url === 'string' && typeof f.token === 'string' ? f : null;
  };
  // the photo ids and how they were read: kept on disk so the screensaver also starts with the server away
  let st = null;
  function state() {
    if (st) return st;
    try {
      st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    } catch (_) {
      st = {};
    }
    st.ids = Array.isArray(st.ids) ? st.ids.filter(id => ID.test(id)) : [];
    return st;
  }
  // the round so far is saved with the ids: at once when a new round starts or the list changes, otherwise at most every SAVE_MS,
  // so the TV's flash is not written for every photo (a restart may show a few photos of the round again)
  const SAVE_MS = ctx.saveMs !== undefined ? ctx.saveMs : 10 * 60 * 1000;
  let savedAt = 0;
  function save() {
    if (restored) {
      state().queue = queue;
      state().last = last;
    }
    savedAt = Date.now();
    nc.mkdirp(DIR);
    const tmp = STATE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state()));
    fs.renameSync(tmp, STATE);
  }
  const fileOf = id => path.join(CACHE, id + '.jpg');
  function cached() {
    let names = [];
    try {
      names = fs.readdirSync(CACHE);
    } catch (_) {}
    const out = [];
    for (const n of names) {
      const m = /^([A-Za-z0-9_-]{1,64})\.jpg$/.exec(n);
      if (!m) continue;
      try {
        const s = fs.statSync(path.join(CACHE, n));
        out.push({ id: m[1], at: s.mtime.getTime(), size: s.size });
      } catch (_) {}
    }
    return out.sort((a, b) => b.at - a.at); // the most recently shown first
  }
  const unlink = f => {
    try {
      fs.unlinkSync(f);
    } catch (_) {}
  };
  // the cache within its limits: the least recently shown leave first, never the ones in keep
  function trim(keep) {
    let n = 0,
      bytes = 0;
    for (const c of cached()) {
      n++;
      bytes += c.size;
      if ((n > CACHE_FILES || bytes > CACHE_BYTES) && keep.indexOf(c.id) < 0) unlink(fileOf(c.id));
    }
  }
  // photos that are no longer in the list (hidden or removed on the server) leave the TV
  function purge() {
    const ids = {};
    for (const id of state().ids) ids[id] = 1;
    for (const c of cached()) if (!ids[c.id]) unlink(fileOf(c.id));
  }

  const headers = (f, extra) =>
    Object.assign(
      { authorization: 'Bearer ' + f.token, 'user-agent': 'cleanyourtv-photofeed', accept: 'application/json, image/jpeg' },
      extra
    );
  // https only, no redirects (the token must not follow one to another host), and with a ca only that certificate is trusted
  const opts = (f, extra) => Object.assign({ allowHttp: false, redirects: 0, ca: f.ca || undefined, idleMs: 20000 }, extra);

  async function readIds(f, etag) {
    const r = await fetch.read(
      f.url + '/api/feed/photos',
      opts(f, { anyStatus: true, totalMs: 45000, maxBytes: 4 * 1024 * 1024, headers: headers(f, etag ? { 'if-none-match': etag } : {}) })
    );
    if (r.status === 304) return null;
    if (r.status !== 200) throw fetch.fail('HTTP ' + r.status, 'status', r.status);
    const j = JSON.parse(r.body.toString('utf8'));
    const ids = (Array.isArray(j && j.photos) ? j.photos : [])
      .map(p => String((p && p.id) || ''))
      .filter(id => ID.test(id))
      .slice(0, 20000);
    return { ids, etag: String(r.headers.etag || '') };
  }
  // read the ids again (every hour, and when the screensaver asks after an hour); a 304 keeps what is there
  let reading = null;
  function refresh() {
    const f = feedCfg();
    if (!f) return Promise.resolve(status());
    if (reading) return reading;
    const s = state();
    reading = readIds(f, s.ids.length ? s.etag : '')
      .then(
        got => {
          if (got) {
            // the round goes on: photos gone from the list leave it, new ones join it
            restore();
            const was = {},
              now = {};
            for (const id of s.ids) was[id] = 1;
            for (const id of got.ids) now[id] = 1;
            queue = queue.filter(id => now[id]).concat(shuffled(got.ids.filter(id => !was[id])));
            s.ids = got.ids;
            s.etag = got.etag;
            purge();
          }
          s.ok = s.tried = Date.now();
          s.error = '';
        },
        e => {
          s.tried = Date.now();
          s.error = plain(e);
        }
      )
      .then(() => {
        reading = null;
        save();
        return status();
      });
    return reading;
  }

  // ---- the order: shuffled, every photo once before any comes back, and never the same one twice in a row ----
  let queue = [],
    last = '',
    restored = false;
  // the round where it was before a restart (only ids still in the list)
  function restore() {
    if (restored) return;
    restored = true;
    const s = state(),
      valid = {};
    for (const id of s.ids) valid[id] = 1;
    queue = (Array.isArray(s.queue) ? s.queue : []).filter(id => typeof id === 'string' && valid[id]);
    last = typeof s.last === 'string' ? s.last : '';
  }
  function fill() {
    restore();
    queue = shuffled(state().ids);
    if (queue.length > 1 && queue[0] === last) queue.push(queue.shift());
    save();
  }
  function pick() {
    restore();
    // the photo on the screen comes back later, not now
    if (!queue.length || (queue[0] === last && queue.length === 1)) fill();
    else if (queue[0] === last) queue.push(queue.shift());
    last = queue.shift() || '';
    if (Date.now() - savedAt >= SAVE_MS) save();
    return last;
  }
  function peek() {
    restore();
    if (!queue.length) fill();
    return queue[0] || '';
  }

  // a photo in the cache: downloaded at WIDTH once, then shown from there
  const inflight = {};
  function ensure(id) {
    const file = fileOf(id);
    if (fs.existsSync(file)) {
      const now = new Date();
      try {
        fs.utimesSync(file, now, now);
      } catch (_) {}
      return Promise.resolve(file);
    }
    if (inflight[id]) return inflight[id];
    const f = feedCfg();
    if (!f) return Promise.reject(new Error('not set up'));
    const p = fetch
      .read(
        f.url + '/api/feed/photos/' + encodeURIComponent(id) + '?w=' + WIDTH,
        opts(f, { totalMs: 30000, maxBytes: PHOTO_MAX, bigText: 'the photo is too large', headers: headers(f) })
      )
      .then(r => {
        if (imageType(r.body) !== 'jpg') throw new Error('the photo feed sent something that is not a JPEG');
        nc.mkdirp(CACHE);
        fs.writeFileSync(file + '.part', r.body);
        fs.renameSync(file + '.part', file);
        trim([id, last]);
        return file;
      });
    inflight[id] = p.then(
      x => {
        delete inflight[id];
        return x;
      },
      e => {
        delete inflight[id];
        throw e;
      }
    );
    return inflight[id];
  }

  // the next photo for the screensaver, in the cache before it is named; the one after it is fetched meanwhile
  async function next() {
    if (!feedCfg()) return { id: null, reason: 'not set up' };
    if (Date.now() - (state().tried || 0) > LIST_MS) await refresh();
    restore();
    const shown = last; // what is on the screen now: a photo that could not be fetched does not replace it
    for (let i = 0; i < 3; i++) {
      const id = pick();
      if (!id) break;
      try {
        await ensure(id);
        const n = peek();
        if (n && n !== id) ensure(n).catch(() => {});
        return { id };
      } catch (e) {
        last = shown;
        if (e && (e.status === 404 || e.status === 422)) {
          state().ids = state().ids.filter(x => x !== id); // gone on the server since the last read, or one it cannot convert
          continue;
        }
        state().error = plain(e);
        break;
      }
    }
    // the server away: what is in the cache keeps the screensaver going, and the order does not bring that photo straight back
    const c = cached()
      .map(x => x.id)
      .filter(x => x !== shown);
    if (c.length) {
      last = c[nc.randomInt(0, c.length)];
      if (queue[0] === last) {
        if (queue.length > 1) queue.push(queue.shift());
        else fill();
      }
      return { id: last, offline: true };
    }
    return { id: null, reason: state().error || 'no photos' };
  }

  function status() {
    const f = feedCfg(),
      s = state();
    let host = '';
    try {
      host = f ? new URL(f.url).host : '';
    } catch (_) {}
    return {
      configured: !!f,
      host,
      tokenHint: f ? '…' + f.token.slice(-4) : '',
      pinned: !!(f && f.ca),
      photos: f ? s.ids.length : 0,
      cached: f ? cached().length : 0,
      lastSync: s.ok || 0,
      tried: s.tried || 0,
      error: s.error || '',
    };
  }
  // whether the screensaver has feed photos to show (the launcher gets only this, never the address or the token)
  const count = () => (feedCfg() ? state().ids.length || cached().length : 0);

  // a new setup code: tried before it is saved, so a wrong one changes nothing
  async function setup(code) {
    const f = parseCode(code);
    if (f.error) return { error: f.error };
    let got;
    try {
      got = await readIds(f, '');
    } catch (e) {
      return { error: plain(e) };
    }
    config.update('photofeed', c => {
      c.photoFeed = { url: f.url, token: f.token, ca: f.ca };
    });
    for (const x of cached()) unlink(fileOf(x.id));
    st = { ids: got.ids, etag: got.etag, ok: Date.now(), tried: Date.now(), error: '' };
    queue = [];
    last = '';
    restored = true;
    save();
    return status();
  }
  function disconnect() {
    config.update('photofeed', c => {
      delete c.photoFeed;
    });
    for (const x of cached()) unlink(fileOf(x.id));
    unlink(STATE);
    st = null;
    queue = [];
    last = '';
    restored = false;
    return status();
  }

  function send(res, id) {
    return ensure(id).then(
      file => {
        res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' });
        fs.createReadStream(file).pipe(res);
      },
      () => web.notFound(res)
    );
  }

  async function handle(req, res, u, body) {
    const json = o => web.json(res, o);
    if (u === '/api/photofeed/status') return json(status());
    if (u === '/api/photofeed/next') return json(await next());
    const m = /^\/api\/photofeed\/photo\/([A-Za-z0-9_-]{1,64})$/.exec(u);
    if (m) return send(res, m[1]);
    if (req.method !== 'POST') return web.notFound(res);
    if (u === '/api/photofeed/setup') return json(await setup(String((await body(req, 16384)).code || '')));
    if (u === '/api/photofeed/refresh') return json(await refresh());
    if (u === '/api/photofeed/disconnect') return json(disconnect());
    return web.notFound(res);
  }

  function start() {
    const t = setInterval(() => feedCfg() && refresh(), LIST_MS);
    if (t.unref) t.unref();
    if (feedCfg() && Date.now() - (state().tried || 0) > LIST_MS) {
      const t2 = setTimeout(refresh, 20000);
      if (t2.unref) t2.unref();
    }
  }

  return { name: 'photofeed', prefix: '/api/photofeed/', handle, start, status, count, setup, disconnect, refresh, next };
}

module.exports = { create, parseCode, CACHE_FILES, CACHE_BYTES };
