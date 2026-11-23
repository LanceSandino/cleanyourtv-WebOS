// Running programs (exec.js, diag.js): the time limit is kept without Node's own (which can abort Node 8), output limits, and the last
// operations survive a process that died.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { ok, tmp, root, req, run } = require('./lib');
const diag = req('diag'),
  exec = req('exec');

run(async () => {
  const dx = (cmd, args, o) => new Promise(res => diag.execFile(cmd, args, o || {}, (e, out, err) => res({ e, out, err })));
  let r = await dx('/bin/sh', ['-c', 'echo hi; echo oops 1>&2']);
  ok(r.e === null && r.out === 'hi\n' && r.err === 'oops\n', 'execFile returns stdout and stderr');
  r = await dx('/bin/sh', ['-c', 'exit 3']);
  ok(r.e && r.e.code === 3, 'a failing command reports its exit code');
  const t0 = Date.now();
  r = await dx('/bin/sh', ['-c', 'sleep 5'], { timeout: 300 });
  ok(r.e && r.e.killed === true && Date.now() - t0 < 2000, 'a command that takes too long is killed once and reported');
  r = await dx('/nonexistent/command', []);
  ok(r.e && /ENOENT/.test(String(r.e.code || r.e.message)), 'a missing command is reported');
  r = await dx('/bin/sh', ['-c', 'head -c 3000000 /dev/zero | tr "\\0" "a"'], { maxBuffer: 1000 });
  ok(r.e === null && r.out.length >= 1000 && r.out.length < 200000, 'output beyond maxBuffer is dropped, not a crash');

  let x = await exec.sh('echo a; exit 2');
  ok(x.ok === false && x.code === 2 && x.out === 'a\n', 'exec.sh resolves with the exit code and the output, it never rejects');
  x = await exec.run('/bin/sh', ['-c', 'sleep 5'], { timeout: 200 });
  ok(x.ok === false && /timed out/.test(x.error), 'exec.run keeps the time limit');
  ok(
    exec.shSync('echo sync') === 'sync\n' &&
      /failed|not found/.test(exec.shSync('exit 1; ', 2000) + exec.shSync('nonexistent-cmd-xyz 2>&1')),
    'exec.shSync for the report collector'
  );
  const luna = req('luna');
  const lr = await luna('luna://x/y', {}, { timeout: 2000 });
  ok(lr.returnValue === false && typeof lr.errorText === 'string', 'luna without luna-send answers returnValue false, never throws');

  diag.note('request', 'GET http://192.168.1.3:36400/live/user/secret/123.m3u8');
  ok(
    diag.ops().some(o => /\/live\/\*\/\*\/123/.test(o)) && !diag.ops().some(o => /secret/.test(o)),
    'logged operations hide the credentials of a stream address'
  );
  fs.writeFileSync(
    process.env.CYTV_RUNFILE,
    JSON.stringify({ pid: 999999, started: 1790000000, ops: ['1790000001 exec luna-send -n 1', '1790000002 request GET http://x/y'] })
  );
  const logged = [];
  const oe = console.error;
  console.error = function () {
    logged.push([].slice.call(arguments).join(' '));
  };
  diag.start();
  console.error = oe;
  ok(
    logged.length === 1 && /ended without a clean exit/.test(logged[0]) && /luna-send/.test(logged[0]),
    'a start that finds the file of a dead process logs its last operations'
  );
  ok(JSON.parse(fs.readFileSync(process.env.CYTV_RUNFILE, 'utf8')).pid === process.pid, 'the file now belongs to the running process');

  // asked to end (an update's pkill): what the parts still have to say (the subscription on LG's bus cancelled) goes out before the
  // process ends, so LG does not keep a client that is gone; the parts are told once, also when it is asked twice
  {
    const out = path.join(tmp, 'ended'),
      js = path.join(tmp, 'ending.js');
    fs.writeFileSync(
      js,
      'const fs=require("fs"),d=require(' +
        JSON.stringify(path.join(root, 'helper', 'diag.js')) +
        ');d.start();d.onStop(()=>{throw new Error("one that fails")});' +
        'd.onStop(()=>{fs.appendFileSync(' +
        JSON.stringify(out) +
        ',"told ");setTimeout(()=>fs.appendFileSync(' +
        JSON.stringify(out) +
        ',"sent "),100)});setInterval(()=>{},1000);console.log("up");'
    );
    const c = cp.spawn(process.execPath, [js], {
      env: Object.assign({}, process.env, { CYTV_RUNFILE: path.join(tmp, 'ending.run') }),
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise(res => c.stdout.once('data', res));
    const at = Date.now();
    c.kill('SIGTERM');
    c.kill('SIGTERM');
    const code = await new Promise(res => c.on('close', res));
    const said = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    ok(
      code === 0 && said === 'told sent ' && Date.now() - at < 900 && !fs.existsSync(path.join(tmp, 'ending.run')),
      'asked to end: the parts are told once, have a moment to send, and it ends cleanly well under the second an update waits: ' + said
    );
  }
  // a program started by the service gets none of its descriptors: LG's bus module does not mark its sockets close-on-exec, and an
  // update (bootstrap.sh, started by the service it replaces) handed them to the new service and its watchdog, so LG's hub kept the
  // dead service as a client (seen on the owner's TV on 2026-11-23)
  {
    const spawned = [];
    const real = cp.spawn;
    cp.spawn = function (cmd, args) {
      spawned.push([cmd].concat(args || []));
      return real.apply(cp, arguments);
    };
    const c1 = exec.detached('exit 0'),
      c2 = exec.spawn('/bin/echo', ['a b', '$HOME']);
    cp.spawn = real;
    let said = '';
    c2.stdout.on('data', b => (said += b));
    const pid = c2.pid;
    await Promise.all([c1, c2].map(c => new Promise(res => c.on('close', res))));
    ok(
      spawned.length === 2 && spawned.every(a => a[0] === '/bin/sh' && a[1] === '-c' && a[2].indexOf(exec.CLEAN) === 0) && pid > 0,
      'a program that can outlive the service starts through the closing of inherited descriptors'
    );
    ok(said === 'a b $HOME\n', 'its arguments reach it as they are: ' + JSON.stringify(said));
    const alive = cp.spawnSync('/bin/sh', ['-c', exec.CLEAN + 'echo alive'], { encoding: 'utf8' });
    ok(alive.stdout === 'alive\n' && alive.stderr === '', 'the closing itself says nothing and goes on in any shell' + alive.stderr);
    const shells = ['busybox sh', 'bash'].filter(sh => cp.spawnSync('/bin/sh', ['-c', 'command -v ' + sh.split(' ')[0]]).status === 0);
    if (!fs.existsSync('/proc/self/fd')) console.log('     skipped: no /proc here; the TV and CI have it');
    else
      for (const sh of shells) {
        const r2 = cp.spawnSync(
          '/bin/sh',
          ['-c', sh + ' -c "$1" x', 'x', 'exec 8</dev/null 25</dev/null; ' + exec.CLEAN + 'ls /proc/$$/fd | tr "\\n" " "'],
          {
            encoding: 'utf8',
          }
        );
        const left = r2.stdout
          .trim()
          .split(' ')
          .map(Number)
          .filter(n => n > 2);
        ok(
          r2.status === 0 && left.every(n => n !== 8 && n !== 25),
          sh + ': descriptors 8 and 25 are closed: ' + r2.stdout.trim() + r2.stderr
        );
      }
    const boot = fs.readFileSync(path.join(root, 'scripts', 'bootstrap.sh'), 'utf8');
    ok(
      boot.indexOf(exec.CLEAN.trim().replace(/;$/, '')) > 0 &&
        (boot.match(/10-cleanyourtv-home (keep|setup)/g) || []).length === 3 &&
        (boot.match(/clean_sh \$D\/10-cleanyourtv-home (keep|setup)/g) || []).length === 3,
      'bootstrap.sh starts the service and the watchdog with the same closing (an update from an older service hands it those descriptors)'
    );
  }
});
