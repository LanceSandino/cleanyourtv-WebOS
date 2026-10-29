// Continue watching: the episodes and films a highlighted app on Home shows in a row under it (app/src/js/watch.js), things started
// and not finished, never app shortcuts. From Telemachus on this TV (what is playing, or the episode each show is in the middle of,
// then what its channel plays next), Plex, Stremio and Disney+ once linked (plex.js, stremio.js, disney.js: what is partly watched), and
// for the other apps the row LG's own Home shows under them (lgrows.js, without LG's advertisements; not Disney+'s once it is linked;
// with LG's picks switched off, watch.lgPicks false, only the rows the apps wrote themselves, and LG's content miner is not read).
// Read here, by the root service:
// Telemachus answers programs on the TV but refuses web pages, and the pictures are fetched here and served from memory, so the Home
// page never contacts another site.
//   GET /api/watch/rows        {items: [{key, group, title, sub, img, progress, next, launch: {id, params}, source, pick}]}
//                              (pick: on LG's rows, true for what LG's servers chose, false for a row the app wrote itself)
//                              (group: what Remove on Home takes away, a whole show or a film; the launcher keeps that list)
//   GET /api/watch/img/<id>    a picture named in items, from memory
//   known()                    the items of the last read, without reading (search.js looks titles up in them)
//   GET /api/watch/accounts    {plex: {linked, server, state, code, url, error}, stremio: {...}, disney: {...}} (never a key)
//   POST /api/watch/link {service: 'plex'|'stremio'|'disney'}  -> {code, url}    POST /api/watch/unlink {service}
const crypto = require('crypto');
const web = require('./web'),
  fetch = require('./fetch'),
  DISNEY_APP = require('./disney').APP;

const TELEMACHUS = process.env.CYTV_TELEMACHUS || 'http://127.0.0.1:8770', // another address only for the tests
  TELEMACHUS_APP = 'com.telemachus.screen',
  ROWS_MS = 20 * 1000,
  SHOWS_MS = 10 * 60 * 1000,
  IMG_MAX = 200, // pictures named (an address each)
  IMG_BYTES = 1024 * 1024, // one picture at most
  IMG_TOTAL = 12 * 1024 * 1024, // the pictures kept in memory at most (the oldest are dropped, fetched again when shown)
  TM_MAX = 6; // Telemachus's cards: one per show
// pictures only from TMDB's image host, in a TV-sized width
const TMDB = /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/,
  METAHUB = /^https:\/\/images\.metahub\.space\/[a-z]+\/[a-z]+\/tt\d+\/img$/,
  DISNEY_IMG =
    /^https:\/\/disney\.images\.edge\.bamgrid\.com\/ripcut-delivery\/v2\/variant\/disney\/[0-9a-f-]{36}\/scale\?width=\d+&aspectRatio=1\.78&format=jpeg$/,
  LG_IMG = /^https?:\/\/(aic\.imagesvc\.lgtvcommon\.com|ngfts\.lge\.com)\//;
// "S8 E9 · The Simple Intimacy of the Near Touch"; Telemachus's titles can be file names ("The Vampire Diaries S08E09 - The Simple...")
const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function ep(show, s, e, t) {
  const name = String(t || '')
    .replace(new RegExp('^(' + esc(show || '') + '[\\s._-]*)?S\\d+\\s*E\\d+\\b[\\s._:\\u00B7-]*', 'i'), '')
    .trim();
  return 'S' + s + ' E' + e + (name ? ' \u00B7 ' + name : '');
}

// Telemachus's film launch: year and tmdb_id only when they are what it takes (it opens normally on anything else)
function filmPlay(name, year, tmdb) {
  const play = /** @type {any} */ ({ film: String(name) });
  if (Number.isInteger(year) && year >= 1870 && year <= 2100) play.year = year;
  if (typeof tmdb === 'string' && /^tmdb:\d+$/.test(tmdb)) play.tmdb_id = tmdb;
  return play;
}

