// Fix the picture and LG's logs kept (picturediag.js): a copy of LG's logs a few minutes into a start of the TV (not when the service
// starts later, after an update), the last 2 starts kept; Fix the picture keeps the logs at that moment (the last 3), then restarts the
// TV, at most once in 5 minutes, or (media) restarts videooutputd and then umediaserver with the TV left on; each copy readable only
// by root, with a summary of LG's video mutes and punch-through warnings.
const fs = require('fs'),
  path = require('path');
const { ok, call, tmp, sleep, req, run } = require('./lib');

run(async () => {
  const src = path.join(tmp, 'lglogs'),
    dir = path.join(tmp, 'diag');
  fs.mkdirSync(src, { recursive: true });
  const dbg = path.join(src, 'dbg-log'),
    boot = path.join(src, 'cleanyourtv-boot.log');
  const mute = (on, ctxId) =>
    '2026-11-03T22:47:51Z [1.0] user.info avmutemanager [] avmutemanager VIDEO_MUTE {} End [setAvMute][410] {"muteOn":' +
    on +
    ',"returnValue":true,"contextId":"' +
    ctxId +
    '","muteType":"videoMute","muteOwner":"com.webos.service.videooutput"}\n';
  fs.writeFileSync(
    dbg,
    mute(true, 'a') + mute(true, 'b') + mute(false, 'b') + '... surface-manager LSM {} Punch through is not working with ""\n'
  );
  fs.writeFileSync(boot, '40.26 devtools: restarting WebAppMgr once\n');
  let t = Date.parse('2026-11-03T22:31:00Z');
  const calls = [],
    shs = [];
  const make = up =>
    req('picturediag').create(
      {
        luna: async (uri, p) => (
          calls.push([uri.split('/').pop(), p]), /Foreground/.test(uri) ? { appId: 'netflix' } : { returnValue: true }
        ),
        profile: { get: () => ({ sdk: '10.3.2' }) },
      },
      {
        dir,
        sources: [dbg, path.join(src, 'missing.gz'), boot],
        uptime: () => up,
        bootAtS: 0.05,
        restartMs: 30,
        mediaMs: 200,
        now: () => new Date((t += 1000)),
        sh: async c => (shs.push(c), { ok: true, code: 0 }),
      }
    );
  // a start of the TV: the copy is made a little into it
  const D = make(0);
  D.start();
  await sleep(150);
  let copies = D.copies();
  const first = copies[0],
    sum = first && JSON.parse(fs.readFileSync(path.join(dir, first.name, 'summary.json'), 'utf8'));
  const mode = first && (fs.statSync(path.join(dir, first.name, 'dbg-log')).mode & 0o777).toString(8);
  ok(
    copies.length === 1 &&
      /^boot-/.test(first.name) &&
      first.files === 3 &&
      sum.foreground === 'netflix' &&
      sum.videoMuteOn === 2 &&
      sum.videoMuteOff === 1 &&
      sum.punchThrough === 1 &&
      sum.files.join() === 'dbg-log,cleanyourtv-boot.log' &&
      mode === '600' &&
      (fs.statSync(dir).mode & 0o777).toString(8) === '700',
    'a start of the TV: its logs kept, root only, with the summary: ' + JSON.stringify(sum)
  );
  // the service started later (after an update): no copy
  make(3600).start();
  await sleep(120);
  ok(D.copies().length === 1, 'a service started an hour into the TV keeps nothing');
  // only the last 2 starts are kept
  await D.keep('boot', 'a start');
  await D.keep('boot', 'a start');
  ok(D.copies().filter(c => /^boot-/.test(c.name)).length === 2, 'the last 2 starts are kept');
  // Fix the picture: the logs kept, then the TV restarted; not again within 5 minutes
  calls.length = 0;
  let r = await call(D, '/api/picture/fix', 'POST', { restart: true });
  const kept = r.j.saved;
  await sleep(80);
  const reboot = calls.filter(c => c[0] === 'reboot');
  const again = await call(D, '/api/picture/fix', 'POST', { restart: true });
  ok(
    r.code === 200 &&
      r.j.restarting === true &&
      /^picture-/.test(kept) &&
      fs.existsSync(path.join(dir, kept, 'dbg-log')) &&
      reboot.length === 1 &&
      JSON.stringify(reboot[0][1]) === JSON.stringify({ reason: 'remoteKey' }) &&
      again.code === 429,
    'Fix the picture keeps the logs, then restarts the TV, at most once in 5 minutes: ' + JSON.stringify([r.j, again.code, calls])
  );
  // without restart only kept; the last 3 kept; the list
  for (let i = 0; i < 3; i++) await call(D, '/api/picture/fix', 'POST', {});
  r = await call(D, '/api/picture/diag', 'GET');
  ok(
    r.j.copies.filter(c => /^picture-/.test(c.name)).length === 3 && calls.filter(c => c[0] === 'reboot').length === 1,
    'only kept without restart, the last 3 kept: ' + r.j.copies.map(c => c.name).join()
  );
  // a black picture fixed without a restart: the logs kept, then videooutputd and then umediaserver restarted where they run
  const reboots = calls.filter(c => c[0] === 'reboot').length;
  r = await call(D, '/api/picture/fix', 'POST', { media: true });
  const soon = await call(D, '/api/picture/fix', 'POST', { media: true });
  ok(
    r.code === 200 &&
      /^picture-/.test(r.j.saved) &&
      r.j.media.map(m => m.name + ':' + m.ok).join() === 'videooutputd:true,umediaserver:true' &&
      shs.length === 2 &&
      /is-active videooutputd .*restart videooutputd\.service$/.test(shs[0]) &&
      /is-active umediaserver .*restart umediaserver\.service$/.test(shs[1]) &&
      calls.filter(c => c[0] === 'reboot').length === reboots &&
      soon.code === 429,
    'Fix a black picture: the media services in order, the TV left on, not twice at once: ' + JSON.stringify([r.j, shs, soon.code])
  );
  // a service that does not run is left alone
  shs.length = 0;
  const S = req('picturediag').create(
    { luna: async () => ({ returnValue: true }), profile: { get: () => ({}) } },
    { dir, sources: [dbg], sh: async c => (shs.push(c), /videooutputd/.test(c) ? { ok: false, code: 3 } : { ok: true, code: 0 }) }
  );
  const m = await S.fix({ media: true });
  ok(
    m.media[0].skipped === true && m.media[1].ok === true && shs.length === 2,
    'a media service that does not run is skipped: ' + JSON.stringify(m.media)
  );
});
