// The TV profile (tvprofile.js): the facts of a TV go in, every per-TV decision comes out. When a new kind of TV needs another
// decision, add its case here.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, helper, ok, req, run } = require('./lib');
const tv = req('tvprofile');

run(async () => {
  const compat = [
    { firmware: '33.23.05', sdk: '10.2.2', note: 'OLED65G26LA' },
    { firmware: '04.4*', note: 'a prefix' },
    { firmware: '6.5.3', note: 'by SDK' },
  ];
  const cases = [
    // [what, facts, expected decisions]
    [
      'webOS 25 (G2, the tested TV)',
      { sdk: '10.2.2', firmware: '33.23.05', home: 'com.webos.app.home flutter', node: 'v16.20.2' },
      {
        pickerMode: 'overlay',
        notifyWindow: 'topui',
        homeSupported: true,
        tested: true,
        legacyNode: false,
        lgScreensaver: 'bus',
        adManagerStub: true,
        devtoolsRestart: true,
        supported: true,
      },
    ],
    [
      'webOS 26 (SDK 11): the hidden picker was not tried there (issue 6)',
      { sdk: '11.2.0', firmware: '43.21.77', home: 'com.webos.app.home web', node: 'v16.20.2' },
      { pickerMode: 'ondemand', notifyWindow: 'topui', homeSupported: true, tested: false, supported: true },
    ],
    [
      'webOS 24 (SDK 9, Node.js 16, Chromium 108)',
      { sdk: '9.2.4', firmware: '23.23.30', home: 'com.webos.app.home flutter', node: 'v16.19.1' },
      { pickerMode: 'ondemand', notifyWindow: 'overlay', homeSupported: true, homeTakeover: 'mount', supported: true },
    ],
    [
      'webOS 23 (SDK 8, Node.js 12, Chromium 94; issue 17): the native Home gets the stand-in',
      { sdk: '8.4.0', firmware: '13.40.90', home: 'com.webos.app.home native', node: 'v12.22.2' },
      { pickerMode: 'ondemand', notifyWindow: 'overlay', homeSupported: false, homeTakeover: 'standin', supported: true },
    ],
    [
      "webOS 22 (SDK 7, Node.js 12.21, Chromium 87): the owner's second TV, the oldest supported (D-20261101-1)",
      { model: '86UQ8000AUB', sdk: '7.6.0', firmware: '04.60.91', home: 'com.webos.app.home native', node: 'v12.21.0' },
      {
        pickerMode: 'ondemand',
        notifyWindow: 'overlay',
        homeSupported: false,
        homeTakeover: 'standin',
        afterSam: 'eim webapp-mgr preload-manager memorymanager',
        lgVolumeBar: '',
        lgPreload: '',
        lgScreensaver: 'bus',
        adManagerStub: false,
        devtoolsRestart: false,
        legacyNode: false,
        supported: true,
      },
    ],
    [
      'an SDK 7 report with a Node.js older than 12: below the floor',
      { sdk: '7.6.0', firmware: '04.60.91', home: 'com.webos.app.home native', node: 'v11.15.0' },
      { supported: false },
    ],
    [
      'webOS 6.5 (issue 5)',
      { sdk: '6.5.3', firmware: '03.53.45', home: 'com.webos.app.home native', node: 'v8.12.0' },
      { pickerMode: 'ondemand', notifyWindow: 'overlay', homeSupported: false, tested: true, legacyNode: true, supported: false },
    ],
    [
      'webOS 5 (issue 4)',
      { sdk: '5.6.2', firmware: '04.41.35', home: 'com.webos.app.home native', node: 'v8.12.0' },
      { pickerMode: 'ondemand', notifyWindow: 'overlay', tested: true, testedNote: 'a prefix', supported: false },
    ],
    [
      'SDK unknown',
      { sdk: '', firmware: '', home: '' },
      {
        pickerMode: 'ondemand',
        notifyWindow: 'overlay',
        homeSupported: false,
        tested: false,
        sdkMajor: 0,
        lgScreensaver: '',
        adManagerStub: false,
        devtoolsRestart: false,
        supported: false,
      },
    ],
  ];
  for (const c of cases) {
    const p = tv.decide(c[1], compat);
    const wrong = Object.keys(c[2]).filter(k => p[k] !== c[2][k]);
    ok(!wrong.length, c[0] + (wrong.length ? ': ' + wrong.map(k => k + ' is ' + JSON.stringify(p[k])).join(', ') : ''));
  }
  ok(
    tv.decide({ sdk: '5.6.2' }).afterSam === 'eim webapp-mgr preload-manager memorymanager' &&
      tv.decide({ sdk: '6.5.3' }).afterSam !== '' &&
      tv.decide({ sdk: '10.2.2' }).afterSam === '' &&
      tv.decide({ sdk: '' }).afterSam === '',
    'after the app manager restart, webOS 5 and 6 and every TV with the native Home restart the services that talk to it (issues 14, 23, 24); a flutter Home and an unknown TV do not'
  );
  ok(
    tv.decide({ home: 'com.webos.app.home native' }).homeTakeover === 'standin' &&
      tv.decide({ home: 'com.webos.app.home flutter' }).homeTakeover === 'mount' &&
      tv.decide({ home: 'com.webos.app.home web' }).homeTakeover === 'mount' &&
      tv.decide({}).homeTakeover === 'mount',
    "LG's native Home is taken over by a stand-in for its program (no app manager restart); flutter, web and unknown by the mount"
  );
  // Issue 21: ARC remained silent after SAM restarted, although the controller was active.
  const arc = { model: 'OLED65C35LA.AEU', sdk: '11.2.0', home: 'com.webos.app.home flutter' };
  ok(tv.decide(arc).afterSam === 'arccontroller', 'webOS 26 restarts the ARC controller after SAM (issue 21), whatever the model name');
  ok(tv.decide(Object.assign({}, arc, { home: 'com.webos.app.home web' })).afterSam === 'arccontroller', 'also with the web Home');
  for (const change of [{ sdk: '10.2.2' }, { sdk: '' }, { home: '' }]) {
    ok(tv.decide(Object.assign({}, arc, change)).afterSam === '', 'not on webOS 25 or an unknown TV ' + JSON.stringify(change));
  }
  // LG's volume bar can be hidden only where its switch was read in LG's files (webOS 25)
  ok(
    tv.decide({ sdk: '10.2.2' }).lgVolumeBar === 'configd' &&
      ['6.5.0', '11.2.0', '', '5.4.3'].every(v => tv.decide({ sdk: v }).lgVolumeBar === ''),
    "hiding LG's volume bar: webOS 25 only"
  );
  ok(
    tv.decide({ sdk: '10.2.2' }).lgPreload === 'api' && ['6.5.0', '7.6.0', '11.2.0', ''].every(v => tv.decide({ sdk: v }).lgPreload === ''),
    "stopping LG's pre-loading: webOS 25 only"
  );
  // LG's screensaver question: on webOS 22 and from webOS 25 on, where it was tried; a registered client that answers wrong reboots
  // the TV at standby (D-20261029-9), so webOS 23 and 24 and an unknown TV are left out. WebAppMgr's restart without its inspector and
  // the admanager stub: from webOS 25 on (on webOS 22 Disney+ stayed on its logo with the stub)
  ok(
    ['7.6.0', '10.2.2', '11.2.0'].every(v => tv.decide({ sdk: v }).lgScreensaver === 'bus') &&
      ['8.4.0', '9.2.4', ''].every(v => tv.decide({ sdk: v }).lgScreensaver === ''),
    "LG's screensaver question: webOS 22 and webOS 25 and newer"
  );
  ok(
    ['10.2.2', '11.2.0'].every(v => tv.decide({ sdk: v }).devtoolsRestart === true && tv.decide({ sdk: v }).adManagerStub === true) &&
      ['7.6.0', '8.4.0', '9.2.4', ''].every(
        v => tv.decide({ sdk: v }).devtoolsRestart === false && tv.decide({ sdk: v }).adManagerStub === false
      ),
    'the WebAppMgr restart and the admanager stub: webOS 25 and newer only'
  );
  // the setup script asks the same rules from the shell
  const cli = args => cp.spawnSync(process.execPath, [path.join(helper, 'tvprofile.js')].concat(args), { encoding: 'utf8' }).stdout.trim();
  ok(
    cli(['get', 'notifyWindow', '--sdk', '5.4.3']) === 'overlay' && cli(['get', 'notifyWindow', '--sdk', '10.2.2']) === 'topui',
    'from the shell: the notification window type'
  );
  ok(
    cli(['get', 'tested', '--firmware', '33.23.05', '--compat', path.join(root, 'compat.json')]) === '1' &&
      cli(['get', 'tested', '--firmware', '99.99.99', '--compat', path.join(root, 'compat.json')]) === '0',
    "from the shell: is the firmware in the repository's compat.json"
  );
  ok(cli(['get', 'homeSupported', '--home', 'com.webos.app.home flutter']) === '1', "from the shell: LG's Home kind");
  // the oldest webOS this fork runs on (DECISIONS.md D-20261101-1): bootstrap.sh asks, install.sh has the same numbers
  ok(
    tv.FLOOR.sdk === 7 && tv.FLOOR.node === 12 && tv.decide({}).floor === 'webOS 22 (SDK 7)',
    'the floor is webOS 22: SDK 7 with Node.js 12 (and Chromium 87)'
  );
  ok(
    ['7.6.0', '8.4.0', '9.2.4', '10.3.2', '11.2.0'].every(v => cli(['get', 'supported', '--sdk', v]) === '1') &&
      ['6.5.3', '5.4.3', ''].every(v => cli(['get', 'supported', '--sdk', v]) === '0') &&
      cli(['get', 'floor']) === 'webOS 22 (SDK 7)',
    'from the shell: is the TV at least the floor (the Node.js running it counts too), and what the floor is'
  );
  ok(
    cli(['get', 'lgScreensaver', '--sdk', '7.6.0']) === 'bus' &&
      cli(['get', 'devtoolsRestart', '--sdk', '7.6.0']) === '0' &&
      cli(['get', 'devtoolsRestart', '--sdk', '10.2.2']) === '1' &&
      cli(['get', 'adManagerStub', '--sdk', '7.6.0']) === '0' &&
      cli(['get', 'adManagerStub', '--sdk', '10.3.2']) === '1' &&
      cli(['get', 'adManagerStub']) === '0' &&
      cli(['get', 'lgServerHosts', '--sdk', '7.6.0']) === '0' &&
      cli(['get', 'lgServerHosts', '--sdk', '10.3.2']) === '1',
    'from the shell: no WebAppMgr restart and no admanager stub on webOS 22 (devtools-close.sh and debloat-stop.sh ask)'
  );
  ok(
    cli(['get', 'afterSam', '--sdk', arc.sdk, '--home', arc.home]) === 'arccontroller',
    'from the shell: webOS 26 restarts the ARC controller'
  );
  // the service saves the profile and reads it again after a restart
  const svc = tv.create({ luna: async () => ({ returnValue: true, modelName: 'X', firmwareVersion: '1', sdkVersion: '6.5.0' }) });
  const p = await svc.refresh();
  ok(
    p.pickerMode === 'ondemand' && p.model === 'X' && tv.create({ luna: async () => ({}) }).get().sdk === '6.5.0',
    'the service keeps the profile in tv.json'
  );
  const failed = tv.create({ luna: async () => ({ returnValue: false }) });
  ok((await failed.refresh()).sdk === '6.5.0', 'when luna does not answer, the saved profile stays');
  // a profile saved by an older version, with a decision since changed (webOS 22's screensaver question): this version's rules at start
  const P = req('paths');
  fs.writeFileSync(
    P.TV,
    JSON.stringify({
      model: '86UQ8000AUB',
      firmware: '04.60.91',
      sdk: '7.6.0',
      sdkMajor: 7,
      home: 'com.webos.app.home native',
      lgScreensaver: '',
    })
  );
  const old = tv.create({ luna: async () => ({ returnValue: false }) }).get();
  ok(
    old.lgScreensaver === 'bus' && old.adManagerStub === false && old.model === '86UQ8000AUB' && old.homeTakeover === 'standin',
    'a profile saved by an older version is decided again at start: ' +
      JSON.stringify([old.lgScreensaver, old.adManagerStub, old.homeTakeover])
  );
});
