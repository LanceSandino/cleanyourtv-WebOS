// Plex for Continue watching (watch.js): the TV is linked with Plex's own TV sign-in (a 4-character code entered at plex.tv/link,
// no password on the TV), then the owner's Plex server gives what is partly watched (/hubs/continueWatching/items, or /library/onDeck
// on an older server) with pictures and how far it got. The keys stay in config.json (root only); the launcher sees the cards only.
//   link()    {code, url} and the service asks plex.tv every 3 s (10 minutes at most) until the code was entered
//   status()  {linked, server, state: 'idle'|'waiting'|'linked'|'expired'|'error', code, url, error}
//   items()   cards for watch.js; pictures go through watch.js's image ids, never by address
const crypto = require('crypto');
const fetch = require('./fetch');

const PLEXTV = process.env.CYTV_PLEXTV || 'https://plex.tv', // another address only for the tests
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
  const json = (url, o) =>
    fetch.read(url, Object.assign({ totalMs: 20000, maxBytes: 4 * 1024 * 1024 }, o)).then(r => JSON.parse(r.body.toString('utf8')));

  let state = { state: 'idle', code: '', url: '', error: '' };
  let timer = /** @type {any} */ (null);
  function stop() {
    clearTimeout(timer);
    timer = null;
  }
  // the server to read: the owner's own, by its local address first
  async function findServer(token) {
    const list = await json(PLEXTV + '/api/v2/resources?includeHttps=1&includeRelay=0', { headers: head(token) });
    const servers = (Array.isArray(list) ? list : []).filter(r => r && /server/.test(r.provides || ''));
    const s = servers.filter(r => r.owned)[0] || servers[0];
    if (!s) throw new Error('No Plex server on this account.');
    const cons = (s.connections || []).filter(c => c && c.uri);
    const con = cons.filter(c => c.local && !c.relay)[0] || cons.filter(c => !c.relay)[0];
    if (!con) throw new Error('The Plex server has no address this TV can reach.');
    return { name: String(s.name || 'Plex'), uri: con.uri.replace(/\/+$/, ''), token: s.accessToken || token };
  }
  async function link() {
    stop();
    try {
      const pin = await json(PLEXTV + '/api/v2/pins', {
        method: 'POST',
        body: 'strong=false',
        headers: Object.assign(head(), { 'content-type': 'application/x-www-form-urlencoded' }),
      });
      if (!pin || !pin.id || !pin.code) throw new Error('Plex did not give a code.');
      const until = Date.now() + LINK_MS;
      state = { state: 'waiting', code: String(pin.code), url: 'plex.tv/link', error: '' };
      const poll = async () => {
        if (Date.now() > until) return (state = { state: 'expired', code: '', url: '', error: '' });
        try {
          const p = await json(PLEXTV + '/api/v2/pins/' + encodeURIComponent(pin.id), { headers: head() });
          if (p && p.authToken) {
            const server = await findServer(p.authToken);
            setAcct(a => Object.assign(a, { token: p.authToken, server }));
            if (ctx.changed) ctx.changed();
            state = { state: 'linked', code: '', url: '', error: '' };
            return;
          }
        } catch (e) {
          state = { state: 'error', code: '', url: '', error: String(e.message || e) };
          return;
        }
        timer = setTimeout(poll, pollMs);
      };
      timer = setTimeout(poll, pollMs);
      return { code: state.code, url: state.url };
    } catch (e) {
      state = { state: 'error', code: '', url: '', error: String(e.message || e) };
      return { error: state.error };
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
  return { link, unlink, status, items };
}

module.exports = { create };
