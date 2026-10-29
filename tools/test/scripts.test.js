// The shell side: the scripts parse, and the setup keeps the options the user chose (issues 6 and 7).
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, tmp, ok, run, sleep } = require('./lib');

run(async () => {
  const scripts = fs
    .readdirSync(path.join(root, 'scripts'))
    .filter(f => !/\.js$/.test(f))
    .map(f => path.join('scripts', f))
    .concat(['install.sh', 'uninstall.sh', 'tools/diagnose.sh']);
  for (const f of scripts) {
    const r = cp.spawnSync('sh', ['-n', path.join(root, f)], { encoding: 'utf8' });
    ok(r.status === 0, 'shell syntax ' + f + (r.status ? ': ' + r.stderr : ''));
  }
  const jt = path.join(root, 'scripts', 'jtool.js'),
    cfg = path.join(tmp, 'config.json');
  const opts = function () {
    return cp.spawnSync(process.execPath, [jt, 'options', cfg].concat([].slice.call(arguments)), { encoding: 'utf8' });
  };
  fs.writeFileSync(cfg, JSON.stringify({ options: { inputKey: false, debloat: false, liveTv: false }, keep: 1 }));
  let r = opts('', '');
  let c = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  ok(
    r.status === 0 && c.options.inputKey === false && c.options.debloat === false && c.options.liveTv === false && c.keep === 1,
    'an update (no values) keeps Input key, Debloat and Live TV as they were'
  );
  ok(/\(kept\)/.test(r.stdout), 'the setup log says the options were kept');
  r = opts('1', '1');
  c = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  ok(
    c.options.inputKey === true && c.options.debloat === true && /were/.test(r.stdout),
    'setup with values sets them and says what they were'
  );
  fs.writeFileSync(cfg, '{}');
  opts('', '');
  c = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  ok(c.options.inputKey === true && c.options.debloat === true, 'a first install without values defaults both to on');
  // the stand-in way (LG's native Home): the program it is mounted over, and the request to webapp-mgr
  const jtool = args => cp.spawnSync(process.execPath, [jt].concat(args), { encoding: 'utf8' });
  const prog = path.join(tmp, 'lg-home-program'),
    nat = path.join(tmp, 'native-home.json');
  fs.writeFileSync(prog, '');
  fs.writeFileSync(nat, JSON.stringify({ id: 'com.webos.app.home', type: 'native', main: prog }));
  r = jtool(['exe', nat]);
  ok(r.status === 0 && r.stdout.trim() === prog, "jtool exe: the program of LG's native Home");
  fs.writeFileSync(nat, JSON.stringify({ id: 'com.webos.app.home', type: 'native', main: path.join(tmp, 'missing') }));
  ok(jtool(['exe', nat]).status === 1, 'jtool exe: a missing program is reported, so the mount way is used instead');
  const ov = path.join(tmp, 'overlay.json'),
    req = path.join(tmp, 'wam-launch.json');
  fs.writeFileSync(ov, JSON.stringify({ id: 'com.webos.app.home', type: 'web', main: 'index.html' }));
  jtool(['wamlaunch', ov, '/media/developer/cleanyourtv/home-overlay', req]);
  const q = JSON.parse(fs.readFileSync(req, 'utf8')),
    qs = JSON.parse(fs.readFileSync(req + '.str', 'utf8'));
  ok(
    q.appDesc.id === 'com.webos.app.home' &&
      q.appDesc.type === 'web' &&
      q.appDesc.folderPath === '/media/developer/cleanyourtv/home-overlay' &&
      JSON.parse(qs.appDesc).folderPath === q.appDesc.folderPath,
    'jtool wamlaunch: webapp-mgr opens the launcher folder as com.webos.app.home (also with the description as a string)'
  );
  // reload-home.sh: webOS starts Home again by itself after its page is stopped, so Home is launched only when no new Home process
  // came up (a launch on top of it showed as a second load after an update); stand-ins for pgrep, pkill and luna-send
  const rbin = path.join(tmp, 'reload-bin'),
    st = path.join(tmp, 'reload-state');
  fs.mkdirSync(rbin);
  const stand = (name, body) => {
    fs.writeFileSync(path.join(rbin, name), '#!/bin/sh\n' + body + '\n');
    fs.chmodSync(path.join(rbin, name), 0o755);
  };
  stand('pgrep', 'cat "' + st + '/pids" 2>/dev/null; [ -s "' + st + '/pids" ]');
  stand('pkill', 'echo pkill >> "' + st + '/calls"; cat "' + st + '/after" > "' + st + '/pids"');
  stand('luna-send', 'echo "luna $*" >> "' + st + '/calls"');
  const reload = (before, after) => {
    cp.spawnSync('rm', ['-rf', st]);
    fs.mkdirSync(st);
    fs.writeFileSync(path.join(st, 'pids'), before);
    fs.writeFileSync(path.join(st, 'after'), after);
    const r = cp.spawnSync('sh', [path.join(root, 'scripts', 'reload-home.sh')], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { CYTV_TEST_BIN: rbin, CYTV_HOME_WAIT: '2' }),
    });
    const calls = fs.existsSync(path.join(st, 'calls')) ? fs.readFileSync(path.join(st, 'calls'), 'utf8') : '';
    return { status: r.status, killed: /pkill/.test(calls), launched: /applicationManager\/launch/.test(calls) };
  };
  let rh = reload('100\n', '200\n');
  ok(rh.status === 0 && rh.killed && !rh.launched, 'Home came back by itself (a new process): it is not launched again');
  rh = reload('100\n', '');
  ok(rh.killed && rh.launched, 'Home did not come back: it is launched');
  rh = reload('100\n', '100\n');
  ok(rh.killed && rh.launched, 'the stopped process still listed is not taken for a new one: Home is launched');

  // bootstrap.sh run for real against a folder that stands in for the TV's root (CYTV_TEST_ROOT), with stand-ins for luna-send and systemctl
  const R = path.join(tmp, 'root'),
    S = path.join(tmp, 'pkg'),
    BIN = path.join(tmp, 'bin');
  const write = (f, data, mode) => {
    cp.spawnSync('mkdir', ['-p', path.dirname(f)]);
    fs.writeFileSync(f, data);
    if (mode) fs.chmodSync(f, mode);
  };
  const copyDir = (from, to, filter) => {
    cp.spawnSync('mkdir', ['-p', to]);
    for (const n of fs.readdirSync(from)) if (!filter || filter(n)) fs.copyFileSync(path.join(from, n), path.join(to, n));
  };
  copyDir(path.join(root, 'helper'), path.join(S, 'helper'), n => /\.js$/.test(n));
  copyDir(path.join(root, 'scripts'), path.join(S, 'scripts'), n => n !== 'bootstrap.sh');
  fs.copyFileSync(path.join(root, 'scripts', 'bootstrap.sh'), path.join(S, 'bootstrap.sh'));
  write(path.join(S, 'inputhook', 'ezinject'), '', 0o755);
  write(path.join(S, 'inputhook', 'libinputhookpp.so'), '');
  fs.copyFileSync(path.join(root, 'compat.json'), path.join(S, 'compat.json'));
  fs.copyFileSync(path.join(root, 'config.example.json'), path.join(S, 'config.example.json'));
  write(path.join(S, 'payload', 'app', 'index.html'), '<!doctype html>');
  fs.copyFileSync(path.join(root, 'app', 'version.json'), path.join(S, 'payload', 'app', 'version.json'));
  write(
    path.join(R, 'usr/palm/applications/com.webos.app.home/appinfo.json'),
    JSON.stringify({ id: 'com.webos.app.home', type: 'flutter' })
  );
  const NA = path.join(R, 'media/developer/apps/usr/palm/applications/com.cleanyourtv.notify/appinfo.json');
  write(NA, JSON.stringify({ id: 'com.cleanyourtv.notify', defaultWindowType: 'topui' }));
  cp.spawnSync('mkdir', ['-p', path.join(R, 'var/lib/webosbrew/init.d')]);
  // what the TV's luna answers (getSystemInfo); each case below writes its own
  const reply = path.join(tmp, 'luna-reply.json'),
    tvInfo = sdk =>
      fs.writeFileSync(
        reply,
        JSON.stringify(
          Object.assign({ returnValue: true, modelName: 'OLED65G26LA', firmwareVersion: '33.99.10' }, sdk ? { sdkVersion: sdk } : {})
        )
      );
  write(path.join(BIN, 'luna-send'), '#!/bin/sh\ncat "' + reply + '"\n', 0o755);
  write(path.join(BIN, 'systemctl'), '#!/bin/sh\nexit 0\n', 0o755);
  // a Node.js that says it is 8.12 (webOS 5 and 6), ahead of the real one on PATH; bootstrap.sh puts /usr/bin and /bin first
  const NODE8 = path.join(tmp, 'node8');
  write(
    path.join(NODE8, 'node'),
    '#!/bin/sh\ncase "$1" in -v|--version) echo v8.12.0; exit 0 ;; esac\nexec "' + process.execPath + '" "$@"\n',
    0o755
  );
  const systemNode = ['/usr/bin/node', '/usr/sbin/node', '/bin/node', '/sbin/node'].some(f => fs.existsSync(f));
  const boot = (args, node8) =>
    cp.spawnSync('sh', [path.join(S, 'bootstrap.sh')].concat(args), {
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        PATH: (node8 ? NODE8 + ':' : '') + process.env.PATH + ':' + BIN,
        CYTV_TEST_ROOT: R,
      }),
      timeout: 60000,
    });
  const D = path.join(R, 'media/developer/cleanyourtv');
  // below the floor (webOS 25, SDK 10, Node.js 16: DECISIONS.md D-20261029-3) the setup stops before it changes anything,
  // --force or not; only a TV whose version could not be read can be set up anyway
  let b;
  for (const c of [
    ['webOS 5 (SDK 5.4.3)', '5.4.3', []],
    ['webOS 6 (SDK 6.5.3)', '6.5.3', ['--force']],
    ['webOS 24 (SDK 9.2.4), also with --force', '9.2.4', ['--force']],
  ]) {
    tvInfo(c[1]);
    b = boot(['install', '--no-start'].concat(c[2]));
    const refused =
      b.status !== 0 &&
      new RegExp('webOS SDK ' + c[1].replace(/\./g, '\\.') + '.*needs webOS 25 \\(SDK 10\\) or newer').test(b.stderr) &&
      /Nothing was changed/.test(b.stderr) &&
      !fs.existsSync(D);
    ok(refused, c[0] + ': the setup refuses the TV and changes nothing' + (refused ? '' : ': ' + (b.stdout + b.stderr).trim().slice(-300)));
  }
  tvInfo('10.3.2');
  if (systemNode) console.log('     skipped: a Node.js in /usr/bin or /bin comes before the stand-in Node.js 8.12');
  else {
    b = boot(['install', '--no-start', '--force'], true);
    const refused =
      b.status !== 0 && /Node\.js \(v8\.12\.0\) is too old/.test(b.stderr) && /Nothing was changed/.test(b.stderr) && !fs.existsSync(D);
    ok(refused, 'Node.js 8.12 is refused before anything else, also with --force' + (refused ? '' : ': ' + b.stderr.trim().slice(-300)));
  }
  tvInfo('');
  b = boot(['install', '--no-start']);
  const unread = b.status !== 0 && /could not read this TV's webOS version/.test(b.stderr) && /--force/.test(b.stderr) && !fs.existsSync(D);
  ok(unread, 'a TV whose webOS version cannot be read is not set up without --force' + (unread ? '' : ': ' + b.stderr.trim().slice(-300)));
  tvInfo('10.3.2');
  b = boot(['install', '--no-start', '--no-input-key']);
  const out1 = b.stdout + b.stderr;
  ok(b.status === 0, 'bootstrap.sh install runs to the end (' + (b.status === 0 ? 'ok' : out1.slice(-400)) + ')');
  ok(
    /webOS SDK 10\.3\.2/.test(out1) && /not in the compatibility list; continuing because LG's Home is the flutter or web kind/.test(out1),
    'it reads the TV and accepts a flutter Home that is not in the list'
  );
  ok(
    JSON.parse(fs.readFileSync(NA, 'utf8')).defaultWindowType === 'topui' && !/use the .* window/.test(out1),
    'on SDK 10 the notification app keeps the topui window it ships with (tvprofile.js)'
  );
  ok(
    fs.existsSync(path.join(D, 'helper.js')) &&
      fs.existsSync(path.join(D, 'tvprofile.js')) &&
      fs.existsSync(path.join(D, 'app', 'version.json')),
    'the service files and the launcher are in place'
  );
  let conf = JSON.parse(fs.readFileSync(path.join(D, 'config.json'), 'utf8'));
  ok(conf.options.inputKey === false && conf.options.debloat === true, 'the setup stores the chosen options');
  const initd = path.join(R, 'var/lib/webosbrew/init.d');
  ok(
    fs.lstatSync(path.join(initd, '10-cleanyourtv-home')).isSymbolicLink() &&
      fs.lstatSync(path.join(initd, '15-cleanyourtv-debloat')).isSymbolicLink(),
    'the boot scripts are linked'
  );
  b = boot(['update', '1.6.0', '--no-start']);
  const out2 = b.stdout + b.stderr;
  conf = JSON.parse(fs.readFileSync(path.join(D, 'config.json'), 'utf8'));
  ok(
    b.status === 0 && conf.options.inputKey === false && /options: .*\(kept\)/.test(out2),
    'an update keeps the Input key switched off (issues 6 and 7)'
  );
  ok(fs.existsSync(path.join(D, 'backup', 'service-prev.tgz')), 'an update keeps the previous service files for a rollback');
  // an update that arrives on a TV below the floor (the package was installed anyway): the running service's files stay, and the
  // note in last-error.txt keeps updates.js from applying the same package again and again
  const svcFile = path.join(D, 'helper.js'),
    then = new Date(2020, 0, 1);
  fs.utimesSync(svcFile, then, then);
  tvInfo('6.5.3');
  b = boot(['update', '1.6.1', '--no-start']);
  const kept =
    b.status !== 0 &&
    /needs webOS 25 \(SDK 10\) or newer/.test(b.stderr) &&
    fs.statSync(svcFile).mtime.getTime() === then.getTime() &&
    fs.existsSync(path.join(D, 'last-error.txt')) &&
    /update to 1\.6\.1 failed/.test(fs.readFileSync(path.join(D, 'last-error.txt'), 'utf8'));
  ok(
    kept,
    'an update below the floor is refused, the service files stay and last-error.txt says so' +
      (kept ? '' : ': ' + b.stderr.trim().slice(-300))
  );
  if (fs.existsSync(path.join(D, 'last-error.txt'))) fs.unlinkSync(path.join(D, 'last-error.txt'));
  // an update where the version cannot be read goes on (the TV was set up, and Node.js was checked)
  tvInfo('');
  b = boot(['update', '1.6.0', '--no-start']);
  ok(b.status === 0 && /could not read this TV's webOS version/.test(b.stderr), 'an update on a TV whose version cannot be read goes on');
  tvInfo('10.3.2');
  // the input hook is loaded in lginput2 on the TV: an update must never write over it in place (a truncated mapped library crashed
  // lginput2, and LG rebooted the TV at the next standby). Held open here as lginput2 holds it: an unchanged hook is left alone, a
  // changed one replaces it by a rename, so the open copy keeps its bytes; the rollback's archive leaves the hook out
  const hook = path.join(D, 'inputhook', 'libinputhookpp.so'),
    ino0 = fs.statSync(hook).ino;
  boot(['update', '1.6.0', '--no-start']);
  const same = fs.statSync(hook).ino === ino0;
  fs.writeFileSync(hook + '.tmp', 'OLD HOOK BYTES');
  fs.renameSync(hook + '.tmp', hook);
  const held = fs.openSync(hook, 'r');
  write(path.join(S, 'inputhook', 'libinputhookpp.so'), 'NEW HOOK');
  b = boot(['update', '1.6.0', '--no-start']);
  const hookKept = Buffer.alloc(14);
  fs.readSync(held, hookKept, 0, 14, 0);
  fs.closeSync(held);
  const listed = cp.spawnSync('tar', ['tzf', path.join(D, 'backup', 'service-prev.tgz')], { encoding: 'utf8' }).stdout || '';
  ok(
    b.status === 0 &&
      same &&
      hookKept.toString() === 'OLD HOOK BYTES' &&
      fs.readFileSync(hook, 'utf8') === 'NEW HOOK' &&
      !fs.existsSync(hook + '.new') &&
      (fs.statSync(path.join(D, 'inputhook', 'ezinject')).mode & 0o111) !== 0 &&
      !/^inputhook\//m.test(listed) &&
      /^helper\.js$/m.test(listed),
    'an update never writes over the loaded input hook: unchanged it stays, changed it is renamed in, the open copy keeps its bytes, the rollback leaves it out'
  );
  fs.writeFileSync(
    path.join(R, 'usr/palm/applications/com.webos.app.home/appinfo.json'),
    JSON.stringify({ id: 'com.webos.app.home', type: 'native' })
  );
  fs.unlinkSync(path.join(D, 'backup', 'home-appinfo.orig.json'));
  b = boot(['install', '--no-start']);
  ok(
    b.status !== 0 && /Set up anyway/.test(b.stderr),
    'a native Home that is not in the list stops the setup with the hint to set up anyway'
  );
  b = boot(['install', '--no-start', '--force']);
  ok(b.status === 0 && /continuing because of --force/.test(b.stderr), 'with --force it continues');
  // with --force a TV whose version could not be read is set up, with the notification window older TVs need
  tvInfo('');
  b = boot(['install', '--no-start', '--force']);
  ok(
    b.status === 0 &&
      /could not read this TV's webOS version; continuing because of --force/.test(b.stderr) &&
      JSON.parse(fs.readFileSync(NA, 'utf8')).defaultWindowType === 'overlay',
    'with --force a TV of unknown version is set up, and its notification app gets the overlay window (tvprofile.js)'
  );
  tvInfo('10.3.2');

  // bootstrap.sh asks tvprofile.js for the per-TV decisions instead of deciding itself
  const bootText = fs.readFileSync(path.join(root, 'scripts', 'bootstrap.sh'), 'utf8');
  const stop = fs.readFileSync(path.join(root, 'scripts', 'debloat-stop.sh'), 'utf8'),
    undo = fs.readFileSync(path.join(root, 'scripts', 'debloat-undo.sh'), 'utf8'),
    hostsSh = fs.readFileSync(path.join(root, 'scripts', 'debloat-hosts.sh'), 'utf8');
  ok(
    /mount --bind \/tmp\/cleanyourtv-hosts "\$HOSTS"/.test(hostsSh) &&
      /umount "\$HOSTS"/.test(hostsSh) &&
      /HOSTS=\$\{CYTV_HOSTS:-\/etc\/hosts\}/.test(hostsSh) &&
      /sh \$L\/debloat-hosts\.sh \$keep$/m.test(stop) &&
      /sh \$L\/debloat-hosts\.sh \$keep$/m.test(undo),
    'where /etc/hosts is read-only (issue 11) the servers go into a copy in RAM, unmounted when no line is left (debloat-hosts.sh)'
  );
  // the groups debloat-stop.sh and debloat-undo.sh act on: only the part that picks the programs is run here (it stops and mounts
  // nothing); admanager has its own group (adapps), on by default, and only while ads is on too
  const pick = (script, args, off) => {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-debloat-'));
    fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ options: { debloatOff: off || [] } }));
    const body = script.replace(/^L=.*$/m, 'L=' + d).split(/\n# --no-block|\nfor b in \$bins/)[0] + '\necho "units:$units bins:$bins"\n';
    fs.writeFileSync(path.join(d, 's.sh'), body);
    const r = cp.spawnSync('sh', [path.join(d, 's.sh')].concat(args || []), { encoding: 'utf8' });
    cp.spawnSync('rm', ['-rf', d]);
    return r.stdout.trim().replace(/\s+/g, ' ');
  };
  const all = pick(stop),
    adsOff = pick(stop, [], ['ads']),
    appsOff = pick(stop, [], ['adapps']),
    redoAds = pick(stop, ['ads'], []),
    undoAds = pick(undo, ['ads']);
  ok(
    / admanager/.test(all) &&
      / adoverlay-service/.test(all) &&
      / acr2/.test(all) &&
      !/admanager|adoverlay/.test(adsOff) &&
      !/admanager/.test(appsOff) &&
      / adoverlay-service/.test(appsOff) &&
      / admanager/.test(redoAds) &&
      / admanager/.test(undoAds),
    'admanager is its own group, on by default, off with ads too, back with ads, and undone with ads: ' +
      [all, adsOff, appsOff, redoAds, undoAds].join(' | ')
  );
  // LG's content miner from the start (the opt-in group "miner", options.debloatOn): stopped by systemd and its program stubbed (never
  // killed) only when switched on; the undo starts it again only when no group still holds it (suggestions or the miner still on)
  const pickOpt = (script, args, options) => {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-debloat-'));
    fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ options }));
    const body =
      script.replace(/^L=.*$/m, 'L=' + d).split(/\n# --no-block|\nfor b in \$bins/)[0] + '\necho "units:$units bins:$bins stubs:$stubs"\n';
    fs.writeFileSync(path.join(d, 's.sh'), body);
    const r = cp.spawnSync('sh', [path.join(d, 's.sh')].concat(args || []), { encoding: 'utf8' });
    cp.spawnSync('rm', ['-rf', d]);
    return r.stdout.trim().replace(/\s+/g, ' ');
  };
  const minerDefault = pickOpt(stop, [], {}),
    minerOn = pickOpt(stop, [], { debloatOn: ['miner'] }),
    minerAsked = pickOpt(stop, ['miner'], {}),
    minerAtBoot = pickOpt(stop, ['miner'], { debloatOn: ['miner'] }),
    minerOnly = pickOpt(stop, ['miner'], { debloatOn: ['miner'], debloatOff: ['suggestions'] });
  ok(
    !/stubs:.*contentminer/.test(minerDefault) &&
      /stubs: contentminer$/.test(minerOn) &&
      !/contentminer/.test(minerAsked) &&
      minerAtBoot === 'units: contentminer bins: stubs: contentminer' &&
      minerOnly === minerAtBoot &&
      !/bins:[^:]*contentminer/.test(minerOn),
    'the miner is stopped and stubbed (never killed) only when switched on; at boot alone it touches nothing else: ' +
      [minerDefault, minerOn, minerAsked, minerAtBoot].join(' | ')
  );
  const undoMinerSugOn = pickOpt(undo, ['miner'], { debloatOn: [] }),
    undoMinerSugOff = pickOpt(undo, ['miner'], { debloatOff: ['suggestions'] }),
    undoSugMinerOn = pickOpt(undo, ['suggestions'], { debloatOn: ['miner'], debloatOff: ['suggestions'] }),
    undoSugMinerOff = pickOpt(undo, ['suggestions'], { debloatOff: ['suggestions'] }),
    undoAll = pickOpt(undo, [], { debloatOn: ['miner'] });
  const startsMiner = x => /units:[^:]*contentminer/.test(x);
  ok(
    /bins: contentminer/.test(undoMinerSugOn) &&
      !startsMiner(undoMinerSugOn) &&
      startsMiner(undoMinerSugOff) &&
      !startsMiner(undoSugMinerOn) &&
      / nudge/.test(undoSugMinerOn) &&
      startsMiner(undoSugMinerOff) &&
      startsMiner(undoAll) &&
      /bins:[^:]*contentminer/.test(undoAll),
    'the undo unstubs the miner and starts it only when neither suggestions nor the miner group still holds it: ' +
      [undoMinerSugOn, undoMinerSugOff, undoSugMinerOn, undoSugMinerOff, undoAll].join(' | ')
  );
  const bootHook = fs.readFileSync(path.join(root, 'scripts', '15-cleanyourtv-debloat'), 'utf8');
  ok(
    /^\(home && sh \/media\/developer\/cleanyourtv\/debloat-stop\.sh miner lgservers\) [^\n]*&$/m.test(bootHook) &&
      bootHook.indexOf('debloat-stop.sh miner') < bootHook.indexOf('sleep 60') &&
      /DISABLE-DEBLOAT \] && exit 0/.test(bootHook.split('debloat-stop.sh miner')[0]),
    'the boot hook applies the opt-in groups at once (in the background), after the off switches and before the minute the rest waits'
  );
  // the ad servers of the TV's country (LG's Smart Service country, here US) join the list; old marked lines (the Dutch ones alone)
  // are written again, a second run adds nothing, and the undo takes them all out
  {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-hosts-'));
    const bin = path.join(d, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, 'luna-send'),
      '#!/bin/sh\nprintf \'{\\n "settings": {\\n  "smartServiceCountryCode2": "US"\\n }\\n}\\n\'\n',
      { mode: 0o755 }
    );
    fs.writeFileSync(path.join(d, 'config.json'), '{}');
    const hosts = path.join(d, 'hosts');
    fs.writeFileSync(
      hosts,
      '127.0.0.1 localhost\n127.0.0.1 eic.ads.lgtvcommon.com nl.ad.lgsmartad.com nl.info.lgsmartad.com # cleanyourtv-debloat\n'
    );
    const env = Object.assign({}, process.env, { CYTV_HOSTS: hosts, PATH: process.env.PATH + ':' + bin });
    fs.writeFileSync(path.join(d, 'debloat-hosts.sh'), hostsSh.replace(/^L=.*$/m, 'L=' + d));
    const runIt = (script, name) => {
      fs.writeFileSync(path.join(d, name), script.replace(/^L=.*$/m, 'L=' + d));
      return cp.spawnSync('sh', [path.join(d, name), 'ads'], { encoding: 'utf8', env });
    };
    runIt(stop, 'stop.sh');
    const once = fs.readFileSync(hosts, 'utf8');
    runIt(stop, 'stop.sh');
    const twice = fs.readFileSync(hosts, 'utf8');
    runIt(undo, 'undo.sh');
    const after = fs.readFileSync(hosts, 'utf8');
    cp.spawnSync('rm', ['-rf', d]);
    ok(
      /^127\.0\.0\.1 .*nl\.ad\.lgsmartad\.com.* us\.ad\.lgsmartad\.com us\.info\.lgsmartad\.com # cleanyourtv-debloat$/m.test(once) &&
        (once.match(/cleanyourtv-debloat/g) || []).length === 2 &&
        twice === once &&
        after === '127.0.0.1 localhost\n',
      "the TV's country's ad servers are blocked too (old lines written again, nothing added twice, all removed by the undo): " +
        JSON.stringify(once)
    );
  }
  // LG's online servers (the opt-in group lgservers): the hosts LG's sdx names on this TV for its own services (only LG's domains),
  // with the region's LG Channels and ThinQ hosts; the list kept for a start at which sdx does not answer yet; undoing ads keeps
  // them, undoing them keeps the ads, and the full undo leaves the TV's own file
  {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-lgservers-'));
    const bin = path.join(d, 'bin'),
      down = path.join(d, 'sdx-down');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, 'luna-send'),
      [
        '#!/bin/sh',
        'case "$*" in',
        '  *getSystemSettings*) printf \'{\\n "settings": {\\n  "smartServiceCountryCode2": "US"\\n }\\n}\\n\' ;;',
        '  *getServerUrl*)',
        '    [ -e "$SDX_DOWN" ] && { printf \'{"returnValue": false}\\n\'; exit 0; }',
        '    case "$*" in',
        '      *homeprv_secure*) u=https://AIC.tv.wiselg.com/homeprv/10.0.0/ ;;',
        '      *ibis_stat_secure*) u=https://US.ibsstat.nextlgsdp.com/ibs/10.0.0/ ;;',
        '      *rdx_secure*) u=https://evil.example.com/rdx/ ;;',
        '      *) u=https://AIC.api.lgtviot.com/v3.0/ ;;',
        '    esac',
        '    printf \'{\\n    "serverUrl": "http://US.nextlgsdp.com",\\n    "baseUrl": "%s"\\n}\\n\' "$u" ;;',
        'esac',
        '',
      ].join('\n'),
      { mode: 0o755 }
    );
    const hosts = path.join(d, 'hosts'),
      base = '127.0.0.1 localhost\n';
    fs.writeFileSync(hosts, base);
    const env = Object.assign({}, process.env, { CYTV_HOSTS: hosts, SDX_DOWN: down, PATH: bin + ':' + process.env.PATH });
    fs.writeFileSync(path.join(d, 'debloat-hosts.sh'), hostsSh.replace(/^L=.*$/m, 'L=' + d));
    fs.writeFileSync(path.join(d, 'stop.sh'), stop.replace(/^L=.*$/m, 'L=' + d));
    fs.writeFileSync(path.join(d, 'undo.sh'), undo.replace(/^L=.*$/m, 'L=' + d));
    const runIt = (name, args, options) => {
      fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ options }));
      cp.spawnSync('sh', [path.join(d, name)].concat(args), { encoding: 'utf8', env });
      return fs.readFileSync(hosts, 'utf8');
    };
    const marked = t => t.split('\n').filter(l => /# cleanyourtv-debloat$/.test(l));
    const on = runIt('stop.sh', ['lgservers'], { debloatOn: ['lgservers'] });
    const kept = fs.existsSync(path.join(d, 'lgservers-hosts')) ? fs.readFileSync(path.join(d, 'lgservers-hosts'), 'utf8') : '';
    const lgLine = marked(on).filter(l => /^127\.0\.0\.1 aic\.tv\.wiselg\.com /.test(l))[0] || '';
    const words = lgLine.split(' ');
    fs.writeFileSync(hosts, base);
    fs.writeFileSync(down, '');
    const fromKept = runIt('stop.sh', ['miner', 'lgservers'], { debloatOn: ['miner', 'lgservers'] });
    fs.unlinkSync(down);
    const adsUndone = runIt('undo.sh', ['ads'], { debloatOff: ['ads'], debloatOn: ['lgservers'] });
    const lgUndone = runIt('undo.sh', ['lgservers'], { debloatOff: [] });
    runIt('stop.sh', ['lgservers'], { debloatOn: ['lgservers'] });
    const all = runIt('undo.sh', [], { debloatOn: ['lgservers'] });
    const notOptedIn = runIt('stop.sh', ['lgservers'], {});
    cp.spawnSync('rm', ['-rf', d]);
    ok(
      marked(on).length === 4 &&
        [
          'aic.tv.wiselg.com',
          'us.ibsstat.nextlgsdp.com',
          'aic.api.lgtviot.com',
          'aic.lgchhomeapp.lgtvcommon.com',
          'aic.cdplauncher.lgtvcommon.com',
          'aic.cdpsvc.lgtvcommon.com',
          'aic.cdpbeacon.lgtvcommon.com',
          'aic-connect-client.lgthinq.com',
          'connect-client.lgthinq.com',
        ].every(h => words.indexOf(h) > 0) &&
        !/evil|us\.nextlgsdp\.com /.test(on) &&
        /us\.ad\.lgsmartad\.com/.test(on) &&
        kept.trim() === words.slice(1, -2).join(' '),
      "LG's online servers as sdx names them (LG's domains only, never the app store's host), with the ads, the list kept: " +
        JSON.stringify(marked(on))
    );
    ok(
      fromKept === on &&
        marked(adsUndone).length === 2 &&
        !/lgsmartad/.test(adsUndone) &&
        /aic\.tv\.wiselg\.com/.test(adsUndone) &&
        marked(lgUndone).length === 2 &&
        /lgsmartad/.test(lgUndone) &&
        !/wiselg/.test(lgUndone) &&
        all === base &&
        notOptedIn === '127.0.0.1 localhost\n' + marked(lgUndone).join('\n') + '\n',
      'sdx silent: the kept list; undoing ads keeps the servers, undoing the servers keeps the ads, the full undo leaves the file as ' +
        'it was, and the servers stay out unless switched on'
    );
  }
  // never these: LG's sdx (the Settings gear stops working) or ss.gateway (casting, second screen and quick cards stop), as
  // own-your-glass found out on webOS 25
  ok(!/sdx|ss\.gateway|ssgateway/.test(stop + undo), 'the debloat never touches sdx or ss.gateway');
  ok(
    !/(stop|kill|mount|umount)[^\n]*sdx/.test(hostsSh) && /getServerUrl/.test(hostsSh),
    'debloat-hosts.sh only asks sdx for the names of its servers; it never stops or stubs it'
  );
  ok(
    /TV="node \$S\/helper\/tvprofile\.js"/.test(bootText) &&
      /\$TV get notifyWindow/.test(bootText) &&
      /\$TV get testedNote/.test(bootText) &&
      /\$TV get homeSupported/.test(bootText) &&
      !/TESTED_SDK/.test(bootText),
    'the setup takes the window type and the compatibility list from tvprofile.js'
  );
  // the floor: bootstrap.sh asks tvprofile.js; its own Node.js check (before tvprofile.js runs) and install.sh (which runs before the
  // package is on the TV) have the same numbers
  const tvp = require(path.join(root, 'helper', 'tvprofile.js')),
    installText = fs.readFileSync(path.join(root, 'install.sh'), 'utf8'),
    num = (t, k) => parseInt((new RegExp('\\b' + k + '=(\\d+)').exec(t) || [])[1], 10);
  ok(
    /\$TV get supported/.test(bootText) &&
      num(bootText, 'MIN_NODE') === tvp.FLOOR.node &&
      num(installText, 'MIN_NODE') === tvp.FLOOR.node &&
      num(installText, 'MIN_SDK') === tvp.FLOOR.sdk,
    'bootstrap.sh and install.sh refuse below the floor of tvprofile.js (SDK ' + tvp.FLOOR.sdk + ', Node.js ' + tvp.FLOOR.node + ')'
  );
  // install.sh's own check, run with stand-ins for the TV's luna-send and node (the rest of install.sh needs root and downloads)
  {
    const I = path.join(tmp, 'inst'),
      ib = path.join(I, 'bin'),
      rep = path.join(I, 'reply.json');
    write(path.join(ib, 'luna-send'), '#!/bin/sh\ncat "' + rep + '"\n', 0o755);
    write(
      path.join(I, 'check.sh'),
      installText.replace(/\nmain "\$@"\s*$/, '\n') + '\nif why=$(too_old); then echo "old: $why"; else echo fine; fi\n'
    );
    const tooOld = (sdk, nodeV) => {
      fs.writeFileSync(rep, JSON.stringify(Object.assign({ returnValue: true }, sdk ? { sdkVersion: sdk } : {})));
      write(
        path.join(ib, 'node'),
        '#!/bin/sh\ncase "$1" in -v|--version) echo ' + nodeV + '; exit 0 ;; esac\nexec "' + process.execPath + '" "$@"\n',
        0o755
      );
      return cp
        .spawnSync('sh', [path.join(I, 'check.sh')], {
          encoding: 'utf8',
          env: Object.assign({}, process.env, { PATH: ib + ':' + process.env.PATH }),
        })
        .stdout.trim();
    };
    const res = [
      tooOld('10.3.2', 'v16.20.2'),
      tooOld('11.2.0', 'v20.12.2'),
      tooOld('', 'v16.20.2'),
      tooOld('9.2.4', 'v16.19.1'),
      tooOld('6.5.3', 'v8.12.0'),
      tooOld('10.3.2', 'v12.22.2'),
    ];
    ok(
      res[0] === 'fine' &&
        res[1] === 'fine' &&
        res[2] === 'fine' &&
        /^old: .*webOS SDK 9\.2\.4/.test(res[3]) &&
        /^old: .*Node\.js \(v8\.12\.0\)/.test(res[4]) &&
        /^old: .*Node\.js \(v12\.22\.2\)/.test(res[5]),
      'install.sh installs nothing on a TV below webOS 25 or with a Node.js older than 16; an unread version is left to the setup: ' +
        res.join(' | ')
    );
  }

  // the watchdog (watchdog.sh) starts a service that has stopped again, keeps the log of the run that ended, and stops when
  // CleanYourTV is gone. A stand-in service that only counts its starts; the address it asks answers nothing.
  const W = path.join(tmp, 'wd'),
    mark = path.join(W, 'starts'),
    slog = path.join(W, 'helper.log'),
    blog = path.join(W, 'boot.log');
  fs.mkdirSync(W);
  fs.writeFileSync(
    path.join(W, 'helper.js'),
    "require('fs').appendFileSync(process.env.WD_MARK, 'start\\n'); setInterval(function () {}, 1000);\n"
  );
  fs.writeFileSync(slog, 'the run that ended\n');
  const starts = () => (fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8').split('\n').filter(Boolean).length : 0);
  const kill = () => cp.spawnSync('pkill', ['-f', W + '/helper.js']);
  const wd = cp.spawn('sh', [path.join(root, 'scripts', 'watchdog.sh')], {
    env: Object.assign({}, process.env, {
      CYTV_DIR: W,
      CYTV_BOOT_LOG: blog,
      CYTV_SERVICE_LOG: slog,
      CYTV_SERVICE_URL: 'http://127.0.0.1:9/none',
      CYTV_WATCH_SECS: '1',
      WD_MARK: mark,
    }),
    stdio: 'ignore',
  });
  let exited = false;
  wd.on('exit', () => (exited = true));
  for (let i = 0; i < 40 && starts() < 1; i++) await sleep(100);
  await sleep(2500);
  ok(
    starts() === 1 &&
      /watchdog: the service had stopped; starting it again/.test(fs.readFileSync(blog, 'utf8')) &&
      fs.readFileSync(path.join(W, 'helper.crash.log'), 'utf8') === 'the run that ended\n',
    'the watchdog starts a stopped service once, says so in the boot log and keeps the log of the run that ended'
  );
  kill();
  for (let i = 0; i < 40 && starts() < 2; i++) await sleep(100);
  ok(starts() === 2, 'it starts the service again each time it stops');
  fs.unlinkSync(path.join(W, 'helper.js'));
  for (let i = 0; i < 40 && !exited; i++) await sleep(100);
  kill();
  if (!exited) wd.kill();
  ok(exited, 'the watchdog ends when CleanYourTV is no longer installed');
  // a service that stops at once every time: started at most CYTV_WATCH_MAX times in ten minutes, then left alone with a note,
  // and the crash log of the first stop is kept
  {
    const W2 = path.join(tmp, 'wd2'),
      mark2 = path.join(W2, 'starts'),
      blog2 = path.join(W2, 'boot.log'),
      slog2 = path.join(W2, 'helper.log');
    fs.mkdirSync(W2);
    fs.writeFileSync(path.join(W2, 'helper.js'), "require('fs').appendFileSync(process.env.WD_MARK, 'start\\n'); console.log('crash');\n");
    fs.writeFileSync(slog2, 'the first crash\n');
    const n2 = () => (fs.existsSync(mark2) ? fs.readFileSync(mark2, 'utf8').split('\n').filter(Boolean).length : 0);
    const wd2 = cp.spawn('sh', [path.join(root, 'scripts', 'watchdog.sh')], {
      env: Object.assign({}, process.env, {
        CYTV_DIR: W2,
        CYTV_BOOT_LOG: blog2,
        CYTV_SERVICE_LOG: slog2,
        CYTV_SERVICE_URL: 'http://127.0.0.1:9/none',
        CYTV_WATCH_SECS: '1',
        CYTV_WATCH_MAX: '2',
        WD_MARK: mark2,
      }),
      stdio: 'ignore',
    });
    for (let i = 0; i < 60 && !/not starting it again/.test(fs.existsSync(blog2) ? fs.readFileSync(blog2, 'utf8') : ''); i++)
      await sleep(100);
    await sleep(1500);
    const log2 = fs.readFileSync(blog2, 'utf8');
    wd2.kill();
    ok(
      n2() === 2 &&
        /stopped 2 times in 10 minutes; not starting it again/.test(log2) &&
        (log2.match(/not starting it again/g) || []).length === 1 &&
        fs.readFileSync(path.join(W2, 'helper.crash.log'), 'utf8') === 'the first crash\n',
      'a service that keeps stopping is started at most the limit, then left with one note; the first crash log is kept: ' + n2()
    );
  }
});
