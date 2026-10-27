// luna-send, the TV's service bus. Every call is one luna-send process with its stdin closed (it waits on it otherwise) and a time
// limit; a reply that is not JSON comes back as {returnValue: false, errorText}. opts.as sends the call as another service (luna-send
// -a), for data only that service may read (lgrows.js: LG's content miner); the name is checked, and passed as an argument.
const exec = require('./exec');

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function script(wait, as) {
  return 'luna-send -n 1 -w ' + wait + (as ? ' -a "$3"' : '') + ' -f "$1" "$2" </dev/null';
}
function luna(uri, payload, opts) {
  const o = opts || {};
  const wait = o.wait || 5000;
  const as = typeof o.as === 'string' && NAME.test(o.as) ? o.as : '';
  if (o.as && !as) return Promise.resolve({ returnValue: false, errorText: 'bad service name' });
  const args = ['-c', script(wait, as), 'sh', uri, JSON.stringify(payload || {})].concat(as ? [as] : []);
  return exec.run('/bin/sh', args, { timeout: o.timeout || wait + 3000 }).then(r => {
    try {
      return JSON.parse(r.out);
    } catch (_) {
      return { returnValue: false, errorText: r.error || 'bad json' };
    }
  });
}

module.exports = luna;
module.exports.script = script; // for the tests
