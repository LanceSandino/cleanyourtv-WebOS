// LG's screensaver question, answered by the service. Before LG starts its own screensaver it asks every registered client
// (com.webos.service.tvpower registerScreenSaverRequest) and waits for responseScreenSaverRequest; a client that answers late is a
// fault for LG: its fault manager records "Request Screen Saver" timed out for the client, and the TV then reboots fully at its next
// standby instead of sleeping (rebootByFault: LG's Home first, ours a minute later; seen on the owner's TV on 2026-10-29). The launcher
// page used to answer, and a page can be late (in the background, reloading after an update). The service answers now, at once: one
// subscription held by one waiting luna-send -i, an answer within tens of milliseconds.
// Ours (the photos, saver.js) when the screensaver is on and has photos and the TV is not on an HDMI input (a console or a set-top box
// is in use even when the remote is not): LG is told no, and Home is opened with {saver: 'start', from: the app that was in front}, so
// the launcher shows the photos and a key goes back to that app. Otherwise LG decides, as before this launcher.
const cp = require('child_process'),
  fs = require('fs'),
  path = require('path');
const P = require('./paths');

const URI = 'luna://com.webos.service.tvpower/power/';

function create(ctx, opts) {
  const o = Object.assign(
    {
      bin: process.env.CYTV_LUNA_SEND || 'luna-send',
      minWaitMs: 1000,
      maxWaitMs: 30000,
      proc: P.PROC,
      kill: (pid, sig) => process.kill(pid, sig),
    },
    opts
  );
  const config = ctx.config;
  let child = null,
    timer = null,
    stopped = true,
    wait = o.minWaitMs,
    last = '';
  const log = m => {
    last = m;
    console.log('screensaver: ' + m);
  };
  // ours to show: switched on, and photos from the feed or the wallpapers
  function ours() {
    const c = config.get(),
      s = c.saver || {},
      feed = (c.photoFeed && c.photoFeed.photos) || 0,
      wall = +String((c.wallpapers && c.wallpapers.stamp) || '0').split(':')[0] || 0;
    return s.on === true && (feed > 0 || wall > 0);
  }
  const answer = (ts, ack) =>
    ctx.luna(URI + 'responseScreenSaverRequest', { clientName: 'cleanyourtv', ack, timestamp: ts }).catch(() => null);
  async function asked(ts) {
    if (!ours()) {
      await answer(ts, true);
      return log('LG asked, LG allowed');
    }
    let fg = '';
    try {
      const f = await ctx.luna('luna://com.webos.applicationManager/getForegroundAppInfo', {});
      fg = (f && f.appId) || '';
    } catch (_) {}
    if (/^com\.webos\.app\.hdmi\d+$/.test(fg)) {
      await answer(ts, true);
      return log('LG asked over ' + fg + ', left to LG (an HDMI input)');
    }
    await answer(ts, false);
    await ctx
      .luna('luna://com.webos.applicationManager/launch', {
        id: 'com.webos.app.home',
        params: { saver: 'start', from: fg && fg !== 'com.webos.app.home' ? fg : '' },
      })
      .catch(() => null);
    log('LG asked' + (fg && fg !== 'com.webos.app.home' ? ' over ' + fg : '') + ', ours shown on Home');
  }
  function listen() {
    if (child || stopped) return;
    const c = cp.spawn(o.bin, ['-i', URI + 'registerScreenSaverRequest', JSON.stringify({ subscribe: true, clientName: 'cleanyourtv' })], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    child = c;
    let buf = '';
    c.stdout.setEncoding('utf8');
    c.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        let j = null;
        try {
          j = JSON.parse(line);
        } catch (_) {}
        if (!j) continue;
        if (j.returnValue === true && j.timestamp === undefined) wait = o.minWaitMs; // subscribed
        if (j.timestamp !== undefined) asked(j.timestamp).catch(() => {});
      }
    });
    c.on('error', () => {});
    c.on('exit', () => {
      if (child !== c) return;
      child = null;
      if (stopped) return;
      // the subscription ended (the power service restarted): again, waiting longer each time
      timer = setTimeout(listen, wait);
      wait = Math.min(o.maxWaitMs, wait * 2);
    });
  }
  // a subscription of ours left by an earlier run of the service (a restarted service does not take its children with it): it can no
  // longer answer, and an unanswered question is the fault this part exists to prevent, so it goes before ours starts
  function sweep() {
    let gone = 0;
    let pids = [];
    try {
      pids = fs.readdirSync(o.proc).filter(x => /^\d+$/.test(x));
    } catch (_) {}
    for (const pid of pids) {
      if (child && +pid === child.pid) continue;
      let cmd = '';
      try {
        cmd = fs.readFileSync(path.join(o.proc, pid, 'cmdline'), 'utf8');
      } catch (_) {}
      if (cmd.indexOf('registerScreenSaverRequest') >= 0 && cmd.indexOf('cleanyourtv') >= 0)
        try {
          o.kill(+pid, 'SIGTERM');
          gone++;
        } catch (_) {}
    }
    if (gone) log('ended ' + gone + ' subscription(s) left by an earlier run');
  }
  function start() {
    stopped = false;
    sweep();
    listen();
    process.once('exit', stop); // ours ends with the service
  }
  function stop() {
    stopped = true;
    clearTimeout(timer);
    if (child) {
      const c = child;
      child = null;
      try {
        c.kill();
      } catch (_) {}
    }
  }
  return { name: 'lgscreensaver', start, stop, status: () => ({ listening: !!child, last }) };
}

module.exports = { create };
