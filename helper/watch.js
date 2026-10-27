// Continue watching: the cards of Home's first grid row, things started and not finished, never app shortcuts (the apps are on Home
// already). From Telemachus on this TV (what is playing, or the episode each show is in the middle of, and one card for what its
// channel plays next), and Plex and Stremio once linked (plex.js, stremio.js: what is partly watched). Read here, by the root service:
// Telemachus answers programs on the TV but refuses web pages, and the pictures are fetched here and served from memory, so the Home
// page never contacts another site.
//   GET /api/watch/rows        {items: [{key, group, title, sub, img, progress, next, launch: {id, params}, source}]}
//                              (group: what Remove on Home takes away, a whole show or a film; the launcher keeps that list)
//   GET /api/watch/img/<id>    a picture named in items, from memory
//   GET /api/watch/accounts    {plex: {linked, server, state, code, url, error}, stremio: {...}} (never a key)
//   POST /api/watch/link {service: 'plex'|'stremio'}  -> {code, url}    POST /api/watch/unlink {service}
const crypto = require('crypto');
const web = require('./web'),
  fetch = require('./fetch');

const TELEMACHUS = process.env.CYTV_TELEMACHUS || 'http://127.0.0.1:8770', // another address only for the tests
  TELEMACHUS_APP = 'com.telemachus.screen',
  ROWS_MS = 20 * 1000,
  SHOWS_MS = 10 * 60 * 1000,
  IMG_MAX = 40,
  IMG_BYTES = 1024 * 1024;
// pictures only from TMDB's image host, in a TV-sized width
const TMDB = /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/,
  METAHUB = /^https:\/\/images\.metahub\.space\/[a-z]+\/[a-z]+\/tt\d+\/img$/;
// "S8 E9 · The Simple Intimacy of the Near Touch"; Telemachus's titles can be file names ("The Vampire Diaries S08E09 - The Simple...")
const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function ep(show, s, e, t) {
  const name = String(t || '')
    .replace(new RegExp('^(' + esc(show || '') + '[\\s._-]*)?S\\d+\\s*E\\d+\\b[\\s._:\\u00B7-]*', 'i'), '')
    .trim();
  return 'S' + s + ' E' + e + (name ? ' \u00B7 ' + name : '');
}

