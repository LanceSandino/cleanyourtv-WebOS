// Where to watch (search.js, GET /api/search/where?q=): where any film or show can be watched, also one that is not on Home, asked of
// the services the owner uses (D-20261029-9). On unless Customize > Search > "Ask services where a title is" is off (search.where
// false); then nothing is asked and the search stays on the TV. The words typed go to:
// - Plex's catalogue (Plex Discover, with the linked Plex account: plex.js discover and availability), which says which services
//   have a title in this TV's country (LG's service country, from the TV's settings) and how: subscription, free, rent or buy. Its
//   links are affiliate trackers: only the service's own link inside them is used (deeplinks.unwrap), they are never opened;
// - Disney+'s own search, when Disney+ is linked (disney.js search), for the exact Disney+ page;
// - Stremio's public catalogue (Cinemeta, no account), when Stremio is installed;
// - the linked Plex server's own search (your library), and Telemachus on the TV (127.0.0.1:8770), when installed.
// No device id is sent, and no address is followed. Each title then lists its services: the apps on this TV first (they open at the
// title where a link format is known, else as they are: deeplinks.js), subscription and free before rent and buy; services that are not
// installed are named with their offer. What the services answered is kept 10 minutes in memory per words and country.
//   find(words, installed)  {titles: [{key, title, year, kind, offers: [{key, provider, name, offer, price, currency, app?, appTitle?,
//                           launch?: {id, params}, exact?}]}]}
const fetch = require('./fetch'),
  deeplinks = require('./deeplinks'),
  { filmPlay } = require('./watch'),
  { norm, match } = require('./titles');

const TELEMACHUS = process.env.CYTV_TELEMACHUS || 'http://127.0.0.1:8770', // another address only for the tests
  TELEMACHUS_APP = 'com.telemachus.screen',
  STREMIO_APP = 'io.strem.tv',
  PLEX_APPS = ['cdp-30', 'com.beb.plxnative'],
  CACHE_MS = 10 * 60 * 1000,
  CACHE_MAX = 40,
  COUNTRY_MS = 60 * 60 * 1000,
  MAX_TITLES = 6,
  MAX_OFFERS = 8,
  AVAILABILITY_OF = 4, // Plex's first titles whose services are asked
  MIN_SCORE = 65; // a title that matches the words at least this well (titles.js)
// how an offer ranks after "installed first": a subscription or free before your own library and a catalogue, before rent and buy
const RANK = { subscription: 0, free: 1, library: 2, catalogue: 3, rent: 4, buy: 5, other: 6 };

const sameTitle = (a, b) =>
  norm(a.title) === norm(b.title) && (!a.year || !b.year || Math.abs(a.year - b.year) <= 1) && (!a.kind || !b.kind || a.kind === b.kind);

