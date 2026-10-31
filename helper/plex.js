// Plex for Continue watching (watch.js): the TV is linked with Plex's own TV sign-in (a 4-character code entered at plex.tv/link,
// no password on the TV), then the owner's Plex server gives what is partly watched (/hubs/continueWatching/items, or /library/onDeck
// on an older server) with pictures and how far it got. The keys stay in config.json (root only); the launcher sees the cards only.
//   link()    {code, url} and the service asks plex.tv every 3 s (10 minutes at most) until the code was entered; then it keeps the
//             server's first address that answers as that server (its addresses on the network first)
//   status()  {linked, server, state: 'idle'|'waiting'|'linked'|'expired'|'error', code, url, error}
//   items()   cards for watch.js; pictures go through watch.js's image ids, never by address
// Where to watch (where.js), with the same link (the words typed, the account's key and this install's Plex client id; no other id):
//   discover(q)           Plex's catalogue of films and shows (Plex Discover): [{id, kind: 'movie'|'series', title, year}]
//   availability(id, cc)  where that title is in that country: [{platform, name, offer, price, currency, link}]; link is the
//                         service's own link taken out of Plex's affiliate link (deeplinks.unwrap), which is never asked
//   library(q)            the titles on the linked Plex server itself: [{kind, title, year}] (/hubs/search)
const crypto = require('crypto');
const fetch = require('./fetch'),
  deeplinks = require('./deeplinks');

const PLEXTV = process.env.CYTV_PLEXTV || 'https://plex.tv', // another address only for the tests
  DISCOVER = process.env.CYTV_PLEX_DISCOVER || 'https://discover.provider.plex.tv',
  APP = 'cdp-30', // the Plex app for LG TVs
  POLL_MS = 3000,
  LINK_MS = 10 * 60 * 1000;

