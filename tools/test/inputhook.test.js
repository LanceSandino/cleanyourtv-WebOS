// The input hook (inputhook.js): which of LG's processes it goes into (issue 23: hooked into micomservice, HDMI-CEC control of
// other devices and eARC stopped working).
const fs = require('fs'),
  path = require('path');
const { ok, req, run } = require('./lib');

const PROC = process.env.CYTV_PROC;
const HOOKLOG = path.join(PROC, '..', 'hook-test.log');
process.env.CYTV_HOOK_LOG = HOOKLOG;
const proc = (pid, name) => {
  fs.mkdirSync(path.join(PROC, String(pid)));
  fs.writeFileSync(path.join(PROC, String(pid), 'comm'), name + '\n');
};

run(async () => {
  const hook = req('inputhook');
  proc(100, 'micomservice');
  proc(200, 'lginput2');
  proc(300, 'tvservice');
  proc(400, 'bash');
  let p = hook.procs();
  ok(
    p.length === 1 && p[0].name === 'lginput2',
    "where LG's input service runs, the hook goes only into lginput2, never into micomservice"
  );
  // attached: the hook's start in its log, or (the log keeps only its newest lines: a hook that ran a while has lost its start, as on a
  // webOS 22 TV) the library in lginput2 and keys going through it; keys alone, without the library, are not enough
  const keysOnly = '[INFO] lginput_uinput_send_button called: keyid=7, state=1 uinput_code=108\n';
  fs.writeFileSync(HOOKLOG, '[INFO] InputHook initialized\n[INFO] lib_main returned: 0\n');
  const fromStart = hook.hookInfo().attached;
  fs.writeFileSync(HOOKLOG, keysOnly);
  const keysNoLib = hook.hookInfo().attached;
  fs.writeFileSync(
    path.join(PROC, '200', 'maps'),
    'b6a00000-b6a10000 r-xp 00000000 00:00 0 /media/developer/cleanyourtv/inputhook/libinputhookpp.so\n'
  );
  const keysAndLib = hook.hookInfo().attached;
  fs.writeFileSync(HOOKLOG, '');
  const libNoKeys = hook.hookInfo().attached;
  ok(
    fromStart && !keysNoLib && keysAndLib && !libNoKeys,
    'the hook is attached from its start in the log, or from the library in lginput2 with keys going through it: ' +
      [fromStart, keysNoLib, keysAndLib, libNoKeys].join()
  );
  fs.unlinkSync(path.join(PROC, '200', 'maps'));
  fs.unlinkSync(path.join(PROC, '200', 'comm'));
  fs.rmdirSync(path.join(PROC, '200'));
  p = hook.procs();
  ok(
    p
      .map(x => x.name)
      .sort()
      .join() === 'micomservice,tvservice',
    'firmware without lginput2: the other input processes, as before'
  );
});