function create(ctx) {
  const cache = new Map();
  let country = '',
    countryAt = 0;
  // LG's service country of this TV (the same setting the debloat reads), two letters; '' when the TV does not say
  async function countryCode() {
    if (countryAt && Date.now() - countryAt < COUNTRY_MS) return country;
    const r = await Promise.resolve(
      ctx.luna('luna://com.webos.settingsservice/getSystemSettings', { category: 'option', keys: ['smartServiceCountryCode2'] })
    ).catch(() => null);
    const cc = String((r && r.settings && r.settings.smartServiceCountryCode2) || '').toUpperCase();
    country = /^[A-Z]{2}$/.test(cc) ? cc : '';
    countryAt = Date.now();
    return country;
  }
  // Telemachus on the TV: its own search (TMDB's titles, and whether its catalogue has each); it answers programs that say so
  async function telemachus(words) {
    const r = await fetch.read(TELEMACHUS + '/api/search?q=' + encodeURIComponent(words), {
      headers: { accept: 'application/json', 'X-Telemachus': 'cli' },
      totalMs: 5000,
      idleMs: 4000,
      maxBytes: 1024 * 1024,
      redirects: 0,
    });
    const j = JSON.parse(r.body.toString('utf8'));
    return ((j && Array.isArray(j.results) && j.results) || [])
      .filter(x => x && typeof x.title === 'string' && x.title.trim())
      .slice(0, 12)
      .map(x => ({
        title: x.title.trim().slice(0, 200),
        year: Number.isInteger(x.year) && x.year >= 1870 && x.year <= 2100 ? x.year : null,
        kind: x.kind === 'movie' ? 'movie' : x.kind === 'series' ? 'series' : '',
        tmdb: /^tmdb:\d{1,12}$/.test(String(x.id)) ? String(x.id) : '',
        has: x.in_catalogue === true,
      }));
  }

  // what the services say for these words, as titles with offers (not yet the apps of this TV); each source on its own: one that
  // fails or is slow leaves the others
  async function ask(words, q, use, cc) {
    const svc = (ctx.feature('watch') || {}).services || {};
    const none = () => [];
    const [px, dn, cm, tm, lib] = await Promise.all([
      use.plex ? svc.plex.discover(words).catch(none) : [],
      use.disney ? svc.disney.search(words).catch(none) : [],
      use.stremio ? svc.stremio.catalog(words).catch(none) : [],
      use.telemachus ? telemachus(words).catch(none) : [],
      use.library ? svc.plex.library(words).catch(none) : [],
    ]);
    const titles = [];
    const add = (t, order) => {
      const s = match(t.title, q);
      if (s < MIN_SCORE) return null;
      // a title from a catalogue of where things are (Plex's, Disney+'s) before one only a library or Stremio's catalogue names
      const x = { title: t.title, year: t.year || null, kind: t.kind || '', score: s, order, rank: order <= 1 ? 0 : 1, offers: [] };
      titles.push(x);
      return x;
    };
    // Plex's titles, with where they are
    const top = px.filter(t => match(t.title, q) >= MIN_SCORE).slice(0, AVAILABILITY_OF);
    const av = await Promise.all(top.map(t => svc.plex.availability(t.id, cc).catch(none)));
    top.forEach((t, i) => {
      const x = add(t, 0);
      if (x)
        for (const v of av[i])
          x.offers.push({ provider: v.platform, name: v.name, offer: v.offer, price: v.price, currency: v.currency, link: v.link });
    });
    // the others join the same title (or bring their own)
    const join = (t, order, offer) => {
      const x = titles.filter(y => sameTitle(y, t))[0] || add(t, order);
      if (!x) return;
      if (!x.year && t.year) x.year = t.year;
      if (!x.kind && t.kind) x.kind = t.kind;
      x.offers.push(offer);
    };
    for (const d of dn) {
      const page = 'https://www.disneyplus.com/browse/entity-' + d.id;
      // Plex's Disney+ link names the same page: that title; else the title of the same name
      const byId = titles.filter(y => y.offers.some(o => o.provider === 'disney-plus' && o.link.indexOf(d.id) >= 0))[0];
      const x = byId || titles.filter(y => sameTitle(y, d))[0];
      if (x) {
        const o = x.offers.filter(z => z.provider === 'disney-plus')[0];
        if (o) o.link = o.link.indexOf('entity-') >= 0 ? o.link : page;
        else x.offers.push({ provider: 'disney-plus', name: 'Disney+', offer: 'subscription', price: null, currency: '', link: page });
      } else join(d, 1, { provider: 'disney-plus', name: 'Disney+', offer: 'subscription', price: null, currency: '', link: page });
    }
    for (const t of lib) join(t, 2, { provider: 'plex-library', name: 'Plex', offer: 'library' });
    for (const t of tm) join(t, 3, { provider: 'telemachus', name: 'Telemachus', offer: t.has ? 'library' : 'catalogue', tmdb: t.tmdb });
    for (const t of cm) join(t, 4, { provider: 'stremio', name: 'Stremio', offer: 'catalogue', imdb: t.id });
    return titles
      .filter(t => t.offers.length)
      .sort((a, b) => a.rank - b.rank || b.score - a.score || a.order - b.order)
      .slice(0, MAX_TITLES);
  }

  // an offer as this TV can take it up: the installed app it is in, and how that app opens the title
  function offersOf(t, installed, byId) {
    const best = {};
    for (const o of t.offers) {
      const ids =
        o.provider === 'telemachus'
          ? [TELEMACHUS_APP]
          : o.provider === 'stremio'
            ? [STREMIO_APP]
            : o.provider === 'plex-library'
              ? PLEX_APPS
              : deeplinks.appsOf(o.provider, o.name, installed);
      const app = ids.filter(id => byId[id])[0] || '';
      // a library or a catalogue of an app that is not on this TV says nothing about where to watch
      if (!app && (o.offer === 'library' || o.offer === 'catalogue')) continue;
      const out = /** @type {any} */ ({
        key: 'where-' + o.provider + '-' + o.offer,
        provider: o.provider,
        name: app && o.provider !== 'plex-library' ? byId[app].title : o.name,
        offer: o.offer,
        price: o.price === undefined ? null : o.price,
        currency: o.currency || '',
      });
      if (app) {
        let l = { params: {}, exact: false };
        if (o.provider === 'telemachus') {
          if (t.kind === 'movie') l = { params: { play: filmPlay(t.title, t.year, o.tmdb) }, exact: true };
        } else if (o.provider === 'stremio') {
          // the title's page in Stremio (its documented stremio:///detail/<type>/<imdb id>, a film with its video id), through the
          // contentTarget its app takes; not yet seen opening the page on a TV, so the hint still says to find it there
          if (/^tt\d{1,10}$/.test(String(o.imdb || '')))
            l = {
              params: {
                contentTarget: 'stremio:///detail/' + (t.kind === 'series' ? 'series/' + o.imdb : 'movie/' + o.imdb + '/' + o.imdb),
              },
              exact: false,
            };
        } else if (o.provider !== 'stremio' && o.provider !== 'plex-library') l = deeplinks.launch(app, o.link, t.kind);
        out.app = app;
        out.appTitle = byId[app].title;
        out.launch = { id: app, params: l.params };
        out.exact = l.exact;
      }
      // one offer per service and kind of offer: the cheapest
      const was = best[out.key];
      if (!was || (out.price !== null && (was.price === null || out.price < was.price))) best[out.key] = out;
    }
    return (
      Object.keys(best)
        .map(k => best[k])
        // Plex's own order (and whether a service paid to come first) is not used: then by name
        .sort(
          (a, b) =>
            (b.app ? 1 : 0) - (a.app ? 1 : 0) ||
            RANK[a.offer] - RANK[b.offer] ||
            (a.price || 0) - (b.price || 0) ||
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        )
        .slice(0, MAX_OFFERS)
    );
  }

  async function find(words, installed) {
    const q = norm(words);
    if (q.length < 2) return { titles: [] };
    const byId = {};
    for (const a of installed) byId[a.id] = a;
    const svc = (ctx.feature('watch') || {}).services || {};
    const linked = s => !!(svc[s] && svc[s].status && svc[s].status().linked);
    const use = {
      plex: linked('plex') && !!svc.plex.discover,
      disney: linked('disney') && !!svc.disney.search,
      stremio: !!byId[STREMIO_APP] && !!(svc.stremio && svc.stremio.catalog),
      telemachus: !!byId[TELEMACHUS_APP],
      library: linked('plex') && !!svc.plex.library && PLEX_APPS.some(id => byId[id]),
    };
    const cc = use.plex ? await countryCode() : '';
    const key = q + '|' + cc + '|' + Object.keys(use).filter(k => use[k]);
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      hit = { at: Date.now(), p: ask(words, q, use, cc) };
      cache.set(key, hit);
      hit.p.catch(() => cache.delete(key));
      while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    const titles = await hit.p;
    return {
      titles: titles
        .map((t, i) => ({
          key: 'where-' + i + '-' + q.slice(0, 40),
          title: t.title,
          year: t.year,
          kind: t.kind,
          offers: offersOf(t, installed, byId),
        }))
        .filter(t => t.offers.length),
    };
  }
  return { find };
}

module.exports = { create };
