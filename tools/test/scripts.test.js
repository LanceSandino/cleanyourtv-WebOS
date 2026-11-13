// The shell side: the scripts parse, and the setup keeps the options the user chose (issues 6 and 7).
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, helper, tmp, ok, run, sleep } = require('./lib');

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
    tvInfo = (sdk, firmware, model) =>
      fs.writeFileSync(
        reply,
        JSON.stringify(
          Object.assign(
            { returnValue: true, modelName: model || 'OLED65G26LA', firmwareVersion: firmware || '33.99.10' },
            sdk ? { sdkVersion: sdk } : {}
          )
        )
      );
  write(path.join(BIN, 'luna-send'), '#!/bin/sh\ncat "' + reply + '"\n', 0o755);
  write(path.join(BIN, 'systemctl'), '#!/bin/sh\nexit 0\n', 0o755);
  // a Node.js that says it is 8.12 (webOS 5 and 6), ahead of the real one on PATH; bootstrap.sh puts /usr/bin and /bin first
  const fakeNode = v => {
    const dir = path.join(tmp, 'node-' + v);
    write(
      path.join(dir, 'node'),
      '#!/bin/sh\ncase "$1" in -v|--version) echo ' + v + '; exit 0 ;; esac\nexec "' + process.execPath + '" "$@"\n',
      0o755
    );
    return dir;
  };
  // and one that says it is 12.21.0, as webOS 22 has
  const NODE8 = fakeNode('v8.12.0'),
    NODE12 = fakeNode('v12.21.0');
  const systemNode = ['/usr/bin/node', '/usr/sbin/node', '/bin/node', '/sbin/node'].some(f => fs.existsSync(f));
  const boot = (args, nodeDir) =>
    cp.spawnSync('sh', [path.join(S, 'bootstrap.sh')].concat(args), {
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        PATH: (nodeDir ? nodeDir + ':' : '') + process.env.PATH + ':' + BIN,
        CYTV_TEST_ROOT: R,
      }),
      timeout: 60000,
    });
  const D = path.join(R, 'media/developer/cleanyourtv');
  // below the floor (webOS 22, SDK 7, Node.js 12: DECISIONS.md D-20261101-1) the setup stops before it changes anything,
  // --force or not; only a TV whose version could not be read can be set up anyway
  let b;
  for (const c of [
    ['webOS 5 (SDK 5.4.3)', '5.4.3', []],
    ['webOS 6 (SDK 6.5.3), also with --force', '6.5.3', ['--force']],
  ]) {
    tvInfo(c[1]);
    b = boot(['install', '--no-start'].concat(c[2]));
    const refused =
      b.status !== 0 &&
      new RegExp('webOS SDK ' + c[1].replace(/\./g, '\\.') + '.*needs webOS 22 \\(SDK 7\\) or newer').test(b.stderr) &&
      /Nothing was changed/.test(b.stderr) &&
      !fs.existsSync(D);
    ok(refused, c[0] + ': the setup refuses the TV and changes nothing' + (refused ? '' : ': ' + (b.stdout + b.stderr).trim().slice(-300)));
  }
  tvInfo('10.3.2');
  if (systemNode) console.log('     skipped: a Node.js in /usr/bin or /bin comes before the stand-in Node.js 8.12');
  else {
    b = boot(['install', '--no-start', '--force'], NODE8);
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
    /needs webOS 22 \(SDK 7\) or newer/.test(b.stderr) &&
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
  // webOS 22, the oldest supported (DECISIONS.md D-20261101-1): the owner's second TV, an 86UQ8000AUB with firmware 04.60.91 and
  // Node.js 12.21, a firmware the compatibility list has (43NANO786QA, issue 31). With LG's native Home it is set up without --force,
  // and the notification app gets the overlay window (an app of the topui type does not start before SDK 10)
  if (systemNode) console.log('     skipped: a Node.js in /usr/bin or /bin comes before the stand-in Node.js 12.21');
  else {
    fs.unlinkSync(path.join(D, 'backup', 'home-appinfo.orig.json'));
    fs.writeFileSync(NA, JSON.stringify({ id: 'com.cleanyourtv.notify', defaultWindowType: 'topui' }));
    tvInfo('7.6.0', '04.60.91', '86UQ8000AUB');
    b = boot(['install', '--no-start', '--no-input-key'], NODE12);
    const out22 = b.stdout + b.stderr;
    ok(
      b.status === 0 &&
        /webOS SDK 7\.6\.0/.test(out22) &&
        /this firmware is in the compatibility list \(43NANO786QA, webOS 22/.test(out22) &&
        /LG's Home app is 'native'/.test(out22) &&
        !/--force/.test(out22) &&
        JSON.parse(fs.readFileSync(NA, 'utf8')).defaultWindowType === 'overlay' &&
        /picture notifications use the overlay window/.test(out22),
      'webOS 22 with Node.js 12.21 and the native Home (firmware 04.60.91, in the list) is set up without --force, with the overlay ' +
        'notification window' +
        (b.status === 0 ? '' : ': ' + out22.slice(-400))
    );
  }
  tvInfo('10.3.2');

  // bootstrap.sh asks tvprofile.js for the per-TV decisions instead of deciding itself
  const bootText = fs.readFileSync(path.join(root, 'scripts', 'bootstrap.sh'), 'utf8');
  const stop = fs.readFileSync(path.join(root, 'scripts', 'debloat-stop.sh'), 'utf8'),
    undo = fs.readFileSync(path.join(root, 'scripts', 'debloat-undo.sh'), 'utf8'),
    hostsSh = fs.readFileSync(path.join(root, 'scripts', 'debloat-hosts.sh'), 'utf8');
  ok(
    /mount --bind "\$COPY" "\$HOSTS"/.test(hostsSh) &&
      /COPY=\$\{CYTV_HOSTS_COPY:-\/tmp\/cleanyourtv-hosts\}/.test(hostsSh) &&
      /umount "\$HOSTS"/.test(hostsSh) &&
      /HOSTS=\$\{CYTV_HOSTS:-\/etc\/hosts\}/.test(hostsSh) &&
      /sh \$L\/debloat-hosts\.sh \$keep$/m.test(stop) &&
      /sh \$L\/debloat-hosts\.sh \$keep$/m.test(undo),
    'where /etc/hosts is read-only (issue 11) the servers go into a copy in RAM, unmounted when no line is left (debloat-hosts.sh)'
  );
  // the copy in RAM is unmounted only while it is what /etc/hosts shows (test -ef): a table another tool mounted over it later
  // (Glasshouse, the Homebrew Channel's update block, upstream issue 87) stays, and the lines go into the file it shows. Run for real
  // with a stand-in umount and mount that only note their call
  {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-hoststop-'));
    const bin = path.join(d, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'umount'), '#!/bin/sh\necho "umount $*" >> "$CALLS"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'mount'), '#!/bin/sh\necho "mount $*" >> "$CALLS"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'luna-send'), '#!/bin/sh\necho "{}"\n', { mode: 0o755 });
    const hosts = path.join(d, 'hosts'),
      copy = path.join(d, 'copy'),
      calls = path.join(d, 'calls');
    const script = path.join(d, 'debloat-hosts.sh');
    fs.writeFileSync(script, hostsSh.replace(/^L=.*$/m, 'L=' + d));
    const env = Object.assign({}, process.env, {
      CYTV_HOSTS: hosts,
      CYTV_HOSTS_COPY: copy,
      CALLS: calls,
      CYTV_TEST_BIN: bin,
    });
    const runHosts = () => {
      fs.writeFileSync(calls, '');
      cp.spawnSync('sh', [script], { env });
      return fs.readFileSync(calls, 'utf8');
    };
    const ad = '127.0.0.1 eic.ads.lgtvcommon.com # cleanyourtv-debloat\n';
    // ours on top: the same file (a hard link stands in for the bind mount)
    fs.writeFileSync(copy, '127.0.0.1 localhost\n' + ad);
    fs.linkSync(copy, hosts);
    fs.writeFileSync(copy + '.mounted', '');
    const a = runHosts();
    const aGone = !fs.existsSync(copy) && !fs.existsSync(copy + '.mounted');
    // another table mounted over ours (a different file shows): nothing is unmounted, our lines leave the file it shows
    for (const f of [hosts, copy]) if (fs.existsSync(f)) fs.unlinkSync(f);
    fs.writeFileSync(copy, '127.0.0.1 localhost\n' + ad);
    fs.writeFileSync(copy + '.mounted', '');
    fs.writeFileSync(hosts, '0.0.0.0 update.lge.com\n' + ad);
    const b = runHosts();
    const bHosts = fs.readFileSync(hosts, 'utf8');
    cp.spawnSync('rm', ['-rf', d]);
    ok(
      a === 'umount ' + hosts + '\n' && aGone && b === '' && bHosts === '0.0.0.0 update.lge.com\n',
      "the hosts copy in RAM is unmounted only while it is on top; another tool's table over it stays mounted: " +
        JSON.stringify([a, aGone, b, bHosts])
    );
  }
  // the groups debloat-stop.sh and debloat-undo.sh act on: only the part that picks the programs is run here (it stops and mounts
  // nothing); admanager has its own group (adapps), on by default, and only while ads is on too, and only on webOS 25 and newer (the
  // TV's version from its os-release, webOS 25 unless a check says otherwise)
  const pick = (script, args, off, sdk) => {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-debloat-'));
    fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ options: { debloatOff: off || [] } }));
    fs.writeFileSync(path.join(d, 'os-release'), sdk === null ? '' : 'NAME="webOS"\nVERSION_ID=' + (sdk || '10.3.2') + '\n');
    const body =
      script.replace(/^L=.*$/m, 'L=' + d).split(/\n# --no-block|\nfor b in \$bins/)[0] + '\necho "units:$units bins:$bins hide:$hide"\n';
    fs.writeFileSync(path.join(d, 's.sh'), body);
    const env = Object.assign({}, process.env, {
      CYTV_TVPROFILE: path.join(helper, 'tvprofile.js'),
      CYTV_OS_RELEASE: path.join(d, 'os-release'),
      PATH: path.dirname(process.execPath) + ':' + process.env.PATH,
    });
    const r = cp.spawnSync('sh', [path.join(d, 's.sh')].concat(args || []), { encoding: 'utf8', env });
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
  // webOS 22: admanager stubbed and its service entry hidden from LG's hub (a call to a stubbed service waited for ever there: Disney+
  // stayed on its logo); webOS 25: stubbed only; a TV whose version cannot be read: left running, the rest of the ads group applies
  const w22 = pick(stop, [], [], '7.6.0'),
    w22off = pick(stop, [], ['adapps'], '7.6.0'),
    noVersion = pick(stop, [], [], null);
  ok(
    / admanager/.test(w22) &&
      /hide:1$/.test(w22) &&
      / admanager/.test(all) &&
      /hide:$/.test(all) &&
      !/admanager/.test(w22off) &&
      /hide:$/.test(w22off) &&
      !/admanager/.test(noVersion) &&
      / adoverlay-service/.test(noVersion),
    'admanager hidden as well on webOS 22, stubbed on webOS 25, left where the version is unknown: ' +
      [w22, all, w22off, noVersion].join(' | ')
  );
  // the hiding itself: an empty file over both .service files, then LG's hub rescans; the undo unmounts them and rescans
  ok(
    /mount --bind \$L\/empty\.service \$f/.test(stop) &&
      /com\.webos\.service\.admanager\.service/.test(stop) &&
      /ls-control scan-services/.test(stop) &&
      /umount \$f/.test(undo) &&
      /ls-control scan-services/.test(undo),
    "the debloat hides admanager's service files and the undo shows them again, each time telling LG's hub to rescan"
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
  // the daemons added after own-your-glass's list, read on the owner's 86UR8000 (webOS 25): LG's crash and log reports (rdxd makes
  // them, uploadd sends them) with the logs, livepick-plus (shopping overlays from ACR) with the tracking, nudge stubbed instead of
  // stopped (it ignores SIGTERM: systemd waited 90 s), LG's unused network services (cups-lpd's socket on 515, ninfod) as a group
  const lanOff = pick(stop, [], ['lan']),
    undoLan = pick(undo, ['lan']),
    undoLogs = pick(undo, ['logs']),
    undoSug = pick(undo, ['suggestions']);
  const unitsOf = x => x.split('bins:')[0],
    binsOf = x => x.split('bins:')[1] || '';
  ok(
    / rdxd/.test(unitsOf(all)) &&
      / uploadd/.test(binsOf(all)) &&
      / livepick-plus/.test(binsOf(all)) &&
      / nudge/.test(binsOf(all)) &&
      !/nudge/.test(unitsOf(all)) &&
      / cups-lpd\.socket ninfod/.test(all) &&
      !/cups-lpd|ninfod/.test(lanOff) &&
      / cups-lpd\.socket ninfod/.test(undoLan) &&
      / rdxd/.test(unitsOf(undoLogs)) &&
      / uploadd/.test(binsOf(undoLogs)) &&
      / nudge/.test(unitsOf(undoSug)) &&
      / nudge/.test(binsOf(undoSug)),
    'the new daemons: rdxd stopped and uploadd stubbed (logs), livepick-plus stubbed (tracking), nudge stubbed and started again ' +
      'by the undo, cups-lpd.socket and ninfod stopped (lan): ' +
      [all, lanOff, undoLan, undoLogs, undoSug].join(' | ')
  );
  const typed = /case \$s in \*\.\*\) u=\$s ;; \*\) u=\$s\.service ;; esac/;
  ok(
    typed.test(stop) && typed.test(undo),
    'a unit named with its type (cups-lpd.socket) is stopped and started as it is, the others as .service'
  );
  ok(
    /mv -f \$L\/stub-noop\.new \$L\/stub-noop/.test(stop) && !/> \$L\/stub-noop;/.test(stop),
    'the stub mounted over LG programs is never written over in place: only when it differs, beside it and renamed (D-20261029-2)'
  );
  // the boot hook, run for real with stand-ins for debloat-stop.sh and debloat-undo.sh: the early run from 10-cleanyourtv-home
  // applies it at once; the Homebrew Channel's run lifts it if Home was not taken over, else applies it again once LG's boot is done
  {
    const B = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-boothook-'));
    const calls = path.join(B, 'calls'),
      mounts = path.join(B, 'mounts'),
      done = path.join(B, 'boot-done'),
      early = path.join(B, 'early');
    fs.writeFileSync(path.join(B, 'debloat-stop.sh'), 'echo "stop $*" >> "' + calls + '"\n');
    fs.writeFileSync(path.join(B, 'debloat-undo.sh'), 'echo "undo $*" >> "' + calls + '"\n');
    const hook = (args, setup) => {
      for (const f of [calls, mounts, done, early, path.join(B, 'DISABLE-DEBLOAT')]) cp.spawnSync('rm', ['-f', f]);
      fs.writeFileSync(mounts, setup.home ? 'x /usr/palm/applications/com.webos.app.home tmpfs rw 0 0\n' : 'x / ext4 rw 0 0\n');
      if (setup.early) fs.writeFileSync(early, '');
      if (setup.done) fs.writeFileSync(done, '');
      if (setup.off) fs.writeFileSync(path.join(B, 'DISABLE-DEBLOAT'), '');
      cp.spawnSync('sh', [path.join(root, 'scripts', '15-cleanyourtv-debloat')].concat(args), {
        env: Object.assign({}, process.env, {
          CYTV_DIR: B,
          CYTV_BOOT_LOG: path.join(B, 'boot.log'),
          CYTV_DEBLOAT_EARLY: early,
          CYTV_BOOT_DONE: done,
          CYTV_MOUNTS: mounts,
          CYTV_BOOT_WAIT: '3',
        }),
        stdio: 'ignore',
      });
    };
    const got = () =>
      fs.existsSync(calls)
        ? fs
            .readFileSync(calls, 'utf8')
            .trim()
            .split('\n')
            .map(l => l.trim())
            .join(', ')
        : '';
    const settle = async (want, ms) => {
      for (let i = 0; i < ms / 100 && got() !== want; i++) await sleep(100);
      await sleep(300);
      return got();
    };
    hook(['early'], {});
    const e1 = await settle('stop', 3000),
      e1Marked = fs.existsSync(early);
    hook([], { home: true, early: true, done: true });
    const h1 = await settle('stop', 3000);
    hook([], { home: true, early: true });
    await sleep(500);
    const waiting = got();
    fs.writeFileSync(done, '');
    const h2 = await settle('stop', 5000);
    hook([], { home: false, early: true, done: true });
    const lifted = await settle('undo', 3000);
    hook([], { home: false, done: true });
    const untouched = await settle('-', 1000);
    hook([], { home: true, done: true });
    const noEarly = await settle('stop, stop', 3000);
    hook(['early'], { off: true });
    const disabled = await settle('-', 1000);
    cp.spawnSync('rm', ['-rf', B]);
    ok(
      e1 === 'stop' &&
        e1Marked &&
        h1 === 'stop' &&
        waiting === '' &&
        h2 === 'stop' &&
        lifted === 'undo' &&
        untouched === '' &&
        noEarly === 'stop, stop' &&
        disabled === '',
      "boot hook: early applies at once; after it, the second run waits for LG's boot-done and applies once more; Home not taken " +
        'over lifts it (only if the early run applied it); without the early run it applies at once and again; DISABLE-DEBLOAT: ' +
        'nothing: ' +
        JSON.stringify([e1, h1, waiting, h2, lifted, untouched, noEarly, disabled])
    );
  }
  // 10-cleanyourtv-home at boot (no argument): LG's web inspector closed with WebAppMgr's one restart in the background, the debloat's
  // early run before Home is staged, and the restart over before Home is taken over (sam restarted, or the stand-in mounted); the setup
  // and an update only mount the copy and do not start the debloat early
  {
    const h = fs.readFileSync(path.join(root, 'scripts', '10-cleanyourtv-home'), 'utf8');
    const at = t => h.indexOf(t);
    ok(
      at('sh $L/devtools-close.sh restart </dev/null >/dev/null 2>&1 &') > 0 &&
        at('sh $L/devtools-close.sh restart') < at('[ -e $L/DISABLE ] && exit 0') &&
        /if \[ -z "\$1" \] && \[ -z "\$FAST" \]; then\n {2}sh \$L\/devtools-close\.sh restart/.test(h) &&
        /else\n {2}sh \$L\/devtools-close\.sh <\/dev\/null/.test(h) &&
        /\[ -z "\$1" \] && \[ -e \$INITD\/15-cleanyourtv-debloat \] && sh \$L\/15-cleanyourtv-debloat early/.test(h) &&
        at('sh $L/15-cleanyourtv-debloat early') > at('[ -e $L/DISABLE ] && exit 0') &&
        at('sh $L/15-cleanyourtv-debloat early') < at('sh $L/stage-home.sh') &&
        at('wait $DT') > at('sh $L/stage-home.sh') &&
        at('wait $DT') < at('mount --bind $L/home-standin.sh "$EXE" ||') &&
        at('wait $DT') < at('mount --bind $L/home-overlay $H') &&
        at('wait $DT') < at('systemctl restart sam') &&
        /10-cleanyourtv-home setup <\/dev\/null/.test(bootText),
      "10-cleanyourtv-home: at boot WebAppMgr's restart (before sam's) and the early debloat; setup and update only mount the copy"
    );
  }
  // devtools-close.sh and devtools-undo.sh run for real against a stand-in for LG's start script, /proc/mounts, /proc/<pid>/cmdline and
  // mount, umount, systemctl and luna-send (the webOS version): the copy has no --remote-debugging-port, it is mounted once, WebAppMgr is
  // restarted once (only when it runs with the port, and only on webOS 25 and newer: tvprofile.js devtoolsRestart), and the undo
  // removes the mount and the copy
  {
    const W = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cytv-devtools-')),
      wb = path.join(W, 'bin'),
      wp = path.join(W, 'proc');
    fs.mkdirSync(wb);
    fs.mkdirSync(path.join(wp, '100'), { recursive: true });
    const S = path.join(W, 'webapp-mgr.sh'),
      C = path.join(W, 'tmp-copy.sh'),
      M = path.join(W, 'mounts'),
      SLOG = path.join(W, 'systemctl.log'),
      PIDF = path.join(W, 'mainpid'),
      SDKF = path.join(W, 'sdk');
    // the shape of LG's script on webOS 25: the switches in one quoted variable, a backslash at the end of each line
    const LG = [
      '#!/bin/sh',
      'export WAM_EXE_PATH="/usr/bin/WebAppMgr"',
      'export WAM_COMMON_SWITCHES=" \\',
      '    --ozone-platform=wayland \\',
      '    --remote-debugging-port=9998 \\',
      '    --touch-events=disabled \\',
      '    "',
      'exec $WAM_EXE_PATH $WAM_COMMON_SWITCHES',
      '',
    ].join('\n');
    const stand = (name, body) => {
      fs.writeFileSync(path.join(wb, name), '#!/bin/sh\n' + body + '\n');
      fs.chmodSync(path.join(wb, name), 0o755);
    };
    // mount --bind <copy> <script> adds a line; umount <script> takes it out; a restart starts WebAppMgr as the script then at
    // <script> would: from the copy while it is mounted, else from LG's own
    stand('mount', 'echo "tmpfs $3 tmpfs rw 0 0" >> "' + M + '"');
    // LG's system properties: the webOS version in SDKF
    stand('luna-send', 'printf \'{"returnValue": true, "sdkVersion": "%s"}\\n\' "$(cat "' + SDKF + '")"');
    stand('umount', 'grep -v " $1 " "' + M + '" > "' + M + '.new"; mv "' + M + '.new" "' + M + '"');
    stand(
      'systemctl',
      [
        'echo "$*" >> "' + SLOG + '"',
        'case "$*" in',
        '  "show -p MainPID --value webapp-mgr.service") cat "' + PIDF + '" ;;',
        '  "is-active webapp-mgr.service") echo active ;;',
        '  *restart*)',
        '    n=$(( $(cat "' + PIDF + '") + 1 )); mkdir -p "' + wp + '/$n"',
        '    src="' + S + '"; grep -q " ' + S + ' " "' + M + '" && src="' + C + '"',
        '    printf "/usr/bin/WebAppMgr\\0%s\\0" "$(grep -o -- "--remote-debugging-port=[0-9]*" "$src")" > "' + wp + '/$n/cmdline"',
        '    echo $n > "' + PIDF + '" ;;',
        'esac',
      ].join('\n')
    );
    const env = {
      CYTV_TEST_BIN: wb,
      CYTV_DIR: W,
      CYTV_WAM_SCRIPT: S,
      CYTV_WAM_COPY: C,
      CYTV_MOUNTS: M,
      CYTV_PROC: wp,
      CYTV_BOOT_LOG: path.join(W, 'boot.log'),
      CYTV_WAM_WAIT: '5',
      CYTV_TVPROFILE: path.join(helper, 'tvprofile.js'),
    };
    const reset = (lg, withPort, sdk) => {
      for (const f of [C, SLOG, path.join(W, 'devtools-open'), path.join(W, 'boot.log')]) cp.spawnSync('rm', ['-f', f]);
      fs.writeFileSync(SDKF, sdk === undefined ? '10.2.2' : sdk);
      fs.writeFileSync(S, lg);
      fs.writeFileSync(M, 'overlay /etc overlay ro 0 0\n');
      fs.writeFileSync(path.join(wp, '100', 'cmdline'), '/usr/bin/WebAppMgr\0' + (withPort ? '--remote-debugging-port=9998\0' : ''));
      fs.writeFileSync(PIDF, '100\n');
    };
    const sh = (script, args) =>
      cp.spawnSync('sh', [path.join(root, 'scripts', script)].concat(args || []), {
        encoding: 'utf8',
        env: Object.assign({}, process.env, env),
      }).status;
    const mounts = () => fs.readFileSync(M, 'utf8').split(' ' + S + ' ').length - 1;
    const restarts = () => (fs.existsSync(SLOG) ? (fs.readFileSync(SLOG, 'utf8').match(/restart webapp-mgr/g) || []).length : 0);
    const running = () => fs.readFileSync(path.join(wp, fs.readFileSync(PIDF, 'utf8').trim(), 'cmdline'), 'utf8');
    reset(LG, true);
    const first = sh('devtools-close.sh', ['restart']);
    const copy = fs.existsSync(C) ? fs.readFileSync(C, 'utf8') : '';
    const copyParses = cp.spawnSync('sh', ['-n', C]).status === 0;
    const after1 = { mounts: mounts(), restarts: restarts(), running: running() };
    const second = sh('devtools-close.sh', ['restart']);
    const after2 = { mounts: mounts(), restarts: restarts() };
    const undone = sh('devtools-undo.sh');
    const after3 = { mounts: mounts(), copy: fs.existsSync(C) };
    ok(
      first === 0 &&
        !/remote-debugging-port/.test(copy) &&
        copy === LG.replace('    --remote-debugging-port=9998 \\', ' \\') &&
        copyParses &&
        after1.mounts === 1 &&
        after1.restarts === 1 &&
        !/remote-debugging-port/.test(after1.running) &&
        second === 0 &&
        after2.mounts === 1 &&
        after2.restarts === 1 &&
        undone === 0 &&
        after3.mounts === 0 &&
        !after3.copy,
      'devtools-close.sh: the copy has no --remote-debugging-port and parses, is mounted once, WebAppMgr restarted once and then ' +
        'runs without the port; a second run changes nothing; devtools-undo.sh removes the mount and the copy: ' +
        JSON.stringify([first, after1, second, after2, undone, after3])
    );
    // without "restart" (the setup, an update, the manager's switch): mounted, WebAppMgr left as it runs
    reset(LG, true);
    sh('devtools-close.sh');
    const noRestart = { mounts: mounts(), restarts: restarts() };
    sh('devtools-undo.sh');
    // switched off in the manager (D/devtools-open): nothing; LG's script without the switch (a later firmware): nothing either
    reset(LG, true);
    fs.writeFileSync(path.join(W, 'devtools-open'), '');
    sh('devtools-close.sh', ['restart']);
    const optedOut = { mounts: mounts(), restarts: restarts(), copy: fs.existsSync(C) };
    reset(LG.replace('    --remote-debugging-port=9998 \\\n', ''), false);
    sh('devtools-close.sh', ['restart']);
    const noFlag = { mounts: mounts(), restarts: restarts(), copy: fs.existsSync(C) };
    // a WebAppMgr already without the port: the copy mounted, WebAppMgr not restarted
    reset(LG, false);
    sh('devtools-close.sh', ['restart']);
    const alreadyClosed = { mounts: mounts(), restarts: restarts() };
    // webOS 22 (and a version that cannot be read): the restart was not tried there, so the copy is mounted and WebAppMgr left running
    const older = ['7.6.0', ''].map(sdk => {
      reset(LG, true, sdk);
      const st = sh('devtools-close.sh', ['restart']);
      const r = { sdk, status: st, mounts: mounts(), restarts: restarts(), log: fs.readFileSync(path.join(W, 'boot.log'), 'utf8') };
      sh('devtools-undo.sh');
      return r;
    });
    cp.spawnSync('rm', ['-rf', W]);
    ok(
      older.every(r => r.status === 0 && r.mounts === 1 && r.restarts === 0 && /WebAppMgr is not restarted on webOS SDK/.test(r.log)),
      'devtools-close.sh on webOS 22 or an unknown version: the copy is mounted, WebAppMgr is not restarted, and the boot log says so: ' +
        JSON.stringify(older.map(r => [r.sdk, r.status, r.mounts, r.restarts]))
    );
    ok(
      noRestart.mounts === 1 &&
        noRestart.restarts === 0 &&
        optedOut.mounts === 0 &&
        optedOut.restarts === 0 &&
        !optedOut.copy &&
        noFlag.mounts === 0 &&
        noFlag.restarts === 0 &&
        !noFlag.copy &&
        alreadyClosed.mounts === 1 &&
        alreadyClosed.restarts === 0,
      "devtools-close.sh: no restart unless asked and WebAppMgr has the port; nothing while switched off or when LG's script has no " +
        'port: ' +
        JSON.stringify([noRestart, optedOut, noFlag, alreadyClosed])
    );
  }
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
      tooOld('7.6.0', 'v12.21.0'),
      tooOld('9.2.4', 'v16.19.1'),
      tooOld('6.5.3', 'v8.12.0'),
      tooOld('6.5.3', 'v12.21.0'),
      tooOld('7.6.0', 'v11.15.0'),
    ];
    ok(
      res[0] === 'fine' &&
        res[1] === 'fine' &&
        res[2] === 'fine' &&
        res[3] === 'fine' &&
        res[4] === 'fine' &&
        /^old: .*Node\.js \(v8\.12\.0\)/.test(res[5]) &&
        /^old: .*webOS SDK 6\.5\.3/.test(res[6]) &&
        /^old: .*Node\.js \(v11\.15\.0\)/.test(res[7]),
      'install.sh installs on webOS 22 (SDK 7, Node.js 12.21) and newer, nothing on webOS 6 or with a Node.js older than 12; an unread ' +
        'version is left to the setup: ' +
        res.join(' | ')
    );
  }

  // the watchdog (watchdog.sh): starts a service that has stopped again, keeps the logs of the runs that ended, starts less often a
  // service that stops at once and gives up after the limit, survives its own file being replaced by an update, and ends when
  // CleanYourTV is gone. A stand-in service counts its starts and writes "run <n>" to its log; the address the watchdog asks answers
  // nothing. Everything waits for what it expects (up to 15 s) instead of for a fixed time, so a slow machine does not fail it.
  const waitFor = async (cond, ms) => {
    for (let t = 0; t < (ms || 15000) && !cond(); t += 100) await sleep(100);
    return cond();
  };
  const watch = (dir, script, extra) => {
    const w = cp.spawn('sh', [script], {
      env: Object.assign(
        {},
        process.env,
        {
          CYTV_DIR: dir,
          CYTV_BOOT_LOG: path.join(dir, 'boot.log'),
          CYTV_SERVICE_LOG: path.join(dir, 'helper.log'),
          CYTV_SERVICE_URL: 'http://127.0.0.1:9/none',
          CYTV_WATCH_SECS: '1',
          WD_MARK: path.join(dir, 'starts'),
        },
        extra || {}
      ),
      stdio: 'ignore',
    });
    w.gone = false;
    w.on('exit', () => (w.gone = true));
    return w;
  };
  const countStarts = dir =>
    fs.existsSync(path.join(dir, 'starts')) ? fs.readFileSync(path.join(dir, 'starts'), 'utf8').split('\n').filter(Boolean).length : 0;
  const text = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  const killService = dir => cp.spawnSync('pkill', ['-f', dir + '/helper.js']);

  // 1. a service that keeps running
  {
    const W = path.join(tmp, 'wd');
    fs.mkdirSync(W);
    fs.writeFileSync(
      path.join(W, 'helper.js'),
      "const fs = require('fs'); fs.appendFileSync(process.env.WD_MARK, 'start\\n');" +
        " console.log('run ' + fs.readFileSync(process.env.WD_MARK, 'utf8').split('\\n').filter(Boolean).length); setInterval(function () {}, 1000);\n"
    );
    fs.writeFileSync(path.join(W, 'helper.log'), 'the run that ended\n');
    fs.copyFileSync(path.join(root, 'scripts', 'watchdog.sh'), path.join(W, 'watchdog.sh')); // a copy, so the test can replace it
    const wd = watch(W, path.join(W, 'watchdog.sh'));
    await waitFor(() => countStarts(W) >= 1 && /start 1 in a row/.test(text(path.join(W, 'boot.log'))));
    await sleep(2500); // a service that runs is left alone
    ok(
      countStarts(W) === 1 &&
        /watchdog: the service had stopped; starting it again/.test(text(path.join(W, 'boot.log'))) &&
        /the run that ended/.test(text(path.join(W, 'helper.crash.log'))),
      'the watchdog starts a stopped service once, says so in the boot log and keeps the log of the run that ended'
    );
    // an update copies a new watchdog.sh over the running one: the running copy goes on
    fs.writeFileSync(path.join(W, 'watchdog.sh'), '#!/bin/sh\necho replaced > "$0.was-run"\n');
    killService(W);
    const again = await waitFor(() => countStarts(W) >= 2);
    const crash = text(path.join(W, 'helper.crash.log'));
    ok(
      again && /the run that ended/.test(crash) && /run 1/.test(crash),
      'it starts the service again each time it stops, also after its own file was replaced, and the crash log keeps every run'
    );
    fs.unlinkSync(path.join(W, 'helper.js'));
    ok(await waitFor(() => wd.gone, 10000), 'the watchdog ends when CleanYourTV is no longer installed');
    killService(W);
    if (!wd.gone) wd.kill();
    ok(!fs.existsSync(path.join(W, 'watchdog.sh.was-run')), 'the replaced file was not run by the running watchdog');
  }

  // 1b. not while bootstrap.sh runs (a setup or an update starts and stops the service itself), but a command line that only mentions
  // the name does not count
  {
    const S2 = path.join(tmp, 'wd-boot');
    fs.mkdirSync(S2);
    fs.writeFileSync(
      path.join(S2, 'helper.js'),
      "require('fs').appendFileSync(process.env.WD_MARK, 'start\\n'); setInterval(function () {}, 1000);\n"
    );
    fs.writeFileSync(path.join(S2, 'bootstrap.sh'), 'sleep 4\n');
    const bootRun = cp.spawn('sh', [path.join(S2, 'bootstrap.sh'), 'update'], { stdio: 'ignore' });
    const w2 = watch(S2, path.join(root, 'scripts', 'watchdog.sh'));
    await sleep(2500);
    const early = countStarts(S2);
    const late = await waitFor(() => countStarts(S2) >= 1);
    ok(early === 0 && late, 'the watchdog leaves the service alone while bootstrap.sh runs and starts it afterwards');
    bootRun.kill();
    const mention = cp.spawn('sh', ['-c', 'sleep 30 # ' + path.join(S2, 'bootstrap.sh')], { stdio: 'ignore' });
    killService(S2);
    ok(await waitFor(() => countStarts(S2) >= 2), 'a command that only mentions bootstrap.sh does not hold the watchdog back');
    mention.kill();
    fs.unlinkSync(path.join(S2, 'helper.js'));
    await waitFor(() => w2.gone, 10000);
    killService(S2);
    if (!w2.gone) w2.kill();
  }

  // 2. a service that stops at once is started less and less often (without that it would be 1 start a second); every run is in the
  // crash log
  {
    const B = path.join(tmp, 'wd-crash');
    fs.mkdirSync(B);
    fs.writeFileSync(path.join(B, 'helper.js'), "require('fs').appendFileSync(process.env.WD_MARK, 'start\\n'); console.log('crash');\n");
    const wb = watch(B, path.join(root, 'scripts', 'watchdog.sh'), { CYTV_WATCH_MAX: '50' });
    await waitFor(() => countStarts(B) >= 2);
    await sleep(6000);
    const n = countStarts(B);
    ok(n >= 2 && n <= 5, 'a service that keeps stopping is started less and less often (' + n + ' starts in about 7 seconds)');
    // the watchdog stopped first, so no start runs between the two counts
    fs.unlinkSync(path.join(B, 'helper.js'));
    await waitFor(() => wb.gone, 10000);
    if (!wb.gone) wb.kill();
    await sleep(1000);
    // (a start the watchdog began just as helper.js went keeps the log of the run before it as well, so the last run may be in it too)
    const all = countStarts(B),
      entries = text(path.join(B, 'helper.crash.log'))
        .split(/^=== the service log of a run that ended[^\n]*\n/m)
        .slice(1);
    ok(
      (entries.length === all - 1 || entries.length === all) && entries.every(e => e === 'crash\n'),
      'every start leaves the log of the run before it in the crash log (' + entries.length + ' of ' + all + ')'
    );
  }

  // 3. ... and after CYTV_WATCH_MAX starts in ten minutes it is left alone with one note; the crash log of the first stop stays first
  {
    const W2 = path.join(tmp, 'wd2');
    fs.mkdirSync(W2);
    fs.writeFileSync(path.join(W2, 'helper.js'), "require('fs').appendFileSync(process.env.WD_MARK, 'start\\n'); console.log('crash');\n");
    fs.writeFileSync(path.join(W2, 'helper.log'), 'the first crash\n');
    const wd2 = watch(W2, path.join(root, 'scripts', 'watchdog.sh'), { CYTV_WATCH_MAX: '2' });
    await waitFor(() => /not starting it again/.test(text(path.join(W2, 'boot.log'))), 30000); // the backoff waits too
    await sleep(1500);
    const log2 = text(path.join(W2, 'boot.log'));
    wd2.kill();
    ok(
      countStarts(W2) === 2 &&
        /stopped 2 times in 10 minutes; not starting it again/.test(log2) &&
        (log2.match(/not starting it again/g) || []).length === 1 &&
        /^=== the service log of a run that ended[^\n]*\nthe first crash\n/.test(text(path.join(W2, 'helper.crash.log'))),
      'a service that keeps stopping is started at most the limit, then left with one note; the first crash log comes first: ' +
        JSON.stringify([countStarts(W2), log2, text(path.join(W2, 'helper.crash.log')).slice(0, 200)])
    );
  }

  // 4. the crash log stays near 400 lines and keeps the first run of the boot as well as the latest
  {
    const C = path.join(tmp, 'wd-trim');
    fs.mkdirSync(C);
    const keep = fs.readFileSync(path.join(root, 'scripts', 'watchdog.sh'), 'utf8');
    const fn = keep.slice(keep.indexOf('  keep_log() {'), keep.indexOf('\n  }\n', keep.indexOf('  keep_log() {')) + 4);
    const script =
      'up() { echo 1; }\nSLOG=' +
      path.join(C, 'helper.log') +
      '\nCRASH=' +
      path.join(C, 'helper.crash.log') +
      '\n' +
      fn +
      '\n' +
      'for r in 1 2 3 4 5 6 7 8; do seq 1 150 | sed "s/^/run$r line /" > "$SLOG"; keep_log; done\n';
    const r = cp.spawnSync('sh', ['-c', script], { encoding: 'utf8' });
    const c = text(path.join(C, 'helper.crash.log')).split('\n').filter(Boolean);
    ok(
      r.status === 0 &&
        c.length <= 400 &&
        c[1] === 'run1 line 51' &&
        c[100] === 'run1 line 150' &&
        c.indexOf('=== (runs in between left out) ===') === 101 &&
        c[c.length - 1] === 'run8 line 150',
      'the crash log keeps the first run (its last 100 lines) and the latest ones within 400 lines: ' + c.length + ' ' + (r.stderr || '')
    );
  }
  // the fast start on the native Home (upstream issue 125): at boot the stand-in is mounted before the service starts and before any
  // Node.js step, only from what an earlier boot worked out, and that is written again whenever the slow way runs; no WebAppMgr
  // restart after it (it would close the launcher the stand-in opened)
  {
    const bootSh = fs.readFileSync(path.join(root, 'scripts', '10-cleanyourtv-home'), 'utf8');
    const fastMount = bootSh.indexOf('FAST=1');
    const cond = bootSh.slice(bootSh.indexOf('FAST=""'), fastMount);
    ok(
      fastMount > 0 &&
        fastMount < bootSh.indexOf('nohup node $L/helper.js') &&
        fastMount < bootSh.indexOf('sh $L/stage-home.sh') &&
        fastMount < bootSh.indexOf('sh $L/devtools-close.sh') &&
        bootSh.slice(0, fastMount).indexOf('node ') < 0 &&
        /^if \[ -z "\$1" \] && \[ ! -e \$L\/DISABLE \]/m.test(cond) &&
        /\$TAKEOVER -nt \$L\/backup\/home-appinfo\.orig\.json/.test(cond) &&
        /\$TAKEOVER -nt \$L\/tvprofile\.js/.test(cond) &&
        /find \$L\/app -type f ! -name cytv-token\.js -newer \$L\/home-overlay\.staged/.test(cond) &&
        /echo "\$method \$EXE" > \$TAKEOVER/.test(bootSh) &&
        /rm -f \$TAKEOVER; exit 1/.test(bootSh) &&
        /if \[ -z "\$FAST" \] && replaced; then/.test(bootSh),
      'the boot script mounts the stand-in first when an earlier boot found the way, before the service and any Node.js step, ' +
        'only at boot, and not after an update of the launcher (then the slow way stages it first)'
    );
  }
  // the condition of the fast start, run against a folder: a launcher staged as it is passes (also when the service rewrote
  // cytv-token.js since), a launcher file newer than the staging does not
  {
    const F = path.join(tmp, 'fast');
    fs.mkdirSync(path.join(F, 'app'), { recursive: true });
    fs.writeFileSync(path.join(F, 'app', 'index.html'), 'x');
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(path.join(F, 'app', 'index.html'), past, past);
    fs.writeFileSync(path.join(F, 'home-overlay.staged'), '');
    const bootSh = fs.readFileSync(path.join(root, 'scripts', '10-cleanyourtv-home'), 'utf8');
    const find = bootSh.match(/\$\(find \$L\/app [^)]*\)/)[0];
    const fresh = () => cp.spawnSync('sh', ['-c', 'L=' + F + '; [ -z "' + find + '" ]']).status === 0;
    const a = fresh();
    fs.writeFileSync(path.join(F, 'app', 'cytv-token.js'), "var CYTV_TOKEN = '';\n");
    const b = fresh();
    fs.writeFileSync(path.join(F, 'app', 'index.html'), 'y');
    const c = fresh();
    ok(a && b && !c, 'the fast start takes a staged launcher (cytv-token.js and the folder itself do not count), not a newer one');
  }
  // stage-home.sh copies only what changed, removes what is gone from app/ (not appinfo.json) and notes when it staged
  {
    const G = path.join(tmp, 'stage');
    fs.mkdirSync(path.join(G, 'app'), { recursive: true });
    fs.mkdirSync(path.join(G, 'home-overlay'));
    fs.mkdirSync(path.join(G, 'app', 'src'));
    fs.writeFileSync(path.join(G, 'app', 'index.html'), 'new');
    fs.writeFileSync(path.join(G, 'app', 'same.webp'), 'same');
    fs.writeFileSync(path.join(G, 'home-overlay', 'same.webp'), 'same');
    const old = new Date(Date.now() - 3600000);
    fs.utimesSync(path.join(G, 'app', 'same.webp'), old, old);
    fs.writeFileSync(path.join(G, 'home-overlay', 'gone.js'), 'old');
    fs.writeFileSync(path.join(G, 'home-overlay', 'appinfo.json'), '{}');
    const before = fs.statSync(path.join(G, 'home-overlay', 'same.webp')).mtimeMs;
    const st = fs
      .readFileSync(path.join(root, 'scripts', 'stage-home.sh'), 'utf8')
      .replace('L=/media/developer/cleanyourtv', 'L=' + G)
      .replace(/^node .*$/gm, ':');
    const r = cp.spawnSync('sh', ['-c', st], { encoding: 'utf8' });
    const o = n => path.join(G, 'home-overlay', n);
    ok(
      r.status === 0 &&
        fs.readFileSync(o('index.html'), 'utf8') === 'new' &&
        fs.statSync(o('same.webp')).mtimeMs === before &&
        !fs.existsSync(o('gone.js')) &&
        !fs.existsSync(o('src')) &&
        fs.existsSync(o('appinfo.json')) &&
        fs.existsSync(path.join(G, 'home-overlay.staged')),
      'stage-home.sh copies only changed files, removes what is gone (not appinfo.json) and notes the staging: ' + r.stderr
    );
  }
  // the app manager restarts when the TV goes to standby: the stand-in sees its registration end with "is not running", waits until
  // the app manager answers again, has webapp-mgr close the launcher and ends, so the new app manager starts Home afresh (a launcher
  // left open as com.webos.app.home was taken for Home, and nothing came to the front: a black screen with only the pointer)
  {
    const D = path.join(tmp, 'standin-sam');
    fs.mkdirSync(path.join(D, 'bin'), { recursive: true });
    fs.writeFileSync(
      path.join(D, 'bin', 'luna-send'),
      '#!/bin/sh\nD=' +
        JSON.stringify(D) +
        '\nfor a; do case "$a" in luna://*) m=$a ;; esac; done\necho "$m" >> $D/calls\n' +
        'case "$m" in\n*registerApp) echo \'{"registered":true,"event":"registered"}\'; sleep 1;' +
        ' echo \'{"serviceName":"com.webos.applicationManager","returnValue":false,"errorCode":-1,"errorText":"com.webos.applicationManager is not running."}\'; while :; do sleep 1; done ;;\n' +
        '*/running) n=$(cat $D/asked 2>/dev/null || echo 0); echo $((n+1)) > $D/asked; [ $n -ge 1 ] && echo \'{"returnValue":true,"running":[]}\' ;;\n' +
        '*) echo \'{"returnValue":true}\' ;;\nesac\n'
    );
    fs.chmodSync(path.join(D, 'bin', 'luna-send'), 0o755);
    const t0 = Date.now();
    const r = cp.spawnSync('sh', [path.join(root, 'scripts', 'home-standin.sh'), '{"reason":"preload"}'], {
      env: Object.assign({}, process.env, { PATH: path.join(D, 'bin') + ':' + process.env.PATH, CYTV_BOOT_LOG: path.join(D, 'boot.log') }),
      timeout: 20000,
      encoding: 'utf8',
    });
    cp.spawnSync('pkill', ['-f', D]); // nothing of the stand-in luna-send is left
    const log = fs.readFileSync(path.join(D, 'boot.log'), 'utf8'),
      calls = fs.readFileSync(path.join(D, 'calls'), 'utf8');
    ok(
      (r.status === 0 || r.signal === 'SIGTERM') &&
        Date.now() - t0 < 15000 &&
        /registered with the app manager/.test(log) &&
        /the app manager restarted \(the TV went to standby\); the launcher is closed/.test(log) &&
        calls.indexOf('/running') >= 0 &&
        calls.lastIndexOf('/running') < calls.indexOf('killApp'),
      'after the app manager restarts, the stand-in waits for it, closes the launcher and ends (' + (Date.now() - t0) + ' ms)'
    );
  }

  // nothing on screen (the stand-in way, upstream issue 162): with the TV on and no app in front for two checks, the watchdog closes
  // the stand-in and the launcher and has the app manager open Home; when that does not help twice, LG's Home comes back. The app in
  // front comes from the service's answer (a stand-in service that reads the file fg); a stand-in luna-send answers the power state,
  // the running list and the launch of Home ("fixes": it brings Home to the front).
  const blankCase = async (name, fixes, o) => {
    o = o || {};
    const D = path.join(tmp, name);
    fs.mkdirSync(D);
    fs.writeFileSync(path.join(D, 'helper.js'), 'setInterval(function () {}, 1000);\n');
    fs.writeFileSync(path.join(D, 'fg'), o.fg || '');
    if (o.running)
      fs.writeFileSync(path.join(D, 'running'), '{"returnValue":true,"running":[{"id":"com.webos.app.home","processid":"1"}]}');
    if (fixes) fs.writeFileSync(path.join(D, 'fixes'), '');
    const exe = path.join(D, 'com.webos.app.home');
    fs.writeFileSync(exe, 'sleep 60\n');
    fs.writeFileSync(path.join(D, 'standin'), exe + '\n');
    fs.writeFileSync(path.join(D, 'mounts'), '/dev/x ' + exe + ' ext4 rw 0 0\n');
    fs.writeFileSync(path.join(D, 'undo-home.sh'), 'echo "undo $1" >> "$(dirname "$0")/calls"\n');
    const luna = path.join(D, 'luna-send');
    fs.writeFileSync(
      luna,
      '#!/bin/sh\nD=$(dirname "$0")\nfor a; do case "$a" in luna://*) m=$a ;; esac; done\necho "$m" >> $D/calls\n' +
        'case "$m" in\n' +
        '*getPowerState) echo \'{"returnValue":true,"state":"Active"}\' ;;\n' +
        '*/launch) [ -f $D/fixes ] && echo com.webos.app.home > $D/fg; echo \'{"returnValue":true}\' ;;\n' +
        '*/killApp) rm -f $D/running; echo \'{"returnValue":true}\' ;;\n' +
        '*/running) cat $D/running 2>/dev/null || echo \'{"returnValue":true,"running":[]}\' ;;\n' +
        '*) echo \'{"returnValue":true}\' ;;\nesac\n'
    );
    fs.chmodSync(luna, 0o755);
    const standin = o.running ? { kill: () => {}, on: () => {} } : cp.spawn('/bin/sh', [exe], { stdio: 'ignore' });
    standin.gone = !!o.running;
    standin.on('exit', () => (standin.gone = true));
    const srv = require('http').createServer((q, r) =>
      r.end(JSON.stringify({ returnValue: true, appId: fs.readFileSync(path.join(D, 'fg'), 'utf8').trim() }))
    );
    await new Promise(res => srv.listen(0, '127.0.0.1', res));
    const w = cp.spawn('sh', [path.join(root, 'scripts', 'watchdog.sh')], {
      env: Object.assign({}, process.env, {
        CYTV_DIR: D,
        CYTV_BOOT_LOG: path.join(D, 'boot.log'),
        CYTV_SERVICE_LOG: path.join(D, 'helper.log'),
        CYTV_SERVICE_URL: 'http://127.0.0.1:' + srv.address().port + '/api/foreground',
        CYTV_WATCH_SECS: '1',
        CYTV_WATCH_GRACE: String(o.grace || 0),
        CYTV_STANDIN: path.join(D, 'standin'),
        CYTV_MOUNTS: path.join(D, 'mounts'),
        CYTV_LUNA: luna,
      }),
      stdio: 'ignore',
    });
    w.gone = false;
    w.on('exit', () => (w.gone = true));
    const log = () => text(path.join(D, 'boot.log')),
      calls = () => text(path.join(D, 'calls'));
    const t0 = Date.now();
    const done = await waitFor(
      () => (o.until ? o.until(calls()) : fixes ? /launch/.test(calls()) : /undo temp/.test(calls())),
      o.wait || 25000
    );
    const took = Date.now() - t0;
    await sleep(fixes || o.running ? 4000 : 2000); // nothing more happens after that
    const res = { done, took, log: log(), calls: calls(), standinGone: standin.gone };
    fs.unlinkSync(path.join(D, 'helper.js'));
    await waitFor(() => w.gone, 10000);
    if (!w.gone) w.kill();
    if (!standin.gone) standin.kill();
    srv.close();
    return res;
  };
  let bc = await blankCase('wd-blank', true);
  ok(
    bc.done &&
      bc.standinGone &&
      (bc.log.match(/nothing on screen; Home is set up again \(try 1\)/g) || []).length === 1 &&
      !/try 2/.test(bc.log) &&
      bc.calls.indexOf('killApp') >= 0 &&
      bc.calls.indexOf('killApp') < bc.calls.indexOf('/launch') &&
      !/undo/.test(bc.calls),
    'with the TV on and nothing on screen the watchdog closes the stand-in and the launcher and opens Home again, once'
  );
  bc = await blankCase('wd-blank-grace', true, { grace: 4 });
  ok(bc.done && bc.took >= 4000, 'the screen checks wait for the grace checks at the start (' + bc.took + ' ms)');
  bc = await blankCase('wd-blank-stays', false);
  ok(
    bc.done &&
      /try 1/.test(bc.log) &&
      /try 2/.test(bc.log) &&
      /still nothing on screen; LG's Home until the next reboot/.test(bc.log) &&
      (bc.calls.match(/undo temp/g) || []).length === 1,
    "when the screen stays empty after two tries, LG's Home comes back until the next reboot (once)"
  );
  // Home listed as running by the app manager while no stand-in runs (a restart of the app manager can end it too): the Home key does
  // nothing. With another app in front the launcher is only closed; with Home in front it is opened again.
  bc = await blankCase('wd-orphan', false, { running: true, fg: 'youtube.leanback.v4', until: c => /killApp/.test(c) });
  ok(
    bc.done &&
      /Home runs without its stand-in \(the app manager restarted\); the launcher is closed/.test(bc.log) &&
      (bc.calls.match(/killApp/g) || []).length === 1 &&
      !/\/launch/.test(bc.calls) &&
      !/undo/.test(bc.calls),
    'Home running without its stand-in and another app in front: the launcher is closed once, nothing is opened over the app'
  );
  bc = await blankCase('wd-orphan-front', true, { running: true, fg: 'com.webos.app.home' });
  ok(
    bc.done &&
      /Home runs without its stand-in \(the app manager restarted\); Home is set up again/.test(bc.log) &&
      bc.calls.indexOf('killApp') < bc.calls.indexOf('/launch') &&
      !/undo/.test(bc.calls),
    'Home running without its stand-in and in front: the launcher is closed and Home opened again'
  );
  // an app in front, the TV on, the stand-in running: no call to luna at all (the service's answer is enough)
  bc = await blankCase('wd-quiet', false, { fg: 'netflix', until: () => false, wait: 5000 });
  ok(!bc.calls && !/watchdog/.test(bc.log), 'with an app in front the screen checks call nothing and do nothing: ' + bc.calls);
  // the boot script starts the watchdog before every way out (LG's Home selected, Home already replaced after an update), and an
  // update or a setup stops the running one first, so the one from the new files runs
  {
    const home = fs.readFileSync(path.join(root, 'scripts', '10-cleanyourtv-home'), 'utf8');
    const boot = fs.readFileSync(path.join(root, 'scripts', 'bootstrap.sh'), 'utf8');
    const at = home.indexOf('(sh $L/watchdog.sh');
    const fn = name => boot.slice(boot.indexOf(name + '() {'), boot.indexOf('\n}\n', boot.indexOf(name + '() {')));
    ok(
      at > 0 &&
        at < home.indexOf('[ -e $L/DISABLE ] && exit 0') &&
        at < home.indexOf('if [ -z "$FAST" ] && replaced; then') &&
        home.indexOf('(sh $L/watchdog.sh', at + 1) < 0 &&
        (fn('restart_for_update').match(/pkill -f "\[c\]leanyourtv\/watchdog\.sh"/g) || []).length === 2 &&
        /pkill -f "\[c\]leanyourtv\/watchdog\.sh"/.test(fn('start_install')),
      'the watchdog starts on every boot path, and an update (also its rollback) or a setup stops the old one first'
    );
  }
  // the stand-in way checks that the new Home opened; a setup run from the manager app has it in front, so Home is opened then too
  {
    const home = fs.readFileSync(path.join(root, 'scripts', '10-cleanyourtv-home'), 'utf8');
    const standin = home.slice(
      home.indexOf('if [ "$method" = standin ]'),
      home.indexOf('else\n  echo "$(up) home: mounting the launcher over')
    );
    ok(
      /com\.cleanyourtv\.manager\*\|""\) luna-send[^\n]*applicationManager\/launch[^\n]*com\.webos\.app\.home/.test(standin),
      'the stand-in way opens Home when nothing, Home or the manager app (a setup from it) is in front, before it checks the new Home'
    );
  }
});
