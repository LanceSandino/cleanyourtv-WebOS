// The TV's security at a glance, for the manager and the Share log: where updates come from (D/source can name another repository;
// a warning when it is not this project's), whether the API token is required yet (apitoken.js), whether the Homebrew Channel's
// telnet server is off (an open root shell on the network otherwise; its own switch, a file it reads when the TV starts), and whether
// LG's web inspector is closed (WebAppMgr's DevTools on port 9998, open to the network with no authentication: on by default,
// scripts/devtools-close.sh at every start, off while D/devtools-open exists). Telnet and the inspector are changed only when the
// user asks, in the manager, and both take effect at the next start of the TV.
const fs = require('fs');
const P = require('./paths'),
  exec = require('./exec'),
  updates = require('./updates');

const DEVTOOLS_OPEN = () => P.D + '/devtools-open',
  DEVTOOLS_PORT = '270E'; // 9998, as /proc/net/tcp writes it

// WebAppMgr's inspector listens now (on any address): /proc/net/tcp and tcp6, a socket on 9998 in LISTEN (0A)
function devtoolsListening() {
  for (const f of ['tcp', 'tcp6']) {
    let t = '';
    try {
      t = fs.readFileSync(P.PROC + '/net/' + f, 'utf8');
    } catch (_) {
      continue;
    }
    for (const line of t.split('\n').slice(1)) {
      const c = line.trim().split(/\s+/);
      if (c.length > 3 && c[3] === '0A' && (c[1] || '').split(':')[1] === DEVTOOLS_PORT) return true;
    }
  }
  return false;
}

function state() {
  const repo = updates.repo();
  return {
    source: { repo, ours: repo === updates.DEFAULT_REPO },
    token: { enforced: fs.existsSync(P.D + '/api-token-on') },
    telnet: { off: fs.existsSync(P.TELNET_OFF) },
    devtools: { closed: !fs.existsSync(DEVTOOLS_OPEN()), listening: devtoolsListening() },
  };
}
// telnet off (the file the Homebrew Channel reads at the next start) or on again; true when it took
function setTelnet(off) {
  try {
    if (off) fs.writeFileSync(P.TELNET_OFF, '');
    else if (fs.existsSync(P.TELNET_OFF)) fs.unlinkSync(P.TELNET_OFF);
    return true;
  } catch (_) {
    return false;
  }
}
// LG's web inspector closed (the copy of LG's script mounted now; WebAppMgr is not restarted, which would close every web app, so
// the port closes at the next start) or left open again (the mount removed); true when the switch was written
async function setDevtools(closed) {
  try {
    if (!closed) fs.writeFileSync(DEVTOOLS_OPEN(), '');
    else if (fs.existsSync(DEVTOOLS_OPEN())) fs.unlinkSync(DEVTOOLS_OPEN());
  } catch (_) {
    return false;
  }
  await exec.sh('sh ' + P.D + (closed ? '/devtools-close.sh' : '/devtools-undo.sh'), 15000);
  return true;
}
// the Share log's lines
function text() {
  const s = state();
  return (
    'update source: ' +
    s.source.repo +
    (s.source.ours ? '' : '   <- not this project: updates and themes come from there') +
    '\nAPI token: ' +
    (s.token.enforced ? 'required' : 'not required yet') +
    '\nHomebrew Channel telnet: ' +
    (s.telnet.off ? 'off' : 'ON: an open root shell on the network until the file ' + P.TELNET_OFF + ' exists') +
    "\nLG's web inspector (port 9998): " +
    (s.devtools.closed ? 'closed' : 'left open (switched off in the manager)') +
    (s.devtools.listening ? '; WebAppMgr listens on 9998 now' + (s.devtools.closed ? ' (closed from the next start)' : '') : '')
  );
}

module.exports = { state, setTelnet, setDevtools, devtoolsListening, text };