function create(ctx) {
  const imgs = {}, // id -> {url, buf, type, at}
    imgOrder = [];
  let cache = /** @type {any} */ (null),
    cacheAt = 0;
  // a picture's id for the page; the address (with a Plex server's key in it) stays here
  function remember(u) {
    const id = crypto.createHash('sha1').update(u).digest('hex').slice(0, 16);
    if (!imgs[id]) {
      imgs[id] = { url: u, buf: null, type: '', at: 0 };
      imgOrder.push(id);
      while (imgOrder.length > IMG_MAX) delete imgs[imgOrder.shift()];
    }
    return '/api/watch/img/' + id;
  }
  // TMDB (Telemachus) in a TV-sized width; Stremio's image host; the linked Plex server (an address built here, not taken from data)
  const pic = (url, width) => {
    const u = typeof url === 'string' ? url.replace(/\/t\/p\/[a-z0-9]+\//, '/t/p/' + width + '/') : '';
    return TMDB.test(u) ? remember(u) : '';
  };
  const metahubPic = url => (typeof url === 'string' && METAHUB.test(url) ? remember(url) : '');
  const plexPic = url => (typeof url === 'string' && /^https?:\/\//.test(url) ? remember(url) : '');
  // a newly linked account shows on the next read, not after the 20 s cache
  const sub = Object.assign({}, ctx, {
    changed: () => {
      cache = null;
    },
  });
  const plex = require('./plex').create(sub),
    stremio = require('./stremio').create(sub);
  async function sendImg(res, id) {
    const im = imgs[id];
    if (!im) return web.notFound(res);
    if (!im.buf) {
      try {
        const r = await fetch.read(im.url, { allowHttp: !/^https:/.test(im.url), totalMs: 20000, maxBytes: IMG_BYTES, redirects: 0 });
        im.buf = r.body;
        im.type = String(r.headers['content-type'] || 'image/jpeg');
      } catch (e) {
        return web.notFound(res);
      }
    }
    res.writeHead(200, { 'content-type': im.type, 'content-length': im.buf.length, 'cache-control': 'private, max-age=86400' });
    res.end(im.buf);
  }

  // ---- Telemachus: GET /api/brief (now playing, the plan) and /api/shows (pictures), from loopback with no origin ----
  const tm = path =>
    fetch
      .read(TELEMACHUS + path, { totalMs: 4000, idleMs: 3000, maxBytes: 2 * 1024 * 1024, redirects: 0 })
      .then(r => JSON.parse(r.body.toString('utf8')));
  let shows = {},
    showsAt = 0;
  async function telemachus() {
    let brief;
    try {
      brief = await tm('/api/brief');
    } catch (_) {
      return []; // not installed, or not running
    }
    if (Date.now() - showsAt > SHOWS_MS) {
      try {
        const s = await tm('/api/shows');
        shows = {};
        for (const x of (s && s.shows) || []) if (x && x.show) shows[x.show] = x;
        showsAt = Date.now();
      } catch (_) {}
    }
    const st = (brief && brief.state) || {},
      plan = Array.isArray(st.plan) ? st.plan : [],
      out = [],
      seen = {};
    const picOf = (show, poster) => (shows[show] && pic(shows[show].backdrop, 'w780')) || pic(poster, 'w342');
    const titleOf = (show, s, e) => (plan.filter(p => p && p.show === show && p.season === s && p.episode === e)[0] || {}).title || '';
    const card = (show, s, e, title, poster, progress, play, next) => ({
      key: 'tm-' + show + '-' + s + '-' + e,
      group: 'tm:' + show,
      source: 'telemachus',
      title: show,
      sub: ep(show, s, e, title),
      img: picOf(show, poster),
      progress: progress > 0 ? Math.min(1, progress) : null,
      next: !!next,
      launch: { id: TELEMACHUS_APP, params: { play } },
    });
    // what the player has
    const np = st.now_playing;
    if (np && np.show) {
      const len = +np.length_seconds || 0,
        pos = +np.position_seconds || 0;
      out.push(
        card(np.show, np.season, np.episode, np.title, np.poster, len > 0 ? pos / len : (+np.percent_complete || 0) / 100, { resume: true })
      );
      seen[np.show] = 1;
    }
    // the episode each other show is in the middle of (the latest one, when there are several)
    for (const sh of Array.isArray(st.shows) ? st.shows : []) {
      if (!sh || !sh.show || seen[sh.show] || out.length >= 4) continue;
      const ip = (Array.isArray(sh.in_progress) ? sh.in_progress : [])
        .filter(x => x && x.season > 0 && x.episode > 0)
        .sort((a, b) => b.season - a.season || b.episode - a.episode)[0];
      if (!ip) continue;
      out.push(
        card(sh.show, ip.season, ip.episode, titleOf(sh.show, ip.season, ip.episode), sh.poster, (+ip.percent || 0) / 100, {
          show: sh.show,
          season: ip.season,
          episode: ip.episode,
        })
      );
      seen[sh.show] = 1;
    }
    // one card for what the channel plays next, when it is not a show already here
    const p = plan.filter(x => x && (x.film || (x.show && !seen[x.show])))[0];
    if (p && p.film) {
      const name = p.film_title || p.title || p.show;
      out.push({
        key: 'tm-film-' + (p.tmdb_id || name),
        group: 'tm:film:' + (p.tmdb_id || name),
        source: 'telemachus',
        title: name,
        sub: p.year ? String(p.year) : '',
        img: pic(p.poster, 'w342'),
        progress: null,
        next: true,
        launch: { id: TELEMACHUS_APP, params: { play: { film: name, year: p.year || null, tmdb_id: p.tmdb_id || null } } },
      });
    } else if (p)
      out.push(card(p.show, p.season, p.episode, p.title, p.poster, 0, { show: p.show, season: p.season, episode: p.episode }, true));
    return out;
  }

  async function rows() {
    if (cache && Date.now() - cacheAt < ROWS_MS) return cache;
    const [t, px, st] = await Promise.all([telemachus(), plex.items(plexPic).catch(() => []), stremio.items(metahubPic).catch(() => [])]);
    // what Telemachus has started, what Plex and Stremio have partly watched, then what Telemachus's channel plays next
    cache = {
      items: /** @type {any[]} */ ([]).concat(
        t.filter(i => !i.next),
        px,
        st,
        t.filter(i => i.next)
      ),
    };
    cacheAt = Date.now();
    return cache;
  }

  const services = { plex, stremio };
  async function handle(req, res, u, body) {
    if (u === '/api/watch/rows') return web.json(res, await rows());
    if (u === '/api/watch/accounts') return web.json(res, { plex: plex.status(), stremio: stremio.status() });
    if ((u === '/api/watch/link' || u === '/api/watch/unlink') && req.method === 'POST') {
      const sv = services[String((await body(req)).service || '')];
      if (!sv) return web.json(res, { error: 'unknown service' }, 400);
      cache = null;
      if (u === '/api/watch/unlink') {
        sv.unlink();
        return web.json(res, { ok: true });
      }
      return web.json(res, await sv.link());
    }
    const m = /^\/api\/watch\/img\/([0-9a-f]{16})$/.exec(u);
    if (m) return sendImg(res, m[1]);
    web.notFound(res);
  }
  return { name: 'watch', prefix: '/api/watch/', handle, rows };
}

module.exports = { create, TMDB };
