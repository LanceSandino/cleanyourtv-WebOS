// What a paired phone may read about the TV: remote.js answers these on its LAN server (port 8794) only to a phone that sends its own
// paired key, and statuspage.js draws them in the phone page's TV tab. The health reading (metrics.js), the open ports and services
// (exposure.js) and a summary of the settings. The summary is copied field by field from a whitelist, so a setting added later never
// shows up here by itself, and nothing secret is in it: no token, key, hash, address, MAC, playlist, account or phone name. Read only:
// nothing here changes the TV or starts an update check; the costs are those of metrics.js (one reading per 2 s for every viewer).
//   GET /status-data       {metrics, settings}
//   GET /status-exposure   the ports and services (cached 30 s on the TV)
//   GET /status-services   LG's running systemd services (cached a minute)
const fs = require('fs');
const P = require('./paths'),
  debloat = require('./debloat');

const SETTINGS_MS = 10000, // the settings summary is read again at most every 10 s
  DEBLOAT_MS = 5 * 60000;

// the summary, from the manager's status (helper/manager.js), the TV profile and config.json; every field named here
function summary(ctx, debloatCheck) {
  const c = ctx.config.get(),
    o = c.options || {},
    mg = ctx.feature('manager'),
    s = mg ? mg.status() : null,
    tv = ctx.profile ? ctx.profile.get() : {},
    acc = c.watchAccounts || {},
    remote = c.remote || {},
    phones = Array.isArray(remote.devices) ? remote.devices.length : 0;
  const debloatOn = o.debloat !== false;
  const groupOn = id =>
    debloatOn && (debloat.OPT_IN.indexOf(id) >= 0 ? (o.debloatOn || []).indexOf(id) >= 0 : (o.debloatOff || []).indexOf(id) < 0);
  return {
    versions: {
      service: ctx.version,
      launcher: s ? String(s.frontend.version || '') : '',
      node: process.version,
    },
    tv: { model: String(tv.model || ''), firmware: String(tv.firmware || ''), sdk: String(tv.sdk || '') },
    updates: s
      ? {
          channel: s.channel ? 'dev' : 'stable',
          available: s.release && (s.service.updateTo || s.frontend.updateTo) ? String(s.release.version) : '',
          checkedAt: s.checkedAt || 0,
          fromThisProject: !!(s.security && s.security.source.ours),
        }
      : null,
    home: s ? { takeover: !!s.home.enabled, active: !!s.home.ours } : null,
    debloat: {
      on: debloatOn,
      groups: debloat.GROUPS.concat(debloat.OPT_IN).map(id => ({ id, on: groupOn(id) })),
      check: debloatCheck
        ? {
            at: debloatCheck.at || 0,
            groups: (debloatCheck.groups || []).map(g => ({ id: String(g.id), ok: !!g.ok, notes: (g.notes || []).map(String) })),
          }
        : null,
    },
    remote: { on: remote.on !== false && phones > 0, phones },
    linked: {
      plex: !!(acc.plex && acc.plex.token && acc.plex.server),
      stremio: !!(acc.stremio && acc.stremio.authKey),
      disney: !!(acc.disney && acc.disney.refreshToken),
    },
    options: { liveTv: o.liveTv !== false, inputKey: o.inputKey !== false },
    security: s
      ? {
          telnetOff: !!s.security.telnet.off,
          apiToken: !!s.security.token.enforced,
          devtoolsClosed: !!(s.security.devtools && s.security.devtools.closed),
        }
      : {
          telnetOff: fs.existsSync(P.TELNET_OFF),
          apiToken: fs.existsSync(P.D + '/api-token-on'),
          devtoolsClosed: !fs.existsSync(P.D + '/devtools-open'),
        },
  };
}

function create(ctx) {
  let cached = null;
  async function settings() {
    if (cached && Date.now() - cached.at < SETTINGS_MS) return cached.value;
    const dc = ctx.feature('debloatcheck');
    let check = null;
    if (dc && dc.recent)
      try {
        check = await dc.recent(DEBLOAT_MS);
      } catch (_) {}
    const value = summary(ctx, check);
    cached = { at: Date.now(), value };
    return value;
  }
  // the reply for a path, or {error, code}
  async function get(u) {
    const m = ctx.feature('metrics');
    if (!m) return { error: 'TV health is not running on the TV', code: 503 };
    if (u === '/status-data') return { metrics: await m.reading(), settings: await settings() };
    if (u === '/status-exposure') return m.exposure();
    if (u === '/status-services') return m.lgServices();
    return { error: 'not found', code: 404 };
  }
  return { get, settings };
}

module.exports = { create, summary, PATHS: ['/status-data', '/status-exposure', '/status-services'] };