function create(ctx) {
  const config = ctx.config;
  const pollMs = ctx.pollMs || POLL_MS; // shorter only in the tests
  const acct = () => (config.get().watchAccounts || {}).plex || {};
  const setAcct = fn =>
    config.update('plex', c => {
      c.watchAccounts = Object.assign({}, c.watchAccounts);
      c.watchAccounts.plex = fn(Object.assign({}, c.watchAccounts.plex));
      if (!c.watchAccounts.plex) delete c.watchAccounts.plex;
    });
  // this TV's own Plex client id (made once)
  function clientId() {
    let id = acct().clientId;
    if (!/^[0-9a-f]{32}$/.test(id || '')) {
      id = crypto.randomBytes(16).toString('hex');
      setAcct(a => Object.assign(a, { clientId: id }));
    }
    return id;
  }
  const head = token =>
    Object.assign(
      { accept: 'application/json', 'X-Plex-Product': 'CleanYourTV', 'X-Plex-Device': 'LG TV', 'X-Plex-Client-Identifier': clientId() },
      token ? { 'X-Plex-Token': token } : {}
    );
  // any 2xx is an answer (plex.tv gives a new code as "201 Created"); Plex's own errors come as {errors: [{message}]}
  const json = (url, o) =>
    fetch.read(url, Object.assign({ totalMs: 20000, maxBytes: 4 * 1024 * 1024, anyStatus: true }, o)).then(r => {
      const good = r.status >= 200 && r.status < 300;
      let body = null;
      try {
        body = JSON.parse(r.body.toString('utf8'));
      } catch (e) {
        if (good) throw e;
      }
      if (good) return body;
      const said = body && body.errors && body.errors[0] && body.errors[0].message;
      throw fetch.fail(said ? String(said) : 'HTTP ' + r.status, 'status', r.status);
    });

  let state = { state: 'idle', code: '', url: '', error: '' };
  let timer = /** @type {any} */ (null),
    round = 0; // a new code (or unlinking) ends the asking for the one before, also an answer still on its way
  function stop() {
    round++;
    clearTimeout(timer);
    timer = null;
  }
  // the addresses to try, in order: on the network, the same by its plain address (a router that blocks the secure plex.direct names
  // of addresses on the network, when the server allows it), then from outside; never through Plex's relay
  function addresses(s) {
    const cons = (s.connections || []).filter(c => c && typeof c.uri === 'string' && /^https?:\/\//.test(c.uri) && !c.relay),
      local = cons.filter(c => c.local),
      plain = s.httpsRequired
        ? []
        : local
            .filter(c => c.protocol === 'https' && c.address && c.port > 0)
            .map(c => 'http://' + (c.IPv6 ? '[' + c.address + ']' : c.address) + ':' + c.port),
      all = local
        .map(c => c.uri)
        .concat(
          plain,
          cons.filter(c => !c.local).map(c => c.uri)
        );
    return all.map(u => u.replace(/\/+$/, '')).filter((u, i, a) => a.indexOf(u) === i);
  }
  // does this address answer as that server? /identity needs no key, so none is sent while trying
  async function answers(uri, id) {
    try {
      const r = await json(uri + '/identity', { headers: { accept: 'application/json' }, totalMs: 5000, idleMs: 5000, allowHttp: true });
      const mid = r && r.MediaContainer && r.MediaContainer.machineIdentifier;
      return !id || !mid || mid === id;
    } catch (_) {
      return false;
    }
  }
  // the server to read: the owner's own, at its first address that answers (or the first, when the server is off just now)
  async function findServer(token) {
    const list = await json(PLEXTV + '/api/v2/resources?includeHttps=1&includeRelay=0', { headers: head(token) });
    const servers = (Array.isArray(list) ? list : []).filter(r => r && /server/.test(r.provides || ''));
    const s = servers.filter(r => r.owned)[0] || servers[0];
    if (!s) throw new Error('No Plex server on this account.');
    const uris = addresses(s);
    if (!uris.length) throw new Error('The Plex server has no address this TV can reach.');
    let uri = uris[0];
    for (let i = 0; i < uris.length; i++) {
      if (await answers(uris[i], s.clientIdentifier)) {
        uri = uris[i];
        break;
      }
    }
    return { name: String(s.name || 'Plex'), uri, token: s.accessToken || token };
  }
  async function link() {
    stop();
    const mine = round;
    try {
      const pin = await json(PLEXTV + '/api/v2/pins', {
        method: 'POST',
        body: 'strong=false',
        headers: Object.assign(head(), { 'content-type': 'application/x-www-form-urlencoded' }),
      });
      if (mine !== round) return { error: 'A newer code was asked for.' };
      if (!pin || !pin.id || !pin.code) throw new Error('Plex did not give a code.');
      const until = Date.now() + Math.min(LINK_MS, pin.expiresIn > 0 ? pin.expiresIn * 1000 : LINK_MS);
      state = { state: 'waiting', code: String(pin.code), url: 'plex.tv/link', error: '' };
      const expired = () => (state = { state: 'expired', code: '', url: '', error: '' });
      const poll = async () => {
        if (Date.now() > until) return expired();
        let p = null;
        try {
          p = await json(PLEXTV + '/api/v2/pins/' + encodeURIComponent(pin.id), { headers: head() });
        } catch (e) {
          // plex.tv forgets a code once it expires (404); anything else (a dropped connection, a busy plex.tv) is asked again
          if (mine === round && e.status === 404) return expired();
        }
        if (mine !== round) return;
        if (p && p.authToken) {
          try {
            const server = await findServer(p.authToken);
            if (mine !== round) return;
            setAcct(a => Object.assign(a, { token: p.authToken, server }));
            if (ctx.changed) ctx.changed();
            state = { state: 'linked', code: '', url: '', error: '' };
          } catch (e) {
            if (mine === round) state = { state: 'error', code: '', url: '', error: String(e.message || e) };
          }
          return;
        }
        timer = setTimeout(poll, pollMs);
      };
      timer = setTimeout(poll, pollMs);
      return { code: state.code, url: state.url };
    } catch (e) {
      if (mine === round) state = { state: 'error', code: '', url: '', error: String(e.message || e) };
      return { error: String(e.message || e) };
    }
  }
  function unlink() {
    stop();
    setAcct(a => (a.clientId ? { clientId: a.clientId } : null));
    state = { state: 'idle', code: '', url: '', error: '' };
  }
  function status() {
    const a = acct();
    return Object.assign(
      { linked: !!(a.token && a.server), server: a.server ? a.server.name : '' },
      a.token && state.state !== 'waiting' ? { state: 'linked' } : state
    );
  }

  // what is partly watched; the picture is the show's (or the film's) backdrop through the server's transcoder, at TV size
  async function items(pic) {
    const a = acct();
    if (!a.token || !a.server) return [];
    const s = a.server,
      h = { headers: head(s.token), totalMs: 8000, idleMs: 6000, allowHttp: true };
    let md;
    try {
      md = await json(s.uri + '/hubs/continueWatching/items', h);
    } catch (_) {
      try {
        md = await json(s.uri + '/library/onDeck', h);
      } catch (e) {
        return [];
      }
    }
    const list = (md && md.MediaContainer && md.MediaContainer.Metadata) || [];
    return list.slice(0, 6).map(m => {
      const ep = m.type === 'episode',
        art = (ep ? m.grandparentArt : m.art) || m.art || m.thumb || '';
      const img = art
        ? pic(
            s.uri +
              '/photo/:/transcode?width=780&height=440&minSize=1&upscale=1&url=' +
              encodeURIComponent(art) +
              '&X-Plex-Token=' +
              encodeURIComponent(s.token)
          )
        : '';
      return {
        key: 'plex-' + m.ratingKey,
        group: 'plex:' + ((ep && m.grandparentRatingKey) || m.ratingKey),
        source: 'plex',
        title: String((ep ? m.grandparentTitle : m.title) || m.title || ''),
        sub: ep ? 'S' + m.parentIndex + ' E' + m.index + (m.title ? ' · ' + m.title : '') : m.year ? String(m.year) : '',
        img,
        progress: m.duration > 0 && m.viewOffset > 0 ? Math.min(1, m.viewOffset / m.duration) : null,
        launch: { id: APP, params: {} },
      };
    });
  }

  // ---- Where to watch ----
  const RATING_KEY = /^[0-9a-f]{24}$/,
    OFFERS = ['subscription', 'free', 'rent', 'buy'];
  const year = y => (Number.isInteger(Number(y)) && Number(y) >= 1870 && Number(y) <= 2100 ? Number(y) : null);
  const kindOf = t => (t === 'show' ? 'series' : t === 'movie' ? 'movie' : '');
  const asked = { totalMs: 8000, idleMs: 6000, redirects: 0 };
  async function discover(query) {
    const a = acct();
    if (!a.token) return [];
    const j = await json(
      DISCOVER +
        '/library/search?query=' +
        encodeURIComponent(String(query).slice(0, 100)) +
        '&limit=6&searchTypes=movies,tv&searchProviders=discover&includeMetadata=1',
      Object.assign({ headers: head(a.token) }, asked)
    );
    const out = [];
    for (const g of (j && j.MediaContainer && Array.isArray(j.MediaContainer.SearchResults) && j.MediaContainer.SearchResults) || [])
      for (const x of (g && Array.isArray(g.SearchResult) && g.SearchResult) || []) {
        const m = (x && x.Metadata) || {};
        if (!kindOf(m.type) || !RATING_KEY.test(String(m.ratingKey)) || typeof m.title !== 'string' || !m.title.trim()) continue;
        out.push({ id: String(m.ratingKey), kind: kindOf(m.type), title: m.title.trim().slice(0, 200), year: year(m.year) });
      }
    return out;
  }
  async function availability(id, country) {
    const a = acct();
    if (!a.token || !RATING_KEY.test(String(id))) return [];
    const j = await json(
      DISCOVER + '/library/metadata/' + id + '/availabilities' + (/^[A-Z]{2}$/.test(country || '') ? '?country=' + country : ''),
      Object.assign({ headers: head(a.token) }, asked)
    );
    const list = (j && j.MediaContainer && Array.isArray(j.MediaContainer.Availability) && j.MediaContainer.Availability) || [];
    return list
      .filter(v => v && typeof v.platform === 'string' && /^[a-z0-9-]{1,60}$/.test(v.platform))
      .map(v => {
        const info = v.platformInfo && typeof v.platformInfo === 'object' ? v.platformInfo : {};
        const links = [v.platformUrl].concat(Object.keys(info).map(k => info[k] && info[k].url));
        const price = Number(v.price);
        return {
          platform: v.platform,
          name: String(v.title || v.platform).slice(0, 60),
          offer: OFFERS.indexOf(v.offerType) >= 0 ? v.offerType : 'other',
          price: v.price !== undefined && v.price !== null && v.price !== '' && price >= 0 && price < 10000 ? price : null,
          currency: /^[A-Z]{3}$/.test(String(v.currency || '')) ? String(v.currency) : '',
          link: links.map(deeplinks.unwrap).filter(Boolean)[0] || '',
        };
      });
  }
  async function library(query) {
    const a = acct();
    if (!a.token || !a.server) return [];
    const s = a.server;
    const j = await json(
      s.uri + '/hubs/search?query=' + encodeURIComponent(String(query).slice(0, 100)) + '&limit=10',
      Object.assign({ headers: head(s.token), allowHttp: true }, asked)
    );
    const out = [];
    for (const h of (j && j.MediaContainer && Array.isArray(j.MediaContainer.Hub) && j.MediaContainer.Hub) || [])
      for (const m of (h && Array.isArray(h.Metadata) && h.Metadata) || [])
        if (m && kindOf(m.type) && typeof m.title === 'string' && m.title.trim())
          out.push({ kind: kindOf(m.type), title: m.title.trim().slice(0, 200), year: year(m.year) });
    return out;
  }
  // what plays now on the linked server (its /status/sessions): the one on an LG TV first, else the first; for the phone remote.
  // {title, season, episode, year, state: 'playing'|'paused'|''} or null; a short wait, as the phone page asks every 15 s
  async function now() {
    const a = acct();
    if (!a.token || !a.server) return null;
    const s = a.server;
    let md;
    try {
      md = await json(s.uri + '/status/sessions', { headers: head(s.token), totalMs: 1500, idleMs: 1500, allowHttp: true });
    } catch (_) {
      return null;
    }
    const list = ((md && md.MediaContainer && md.MediaContainer.Metadata) || []).filter(m => m && typeof m.title === 'string');
    const onTv = m => /webos|lg/i.test(String((m.Player && (m.Player.platform || m.Player.product || m.Player.device)) || ''));
    const m = list.filter(onTv)[0] || list[0];
    if (!m) return null;
    const ep = m.type === 'episode',
      int = v => (Number.isInteger(v) && v >= 0 && v < 10000 ? v : null),
      st = m.Player && m.Player.state;
    return {
      show: String(ep ? m.grandparentTitle || m.title : m.title).slice(0, 120),
      season: ep ? int(m.parentIndex) : null,
      episode: ep ? int(m.index) : null,
      title: ep ? String(m.title).slice(0, 160) : '',
      state: st === 'playing' || st === 'paused' ? st : '',
    };
  }
  return { link, unlink, status, items, discover, availability, library, now };
}

module.exports = { create };
