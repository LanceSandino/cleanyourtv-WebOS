// Disney+ for Continue watching (watch.js): the TV is linked with Disney's own TV sign-in (an 8-digit code entered at
// disneyplus.com/begin on a phone or a computer, no password on the TV), then Disney's feed for TV makers gives what is partly watched
// (explore partner/continueWatching), newest first, with how far it got. The TV signs in as Disney's web player does: the web player's
// public key is read from disneyplus.com/begin when it is needed (never kept in this project), this TV registers as a device, waits on
// Disney's socket while the code is shown, and trades what Disney sends there for the account's keys. The keys stay in config.json
// (root only); the launcher sees the cards only.
//   link()    {code, url}; Disney says on its socket when the code was entered (10 minutes at most)
//   status()  {linked, state: 'idle'|'waiting'|'linked'|'expired'|'error', code, url, error}
//   items()   cards for watch.js: the film or the episode opens playing in the Disney+ app (LG's deep links; Disney+ asks who is
//             watching first when it was not running); who: the name of the Disney+ profile whose Continue Watching it is (the
//             account's active profile, asked of Disney with the same key; none when Disney does not say);
//             pictures from Disney's image host go through watch.js's image ids
//   search(q) Disney's own search for the words (where.js, Where to watch), with the same key: [{title, id, year}]
const crypto = require('crypto');
const fetch = require('./fetch'),
  wsclient = require('./wsclient');

const WEB = process.env.CYTV_DISNEY_WEB || 'https://www.disneyplus.com', // other addresses only for the tests
  API = process.env.CYTV_DISNEY_API || 'https://disney.api.edge.bamgrid.com',
  EDGE = process.env.CYTV_DISNEY_EDGE || 'wss://disney.connections.edge.bamgrid.com/c800b6/connection',
  TEST = !!(process.env.CYTV_DISNEY_WEB || process.env.CYTV_DISNEY_API),
  IMAGES = 'https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/',
  APP = 'com.disney.disneyplus-prod',
  // who this TV says it is: Disney's web player (its key is the one there is); checked against Disney on 2026-10-29
  CLIENT = 'disney-svod-3d9324fc',
  PLATFORM = 'javascript/macosx/chrome',
  SDK = '35.8.0',
  VERSION = '1.1.2',
  LINK_MS = 10 * 60 * 1000,
  WHO_MS = 30 * 60 * 1000, // the profile's name is asked again after this, or with a new key
  KEY_MS = 6 * 60 * 60 * 1000,
  RETRY_MS = 3000,
  MAX = 12;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  ENTERED = /^urn:dss:event:offDeviceLogin:refresh(:v\d+)?$/;
const Q = {
  register: 'mutation registerDevice($input:RegisterDeviceInput!){registerDevice(registerDevice:$input){grant{grantType assertion}}}',
  plate: 'mutation requestLicensePlate{requestLicensePlate{licensePlate expirationTime expiresInSeconds}}',
  exchange:
    'mutation exchangeAccountDelegationRefreshToken($input:ExchangeAccountDelegationRefreshTokenInput!)' +
    '{exchangeAccountDelegationRefreshToken(exchangeAccountDelegationRefreshToken:$input){__typename}}',
  refresh: 'mutation refreshToken($input:RefreshTokenInput!){refreshToken(refreshToken:$input){activeSession{sessionId}}}',
};
const DEVICE = {
  deviceFamily: 'browser',
  applicationRuntime: 'chrome',
  deviceProfile: 'macosx',
  deviceLanguage: 'en',
  attributes: { operatingSystem: 'macintosh', operatingSystemVersion: '10.15.7', osDeviceIds: [] },
};
const uuid = () => {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-');
};
// how LG's Home opens a Disney+ film (the content miner's Disney+ row), and the same for an episode (it plays that episode: checked on
// the owner's TV on 2026-10-29)
function target(i) {
  const t = i.type === 'movie' ? 'movie' : 'episode';
  return 'distributionPartner=lg&programType=' + t + '&contentId=' + i.id + '&page=play&id=' + i.id + '&type=' + t + '&contentType=Full';
}
// a title's page in the Disney+ app, by Disney's id for it (entity-<id>, as Disney's search and its links name it), in LG's format for
// Disney+'s pages; not yet opened on a TV (unverified)
function browseTarget(id, kind) {
  const t = kind === 'movie' ? 'movie' : 'series';
  return (
    'distributionPartner=lg&programType=' + t + '&contentId=' + id + '&page=browse&id=entity-' + id + '&type=' + t + '&contentType=Full'
  );
}

