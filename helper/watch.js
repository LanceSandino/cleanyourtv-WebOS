// Continue watching: the cards of Home's first grid row. From Telemachus on this TV (what is playing, with how far it got, and what
// comes next, with the show's picture) and from LG's recents list (the apps opened last). Read here, by the root service: Telemachus
// answers programs on the TV but refuses web pages, and the pictures (TMDB) are fetched here and served from memory, so the Home page
// never contacts another site.
//   GET /api/watch/rows        {items: [{key, title, sub, img, progress, launch: {id, params}, source}]}
//   GET /api/watch/img/<id>    a picture named in items, from memory
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
const TMDB = /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
// LG's recents list names these too; they are not things to go back to
const NOT_RECENT = /^(com\.webos\.app\.home|com\.cleanyourtv\.|org\.webosbrew\.|com\.webos\.app\.browser$|amazon\.alexa)/;

const ep = (s, e, t) => 'S' + s + ' E' + e + (t ? ' · ' + t : '');

function create(ctx) {
  const { config, luna } = ctx;
  const imgs = {}, // id -> {url, buf, type, at}
    imgOrder = [];
  // a picture's id for the page; the address itself stays here
  function pic(url, width) {
    if (typeof url !== 'string') return '';
    const u = url.replace(/\/t\/p\/[a-z0-9]+\//, '/t/p/' + width + '/');
    if (!TMDB.test(u)) return '';
    const id = crypto.createHash('sha1').update(u).digest('hex').slice(0, 16);
    if (!imgs[id]) {
      imgs[id] = { url: u, buf: null, type: '', at: 0 };
      imgOrder.push(id);
      while (imgOrder.length > IMG_MAX) delete imgs[imgOrder.shift()];
    }
    return '/api/watch/img/' + id;
  }
  async function sendImg(res, id) {
    const im = imgs[id];
    if (!im) return web.notFound(res);
    if (!im.buf) {
      try {
        const r = await fetch.read(im.url, { allowHttp: false, totalMs: 20000, maxBytes: IMG_BYTES, redirects: 0 });
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
      out = [],
      seen = {};
    const picOf = (show, poster) => (shows[show] && pic(shows[show].backdrop, 'w780')) || pic(poster, 'w342');
    const np = st.now_playing;
    if (np && np.show) {
      const len = +np.length_seconds || 0,
        pos = +np.position_seconds || 0;
      out.push({
        key: 'tm-now',
        source: 'telemachus',
        title: np.show,
        sub: ep(np.season, np.episode, np.title),
        img: picOf(np.show, np.poster),
        progress: len > 0 ? Math.max(0, Math.min(1, pos / len)) : null,
        launch: { id: TELEMACHUS_APP, params: { play: { resume: true } } },
      });
      seen[np.show + ' ' + np.season + ' ' + np.episode] = 1;
    }
    for (const p of Array.isArray(st.plan) ? st.plan : []) {
      if (!p || out.length >= 4) break;
      if (p.film) {
        const name = p.film_title || p.title || p.show;
        out.push({
          key: 'tm-film-' + (p.tmdb_id || name),
          source: 'telemachus',
          title: name,
          sub: p.year ? String(p.year) : '',
          img: pic(p.poster, 'w342'),
          progress: null,
          launch: { id: TELEMACHUS_APP, params: { play: { film: name, year: p.year || null, tmdb_id: p.tmdb_id || null } } },
        });
        continue;
      }
      const k = p.show + ' ' + p.season + ' ' + p.episode;
      if (seen[k]) continue;
      seen[k] = 1;
      out.push({
        key: 'tm-' + p.show + '-' + p.season + '-' + p.episode,
        source: 'telemachus',
        title: p.show,
        sub: ep(p.season, p.episode, p.title),
        img: picOf(p.show, p.poster),
        progress: null,
        launch: { id: TELEMACHUS_APP, params: { play: { show: p.show, season: p.season, episode: p.episode } } },
      });
    }
    return out;
  }

  // ---- LG's recents list: the apps opened last (the ones that are still installed and not hidden) ----
  async function recents(installed) {
    const r = await luna('luna://com.webos.service.recent/listRecents', {});
    const hidden = config.get().hidden || [];
    return (Array.isArray(r && r.recentsAppList) ? r.recentsAppList : [])
      .filter(a => a && a.appId && !NOT_RECENT.test(a.appId) && a.appId !== TELEMACHUS_APP && hidden.indexOf(a.appId) < 0)
      .filter(a => !installed || installed.indexOf(a.appId) >= 0 || /^com\.webos\.app\.hdmi\d$/.test(a.appId))
      .slice(0, 6)
      .map(a => ({
        key: 'app-' + a.appId,
        source: 'recent',
        title: a.title || a.appId,
        sub: '',
        img: /^com\.webos\.app\.hdmi\d$/.test(a.appId) ? '' : '/icon/' + a.appId,
        app: a.appId,
        progress: null,
        launch: { id: a.appId, params: {} },
      }));
  }

  let cache = null,
    cacheAt = 0;
  async function rows() {
    if (cache && Date.now() - cacheAt < ROWS_MS) return cache;
    const ap = ctx.feature('apps');
    let installed = null;
    try {
      installed = ap && ap.apps ? (await ap.apps()).map(a => a.id) : null;
    } catch (_) {}
    const [t, a] = await Promise.all([telemachus(), recents(installed).catch(() => [])]);
    // what is playing first, then the next one of the plan, then the apps opened last, then the rest of the plan
    cache = { items: t.slice(0, 2).concat(a, t.slice(2)) };
    cacheAt = Date.now();
    return cache;
  }

  async function handle(req, res, u) {
    if (u === '/api/watch/rows') return web.json(res, await rows());
    const m = /^\/api\/watch\/img\/([0-9a-f]{16})$/.exec(u);
    if (m) return sendImg(res, m[1]);
    web.notFound(res);
  }
  return { name: 'watch', prefix: '/api/watch/', handle, rows };
}

module.exports = { create, TMDB };
