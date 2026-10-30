// LG's screensaver question, answered by the service. Before LG starts its own screensaver it asks every registered client
// (com.webos.service.tvpower registerScreenSaverRequest) and waits for responseScreenSaverRequest; a client that answers late is a
// fault for LG: its fault manager records "Request Screen Saver" timed out for the client, and the TV then reboots fully at its next
// standby instead of sleeping (rebootByFault: LG's Home first, ours a minute later; seen on the owner's TV on 2026-10-29). The launcher
// page used to answer, and a page can be late (in the background, reloading after an update). The service answers now, at once, on
// its own connection to LG's bus: tvpowerd takes an answer only from the connection that registered (its log: "[setNack] clientID: ...
// / clientName: cleanyourtv is not exist" when the answer came from another luna-send, read on 2026-10-30 after such a fault; it
// still replied returnValue true), so the subscription and every answer go through one palmbus handle (LG's own module for its
// JavaScript services, /usr/lib/nodejs/palmbus.js). Where that module is not there nothing is registered: LG decides, as before this
// launcher, rather than a question no one can answer.
// Ours (the photos, saver.js) when the screensaver is on and has photos and the TV is not on an HDMI input (a console or a set-top box
// is in use even when the remote is not): LG is told no, and Home is opened with {saver: 'start', from: the app that was in front}, so
// the launcher shows the photos and a key goes back to that app. Otherwise LG decides, as before this launcher.
// Every answer is kept in a short record on the TV's storage (screensaver-answers.log, the last 40), with how long it took and what LG
// replied ("The response is too late", an invalid parameter): the service's own log is in /tmp and gone after the reboot such a fault
// causes, so this is what says why LG counted an answer as missing.
const fs = require('fs'),
  os = require('os'),
  path = require('path');
const P = require('./paths');

const URI = 'luna://com.webos.service.tvpower/power/';

