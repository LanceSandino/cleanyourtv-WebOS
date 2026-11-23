// Diagnostics for a service that dies without a trace. Node 8 on some TVs aborts with "uv_close: Assertion !uv__is_closing(handle)
// failed", which JavaScript cannot catch. So the service keeps the last operations (child processes, network requests) in a small file in
// /tmp; a later start that finds the file of a process that is gone logs those operations, and the Share log report includes them.
// onStop() is for what a part still has to say when the service is asked to end (an update's SIGTERM): it is told, and the process ends
// a moment later, so the message leaves; a subscription on LG's bus that is cancelled and the process gone in the same moment stays
// known to LG (tried on the owner's TV on 2026-11-23: still listed without the moment, gone with it).
// execFile() is a child-process helper that handles the timeout itself instead of Node's `timeout` option: the child is killed once and
// the callback runs once, so no handle is closed twice.
const fs = require('fs'),
  cp = require('child_process');
const FILE = require('./paths').RUNFILE,
  KEEP = 25,
  LAST_MS = 250; // from being asked to end to the end; an update waits a second (bootstrap.sh)
const stops = [];
let ending = false;
const onStop = f => void stops.push(f);
let ops = [],
  timer = null,
  started = 0;
const t = () => Math.round(Date.now() / 1000);
function flush() {
  timer = null;
  try {
    fs.writeFileSync(FILE + '.tmp', JSON.stringify({ pid: process.pid, started, ops }));
    fs.renameSync(FILE + '.tmp', FILE);
  } catch (_) {}
}
function note(kind, what) {
  ops.push(
    t() +
      ' ' +
      kind +
      ' ' +
      String(what)
        .replace(/\/live\/[^\/\s]*\/[^\/\s]*\//g, '/live/*/*/')
        .slice(0, 120)
  );
  if (ops.length > KEEP) ops.shift();
  if (!timer) timer = setTimeout(flush, 500);
}
// at start: report how the previous process ended, then take over the file
function start() {
  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (_) {}
  if (prev && prev.pid && prev.pid !== process.pid) {
    let alive = false;
    try {
      process.kill(prev.pid, 0);
      alive = true;
    } catch (_) {}
    if (!alive)
      console.error(
        'diag: the previous service process (pid ' +
          prev.pid +
          ', started ' +
          new Date((prev.started || 0) * 1000).toISOString() +
          ') ended without a clean exit. Its last operations:\n  ' +
          (prev.ops || []).join('\n  ')
      );
  }
  started = t();
  flush();
  const bye = () => {
    try {
      fs.unlinkSync(FILE);
    } catch (_) {}
  };
  process.on('exit', bye);
  const end = () => {
    if (ending) return;
    ending = true;
    bye();
    for (const f of stops)
      try {
        f();
      } catch (_) {}
    setTimeout(() => process.exit(0), stops.length ? LAST_MS : 0);
  };
  process.on('SIGTERM', end);
  process.on('SIGINT', end);
}
// cp.execFile without the `timeout` option; the callback gets (error, stdout, stderr)
function execFile(cmd, args, opts, cb) {
  const o = Object.assign({}, opts),
    ms = o.timeout,
    max = o.maxBuffer || 1 << 20;
  delete o.timeout;
  delete o.maxBuffer;
  note(
    'exec',
    cmd.split('/').pop() +
      ' ' +
      (args || [])
        .filter(a => typeof a === 'string')
        .join(' ')
        .slice(0, 100)
  );
  let done = false,
    timer = null,
    out = '',
    err = '',
    child;
  const fin = e => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    cb(e, out, err);
  };
  try {
    child = cp.spawn(cmd, args || [], Object.assign({}, o, { stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    fin(e);
    return null;
  }
  child.stdout.on('data', d => {
    if (out.length < max) out += d;
  });
  child.stderr.on('data', d => {
    if (err.length < max) err += d;
  });
  child.on('error', fin);
  child.on('close', (code, sig) =>
    fin(code === 0 ? null : Object.assign(new Error('exit ' + (code !== null ? code : sig)), { code, killed: !!sig }))
  );
  if (ms)
    timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {}
      fin(Object.assign(new Error('timed out'), { killed: true }));
    }, ms);
  return child;
}
module.exports = { onStop, start, note, execFile, ops: () => ops.slice() };
