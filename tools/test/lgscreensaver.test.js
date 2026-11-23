// LG's screensaver question answered by the service (lgscreensaver.js), through a stand-in for LG's bus module (palmbus): one
// connection (Handle) holds the subscription and delivers a question; the answer must go out on that same connection, as tvpowerd
// takes an answer only from the connection that registered (an answer from another luna-send was refused on the owner's TV: "[setNack]
// ... clientName: cleanyourtv is not exist", then the timeout and a fault reboot at standby). The answer goes out at once: no (and Home
// opened with the photos and the app that was in front) when the screensaver is ours, yes when it is off or has no photos, yes over an
// HDMI input. Each answer is kept in a short record with LG's reply. LG's responseScreenSaverRequest takes the timestamp only as a
// string, and the answer carries it unchanged. Without the bus module nothing is registered. A subscription that ends is asked again.
// Only on webOS 22 and from webOS 25 on (tvprofile.js lgScreensaver: 'bus', where this was tried): on webOS 23 and 24 nothing is
// registered, and while the TV's version is not known yet it waits for it.
const fs = require('fs'),
  path = require('path'),
  EventEmitter = require('events');
const { ok, tmp, sleep, req, memoryConfig, run } = require('./lib');

run(async () => {
  process.setMaxListeners(30); // every part made here ends with the process (process.once('exit')), as the one in the service does
  const S = req('lgscreensaver');
  const record = path.join(tmp, 'ss-answers.log');
  // the stand-in bus: every Handle is one connection; calls and subscriptions are noted with the connection they came from
  function fakeBus(opts) {
    const o = Object.assign({ reply: { returnValue: true } }, opts);
    const bus = { handles: [], calls: [], subs: [] };
    let n = 0;
    bus.Handle = function () {
      this.id = ++n;
      bus.handles.push(this);
    };
    bus.Handle.prototype.subscribe = function (uri, json) {
      const c = new EventEmitter();
      c.cancelled = false;
      c.cancel = () => {
        c.cancelled = true;
      };
      c.handle = this.id;
      c.uri = uri;
      c.args = JSON.parse(json);
      bus.subs.push(c);
      setImmediate(() => c.emit('response', { payload: () => '{"returnValue":true,"subscribed":true}' }));
      return c;
    };
    bus.Handle.prototype.call = function (uri, json) {
      const c = new EventEmitter();
      bus.calls.push({ handle: this.id, uri: uri.replace(/^luna:\/\//, ''), args: JSON.parse(json) });
      setImmediate(() => c.emit('response', { payload: () => JSON.stringify(o.reply) }));
      return c;
    };
    // LG asks: a question on the newest subscription
    bus.ask = ts => {
      const s = bus.subs[bus.subs.length - 1];
      s.emit('response', { payload: () => JSON.stringify({ returnValue: true, timestamp: ts, state: 'Active' }) });
    };
    return bus;
  }
  // the photos come from the wallpapers part (its list: uploads, Immich, the feed) and the photo feed (its count), as on the TV
  const featureOf = photos => n =>
    n === 'wallpapers' ? { list: () => Array.from({ length: photos }, (_, i) => 'u/' + i) } : n === 'photofeed' ? { count: () => 0 } : null;
  // the TV's profile as tvprofile.js makes it: webOS 25 unless a test says otherwise
  const tv = req('tvprofile');
  const profileOf = sdk => ({ get: () => tv.decide({ sdk, home: 'com.webos.app.home flutter' }) });
  const webOS25 = profileOf('10.2.2');
  async function once(conf, fg, opts) {
    const o = opts || {};
    const bus = fakeBus(o.bus);
    const luna = [];
    const ctx = {
      config: memoryConfig(conf),
      profile: webOS25,
      feature: featureOf(conf._photos === undefined ? 3 : conf._photos),
      luna: async (uri, p) => {
        luna.push([uri.replace(/^luna:\/\//, ''), p]);
        if (/getForegroundAppInfo/.test(uri)) return { returnValue: true, appId: fg };
        if (/getActivePipelines$/.test(uri) && o.pipelines) return o.pipelines;
        return { returnValue: true };
      },
    };
    const part = S.create(ctx, { bus: () => bus, record, keep: 3, minWaitMs: 50, maxWaitMs: 100, proc: path.join(tmp, 'no-proc') });
    part.start();
    await sleep(20);
    bus.ask('5934:120');
    for (let i = 0; i < 60 && !bus.calls.length; i++) await sleep(20);
    await sleep(60);
    part.stop();
    return { bus, luna, part };
  }
  const on = { saver: { on: true } };
  let r = await once(on, 'netflix');
  const sub = r.bus.subs[0],
    resp = r.bus.calls.filter(x => /responseScreenSaverRequest/.test(x.uri))[0],
    launch = r.luna.filter(x => /applicationManager\/launch/.test(x[0]))[0];
  ok(
    !!sub &&
      sub.args.subscribe === true &&
      sub.args.clientName === 'cleanyourtv' &&
      /registerScreenSaverRequest$/.test(sub.uri) &&
      r.bus.handles.length === 1,
    'one connection to LG bus registers for the question, as cleanyourtv'
  );
  ok(
    !!resp &&
      resp.handle === sub.handle &&
      resp.args.ack === false &&
      resp.args.timestamp === '5934:120' &&
      resp.args.clientName === 'cleanyourtv' &&
      !r.luna.some(x => /responseScreenSaverRequest/.test(x[0])),
    'the answer goes out on the connection that registered (never through another luna-send), with the timestamp unchanged: ' +
      JSON.stringify(r.bus.calls)
  );
  ok(
    !!launch && launch[1].id === 'com.webos.app.home' && launch[1].params.saver === 'start' && launch[1].params.from === 'netflix',
    'ours: Home opens with the photos and the app that was in front'
  );
  let rec = fs
    .readFileSync(record, 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
  ok(
    rec.length === 1 &&
      rec[0].ack === false &&
      rec[0].over === 'netflix' &&
      rec[0].lg === 'ok' &&
      rec[0].ms >= 0 &&
      !rec[0].ts &&
      /T/.test(rec[0].at),
    'the answer is kept in the record with the app in front, how long it took and LG reply: ' + JSON.stringify(rec)
  );
  // LG refuses the answer: the record says why
  await once(on, 'netflix', { bus: { reply: { returnValue: false, errorCode: -13, errorText: 'The response is too late' } } });
  rec = fs
    .readFileSync(record, 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
  ok(rec.length === 2 && rec[1].lg === 'The response is too late', "LG's refusal is kept in the record: " + JSON.stringify(rec[1]));
  r = await once({ saver: { on: false } }, 'netflix');
  ok(
    r.bus.calls.some(x => /responseScreenSaverRequest/.test(x.uri) && x.args.ack === true) &&
      !r.luna.some(x => /launch/.test(x[0])) &&
      !r.luna.some(x => /getForeground/.test(x[0])),
    'switched off: LG decides (yes), nothing opens'
  );
  r = await once({ saver: { on: true }, _photos: 0 }, 'netflix');
  ok(
    r.bus.calls.some(x => /responseScreenSaverRequest/.test(x.uri) && x.args.ack === true) && !r.luna.some(x => /launch/.test(x[0])),
    'no photos: LG decides'
  );
  rec = fs.readFileSync(record, 'utf8').trim().split('\n');
  ok(rec.length === 3, 'the record keeps only the last answers (' + rec.length + ')');
  r = await once(on, 'com.webos.app.hdmi2');
  ok(
    r.bus.calls.some(x => /responseScreenSaverRequest/.test(x.uri) && x.args.ack === true) &&
      !r.luna.some(x => /applicationManager\/launch/.test(x[0])),
    'over an HDMI input: left to LG'
  );
  // music in the app on screen: LG is told no and Home stays where it is (bringing it forward ends the app's media pipeline, so the
  // music stops). The pipelines are as the owner's TV listed them while Spotify played (2026-11-23)
  {
    const idle = { id: '_37CRA28TeML4Nb', type: 'vtclient', sub_type: 'card', is_foreground: false, resource: [] };
    const music = app => ({
      id: '_vMWjQq8t2NTdkA',
      type: 'media',
      sub_type: 'card',
      appStatus: 6,
      currentAppId: app,
      is_foreground: true,
      resource: [{ index: 3, resource: 'PCMMC' }],
    });
    const av = { id: '_eiJFQq8yOib9kS', type: 'avconnector', currentAppId: 'spotify-beehive', is_foreground: true, resource: [] };
    const opened = x => x.luna.some(l => /applicationManager\/launch/.test(l[0]));
    const no = x => x.bus.calls.some(c => /responseScreenSaverRequest/.test(c.uri) && c.args.ack === false);
    let m = await once(on, 'spotify-beehive', { pipelines: [idle, av, music('spotify-beehive')] });
    ok(
      no(m) && !opened(m) && /music/.test(m.part.status().last),
      'music in the app on screen: LG told no, Home not opened: ' + m.part.status().last
    );
    m = await once(on, 'spotify-beehive', { pipelines: [idle] });
    ok(no(m) && opened(m), 'the same app with nothing playing: the photos as before');
    m = await once(on, 'spotify-beehive', { pipelines: [idle, music('netflix')] });
    ok(opened(m), "another app's sound is not the app on screen's");
    // a picture is decoded too: LG does not ask while a video plays, so this one is paused
    const video = music('youtube.leanback.v4');
    video.resource = [
      { index: 0, resource: 'VDEC' },
      { index: 0, resource: 'ADEC' },
    ];
    m = await once(on, 'youtube.leanback.v4', { pipelines: [video] });
    ok(opened(m), 'a paused video: the photos as before');
    m = await once(on, 'spotify-beehive', { pipelines: { returnValue: false, errorText: 'no' } });
    ok(no(m) && opened(m), 'the media service does not answer: the photos as before');
    m = await once(on, 'com.webos.app.home', { pipelines: [music('com.webos.app.home')] });
    ok(opened(m), "Home in front: the page's own rules decide, as before");
    m = await once({ saver: { on: false } }, 'spotify-beehive', { pipelines: [music('spotify-beehive')] });
    ok(!m.luna.some(l => /getActivePipelines/.test(l[0])), 'switched off: nothing is asked');
  }
  // without LG's bus module nothing is registered: a question no one can answer is worse than LG's own screensaver
  {
    const calls = [];
    const part = S.create(
      { config: memoryConfig(on), profile: webOS25, feature: featureOf(3), luna: async u => (calls.push(u), { returnValue: true }) },
      { bus: () => null, proc: path.join(tmp, 'no-proc') }
    );
    part.start();
    await sleep(30);
    part.stop();
    ok(
      !calls.length && part.status().listening === false && /not registered/.test(part.status().last),
      'without the bus module nothing is registered: ' + part.status().last
    );
  }
  // webOS 22 (the owner's 86UQ8000): registered and answered on the same connection, as on webOS 25
  {
    const bus = fakeBus();
    const part = S.create(
      { config: memoryConfig(on), profile: profileOf('7.6.0'), feature: featureOf(3), luna: async () => ({ returnValue: true }) },
      { bus: () => bus, minWaitMs: 30, maxWaitMs: 60, proc: path.join(tmp, 'no-proc') }
    );
    part.start();
    await sleep(20);
    bus.ask('2176077378');
    for (let i = 0; i < 40 && !bus.calls.length; i++) await sleep(10);
    part.stop();
    const a = bus.calls.filter(x => /responseScreenSaverRequest/.test(x.uri))[0];
    ok(
      bus.subs.length === 1 && !!a && a.handle === bus.subs[0].handle && a.args.ack === false && a.args.timestamp === '2176077378',
      'webOS SDK 7.6.0: registered, and the answer on the same connection: ' + JSON.stringify(bus.calls)
    );
  }
  // webOS 23 and 24 (tvprofile.js lgScreensaver ''): not tried there, and a registered client that answers wrong is a fault that
  // reboots the TV at standby, so nothing registers and LG shows its own screensaver
  for (const sdk of ['8.4.0', '9.2.4']) {
    const bus = fakeBus();
    const part = S.create(
      { config: memoryConfig(on), profile: profileOf(sdk), feature: featureOf(3), luna: async () => ({ returnValue: true }) },
      { bus: () => bus, minWaitMs: 30, maxWaitMs: 60, proc: path.join(tmp, 'no-proc') }
    );
    part.start();
    await sleep(40);
    part.stop();
    ok(
      !bus.handles.length &&
        !bus.subs.length &&
        part.status().listening === false &&
        /not registered on webOS SDK/.test(part.status().last),
      'webOS SDK ' + sdk + ': no connection to LG bus and nothing registered, LG decides: ' + part.status().last
    );
  }
  // the TV's version not known yet (the first start): it waits, and registers once the profile says webOS 25
  {
    const bus = fakeBus();
    let p = tv.decide({}, []);
    const part = S.create(
      { config: memoryConfig(on), profile: { get: () => p }, feature: featureOf(3), luna: async () => ({ returnValue: true }) },
      { bus: () => bus, profileWaitMs: 20, minWaitMs: 30, maxWaitMs: 60, proc: path.join(tmp, 'no-proc') }
    );
    part.start();
    await sleep(50);
    const before = bus.subs.length;
    p = webOS25.get();
    for (let i = 0; i < 40 && !bus.subs.length; i++) await sleep(10);
    part.stop();
    ok(
      before === 0 && bus.subs.length === 1,
      'an unknown version waits; it registers once the profile is read (' + before + ', ' + bus.subs.length + ')'
    );
  }
  // a luna-send subscription left by an earlier version is ended at start; other programs are left alone
  const proc = path.join(tmp, 'ss-proc'),
    killed = [];
  [
    [
      '4242',
      'luna-send\0-i\0luna://com.webos.service.tvpower/power/registerScreenSaverRequest\0{"subscribe":true,"clientName":"cleanyourtv"}\0',
    ],
    ['4343', 'luna-send\0-i\0luna://com.webos.service.tvpower/power/getPowerState\0{}\0'],
    ['4444', 'node\0helper.js\0'],
  ].forEach(([pid, cmd]) => {
    fs.mkdirSync(path.join(proc, pid), { recursive: true });
    fs.writeFileSync(path.join(proc, pid, 'cmdline'), cmd);
  });
  const sw = S.create(
    { config: memoryConfig(on), profile: webOS25, feature: featureOf(3), luna: async () => ({ returnValue: true }) },
    { bus: () => fakeBus(), proc, kill: pid => killed.push(pid), minWaitMs: 100 }
  );
  sw.start();
  sw.stop();
  ok(killed.join() === '4242', 'a luna-send subscription left by an earlier version is ended at start, nothing else: ' + killed.join());
  // the subscription ends (the power service restarted): it is asked again, on the same connection, and stop cancels it
  {
    const bus = fakeBus();
    const part = S.create(
      { config: memoryConfig(on), profile: webOS25, feature: featureOf(3), luna: async () => ({ returnValue: true }) },
      { bus: () => bus, minWaitMs: 30, maxWaitMs: 60, proc: path.join(tmp, 'no-proc') }
    );
    part.start();
    await sleep(20);
    bus.subs[0].emit('cancel', { payload: () => '{}' });
    for (let i = 0; i < 40 && bus.subs.length < 2; i++) await sleep(10);
    part.stop();
    ok(
      bus.subs.length === 2 && bus.subs[1].handle === bus.subs[0].handle && bus.subs[1].cancelled === true && bus.handles.length === 1,
      'an ended subscription is asked again on the same connection, and stop cancels it (' + bus.subs.length + ')'
    );
  }
});
