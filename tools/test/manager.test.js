// The manager's options and keys (manager.js, inputkey.js, config.js): what is stored, what is logged, and how the Input key follows.
const fs = require('fs'),
  path = require('path');
const { ok, call, req, run } = require('./lib');
const config = req('config');

run(async () => {
  const lines = [];
  const conf = config.memory({}, l => lines.push(l));
  let ensured = 0,
    keyOn = null,
    mode = 'overlay',
    synced = 0;
  const inputkey = {
    mode: () => (conf.get().picker || {}).mode || mode,
    on: () => conf.options().inputKey && mode !== 'released',
    syncMode: () => synced++,
    pickerShownAt: () => 0,
  };
  const features = { inputkey };
  const m = req('manager').create({
    version: '1.6.0',
    config: conf,
    luna: async () => ({}),
    feature: n => features[n] || null,
    inputhook: {
      status: () => ({}),
      ensure(on) {
        ensured++;
        keyOn = on;
      },
      learnState: () => ({ state: 'got', name: 'guide', code: '362' }),
      markSaved() {},
      startLearn() {},
    },
  });
  const ask = (act, method, body) => call(m, '/api/manager/' + act, method, body);

  let r = await ask('status', 'GET');
  ok(
    r.j.options.liveTv === true && r.j.options.inputKey === true && r.j.options.debloat === true && r.j.keys.guide === '',
    'options are on by default and no Guide key is learned'
  );
  r = await ask('options', 'POST', { liveTv: false });
  ok(
    r.j.options.liveTv === false && conf.get().options.liveTv === false && ensured > 0,
    'switching Live TV off is stored and refreshes the key binds'
  );
  ok(
    lines.some(l => /options\.liveTv true -> false \(manager\)/.test(l)),
    'the change is logged with its source: ' + lines.join(' | ')
  );
  r = await ask('options', 'POST', { liveTv: 'no' });
  ok(r.j.options.liveTv === false, 'only a boolean changes an option');
  r = await ask('options', 'POST', { inputKey: false });
  ok(r.j.options.inputKey === false && r.j.options.liveTv === false, 'one option does not reset another');

  r = await ask('options', 'POST', { pickerMode: 'overlay' });
  ok(
    r.j.picker.mode === 'overlay' && conf.get().picker.prewarm === true && synced > 0,
    'choosing the overlay is saved and the Input key script is told'
  );
  r = await ask('options', 'POST', { pickerMode: 'ondemand' });
  ok(r.j.picker.mode === 'ondemand', 'choosing the on-demand picker');
  r = await ask('options', 'POST', { pickerMode: 'launcher' });
  ok(r.j.picker.mode === 'launcher', "choosing the launcher's list");
  r = await ask('options', 'POST', { pickerMode: 'sideways' });
  ok(r.j.picker.mode === 'launcher', 'an unknown mode is ignored');
  r = await ask('options', 'POST', { inputKey: true });
  mode = 'released';
  r = await ask('options', 'POST', { liveTv: true });
  ok(
    keyOn === false && r.j.picker.released === true,
    "the Input key is released to LG when its target needs CleanYourTV as Home and LG's Home is selected"
  );

  r = await ask('learn-state', 'GET');
  ok(conf.keys().guide === '362' && conf.keys().input === '241', 'a learned key is saved with the default Input key');
  r = await ask('clear-key', 'POST', { name: 'guide' });
  ok(conf.keys().guide === '', 'a learned key can be cleared');
  r = await ask('keys-done', 'POST');
  ok(conf.keys().learned === true, 'the end of the Input key steps is saved');
  ok(
    lines.some(l => /keys\.guide "" -> "362"|keys\.guide undefined -> "362"/.test(l)),
    'learned keys are logged too'
  );
  r = await ask('nope', 'POST');
  ok(r.code === 404, 'an unknown action');
  r = await ask('options', 'GET');
  ok(r.code === 405, 'a change needs POST');

  // the settings file: one read-modify-write at a time, written atomically, the launcher's part replaced without touching the rest
  const file = path.join(process.env.CYTV_DIR, 'config.json');
  const c = config.create(file, { log: () => {} });
  c.update('setup', x => {
    x.options = { inputKey: false };
    x.dock = ['a'];
  });
  c.update('launcher', x => {
    delete x.dock;
    x.dock = ['b'];
  });
  const back = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(
    back.options.inputKey === false && back.dock.join() === 'b' && (fs.statSync(file).mode & 0o777) === 0o600,
    'config.json keeps every section, is replaced atomically and readable by root only'
  );
  fs.writeFileSync(file, '[1,2]');
  ok(JSON.stringify(c.get()) === '{}' && c.options().inputKey === true, 'a broken config.json reads as empty, with the defaults');

  // the debloat's groups: switching one off while the debloat is on undoes only that group; switching it on again applies only it
  const exec = req('exec'),
    realSh = exec.sh,
    ran = [];
  exec.sh = async c => {
    ran.push(c);
    return { ok: true, out: '' };
  };
  r = await ask('options', 'POST', { debloatOff: ['logs', 'nonsense', 'logs'] });
  ok(
    r.j.options.debloat === true &&
      JSON.stringify(r.j.options.debloatOff) === '["logs"]' &&
      ran.length === 1 &&
      /debloat-undo\.sh logs$/.test(ran[0]),
    'a debloat group switched off is stored (known names, once) and only that group is undone: ' + ran.join(' | ')
  );
  r = await ask('options', 'POST', { debloatOff: ['tracking'] });
  ok(
    ran.length === 3 && /debloat-undo\.sh tracking$/.test(ran[1]) && /debloat-stop\.sh logs$/.test(ran[2]),
    'switching groups undoes the newly off ones and applies the ones switched on again: ' + ran.slice(1).join(' | ')
  );
  r = await ask('options', 'POST', { debloat: false, debloatOff: [] });
  ok(ran.length === 4 && /debloat-undo\.sh$/.test(ran[3]), 'the debloat switched off undoes every group');
  r = await ask('options', 'POST', { debloat: true, debloatOff: ['ads', 'logs', 'suggestions'] });
  ok(
    ran.length === 5 && /debloat-stop\.sh$/.test(ran[4]) && JSON.stringify(conf.options().debloatOff) === '["ads","logs","suggestions"]',
    'switched on with groups off: the groups are stored before debloat-stop.sh reads them'
  );
  // an opt-in group of the scripts (LG's content miner) switched on and off: only it is applied and undone; HbbTV (lgsettings.js)
  // runs no script
  r = await ask('options', 'POST', { debloatOn: ['miner', 'nonsense'] });
  ok(
    ran.length === 6 && /debloat-stop\.sh miner$/.test(ran[5]) && JSON.stringify(conf.options().debloatOn) === '["miner"]',
    'the miner switched on is stored and applied alone: ' + ran.slice(5).join(' | ')
  );
  r = await ask('options', 'POST', { debloatOn: ['hbbtv'] });
  ok(
    ran.length === 7 && /debloat-undo\.sh miner$/.test(ran[6]),
    'switched off it is undone alone; HbbTV switched on runs no script: ' + ran.slice(6).join(' | ')
  );
  r = await ask('options', 'POST', { debloatOn: ['lgservers', 'miner'] });
  const both = ran.slice(7).join(' | ');
  r = await ask('options', 'POST', { debloatOn: [] });
  ok(
    ran.length === 9 && /debloat-stop\.sh miner lgservers$/.test(ran[7]) && /debloat-undo\.sh miner lgservers$/.test(ran[8]),
    "LG's online services and the miner switched on together and off together: " + both + ' | ' + ran[8]
  );
  exec.sh = realSh;
  // the security at a glance: the update source (a warning when it is another repository), the API token, telnet on or off
  r = await ask('status', 'GET');
  const sec0 = r.j.security;
  r = await ask('telnet', 'POST', { off: true });
  const offNow = r.j.security.telnet.off && fs.existsSync(process.env.CYTV_TELNET_OFF);
  r = await ask('telnet', 'POST', { off: false });
  const onAgain = !r.j.security.telnet.off && !fs.existsSync(process.env.CYTV_TELNET_OFF);
  fs.writeFileSync(path.join(process.env.CYTV_DIR, 'source'), 'someone/else main\n');
  r = await ask('status', 'GET');
  const other = r.j.security.source;
  fs.unlinkSync(path.join(process.env.CYTV_DIR, 'source'));
  ok(
    sec0.source.ours === true &&
      sec0.source.repo === 'LanceSandino/cleanyourtv-WebOS' &&
      sec0.token.enforced === false &&
      offNow &&
      onAgain &&
      other.repo === 'someone/else' &&
      other.ours === false,
    "the status says where updates come from (and when it is not this project's), whether the token is required, and telnet's switch works both ways"
  );
  // LG's web inspector (port 9998): closed by default; switched off it is left open (D/devtools-open, the mount removed by
  // devtools-undo.sh), switched on again it is closed (devtools-close.sh mounts the copy; WebAppMgr is not restarted from here)
  const open9998 = path.join(process.env.CYTV_DIR, 'devtools-open'),
    shRan = [];
  exec.sh = async c => {
    shRan.push(c);
    return { ok: true, out: '' };
  };
  const byDefault = sec0.devtools && sec0.devtools.closed === true && typeof sec0.devtools.listening === 'boolean';
  r = await ask('devtools', 'POST', { closed: false });
  const leftOpen = r.j.security.devtools.closed === false && fs.existsSync(open9998);
  r = await ask('devtools', 'POST', { closed: true });
  const closedAgain = r.j.security.devtools.closed === true && !fs.existsSync(open9998);
  exec.sh = realSh;
  ok(
    byDefault &&
      leftOpen &&
      closedAgain &&
      shRan.length === 2 &&
      /devtools-undo\.sh$/.test(shRan[0]) &&
      /devtools-close\.sh$/.test(shRan[1]) &&
      !shRan.some(c => /restart/.test(c)),
    "LG's web inspector: closed by default, its switch works both ways and never restarts WebAppMgr: " + shRan.join(' | ')
  );
});
