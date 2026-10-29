// The TV's security at a glance, for the manager and the Share log: where updates come from (D/source can name another repository;
// a warning when it is not this project's), whether the API token is required yet (apitoken.js), and whether the Homebrew Channel's
// telnet server is off (an open root shell on the network otherwise; its own switch, a file it reads when the TV starts). Telnet is
// changed only when the user asks, in the manager.
const fs = require('fs');
const P = require('./paths'),
  updates = require('./updates');

function state() {
  const repo = updates.repo();
  return {
    source: { repo, ours: repo === updates.DEFAULT_REPO },
    token: { enforced: fs.existsSync(P.D + '/api-token-on') },
    telnet: { off: fs.existsSync(P.TELNET_OFF) },
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
    (s.telnet.off ? 'off' : 'ON: an open root shell on the network until the file ' + P.TELNET_OFF + ' exists')
  );
}

module.exports = { state, setTelnet, text };
