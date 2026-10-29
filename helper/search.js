// Search on Home ("where to watch"): a title typed (or said into the TV's keyboard) is looked up in what this TV already has, and the
// words never leave the TV. Two sources, both local:
// - the titles in the rows the service last read for Continue watching (watch.js rows(): Telemachus, Plex, Stremio, Disney+, the rows
//   Netflix and Prime Video write themselves, LG's picks only while they are on), with the same switches and removed cards as Home;
//   no new read of them is made for a search. Each hit opens the way its card opens (its app and launch parameters);
// - the installed apps that open their own search with words (appinfo inAppSearchParams, as the app manager lists it: YouTube and
//   YouTube TV '{ "contentTarget" : "q=$SEARCH_KEYWORD"}'), opened with the words in place of $SEARCH_KEYWORD.
// When no app has the title, Telemachus, Plex and Stremio are offered, opened as they are (searching their libraries comes later).
// Nothing is asked of any server: no search service, not LG's, not the streaming services'.
//   GET /api/search?q=<words>  {q, groups: [{id: 'have'|'search'|'try', items: [{key, app, appTitle, title?, sub?, source?,
//                              launch: {id, params}}]}]}  (only the groups with items; an empty search has none)
const web = require('./web');

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

// Latin letters with accents, for a Node without the full Unicode tables (normalize then does nothing)
const FOLD = {
  a: '\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u0101',
  c: '\u00e7\u0107\u010d',
  e: '\u00e8\u00e9\u00ea\u00eb\u0113\u0117',
  i: '\u00ec\u00ed\u00ee\u00ef\u012b',
  n: '\u00f1\u0144',
  o: '\u00f2\u00f3\u00f4\u00f5\u00f6\u00f8\u014d',
  u: '\u00f9\u00fa\u00fb\u00fc\u016b',
  y: '\u00fd\u00ff',
  s: '\u015b\u0161',
  z: '\u017a\u017c\u017e',
};
const FOLD_RE = new RegExp(
    '[' +
      Object.keys(FOLD)
        .map(k => FOLD[k])
        .join('') +
      ']',
    'g'
  ),
  FOLD_OF = {};
for (const k of Object.keys(FOLD)) for (const ch of FOLD[k]) FOLD_OF[ch] = k;
// punctuation and symbols (ASCII, Latin-1, general punctuation, arrows and shapes, CJK punctuation); letters of every script stay
const PUNCT = /[\u0000-/:-@[-`{-\u00bf\u00d7\u00f7\u2000-\u206f\u2190-\u2bff\u3000-\u303f\ufe30-\ufe4f\uff01-\uff0f]+/g;

// a title or the words as they are compared: lower case, no accents, "&" as "and", no punctuation (an apostrophe joins: "Grey's" is
// "greys"), no year in brackets, no leading "The"
function norm(s) {
  let x = String(s || '').toLowerCase();
  try {
    x = x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch (_) {}
  return x
    .replace(FOLD_RE, ch => FOLD_OF[ch])
    .replace(/\u00df/g, 'ss')
    .replace(/[(\[]\s*(1[89]|20)\d\d\s*[)\]]/g, ' ')
    .replace(/['\u2019`\u00b4]/g, '')
    .replace(/&/g, ' and ')
    .replace(PUNCT, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^the /, '');
}

// edit distance (insert, delete, change one letter), for one typo; short strings only
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// how well a title (normalized) matches the words (normalized): 0 not at all, 100 the same
function score(title, q) {
  if (!title || !q) return 0;
  if (title === q) return 100;
  if (title.indexOf(q) === 0) return title.charAt(q.length) === ' ' ? 90 : 80;
  const tw = title.split(' '),
    qw = q.split(' ');
  const prefixOf = w => tw.some(t => t.indexOf(w) === 0);
  if (qw.every(prefixOf)) return 70;
  const t0 = title.replace(/ /g, ''),
    q0 = q.replace(/ /g, '');
  if (t0.indexOf(q0) === 0) return 65; // "spiderman" for "Spider-Man"
  if (title.indexOf(q) >= 0) return 50;
  // a typo: one (two from 8 letters) in the whole title, one in the start of a title typed so far (from 6 letters), or one in each
  // word of 5 letters or more (shorter words as typed)
  if (q0.length >= 5 && q0.length <= 64) {
    const allow = q0.length >= 8 ? 2 : 1;
    if (dist(t0, q0) <= allow || (q0.length >= 6 && dist(t0.slice(0, q0.length), q0) <= 1)) return 40;
    if (qw.some(w => w.length >= 5) && qw.every(w => (w.length >= 5 ? tw.some(t => dist(t, w) <= 1) : prefixOf(w)))) return 35;
  }
  return 0;
}

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
      q = norm(words),
      // "dune 2021": a year at the end may be the film's, not its title's (ranked a little below the title as typed)
      qNoYear = q.replace(/ (1[89]|20)\d\d$/, '');
    if (!q) return { q: words, groups: [] };
    const match = title => {
      const t = norm(title);
      return Math.max(score(t, q), qNoYear !== q ? score(t, qNoYear) - 5 : 0);
    };
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
      const s = match(it.title),
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
    const tryIn = [];
    if (!have.length)
      for (const src of TRY) {
        const id = SOURCE_APPS[src].filter(x => byId[x])[0];
        if (id) tryIn.push({ key: 'try-' + id, app: id, appTitle: byId[id].title, launch: { id, params: {} } });
      }
    const groups = [];
    if (have.length) groups.push({ id: 'have', items: have });
    if (inApp.length) groups.push({ id: 'search', items: inApp });
    if (tryIn.length) groups.push({ id: 'try', items: tryIn });
    return { q: words, groups };
  }
  async function handle(req, res) {
    const at = req.url.indexOf('?');
    const q = at >= 0 ? new URLSearchParams(req.url.slice(at + 1)).get('q') : '';
    web.json(res, await search(q || ''));
  }
  return { name: 'search', paths: ['/api/search'], handle, search };
}

module.exports = { create, norm, score, fill, template };
