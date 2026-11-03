// The Inputs picker from the launcher (inputkey.js): the Input button on Home shows it as the remote's Input key does (the kept-ready
// picker asked to show itself, the on-demand one started with ondemand), or says to use the launcher's own list where the key opens
// that or the picker does not start; the Home key puts it away only while the picker said it is up.
const { ok, call, memoryConfig, req, run } = require('./lib');

function make(o) {
  const calls = [];
  const conf = memoryConfig({ options: { inputKey: true }, picker: o.picker || {} });
  const K = req('inputkey').create({
    config: Object.assign(conf, { keys: () => ({}), options: () => ({ inputKey: true }) }),
    profile: { get: () => ({ pickerMode: o.mode || 'overlay' }) },
    luna: async (uri, p) => (
      calls.push([uri.replace('luna://com.webos.applicationManager/', ''), p]),
      o.fail ? { returnValue: false, errorText: 'no' } : { returnValue: true }
    ),
    feature: () => null,
    inputhook: { ensure() {}, hookInfo: () => ({ attached: true }) },
  });
  return { K, calls };
}

run(async () => {
  // kept ready (overlay, the living-room TV's default): asked to show itself, with no parameters, as scripts/inputkey.sh does
  let t = make({ mode: 'overlay' });
  let r = await call(t.K, '/api/picker/show', 'POST', {});
  ok(
    r.j.shown === true && JSON.stringify(t.calls) === JSON.stringify([['launch', { id: 'com.cleanyourtv.picker' }]]),
    'the Input button shows the kept-ready picker as the key does: ' + JSON.stringify(t.calls)
  );
  // on demand (webOS 22's default): started with ondemand
  t = make({ mode: 'ondemand' });
  r = await call(t.K, '/api/picker/show', 'POST', {});
  ok(
    r.j.shown === true &&
      JSON.stringify(t.calls[0]) === JSON.stringify(['launch', { id: 'com.cleanyourtv.picker', params: { ondemand: true } }]),
    'on demand: started with ondemand: ' + JSON.stringify(t.calls)
  );
  // the key opens the launcher's own list, or the picker does not start: the launcher's list
  t = make({ mode: 'ondemand', picker: { mode: 'launcher' } });
  r = await call(t.K, '/api/picker/show', 'POST', {});
  const failing = make({ mode: 'overlay', fail: true });
  const r2 = await call(failing.K, '/api/picker/show', 'POST', {});
  ok(
    r.j.launcher === true && !t.calls.length && r2.j.launcher === true,
    "the launcher's own list where the key opens it or the picker fails"
  );

  // the Home key: put away only while the picker said it is up (its own notes on /api/log)
  t = make({ mode: 'overlay' });
  r = await call(t.K, '/api/picker/hide', 'POST', {});
  const before = t.calls.length;
  await call(t.K, '/api/log?m=' + encodeURIComponent('picker show'), 'GET');
  const up = await call(t.K, '/api/picker/hide', 'POST', {});
  const sent = t.calls.slice(before);
  const again = await call(t.K, '/api/picker/hide', 'POST', {});
  await call(t.K, '/api/log?m=' + encodeURIComponent('picker show'), 'GET');
  await call(t.K, '/api/log?m=' + encodeURIComponent('picker hide'), 'GET');
  const gone = await call(t.K, '/api/picker/hide', 'POST', {});
  ok(
    r.j.hidden === false &&
      before === 0 &&
      up.j.hidden === true &&
      JSON.stringify(sent) === JSON.stringify([['launch', { id: 'com.cleanyourtv.picker', params: { hide: true } }]]) &&
      again.j.hidden === false &&
      gone.j.hidden === false,
    'the Home key puts the picker away only while it is up (and once): ' + JSON.stringify(sent)
  );
});
