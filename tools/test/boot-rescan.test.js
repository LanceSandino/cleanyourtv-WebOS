// 10-cleanyourtv-home's mount way with the rescan (rescan-home.sh, from upstream) in front of the fork's sam restart: the real boot
// script runs with stand-ins for mount, systemctl, pkill, pgrep, sleep and luna-send and for the scripts it calls (rescan-home.sh,
// after-sam.sh, stage-home.sh, devtools-close.sh); never calls the TV or system services. When the rescan works, sam is not restarted
// and after-sam.sh (tvprofile.js afterSam, or after-sam-services) does not run; when it does not, or with home-rescan-off, the fork's
// restart path runs as before.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, tmp, ok, run } = require('./lib');
run(async () => {
  const bin = path.join(tmp, 'bbin'),
    service = path.join(tmp, 'bservice'),
    home = path.join(tmp, 'bhome'),
    initd = path.join(tmp, 'binitd'),
    calls = path.join(tmp, 'bcalls'),
    log = path.join(tmp, 'bboot.log');
  for (const d of [bin, service, path.join(service, 'backup'), path.join(service, 'home-overlay'), home, initd]) fs.mkdirSync(d);
  fs.copyFileSync(path.join(root, 'helper/tvprofile.js'), path.join(service, 'tvprofile.js'));
  fs.copyFileSync(path.join(root, 'scripts/jtool.js'), path.join(service, 'jtool.js'));
  fs.writeFileSync(path.join(service, 'backup/home-appinfo.orig.json'), JSON.stringify({ id: 'com.webos.app.home', type: 'flutter' }));
  fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  const stub = (file, body) => fs.writeFileSync(file, '#!/bin/sh\n' + body + '\n', { mode: 0o755 });
  // every stand-in writes one line to $CALLS
  stub(path.join(bin, 'mount'), 'echo "mount $*" >> "$CALLS"; [ -z "$MOUNTFAIL" ]');
  stub(path.join(bin, 'systemctl'), 'echo "systemctl $*" >> "$CALLS"; exit 0');
  stub(path.join(bin, 'pkill'), 'echo "pkill $*" >> "$CALLS"; exit 0');
  stub(path.join(bin, 'pgrep'), 'exit 0'); // the service and the watchdog run already
  stub(path.join(bin, 'sleep'), 'exit 0');
  stub(
    path.join(bin, 'luna-send'),
    'for a; do uri=$prev; prev=$a; done\necho "luna $uri" >> "$CALLS"\n' +
      'case "$uri" in *getForegroundAppInfo) echo \'{"appId": "", "returnValue": true}\' ;; *) echo \'{"returnValue": true}\' ;; esac'
  );
  stub(path.join(service, 'rescan-home.sh'), 'echo "rescan-home $*" >> "$CALLS"; exit ${RESCAN:-0}');
  stub(path.join(service, 'after-sam.sh'), 'echo "after-sam" >> "$CALLS"');
  stub(path.join(service, 'stage-home.sh'), 'exit 0');
  stub(path.join(service, 'devtools-close.sh'), 'exit 0');
  const script = fs
    .readFileSync(path.join(root, 'scripts/10-cleanyourtv-home'), 'utf8')
    .replace(/^export PATH=.*$/m, 'export PATH="' + bin + ':$PATH"')
    .replace('L=/media/developer/cleanyourtv', 'L="' + service + '"')
    .replace('INITD=/var/lib/webosbrew/init.d', 'INITD="' + initd + '"')
    .replace('H=/usr/palm/applications/com.webos.app.home', 'H="' + home + '"')
    .replace('STANDIN=/tmp/cleanyourtv-home-standin', 'STANDIN="' + path.join(tmp, 'bstandin') + '"')
    .replace('LOG=/tmp/cleanyourtv-boot.log', 'LOG="' + log + '"')
    .replace(/^up\(\).*$/m, 'up() { echo 1; }');
  const files = ['home-rescan-off', 'DISABLE', 'locale-ui.restore', 'home-takeover'];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const lines = () => fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean);
  // the last step of each background part: the rescan way's fourth stop of LG's Home program, the restart way's Home launch after
  // after-sam.sh; a way without a background part ends with the script
  const rescanDone = c => c.filter(l => /^pkill -f \[-\]i /.test(l)).length === 4;
  const restartDone = c => c.indexOf('after-sam') >= 0 && /applicationManager\/launch$/.test(c[c.length - 1]);
  // one boot (no argument); sleep is stood in, so the background parts end quickly: wait for their last step (at most 10 s)
  const boot = async (env, setup, done) => {
    for (const f of files) if (fs.existsSync(path.join(service, f))) fs.unlinkSync(path.join(service, f));
    fs.writeFileSync(calls, '');
    fs.writeFileSync(log, '');
    if (setup) setup();
    const r = cp.spawnSync('sh', ['-s'], {
      input: script,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { CALLS: calls }, env || {}),
    });
    for (let i = 0; done && i < 200 && !done(lines()); i++) await wait(50);
    await wait(200); // nothing may follow
    return { status: r.status, calls: lines(), log: fs.readFileSync(log, 'utf8'), err: r.stderr };
  };
  const has = (r, re) => r.calls.some(c => re.test(c));
  const at = (r, re) => r.calls.findIndex(c => re.test(c));

  // the rescan works: no sam restart, no after-sam.sh, LG's Home stopped, Home opened (nothing in front)
  let r = await boot({ RESCAN: '0' }, null, rescanDone);
  ok(
    r.status === 0 &&
      at(r, /^mount --bind .*home-overlay /) >= 0 &&
      at(r, /^rescan-home $/) > at(r, /^mount --bind /) &&
      !has(r, /^systemctl restart sam/) &&
      !has(r, /^after-sam/) &&
      !has(r, /airplay/) &&
      rescanDone(r.calls),
    'boot with a working rescan: the launcher mounted, then the rescan; sam is not restarted and after-sam.sh does not run: ' +
      JSON.stringify(r.calls) +
      r.err
  );
  ok(
    has(r, /^pkill -f \[-\]i com\\\.webos\\\.app\\\.home/) &&
      has(r, /^pkill -f \[a\]pp-id=com\\\.webos\\\.app\\\.home/) &&
      has(r, /applicationManager\/launch$/) &&
      /read it without a restart/.test(r.log) &&
      !/sam restarted|restarting sam/.test(r.log),
    "boot with a working rescan: LG's Home stopped, Home opened, and the boot log says no restart: " + JSON.stringify(r.log)
  );

  // the rescan does not take: the fork's restart path as before, after-sam.sh after sam is back
  r = await boot({ RESCAN: '1' }, null, restartDone);
  ok(
    r.status === 0 &&
      at(r, /^rescan-home $/) >= 0 &&
      at(r, /^systemctl restart sam$/) > at(r, /^rescan-home $/) &&
      at(r, /^after-sam$/) > at(r, /^systemctl restart sam$/) &&
      has(r, /^pkill -9 -f \/usr\/palm\/applications\/airplay\/LunaExecutable$/) &&
      has(r, /applicationManager\/launch$/) &&
      r.calls.filter(c => /^mount /.test(c)).length === 1 &&
      !has(r, /^pkill -f \[-\]i /),
    'boot where the rescan does not take: one mount, then sam restarted and after-sam.sh run, Home opened: ' + JSON.stringify(r.calls)
  );
  ok(
    /home: mounting the launcher over LG's Home, restarting sam/.test(r.log) && /home: sam restarted/.test(r.log),
    'boot where the rescan does not take: the boot log has the sam restart lines as before'
  );

  // home-rescan-off: no rescan at all, the restart path
  r = await boot({ RESCAN: '0' }, () => fs.writeFileSync(path.join(service, 'home-rescan-off'), ''), restartDone);
  ok(
    !has(r, /^rescan-home/) && has(r, /^systemctl restart sam$/) && has(r, /^after-sam$/),
    'home-rescan-off: no rescan, sam restarted and after-sam.sh run: ' + JSON.stringify(r.calls)
  );

  // the mount fails: neither the rescan nor a sam restart nor after-sam.sh
  r = await boot({ RESCAN: '0', MOUNTFAIL: '1' });
  ok(
    r.status === 1 &&
      !has(r, /^rescan-home/) &&
      !has(r, /^systemctl restart sam/) &&
      !has(r, /^after-sam/) &&
      /the mount over .* failed/.test(r.log),
    'a failed mount: no rescan, no sam restart, no after-sam.sh, and the boot log says so: ' + JSON.stringify(r.calls)
  );

  // a UI language left changed is put back at boot, also while LG's Home is selected (DISABLE), and nothing is taken over then
  r = await boot({ RESCAN: '0' }, () => {
    fs.writeFileSync(path.join(service, 'DISABLE'), '');
    fs.writeFileSync(path.join(service, 'locale-ui.restore'), 'it-IT\n');
  });
  ok(
    r.status === 0 && r.calls.join('|') === 'rescan-home restore',
    'a language left changed comes back at boot before the DISABLE exit, and nothing else runs: ' + JSON.stringify(r.calls)
  );
  // without one, the restore is not called
  r = await boot({ RESCAN: '0' }, () => fs.writeFileSync(path.join(service, 'DISABLE'), ''));
  ok(r.calls.length === 0, 'no locale-ui.restore: no restore call at boot: ' + JSON.stringify(r.calls));
  for (const f of files) if (fs.existsSync(path.join(service, f))) fs.unlinkSync(path.join(service, f));
  // WebAppMgr's one restart at boot (devtools-close.sh restart) is over before the rescan too, as before sam's restart
  // (D-20261029-10): the rescan way opens the launcher in webapp-mgr right after it
  const h = fs.readFileSync(path.join(root, 'scripts/10-cleanyourtv-home'), 'utf8');
  ok(
    h.indexOf('wait $DT') > 0 &&
      h.indexOf('wait $DT') < h.indexOf('sh $L/rescan-home.sh;') &&
      h.indexOf('sh $L/rescan-home.sh;') < h.indexOf('systemctl restart sam') &&
      h.indexOf('sh $L/rescan-home.sh restore') < h.indexOf('[ -e $L/DISABLE ] && exit 0'),
    "the boot script waits for WebAppMgr's restart before the rescan, and the rescan comes before sam's restart"
  );
});