function create(ctx, opts) {
  const o = Object.assign(
    {
      // LG's bus module, or null where it is not
      bus: () => {
        try {
          return require(process.env.CYTV_PALMBUS || '/usr/lib/nodejs/palmbus.js');
        } catch (_) {
          return null;
        }
      },
      answerMs: 2500, // LG waits 3000 ms (tvpowerd: "Timer setted with 3000 ms")
      minWaitMs: 1000,
      maxWaitMs: 30000,
      proc: P.PROC,
      kill: (pid, sig) => process.kill(pid, sig),
      record: path.join(P.D, 'screensaver-answers.log'),
      keep: 40,
    },
    opts
  );
  const config = ctx.config;
  let handle = null,
    sub = null,
    timer = null,
    stopped = true,
    wait = o.minWaitMs,
    last = '';
  const log = m => {
    last = m;
    console.log('screensaver: ' + m);
  };
  // ours to show: switched on, and photos to show: the wallpapers' list (uploads, Immich and the photo feed) or the feed's own count,
  // read from those parts, as the page's own check did. (1.6.36 to 1.6.43 read config keys that do not exist, photoFeed.photos and
  // wallpapers.stamp, so LG was always told yes and showed its own screensaver.)
  function ours() {
    const s = config.get().saver || {};
    if (s.on !== true) return false;
    const part = n => (ctx.feature ? ctx.feature(n) : null);
    let n = 0;
    try {
      const w = part('wallpapers');
      n = w && w.list ? w.list().length : 0;
      const f = part('photofeed');
      if (!n && f && f.count) n = f.count();
    } catch (_) {}
    return n > 0;
  }
  // one line per answer, the last o.keep kept (renamed into place, so a reader never sees half a file)
  function remember(entry) {
    try {
      let lines = [];
      try {
        lines = fs.readFileSync(o.record, 'utf8').split('\n').filter(Boolean);
      } catch (_) {}
      lines.push(JSON.stringify(entry));
      fs.writeFileSync(o.record + '.new', lines.slice(-o.keep).join('\n') + '\n');
      fs.renameSync(o.record + '.new', o.record);
    } catch (_) {}
  }
  let t0 = 0;
  // the answer on the connection that registered; LG's reply to it, or null
  function respond(payload) {
    return new Promise(resolve => {
      if (!handle) return resolve(null);
      const t = setTimeout(() => resolve(null), o.answerMs);
      try {
        handle.call(URI + 'responseScreenSaverRequest', JSON.stringify(payload)).addListener('response', m => {
          clearTimeout(t);
          try {
            resolve(JSON.parse(m.payload()));
          } catch (_) {
            resolve(null);
          }
        });
      } catch (_) {
        clearTimeout(t);
        resolve(null);
      }
    });
  }
  async function answer(ts, ack, fg) {
    const r = await respond({ clientName: 'cleanyourtv', ack, timestamp: ts });
    const lg = r && r.returnValue === true ? 'ok' : (r && r.errorText) || 'no reply';
    const entry = { at: new Date().toISOString(), up: Math.round(os.uptime()), ack, over: fg || '', ms: Date.now() - t0, lg };
    if (typeof ts !== 'string') entry.ts = typeof ts;
    remember(entry);
    if (lg !== 'ok') log('LG did not take the answer (' + lg + ', ' + entry.ms + ' ms)');
    return entry;
  }
  async function asked(ts) {
    t0 = Date.now();
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
      await answer(ts, true, fg);
      return log('LG asked over ' + fg + ', left to LG (an HDMI input)');
    }
    await answer(ts, false, fg);
    await ctx
      .luna('luna://com.webos.applicationManager/launch', {
        id: 'com.webos.app.home',
        params: { saver: 'start', from: fg && fg !== 'com.webos.app.home' ? fg : '' },
      })
      .catch(() => null);
    log('LG asked' + (fg && fg !== 'com.webos.app.home' ? ' over ' + fg : '') + ', ours shown on Home');
  }
  function again() {
    if (stopped) return;
    // the subscription ended (the power service restarted): again, waiting longer each time
    timer = setTimeout(listen, wait);
    wait = Math.min(o.maxWaitMs, wait * 2);
  }
  function listen() {
    if (sub || stopped) return;
    if (!handle) {
      const bus = o.bus();
      if (!bus) return log("LG's bus module is not on this TV: not registered, LG decides");
      try {
        handle = new bus.Handle('', false);
      } catch (e) {
        return log("no connection to LG's bus (" + ((e && e.message) || e) + '): not registered, LG decides');
      }
    }
    let s;
    try {
      s = handle.subscribe(URI + 'registerScreenSaverRequest', JSON.stringify({ subscribe: true, clientName: 'cleanyourtv' }));
    } catch (_) {
      return again();
    }
    sub = s;
    s.addListener('response', m => {
      let j = null;
      try {
        j = JSON.parse(m.payload());
      } catch (_) {}
      if (!j) return;
      if (j.returnValue === false || j.subscribed === false) {
        if (sub === s) {
          sub = null;
          try {
            s.cancel();
          } catch (_) {}
          again();
        }
        return;
      }
      if (j.timestamp === undefined)
        wait = o.minWaitMs; // subscribed
      else asked(j.timestamp).catch(() => {});
    });
    s.addListener('cancel', () => {
      if (sub !== s) return;
      sub = null;
      again();
    });
  }
  // a luna-send subscription of ours left by an earlier version (1.6.36 to 1.6.45 held it in a luna-send -i, and a restarted service
  // does not take its children with it): it can never be answered, and an unanswered question is the fault this part exists to
  // prevent, so it goes before ours starts
  function sweep() {
    let gone = 0;
    let pids = [];
    try {
      pids = fs.readdirSync(o.proc).filter(x => /^\d+$/.test(x));
    } catch (_) {}
    for (const pid of pids) {
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
    if (sub) {
      const s = sub;
      sub = null;
      try {
        s.cancel();
      } catch (_) {}
    }
  }
  function answers() {
    try {
      return fs
        .readFileSync(o.record, 'utf8')
        .split('\n')
        .filter(Boolean)
        .slice(-5)
        .map(l => JSON.parse(l));
    } catch (_) {
      return [];
    }
  }
  return { name: 'lgscreensaver', start, stop, status: () => ({ listening: !!sub, last, answers: answers() }) };
}

module.exports = { create };
