// Search on Home ("where to watch"): a title typed (or said into the TV's keyboard) is looked up first in what this TV already has,
// without the words leaving the TV. Two sources, both local:
// - the titles in the rows the service last read for Continue watching (watch.js rows(): Telemachus, Plex, Stremio, Disney+, the rows
//   Netflix and Prime Video write themselves, LG's picks only while they are on), with the same switches and removed cards as Home;
//   no new read of them is made for a search. Each hit opens the way its card opens (its app and launch parameters);
// - the installed apps that open their own search with words (appinfo inAppSearchParams, as the app manager lists it: YouTube and
//   YouTube TV '{ "contentTarget" : "q=$SEARCH_KEYWORD"}'), opened with the words in place of $SEARCH_KEYWORD.
// When no app has the title, Telemachus, Plex and Stremio are offered, opened as they are (searching their libraries comes later).
// Nothing is asked of any server for these: no search service, not LG's, not the streaming services'.
//   GET /api/search?q=<words>  {q, groups: [{id: 'have'|'search'|'try', items: [{key, app, appTitle, title?, sub?, source?,
//                              launch: {id, params}}]}]}  (only the groups with items; an empty search has none)
// Where to watch, any title (where.js, D-20261029-9): the words are sent to the services the owner uses (Plex's catalogue with the
// linked account, Disney+'s search when linked, Stremio's public catalogue, the linked Plex server, Telemachus on the TV), unless
// Customize > Search > "Ask services where a title is" is off:
//   GET /api/search/where?q=<words>  {q, on, groups: [{id: 'where', items: [{key, title, year, kind, offers: [...]}]}]}
const web = require('./web'),
  { norm, score, match } = require('./titles');

const MAX_Q = 100, // the words, at most
  MAX_HITS = 12,
  KEYWORD = '$SEARCH_KEYWORD';
// the apps a source's cards open in (Plex's in PLX when only that is installed), and the libraries offered when no app has the title
const SOURCE_APPS = {
    telemachus: ['com.telemachus.screen'],
    plex: ['cdp-30', 'com.beb.plxnative'],
    stremio: ['io.strem.tv'],
    disney: ['com.disney.disneyplus-prod'],
  },
  TRY = ['telemachus', 'plex', 'stremio'];
// apps that take the words though they declare no in-app search: Telemachus opens its own search page ({play: {search}}, its
// tvlaunch.ts; an older Telemachus opens as it is), Stremio's app takes a link in contentTarget (its appinfo says contentTarget
// "stremio"; the link is Stremio's documented stremio:///search?search=<words>, stremio-addon-sdk docs/deep-links.md)
const OWN_SEARCH = {
  'com.telemachus.screen': words => ({ play: { search: words } }),
  'io.strem.tv': words => ({ contentTarget: 'stremio:///search?search=' + encodeURIComponent(words) }),
};