function create(ctx) {
  const config = ctx.config;
  const retryMs = ctx.retryMs || RETRY_MS; // shorter only in the tests
  const acct = () => (config.get().watchAccounts || {}).disney || {};
  const setAcct = v =>
    config.update('disney', c => {
      c.watchAccounts = Object.assign({}, c.watchAccounts);
      if (v) c.watchAccounts.disney = v;
      else delete c.watchAccounts.disney;
    });
  const head = () => ({
    accept: 'application/json',
    'x-bamsdk-client-id': CLIENT,
    'x-bamsdk-platform': PLATFORM,
    'x-bamsdk-version': SDK.replace(/\.0$/, ''),
    'x-application-version': VERSION,
    'x-dss-edge-accept': 'vnd.dss.edge+json; version=2',
  });
  // a call to Disney's API; Disney's own errors come as {errors: [{code, description}]}
  async function api(path, auth, body) {
    const r = await fetch.read(API + path, {
      method: body ? 'POST' : 'GET',
      body: body || undefined,
      headers: Object.assign(head(), { authorization: 'Bearer ' + auth }, body ? { 'content-type': 'application/json' } : {}),
      totalMs: 20000,
      maxBytes: 4 * 1024 * 1024,
      anyStatus: true,
      allowHttp: TEST,
      redirects: 0,
    });
    let j = null;
    try {
      j = JSON.parse(r.body.toString('utf8'));
    } catch (_) {}
    const err = j && Array.isArray(j.errors) && j.errors[0];
    if (r.status < 200 || r.status >= 300 || err || !j)
      throw fetch.fail(err ? String(err.code || err.description || err.message || 'error') : 'HTTP ' + r.status, 'status', r.status);
    return j;
  }
  const sdkToken = j => (j && j.extensions && j.extensions.sdk && j.extensions.sdk.token) || null;
  // Disney's web player's public key, read from its sign-in page (kept in memory for a few hours)
  let key = '',
    keyAt = 0;
  async function apiKey() {
    if (key && Date.now() - keyAt < KEY_MS) return key;
    const r = await fetch.read(WEB + '/begin', {
      totalMs: 20000,
      maxBytes: 4 * 1024 * 1024,
      allowHttp: TEST,
      headers: { accept: 'text/html' },
    });
    const m = /"clientApiKey":"([A-Za-z0-9_.-]{16,400})"/.exec(r.body.toString('utf8'));
    if (!m) throw new Error('Disney+ sign-in is not available just now.');
    key = m[1];
    keyAt = Date.now();
    return key;
  }
  function keep(t, old) {
    setAcct({
      token: String(t.accessToken),
      refreshToken: String(t.refreshToken || old || ''),
      until: Date.now() + (t.expiresIn > 0 ? t.expiresIn * 1000 : 60 * 60 * 1000) - 60 * 1000,
    });
  }

  let state = { state: 'idle', code: '', url: '', error: '' },
    problem = '';
  let timer = /** @type {any} */ (null),
    sock = /** @type {any} */ (null),
    round = 0; // a new code (or unlinking) ends the wait for the one before, also an answer still on its way
  function quit() {
    clearTimeout(timer);
    timer = null;
    if (sock) sock.close();
    sock = null;
  }
  function stop() {
    round++;
    quit();
  }
  // Disney's socket for this device: opened, then authenticated with the device's key; resolves once Disney accepts it
  function listen(mine, dev, sessionId, live, entered) {
    return new Promise((resolve, reject) => {
      const s = wsclient.open(
        EDGE +
          '?X-Application-Version=' +
          VERSION +
          '&X-BAMSDK-Client-ID=' +
          CLIENT +
          '&X-BAMSDK-Platform=' +
          PLATFORM +
          '&X-BAMSDK-Version=' +
          SDK +
          '&X-DSS-Edge-Accept=vnd.dss.edge+json;%20version=2&X-Request-ID=' +
          uuid(),
        { protocol: 'vnd.dss.edge+json', origin: 'https://www.disneyplus.com' }
      );
      let ready = false;
      sock = s;
      s.on('open', () =>
        s.send(
          JSON.stringify({
            source: 'urn:dss:source:sdk:javascript:macosx:chrome',
            time: new Date().toISOString(),
            id: uuid(),
            data: {
              sessionId,
              accessToken: dev.accessToken,
              application: { id: 'disneyplus', name: 'Disney+', version: VERSION },
              device: {
                os: 'macintosh',
                model: 'macosx',
                brand: 'web',
                modelFamily: 'n/a',
                platformId: 'browser',
                manufacturer: 'apple',
                operatingSystem: 'macintosh',
                operatingSystemVersion: '10.15.7',
              },
              sdk: { version: SDK, platform: PLATFORM, clientId: CLIENT, deviceFamily: 'browser' },
            },
            datacontenttype: 'application/json;charset=utf-8',
            type: 'urn:dss:event:edge:sdk:authentication:v2',
            schemaurl:
              'https://github.bamtech.co/schema-registry/schema-registry/blob/8406352a03f5afc443a19da4fbfa94c4fc1958b6/dss/event/edge/1.0.0/sdk/authentication-v2.oas2.yaml#L21',
            subject: 'sessionId=' + sessionId,
          })
        )
      );
      s.on('message', text => {
        let m = /** @type {any} */ (null);
        try {
          m = JSON.parse(text);
        } catch (_) {
          return;
        }
        if (!m || mine !== round) return;
        if (m.type === 'urn:dss:transport:edge:event:authenticated') {
          ready = true;
          resolve();
        } else if (m.type === 'urn:dss:transport:edge:event:unauthenticated') reject(new Error('Disney+ refused this TV.'));
        else if (ENTERED.test(String(m.type)) && m.data && typeof m.data.refreshToken === 'string') entered(m.data.refreshToken);
      });
      s.on('error', () => {});
      s.on('close', () => {
        if (sock === s) sock = null;
        if (!ready) return reject(new Error('Disney+ could not be reached.'));
        // dropped while the code waits: back on the socket a moment later, until the code expires
        if (live())
          setTimeout(() => {
            if (live() && !sock) listen(mine, dev, sessionId, live, entered).catch(() => {});
          }, retryMs);
      });
    });
  }
  async function link() {
    stop();
    const mine = round;
    const failed = e => {
      if (mine !== round) return { error: 'A newer code was asked for.' };
      quit();
      state = { state: 'error', code: '', url: '', error: String(e.message || e) };
      return { error: state.error };
    };
    try {
      const reg = await api('/graph/v1/device/graphql', await apiKey(), {
        operationName: 'registerDevice',
        query: Q.register,
        variables: { input: DEVICE },
      });
      const dev = sdkToken(reg);
      if (!dev || !dev.accessToken || !dev.refreshToken) throw new Error('Disney+ did not register this TV.');
      const ses = await api('/v1/public/graphql', dev.accessToken, { query: '{activeSession{sessionId}}' });
      const sessionId = String(((ses.data || {}).activeSession || {}).sessionId || '');
      if (mine !== round) return { error: 'A newer code was asked for.' };
      let taken = false;
      // the code was entered: Disney's key for this TV's sign-in, traded for the account's keys
      const entered = async adrt => {
        if (taken || mine !== round) return;
        taken = true;
        try {
          const ex = await api('/v1/public/graphql', dev.accessToken, {
            operationName: 'exchangeAccountDelegationRefreshToken',
            query: Q.exchange,
            variables: { input: { accountDelegationRefreshToken: adrt, deviceRefreshToken: dev.refreshToken } },
          });
          const t = sdkToken(ex);
          if (!t || !t.accessToken || !t.refreshToken) throw new Error('Disney+ did not sign this TV in.');
          if (mine !== round) return;
          keep(t);
          problem = '';
          quit();
          if (ctx.changed) ctx.changed();
          state = { state: 'linked', code: '', url: '', error: '' };
        } catch (e) {
          failed(e);
        }
      };
      let until = Date.now() + LINK_MS;
      await listen(mine, dev, sessionId, () => mine === round && !taken && Date.now() < until - retryMs, entered);
      const lp = await api('/v1/public/graphql', dev.accessToken, { operationName: 'requestLicensePlate', query: Q.plate, variables: {} });
      const plate = (lp.data || {}).requestLicensePlate || {};
      if (!/^[0-9A-Z]{4,12}$/.test(String(plate.licensePlate || ''))) throw new Error('Disney+ did not give a code.');
      if (mine !== round) return { error: 'A newer code was asked for.' };
      until = Date.now() + Math.min(LINK_MS, plate.expiresInSeconds > 0 ? plate.expiresInSeconds * 1000 : LINK_MS);
      if (!taken) state = { state: 'waiting', code: String(plate.licensePlate), url: 'disneyplus.com/begin', error: '' };
      timer = setTimeout(() => {
        if (mine !== round || state.state !== 'waiting') return;
        quit();
        state = { state: 'expired', code: '', url: '', error: '' };
      }, until - Date.now());
      return { code: String(plate.licensePlate), url: 'disneyplus.com/begin' };
    } catch (e) {
      return failed(e);
    }
  }
  function unlink() {
    stop();
    setAcct(null);
    problem = '';
    state = { state: 'idle', code: '', url: '', error: '' };
  }
  function status() {
    const a = acct();
    return Object.assign(
      { linked: !!a.refreshToken },
      a.refreshToken && state.state !== 'waiting' ? { state: 'linked', code: '', url: '', error: problem } : state
    );
  }

  // the account's key, renewed with its refresh key when it has run out (Disney's keys last 4 hours); one renewal at a time
  let renewing = /** @type {Promise<string>|null} */ (null);
  function token() {
    const a = acct();
    if (!a.refreshToken) return Promise.resolve('');
    if (a.token && a.until > Date.now()) return Promise.resolve(a.token);
    if (!renewing)
      renewing = (async () => {
        try {
          const j = await api('/graph/v1/device/graphql', await apiKey(), {
            operationName: 'refreshToken',
            query: Q.refresh,
            variables: { input: { refreshToken: a.refreshToken } },
          });
          const t = sdkToken(j);
          if (!t || !t.accessToken) throw new Error('Disney+ did not renew the sign-in.');
          if (acct().refreshToken !== a.refreshToken) return ''; // unlinked (or linked again) meanwhile
          keep(t, a.refreshToken);
          problem = '';
          return String(t.accessToken);
        } catch (e) {
          // Disney refused the refresh key: the TV has to be linked again (a dropped connection is only tried again later)
          if (e.code === 'status') problem = 'Disney+ asks for this TV to be linked again.';
          throw e;
        } finally {
          renewing = null;
        }
      })();
    return renewing;
  }

  // whose Continue Watching it is: the account's active profile (its name only); a failed question gives no name and is not repeated
  // before WHO_MS
  let who = '',
    whoAt = 0,
    whoTok = '';
  async function profile(tok) {
    if (tok === whoTok && Date.now() - whoAt < WHO_MS) return who;
    whoTok = tok;
    whoAt = Date.now();
    try {
      const j = await api('/v1/public/graphql', tok, { query: '{me{account{activeProfile{id name}}}}' });
      const p = j.data && j.data.me && j.data.me.account && j.data.me.account.activeProfile;
      who =
        p && typeof p.name === 'string'
          ? p.name
              .replace(/[\u0000-\u001f]/g, '')
              .trim()
              .slice(0, 40)
          : '';
    } catch (_) {
      who = '';
    }
    return who;
  }

  // what is partly watched, newest first: Disney's feed for TV makers (the newer version first)
  async function items(pic) {
    const tok = await token().catch(() => '');
    if (!tok) return [];
    const asked = profile(tok);
    let j = null;
    for (const v of ['v1.21', 'v1.4']) {
      try {
        j = await api('/explore/' + v + '/partner/continueWatching', tok);
        break;
      } catch (e) {
        if (e.status === 401) {
          // the key ran out before its time: renewed on the next read
          const a = acct();
          if (a.refreshToken) setAcct(Object.assign({}, a, { until: 0 }));
          return [];
        }
      }
    }
    const list = (j && j.data && j.data.continueWatching && j.data.continueWatching.items) || [];
    const name = await asked;
    return list
      .filter(i => i && ID.test(String(i.id)) && (i.type === 'movie' || i.type === 'episode'))
      .slice(0, MAX)
      .map(i => {
        const ep = i.type === 'episode',
          m = i.episodicMetadata || {},
          art = i.artwork || {},
          std = art.standard || {},
          pct = +(i.watchHistory || {}).progressPercentage || 0,
          series = (/^entity-(.+)$/.exec(String((i.browse || {}).deeplinkId || '')) || [])[1] || '';
        // the wide tile Disney's own row shows, else a backdrop, else the episode's still
        const img = [std.tile, std.background, art.up_next && art.up_next.background, std.thumbnail]
          .map(x => x && x['1.78'] && x['1.78'].imageId)
          .filter(x => ID.test(String(x || '')))[0];
        return {
          key: 'disney-' + i.id,
          group: 'disney:' + (ep && ID.test(series) ? series : i.id),
          source: 'disney',
          title: String(i.title || ''),
          sub:
            ep && m.seasonNumber >= 0 && m.episodeNumber > 0
              ? 'S' + m.seasonNumber + ' E' + m.episodeNumber + (m.episodeTitle ? ' · ' + m.episodeTitle : '')
              : '',
          img: img ? pic(IMAGES + img + '/scale?width=780&aspectRatio=1.78&format=jpeg') : '',
          progress: pct > 0 ? Math.min(1, pct / 100) : null,
          next: ep && pct === 0, // Disney's "Watch Next Episode"
          launch: { id: APP, params: { contentTarget: target(i) } },
          ...(name ? { who: name } : {}),
        };
      });
  }
  // Where to watch (where.js): Disney's own search for the words, with the account's key: [{title, id, year}] (id: Disney's entity id
  // for the title, which its page opens with); nothing without a link
  async function search(query) {
    const tok = await token().catch(() => '');
    if (!tok) return [];
    let j = null;
    try {
      j = await api('/explore/v1.21/search?query=' + encodeURIComponent(String(query).slice(0, 100)), tok);
    } catch (e) {
      if (e.status === 401) {
        const a = acct();
        if (a.refreshToken) setAcct(Object.assign({}, a, { until: 0 }));
      }
      return [];
    }
    const out = [],
      seen = {};
    for (const ct of (j && j.data && j.data.page && Array.isArray(j.data.page.containers) && j.data.page.containers) || [])
      for (const it of (ct && Array.isArray(ct.items) && ct.items) || []) {
        const v = (it && it.visuals) || {},
          b = ((it && Array.isArray(it.actions) && it.actions) || []).filter(x => x && x.type === 'browse')[0] || {},
          id = (/^entity-(.+)$/.exec(String(b.deeplinkId || '')) || [])[1] || '',
          yr = Number(((v.metastringParts || {}).releaseYearRange || {}).startYear || 0);
        if (!ID.test(id) || typeof v.title !== 'string' || !v.title.trim() || seen[id]) continue;
        seen[id] = 1;
        out.push({ title: v.title.trim().slice(0, 200), id, year: yr >= 1870 && yr <= 2100 ? yr : null });
      }
    return out.slice(0, 20);
  }
  return { link, unlink, status, items, search };
}

module.exports = { create, APP, browseTarget };
