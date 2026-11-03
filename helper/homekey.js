// The Home key while Home is in front, on a webOS where LG does nothing then (tvprofile.js homeKeyWatch: webOS 25 and newer). There LG's
// window manager sees the key, finds Home already in front ("KEYFILTER_APPLAUNCH ... com.webos.app.home is foreground app", the owner's
// TV on 2026-11-03) and does not relaunch it, so the launcher never hears of it and an open menu, Search or the photos stayed. webOS 22
// relaunches Home with launchType homeKey itself. The input hook (inputhook.js) logs every remote key LG's input service sends, with its
// Linux code (KEY_HOME is 773 there, read beside LG's own key names); this part reads what the log gained (a look every 300 ms, from
// where it was) and, on a Home press while Home is in front, relaunches Home with {launchType: 'homeKey'}, the parameter LG itself
// sends on webOS 22, which the launcher (input.js homeKey) already answers: its menus, Search and the photos close. Only a press is
// taken (state=1), and one relaunch per press; a log that shrank (the hook keeps only its newest lines) is read again from its start.
const fs = require('fs');
const P = require('./paths');

const HOME_CODE = 773;
const HOME = 'com.webos.app.home';

// ctx: {luna, profile}; o: {log, pollMs} (tests)
function create(ctx, opts) {
  const o = Object.assign({ log: P.HOOK_LOG, pollMs: 300 }, opts);
  const on = () => {
    const p = ctx.profile && ctx.profile.get ? ctx.profile.get() : {};
    return !!(p && p.homeKeyWatch);
  };
  let pos = -1,
    timer = null,
    busy = false,
    sent = 0;
  const press = new RegExp('state=1 uinput_code=' + HOME_CODE + '\\b', 'g');
  // what the log gained since the last look: the Home presses in it
  function gained() {
    let size = 0;
    try {
      size = fs.statSync(o.log).size;
    } catch (_) {
      pos = -1;
      return 0;
    }
    if (pos < 0 || size < pos) pos = pos < 0 ? size : 0; // the first look starts at the end; a shorter log is read from its start
    if (size === pos) return 0;
    let text = '';
    try {
      const fd = fs.openSync(o.log, 'r');
      const buf = Buffer.alloc(Math.min(size - pos, 1 << 16));
      fs.readSync(fd, buf, 0, buf.length, pos);
      fs.closeSync(fd);
      text = buf.toString('utf8');
    } catch (_) {}
    pos = size;
    return (text.match(press) || []).length;
  }
  async function look() {
    if (busy || !on()) return;
    const n = gained();
    if (!n) return;
    busy = true;
    try {
      const f = await ctx.luna('luna://com.webos.applicationManager/getForegroundAppInfo', {});
      if (f && f.appId === HOME) {
        await ctx.luna('luna://com.webos.applicationManager/launch', { id: HOME, params: { launchType: 'homeKey' } });
        sent++;
      }
    } catch (_) {
    } finally {
      busy = false;
    }
  }
  function start() {
    if (timer) return;
    timer = setInterval(() => look().catch(() => {}), o.pollMs);
    if (timer.unref) timer.unref();
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  return { name: 'homekey', start, stop, look, status: () => ({ on: on(), sent }) };
}

module.exports = { create, HOME_CODE };