// the words as the app's search gets them: spaces kept, as LG's own search passes them (the app manager's replaceParams), and the
// characters that would end or split the query string (%, &, #, +) written as %XX
const inQuery = words => words.replace(/[%&#+]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());

// an app's in-app search parameters (a JSON text as the app manager gives it, or an object) as an object with $SEARCH_KEYWORD in it,
// or null
function template(v) {
  let o = v;
  if (typeof v === 'string') {
    if (v.length > 1024) return null;
    try {
      o = JSON.parse(v);
    } catch (_) {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const text = JSON.stringify(o);
  return text.length <= 1024 && text.indexOf(KEYWORD) >= 0 ? o : null;
}
// the launch parameters with the words in place of $SEARCH_KEYWORD (texts only; numbers and switches as they are), or null
function fill(tpl, words) {
  const t = template(tpl);
  if (!t) return null;
  const w = inQuery(words);
  const walk = (v, depth) => {
    if (typeof v === 'string') return v.split(KEYWORD).join(w);
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 4) {
      const out = {};
      for (const k of Object.keys(v)) {
        const x = walk(v[k], depth + 1);
        if (x !== undefined) out[k] = x;
      }
      return out;
    }
    return undefined;
  };
  return walk(t, 0);
}

// the words as typed: no control characters, one space between words, at most MAX_Q characters
const clean = q =>
  String(q || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_Q);

function create(ctx) {
  const config = ctx.config;
  // the installed apps (apps.js, from the app manager on the TV) and the ones hidden on Home
  async function installed() {
    const apps = ctx.feature('apps');
    if (!apps) return { list: [], searchable: [] };
    const [list, searchable] = await Promise.all([apps.installed(), apps.inAppSearch()]);
    const hidden = config.get().hidden || [];
    const shown = a => a && typeof a.id === 'string' && !a.input && hidden.indexOf(a.id) < 0;
    return { list: (list || []).filter(shown), searchable: (searchable || []).filter(shown) };
  }
  // the cards Home has (watch.js, the last read), as Home shows them: Continue watching on, its switches, the removed cards and rows
  function cards() {
    const watch = ctx.feature('watch'),
      wc = config.get().watch || {};
    if (!watch || !watch.known || wc.on === false) return [];
    const gone = Array.isArray(wc.hide) ? wc.hide : [];
    return watch.known().filter(it => {
      if (!it || !it.launch || typeof it.launch.id !== 'string' || gone.indexOf(it.group) >= 0) return false;
      if (it.source === 'telemachus' && wc.tm === false) return false;
      if (it.source === 'lg' && (wc.lg === false || (it.pick && wc.lgPicks === false) || gone.indexOf('app:' + it.app) >= 0)) return false;
      return true;
    });
  }
  async function search(raw) {
    const words = clean(raw),
      q = norm(words);
    if (!q) return { q: words, groups: [] };
    const { list, searchable } = await installed();
    const byId = {};
    for (const a of list) byId[a.id] = a;
    const gone = (config.get().watch || {}).hide || [];
    // the app a card opens in: its own (LG's rows, Telemachus, Disney+), else the other app of its source (PLX for Plex)
    const appFor = it => {
      if (byId[it.launch.id]) return it.launch.id;
      return (SOURCE_APPS[it.source] || []).filter(id => byId[id])[0] || '';
    };
    const seen = {},
      hits = [];
    cards().forEach((it, i) => {
      const s = match(it.title, q),
        app = s ? appFor(it) : '';
      if (!s || !app || gone.indexOf('app:' + app) >= 0 || seen[it.group]) return;
      seen[it.group] = 1;
      hits.push({
        s,
        i,
        item: {
          key: 'have-' + it.key,
          app,
          appTitle: byId[app].title,
          title: String(it.title),
          sub: String(it.sub || ''),
          source: it.source,
          launch: { id: app, params: app === it.launch.id ? it.launch.params || {} : {} },
        },
      });
    });
    hits.sort((a, b) => b.s - a.s || a.i - b.i);
    const have = hits.slice(0, MAX_HITS).map(h => h.item);
    const inApp = [];
    for (const a of searchable) {
      const params = fill(a.params, words);
      if (params) inApp.push({ key: 'search-' + a.id, app: a.id, appTitle: a.title, launch: { id: a.id, params } });
    }
    for (const id of Object.keys(OWN_SEARCH))
      if (byId[id] && gone.indexOf('app:' + id) < 0 && !inApp.some(x => x.app === id))
        inApp.push({ key: 'search-' + id, app: id, appTitle: byId[id].title, launch: { id, params: OWN_SEARCH[id](words) } });
    const tryIn = [];
    if (!have.length)
      for (const src of TRY) {
        const id = SOURCE_APPS[src].filter(x => byId[x])[0];
        if (id && !inApp.some(x => x.app === id))
          tryIn.push({ key: 'try-' + id, app: id, appTitle: byId[id].title, launch: { id, params: {} } });
      }
    const groups = [];
    if (have.length) groups.push({ id: 'have', items: have });
    if (inApp.length) groups.push({ id: 'search', items: inApp });
    if (tryIn.length) groups.push({ id: 'try', items: tryIn });
    return { q: words, groups };
  }
  // Where to watch (where.js): the services asked where a title is, unless Customize > Search switched that off (search.where false)
  const whereTo = require('./where').create(ctx);
  async function where(raw) {
    const words = clean(raw),
      sc = config.get().search || {};
    if (sc.where === false) return { q: words, on: false, groups: [] };
    const { list } = await installed();
    const r = await whereTo.find(words, list);
    return { q: words, on: true, groups: r.titles.length ? [{ id: 'where', items: r.titles }] : [] };
  }
  async function handle(req, res, u) {
    const at = req.url.indexOf('?');
    const q = (at >= 0 ? new URLSearchParams(req.url.slice(at + 1)).get('q') : '') || '';
    web.json(res, u === '/api/search/where' ? await where(q) : await search(q));
  }
  return { name: 'search', paths: ['/api/search', '/api/search/where'], handle, search, where };
}

module.exports = { create, norm, score, fill, template };
