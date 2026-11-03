// The Home key while Home is in front (homekey.js): a Home press in the input hook's log (code 773) while Home is in front relaunches
// Home with launchType homeKey, as LG itself does on webOS 22, so the launcher closes its menus and Search; not while another app is in
// front (LG goes Home then), not for other keys or a release, once per press, a log that shrank read from its start, and only where
// the profile says so (webOS 25 and newer).
const fs = require('fs'),
  path = require('path');
const { ok, tmp, req, run } = require('./lib');

const line = (code, state) => '[INFO] lginput_uinput_send_button called: keyid=3, state=' + state + ' uinput_code=' + code + '\n';

run(async () => {
  const log = path.join(tmp, 'hook-home.log');
  fs.writeFileSync(log, line(103, 1) + line(103, 0));
  const tv = req('tvprofile');
  let fg = 'com.webos.app.home',
    sdk = '10.3.2';
  const calls = [];
  const K = req('homekey').create(
    {
      profile: { get: () => tv.decide({ sdk }) },
      luna: async (uri, p) => {
        calls.push([uri.split('/').pop(), p]);
        return /getForegroundAppInfo/.test(uri) ? { returnValue: true, appId: fg } : { returnValue: true };
      },
    },
    { log }
  );
  await K.look(); // the first look starts at the end of the log: older presses are not taken
  ok(!calls.length, 'what the log held before is not taken');
  fs.appendFileSync(log, line(773, 1) + line(773, 0));
  await K.look();
  const launch = calls.filter(c => c[0] === 'launch');
  ok(
    launch.length === 1 && JSON.stringify(launch[0][1]) === JSON.stringify({ id: 'com.webos.app.home', params: { launchType: 'homeKey' } }),
    "a Home press while Home is in front relaunches Home with LG's own homeKey parameter, once: " + JSON.stringify(calls)
  );
  calls.length = 0;
  await K.look();
  fs.appendFileSync(log, line(412, 1) + line(773, 0) + line(28, 1));
  await K.look();
  ok(!calls.length, 'nothing new, another key or a Home release: nothing');
  fg = 'netflix';
  fs.appendFileSync(log, line(773, 1));
  await K.look();
  ok(!calls.some(c => c[0] === 'launch'), 'another app in front: left to LG (it goes Home itself)');
  // the hook's log shrank (it keeps its newest lines): read from its start
  fg = 'com.webos.app.home';
  calls.length = 0;
  fs.writeFileSync(log, line(773, 1));
  await K.look();
  ok(
    calls.some(c => c[0] === 'launch'),
    'a log that shrank is read from its start'
  );
  // webOS 22: LG relaunches Home with homeKey itself, so nothing is done here
  sdk = '7.6.0';
  calls.length = 0;
  fs.appendFileSync(log, line(773, 1));
  await K.look();
  ok(!calls.length && K.status().on === false, 'webOS 22: left to LG');
});
