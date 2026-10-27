// Stremio for Continue watching (watch.js): the TV is linked with Stremio's own TV sign-in (a link opened on a phone, no password on
// the TV), then the owner's library gives what is partly watched, the way Stremio's own Continue Watching chooses it (not removed,
// started: state.timeOffset > 0), newest first, with how far it got. The key stays in config.json (root only).
//   link()    {code, url} and the service asks Stremio every 3 s (10 minutes at most) until the link was used
//   status()  {linked, state: 'idle'|'waiting'|'linked'|'expired'|'error', code, url, error}
//   items()   cards for watch.js; pictures from Stremio's image host go through watch.js's image ids
const fetch = require('./fetch');

const LINK = process.env.CYTV_STREMIO_LINK || 'https://link.stremio.com', // other addresses only for the tests
  API = process.env.CYTV_STREMIO_API || 'https://api.strem.io',
  APP = 'io.strem.tv',
  POLL_MS = 3000,
  LINK_MS = 10 * 60 * 1000;

function create(ctx) {
  const config = ctx.config;
  const pollMs = ctx.pollMs || POLL_MS; // shorter only in the tests
  const acct = () => (config.get().watchAccounts || {}).stremio || {};
  const setAcct = v =>
    config.update('stremio', c => {
      c.watchAccounts = Object.assign({}, c.watchAccounts);
      if (v) c.watchAccounts.stremio = v;
      else delete c.watchAccounts.stremio;
    });
  const json = (url, o) =>
    fetch
      .read(
        url,
        Object.assign(
          { totalMs: 20000, maxBytes: 8 * 1024 * 1024, allowHttp: !!(process.env.CYTV_STREMIO_LINK || process.env.CYTV_STREMIO_API) },
          o
        )
      )
      .then(r => {
        const j = JSON.parse(r.body.toString('utf8'));
        if (j && j.error) throw new Error(typeof j.error === 'string' ? j.error : j.error.message || 'Stremio refused');
        return j && j.result !== undefined ? j.result : j;
      });

  let state = { state: 'idle', code: '', url: '', error: '' };
  let timer = /** @type {any} */ (null);
  function stop() {
    clearTimeout(timer);
    timer = null;
  }
  async function link() {
    stop();
    try {
      const c = await json(LINK + '/api/v2/create?type=Create');
      if (!c || !c.code) throw new Error('Stremio did not give a code.');
      const until = Date.now() + LINK_MS;
      state = { state: 'waiting', code: String(c.code), url: String(c.link || 'link.stremio.com').replace(/^https?:\/\//, ''), error: '' };
      const poll = async () => {
        if (Date.now() > until) return (state = { state: 'expired', code: '', url: '', error: '' });
        try {
          const r = await json(LINK + '/api/v2/read?type=Read&code=' + encodeURIComponent(c.code));
          if (r && r.authKey) {
            setAcct({ authKey: String(r.authKey) });
            if (ctx.changed) ctx.changed();
            state = { state: 'linked', code: '', url: '', error: '' };
            return;
          }
        } catch (_) {
          /* not used yet: Stremio answers an error until the link was opened */
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
    setAcct(null);
    state = { state: 'idle', code: '', url: '', error: '' };
  }
  function status() {
    const linked = !!acct().authKey;
    return Object.assign({ linked }, linked && state.state !== 'waiting' ? { state: 'linked' } : state);
  }

  // "tt0944947:1:5" -> S1 E5
  const epOf = v => {
    const m = /:(\d+):(\d+)$/.exec(String(v || ''));
    return m ? 'S' + m[1] + ' E' + m[2] : '';
  };
  async function items(pic) {
    const key = acct().authKey;
    if (!key) return [];
    let lib;
    try {
      lib = await json(API + '/api/datastoreGet', {
        method: 'POST',
        body: { authKey: key, collection: 'libraryItem', ids: [], all: true },
        totalMs: 10000,
        idleMs: 8000,
      });
    } catch (_) {
      return [];
    }
    return (Array.isArray(lib) ? lib : [])
      .filter(i => i && i.type !== 'other' && (!i.removed || i.temp) && i.state && i.state.timeOffset > 0)
      .sort((a, b) => String(b.state.lastWatched || '').localeCompare(String(a.state.lastWatched || '')))
      .slice(0, 6)
      .map(i => {
        const imdb = /^tt\d+$/.test(i._id) ? i._id : '';
        return {
          key: 'stremio-' + i._id,
          group: 'stremio:' + i._id,
          source: 'stremio',
          title: String(i.name || ''),
          sub: i.type === 'series' ? epOf(i.state.video_id) : '',
          img: pic(imdb ? 'https://images.metahub.space/background/medium/' + imdb + '/img' : i.poster),
          progress: i.state.duration > 0 ? Math.min(1, i.state.timeOffset / i.state.duration) : null,
          launch: { id: APP, params: {} },
        };
      });
  }
  return { link, unlink, status, items };
}

module.exports = { create };