function create(ctx) {
  const imgs = {}, // id -> {url, buf, type, at}
    imgOrder = [];
  let cache = /** @type {any} */ (null),
    cacheAt = 0,
    last = /** @type {any[]} */ ([]); // the cards of the last read, kept for search.js (it never reads them itself)
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
  // LG's rows: the app's own picture (HTTPS), else LG's copy from its image servers
  const lgPic = (url, url4k) =>
    typeof url === 'string' && /^https:\/\/[A-Za-z0-9.-]+\//.test(url) && url.length < 2048
      ? remember(url)
      : typeof url4k === 'string' && LG_IMG.test(url4k) && url4k.length < 2048
        ? remember(url4k)
        : '';
  const plexPic = url => (typeof url === 'string' && /^https?:\/\//.test(url) ? remember(url) : '');
  const disneyPic = url => (typeof url === 'string' && DISNEY_IMG.test(url) ? remember(url) : '');
  // a newly linked account shows on the next read, not after the 20 s cache
  const sub = Object.assign({}, ctx, {
    changed: () => {
      cache = null;
    },
  });
  const plex = require('./plex').create(sub),
    stremio = require('./stremio').create(sub),
    disney = require('./disney').create(sub),
    lg = require('./lgrows').create(sub);
  async function sendImg(res, id) {
    const im = imgs[id];
    if (!im) return web.notFound(res);
    if (!im.buf) {
      try {
        const r = await fetch.read(im.url, { allowHttp: !/^https:/.test(im.url), totalMs: 20000, maxBytes: IMG_BYTES, redirects: 0 });
        const type = String(r.headers['content-type'] || 'image/jpeg');
        if (!/^image\/(jpeg|png|webp|gif)/.test(type)) return web.notFound(res); // pictures only
        im.buf = r.body;
        im.type = type;
        let total = 0;
        for (let i = imgOrder.length - 1; i >= 0; i--) {
          const x = imgs[imgOrder[i]];
          if (!x || !x.buf) continue;
          total += x.buf.length;
          if (total > IMG_TOTAL && x !== im) x.buf = null;
        }
      } catch (e) {
        return web.notFound(res);
      }
    }
    res.writeHead(200, { 'content-type': im.type, 'content-length': im.buf.length, 'cache-control': 'private, max-age=86400' });
    res.end(im.buf);
  }

  // ---- Telemachus: one card per show, the latest it watched: GET /api/continue gives a row per show, newest first, with the episode
  // it is in the middle of (resume) or the next one to watch (next). A Telemachus without that call gives what is playing and the
  // episode each show is in the middle of (/api/brief). Never the channel's lineup: that listed many episodes of one show. Read from
  // loopback with no origin (Telemachus answers programs on the TV and refuses web pages).
  const tm = path =>
    fetch
      .read(TELEMACHUS + path, { totalMs: 4000, idleMs: 3000, maxBytes: 2 * 1024 * 1024, redirects: 0 })
      .then(r => JSON.parse(r.body.toString('utf8')));
  let shows = {},
    showsAt = 0;
  async function telemachus() {
    let cont = null,
      brief = null;
    try {
      cont = await tm('/api/continue');
    } catch (_) {}
    try {
      brief = await tm('/api/brief');
    } catch (_) {}
    if (!cont && !brief) return []; // not installed, or not running
    const st = (brief && brief.state) || {},
      np = st.now_playing,
      out = [];
    const playing = (show, s, e) => !!np && np.show === show && np.season === s && np.episode === e;
    const card = (show, s, e, title, img, progress, play, next) => ({
      key: 'tm-' + show + '-' + s + '-' + e,
      group: 'tm:' + show,
      source: 'telemachus',
      title: show,
      sub: ep(show, s, e, title),
      img,
      progress: progress > 0 ? Math.min(1, progress) : null,
      next: !!next,
      launch: { id: TELEMACHUS_APP, params: { play } },
    });
    if (cont && Array.isArray(cont.continue)) {
      for (const r of cont.continue) {
        if (!r || !r.show || out.length >= TM_MAX) continue;
        const img = pic(r.backdrop, 'w780') || pic(r.poster, 'w342');
        if (r.kind === 'movie') {
          const p = r.resume;
          out.push({
            key: 'tm-film-' + (r.tmdb_id || r.show),
            group: 'tm:film:' + (r.tmdb_id || r.show),
            source: 'telemachus',
            title: String(r.show),
            sub: '',
            img,
            progress: p && p.percent > 0 ? Math.min(1, p.percent / 100) : null,
            next: false,
            launch: { id: TELEMACHUS_APP, params: { play: filmPlay(r.show, r.year, r.tmdb_id) } },
          });
          continue;
        }
        // the episode it is in the middle of, else the next one (when it has aired); a show caught up with nothing next is left out
        const x = r.resume || (r.next && r.next.aired !== false ? r.next : null);
        if (!x || !(x.season >= 0) || !(x.episode > 0)) continue;
        const play = playing(r.show, x.season, x.episode) ? { resume: true } : { show: r.show, season: x.season, episode: x.episode };
        out.push(card(r.show, x.season, x.episode, x.title, img, r.resume ? (+x.percent || 0) / 100 : 0, play, !r.resume));
      }
      return out;
    }
    // an older Telemachus (no /api/continue): what is playing, then the episode each other show is in the middle of
    if (Date.now() - showsAt > SHOWS_MS) {
      try {
        const s2 = await tm('/api/shows');
        shows = {};
        for (const x of (s2 && s2.shows) || []) if (x && x.show) shows[x.show] = x;
        showsAt = Date.now();
      } catch (_) {}
    }
    const picOf = (show, poster) => (shows[show] && pic(shows[show].backdrop, 'w780')) || pic(poster, 'w342');
    const seen = {};
    if (np && np.show) {
      const len = +np.length_seconds || 0,
        pos = +np.position_seconds || 0;
      out.push(
        card(np.show, np.season, np.episode, np.title, picOf(np.show, np.poster), len > 0 ? pos / len : (+np.percent_complete || 0) / 100, {
          resume: true,
        })
      );
      seen[np.show] = 1;
    }
    for (const sh of Array.isArray(st.shows) ? st.shows : []) {
      if (!sh || !sh.show || seen[sh.show] || out.length >= TM_MAX) continue;
      const ip = (Array.isArray(sh.in_progress) ? sh.in_progress : [])
        .filter(x => x && x.season > 0 && x.episode > 0)
        .sort((a, b) => b.season - a.season || b.episode - a.episode)[0];
      if (!ip) continue;
      out.push(
        card(sh.show, ip.season, ip.episode, '', picOf(sh.show, sh.poster), (+ip.percent || 0) / 100, {
          show: sh.show,
          season: ip.season,
          episode: ip.episode,
        })
      );
      seen[sh.show] = 1;
    }
    return out;
  }

  async function rows() {
    if (cache && Date.now() - cacheAt < ROWS_MS) return cache;
    const wc = ctx.config.get().watch || {},
      lgOn = wc.lg !== false;
    const [t, px, st, dn, l] = await Promise.all([
      wc.tm === false ? [] : telemachus(),
      plex.items(plexPic).catch(() => []),
      stremio.items(metahubPic).catch(() => []),
      disney.items(disneyPic).catch(() => []),
      lgOn ? lg.items(lgPic, { picks: wc.lgPicks !== false }).catch(() => []) : [],
    ]);
    // a linked Disney+ replaces LG's row for it (LG's picks of the season, nothing of the account's)
    const lgRows = disney.status().linked ? l.filter(i => i.app !== DISNEY_APP) : l;
    // what Telemachus has started, what Plex, Stremio and Disney+ have partly watched, Telemachus's next, then LG's rows of the other apps
    cache = {
      items: /** @type {any[]} */ ([]).concat(
        t.filter(i => !i.next),
        px,
        st,
        dn,
        t.filter(i => i.next),
        lgRows
      ),
    };
    cacheAt = Date.now();
    last = cache.items;
    return cache;
  }

  const services = { plex, stremio, disney };
  async function handle(req, res, u, body) {
    if (u === '/api/watch/rows') return web.json(res, await rows());
    if (u === '/api/watch/accounts') return web.json(res, { plex: plex.status(), stremio: stremio.status(), disney: disney.status() });
    if ((u === '/api/watch/link' || u === '/api/watch/unlink') && req.method === 'POST') {
      const name = String((await body(req)).service || ''),
        sv = services[name];
      if (!sv) return web.json(res, { error: 'unknown service' }, 400);
      cache = null;
      if (u === '/api/watch/unlink') {
        sv.unlink();
        last = last.filter(i => i.source !== name); // its cards are not found by a search any more either
        return web.json(res, { ok: true });
      }
      return web.json(res, await sv.link());
    }
    const m = /^\/api\/watch\/img\/([0-9a-f]{16})$/.exec(u);
    if (m) return sendImg(res, m[1]);
    web.notFound(res);
  }
  // the cards of the last read (Home reads them when it is shown and every minute), without reading anything
  const known = () => last.slice();
  return { name: 'watch', prefix: '/api/watch/', handle, rows, known };
}

module.exports = { create, TMDB };
