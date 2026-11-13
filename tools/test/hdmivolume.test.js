// The soundbar's volume over HDMI-CEC (hdmivolume.js and native/cec/cytv-cec): with a stand-in for the listener (a shell script that
// prints what cytv-cec prints): the readings and whether each answers a press, a TV without a CEC line, a listener that ends and is
// started again, switching off. And the shipped program: built from its source (its checksum), listen only, for the TV's 32-bit ARM.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const { ok, root, tmp, sleep, req, run } = require('./lib');

const until = async (fn, ms) => {
  const end = Date.now() + (ms || 3000);
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(15);
  }
  return !!fn();
};
// a stand-in listener: the script's lines, then it waits (or exits with a status)
function standIn(name, body) {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, '#!/bin/sh\n' + body + '\n', { mode: 0o755 });
  return f;
}

run(async () => {
  const H = req('hdmivolume');

  // ---- the program that ships: its source, its checksum, listen only, 32-bit ARM, static
  const src = fs.readFileSync(path.join(root, 'native', 'cec', 'cytv-cec.c'), 'utf8'),
    bin = fs.readFileSync(path.join(root, 'native', 'cec', 'cytv-cec')),
    sums = fs.readFileSync(path.join(root, 'native', 'SHA256SUMS'), 'utf8');
  ok(
    sums.trim() === crypto.createHash('sha256').update(bin).digest('hex') + '  cec/cytv-cec',
    'the shipped listener matches native/SHA256SUMS (sh native/build.sh rebuilds both)'
  );
  ok(
    /CEC_MODE_NO_INITIATOR \| CEC_MODE_MONITOR/.test(src) && !/CEC_TRANSMIT|CEC_ADAP_S_|CEC_MODE_INITIATOR|FOLLOWER/.test(src),
    'the listener opens the line in monitor mode without an address and has no way to send or to change the line'
  );
  // a 32-bit ELF (class 1) for ARM (machine 40) without a program interpreter (no PT_INTERP, type 3, among its program headers)
  const ph = bin.readUInt32LE(28),
    phSize = bin.readUInt16LE(42),
    interp = Array.from({ length: bin.readUInt16LE(44) }, (_, i) => bin.readUInt32LE(ph + i * phSize)).indexOf(3) >= 0;
  ok(
    bin.slice(0, 4).toString('latin1') === '\x7fELF' && bin[4] === 1 && bin.readUInt16LE(18) === 40 && !interp,
    "it is a 32-bit ARM program that needs none of the TV's libraries"
  );
  const pkg = fs.readFileSync(path.join(root, 'ipk', 'build.py'), 'utf8'),
    boot = fs.readFileSync(path.join(root, 'scripts', 'bootstrap.sh'), 'utf8');
  ok(/native\/cytv-cec/.test(pkg) && /\$D\/native/.test(boot), 'the package carries it and the setup copies it to the service folder');

  // ---- readings
  const got = [];
  const okBin = standIn(
    'listener-ok',
    'echo ready; sleep 0.1; echo "key 41"; echo "audio 22 0"; sleep 2; echo "audio 23 0"; echo "audio 101 0"; echo "audio x 0"; ' +
      'echo "key 44"; echo "audio 23 1"; exec sleep 30'
  );
  const h = H.create({ bin: okBin, pressMs: 1500, retryMs: 100 });
  ok(h.state() === 'off', 'off until started');
  h.start(r => got.push(r));
  ok(await until(() => h.state() === 'listening'), 'listening once it says ready');
  ok(await until(() => got.length === 1), 'a report is a reading');
  ok(
    JSON.stringify(got[0]) === '{"volume":22,"muted":false,"press":true}',
    'right after a volume key it answers a press: ' + JSON.stringify(got[0])
  );
  ok(await until(() => got.length === 3, 4000), 'the next reports too');
  ok(
    JSON.stringify(got.slice(1)) === '[{"volume":23,"muted":false,"press":false},{"volume":23,"muted":true,"press":false}]',
    'a report long after a volume key (another key does not count) is not a press; out-of-range and broken lines are left out: ' +
      JSON.stringify(got.slice(1))
  );
  h.stop();
  ok(h.state() === 'off', 'stopped');
  await sleep(200);
  ok(got.length === 3, 'nothing after it was stopped');

  // ---- a TV without a CEC line: unsupported, not started again
  let starts = 0;
  const none = standIn('listener-none', 'echo "cytv-cec: /dev/cec0: No such file or directory" >&2; exit 2');
  const h2 = H.create({ bin: none, retryMs: 50 });
  h2.start(() => starts++);
  ok(await until(() => h2.state() === 'unsupported'), 'a TV without a CEC line: unsupported');
  ok(/No such file/.test(h2.error()), 'with the reason: ' + h2.error());
  const missing = H.create({ bin: path.join(tmp, 'not-there') });
  missing.start(() => {});
  ok(missing.state() === 'unsupported' && missing.error() === 'not installed', 'without the program: unsupported, not installed');

  // ---- a listener that ends is started again
  const count = path.join(tmp, 'count');
  const flaky = standIn('listener-flaky', 'echo x >> "' + count + '"; echo ready; sleep 0.1; exit 1');
  const h3 = H.create({ bin: flaky, retryMs: 100 });
  h3.start(() => {});
  ok(
    await until(() => fs.existsSync(count) && fs.readFileSync(count, 'utf8').split('\n').length > 2, 3000),
    'a listener that ended is started again'
  );
  h3.stop();
  const n = fs.readFileSync(count, 'utf8').length;
  await sleep(500);
  ok(fs.readFileSync(count, 'utf8').length === n && h3.state() === 'off', 'and not after it was stopped');

  // ---- off and on again while the old one is still ending: one listener, listening
  const h4 = H.create({ bin: okBin, retryMs: 100 });
  h4.start(() => {});
  await until(() => h4.state() === 'listening');
  h4.stop();
  h4.start(() => {});
  ok(await until(() => h4.state() === 'listening'), 'switched off and on at once: listening again');
  h4.stop();
});
