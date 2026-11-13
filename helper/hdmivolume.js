// The soundbar's own volume over HDMI-CEC, for the Sonos volume bar (sonos.js). A soundbar on HDMI ARC/eARC reports its new volume
// to the TV by itself right after each press of the remote's volume keys (<Report Audio Status>, about 0.1 s after the TV passed the
// key on): native/cec/cytv-cec listens for it in the kernel's monitor mode, which can send nothing, and prints each report. That is the
// soundbar's real number, known without the network, for any soundbar that reports it. Changes made in the Sonos app do not cross
// HDMI; sonos.js keeps following the speaker on the network for those.
// cytv-cec lines: "ready", "key <hex>" (a key the TV passed on to the soundbar), "audio <volume> <mute>". It exits 2 when the TV has
// no CEC line or does not allow listening (unsupported: not started again), else it is started again after a pause that doubles.
const fs = require('fs');
const exec = require('./exec'),
  P = require('./paths');

const VOLUME_KEYS = ['41', '42', '43']; // volume up, volume down, mute

function create(opts) {
  const o = Object.assign({ bin: P.NATIVE + '/cytv-cec', retryMs: 5000, pressMs: 1500 }, opts);
  let child = null,
    /** @type {any} */ stopping = null, // the child that was asked to end
    want = null, // the function that takes each reading while it should run
    state = 'off', // off, starting, listening, unsupported, stopped (it ended; started again later)
    error = '',
    wait = 0,
    keyAt = 0,
    /** @type {any} */ timer = null;

  function run() {
    timer = null;
    if (!want || child) return;
    if (!fs.existsSync(o.bin)) {
      state = 'unsupported';
      error = 'not installed';
      return;
    }
    try {
      fs.chmodSync(o.bin, 0o755);
    } catch (_) {}
    state = 'starting';
    const c = exec.spawn(o.bin, []);
    child = c;
    let rest = '',
      err = '';
    c.stdout.on('data', b => {
      const lines = (rest + b).split('\n');
      rest = lines.pop() || '';
      lines.forEach(line);
    });
    c.stderr.on('data', b => (err = (err + b).slice(-300)));
    c.on('error', e => (err = e.message));
    c.on('close', code => {
      if (child !== c) return;
      child = null;
      error = err.trim().replace(/^cytv-cec: /, '');
      if (stopping === c) {
        stopping = null;
        if (!want) return void (state = 'off');
        return run(); // switched off and on again before it had ended
      }
      if (!want) return void (state = 'off');
      if (code === 2) {
        state = 'unsupported';
        console.log('sonos: no volume over HDMI on this TV: ' + error);
        return;
      }
      state = 'stopped';
      wait = Math.min(300000, wait ? wait * 2 : o.retryMs);
      console.log('sonos: the HDMI listener ended (' + (error || 'status ' + code) + '); again in ' + Math.round(wait / 1000) + ' s');
      timer = setTimeout(run, wait);
    });
  }
  function line(s) {
    const w = s.trim().split(' ');
    if (w[0] === 'ready') {
      state = 'listening';
      wait = 0;
      error = '';
      console.log('sonos: listening to the soundbar over HDMI');
    } else if (w[0] === 'key' && VOLUME_KEYS.indexOf(w[1]) >= 0) keyAt = Date.now();
    else if (w[0] === 'audio' && /^\d{1,3}$/.test(w[1]) && +w[1] <= 100 && /^[01]$/.test(w[2]) && want)
      // press: the remote's volume or mute key was just passed on to the soundbar, so this report is the answer to a press
      want({ volume: +w[1], muted: w[2] === '1', press: Date.now() - keyAt < o.pressMs });
  }
  function start(onReading) {
    want = onReading;
    if (!child && !timer && state !== 'unsupported') run();
    else if (child && state === 'off') state = 'starting'; // the one that is ending is started again when it has
  }
  function stop() {
    want = null;
    clearTimeout(timer);
    timer = null;
    if (child && stopping !== child)
      try {
        stopping = child;
        child.kill('SIGTERM');
      } catch (_) {}
    if (state !== 'unsupported') state = 'off';
  }
  return { start, stop, state: () => state, error: () => error };
}

module.exports = { create, VOLUME_KEYS };
