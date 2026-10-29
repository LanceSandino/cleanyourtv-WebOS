// LG's screensaver question answered by the service (lgscreensaver.js): a stand-in luna-send holds the subscription and delivers one
// question; the answer goes out at once: no (and Home opened with the photos and the app that was in front) when the screensaver is
// ours, yes when it is off or has no photos, yes over an HDMI input. The subscription is asked again when it ends. Each answer is kept
// in a short record with LG's reply. LG's responseScreenSaverRequest takes the timestamp only as a string (a number: "'timestamp' is
// needed, invalid param", read on the owner's TV), so the stand-in sends one and the answer must carry it unchanged.
const fs = require('fs'),
  path = require('path');
const { ok, tmp, sleep, req, memoryConfig, run } = require('./lib');

run(async () => {
  const bin = path.join(tmp, 'luna-send-ss'),
    count = path.join(tmp, 'ss-count');
  // the subscription: subscribed, then one question, then it waits (or ends when asked to, to test the restart)
  fs.writeFileSync(
    bin,
    '#!/bin/sh\necho x >> ' +
      count +
      '\necho \'{"returnValue":true,"subscribed":true}\'\necho \'{"timestamp":"5934:120"}\'\n[ -n "$SS_END" ] && exit 0\nsleep 30\n',
    { mode: 0o755 }
  );
  const S = req('lgscreensaver');
  const record = path.join(tmp, 'ss-answers.log');
  let lgReply = { returnValue: true };
  async function once(conf, fg, env) {
    const calls = [];
    const luna = async (uri, p) => {
      calls.push([uri.replace(/^luna:\/\//, ''), p]);
      if (/getForegroundAppInfo/.test(uri)) return { returnValue: true, appId: fg };
      if (/responseScreenSaverRequest/.test(uri)) return lgReply;
      return { returnValue: true };
    };
    if (env) process.env.SS_END = '1';
    else delete process.env.SS_END;
    const part = S.create({ config: memoryConfig(conf), luna }, { bin, minWaitMs: 100, maxWaitMs: 200, record, keep: 3 });
    part.start();
    // the answer (or, for the restart, a few starts): waited for, not timed, so a busy machine does not miss it
    for (let i = 0; i < 60 && !calls.some(x => /responseScreenSaverRequest/.test(x[0]) || /launch/.test(x[0])); i++) await sleep(50);
    await sleep(env ? 600 : 150);
    part.stop();
    return calls;
  }
  const on = { saver: { on: true }, photoFeed: { photos: 3 } };
  let c = await once(on, 'netflix');
  const resp = c.filter(x => /responseScreenSaverRequest/.test(x[0]))[0],
    launch = c.filter(x => /applicationManager\/launch/.test(x[0]))[0];
  ok(
    !!resp &&
      resp[1].ack === false &&
      resp[1].timestamp === '5934:120' &&
      resp[1].clientName === 'cleanyourtv' &&
      !!launch &&
      launch[1].id === 'com.webos.app.home' &&
      launch[1].params.saver === 'start' &&
      launch[1].params.from === 'netflix',
    'ours: LG is told no at once, and Home opens with the photos and the app that was in front: ' + JSON.stringify(c)
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
  lgReply = { returnValue: false, errorCode: -13, errorText: 'The response is too late' };
  await once(on, 'netflix');
  lgReply = { returnValue: true };
  rec = fs
    .readFileSync(record, 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));
  ok(rec.length === 2 && rec[1].lg === 'The response is too late', "LG's refusal is kept in the record: " + JSON.stringify(rec[1]));
  c = await once({ saver: { on: false }, photoFeed: { photos: 3 } }, 'netflix');
  ok(
    c.some(x => /responseScreenSaverRequest/.test(x[0]) && x[1].ack === true) &&
      !c.some(x => /launch/.test(x[0])) &&
      !c.some(x => /getForeground/.test(x[0])),
    'switched off: LG decides (yes), nothing opens'
  );
  c = await once({ saver: { on: true } }, 'netflix');
  ok(
    c.some(x => /responseScreenSaverRequest/.test(x[0]) && x[1].ack === true) && !c.some(x => /launch/.test(x[0])),
    'no photos: LG decides'
  );
  rec = fs.readFileSync(record, 'utf8').trim().split('\n');
  ok(rec.length === 3, 'the record keeps only the last answers (' + rec.length + ')');
  c = await once(on, 'com.webos.app.hdmi2');
  ok(
    c.some(x => /responseScreenSaverRequest/.test(x[0]) && x[1].ack === true) && !c.some(x => /applicationManager\/launch/.test(x[0])),
    'over an HDMI input: left to LG'
  );
  // a subscription left by an earlier run of the service is ended before ours starts; other programs are left alone
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
    { config: memoryConfig(on), luna: async () => ({ returnValue: true }) },
    { bin, proc, kill: pid => killed.push(pid), minWaitMs: 100 }
  );
  sw.start();
  sw.stop();
  ok(killed.join() === '4242', 'a subscription of ours left by an earlier run is ended at start, nothing else: ' + killed.join());
  // the subscription ends: it is asked again
  fs.writeFileSync(count, '');
  await once(on, 'netflix', true);
  const starts = fs.readFileSync(count, 'utf8').split('\n').filter(Boolean).length;
  ok(starts >= 2, 'an ended subscription is asked again (' + starts + ' times)');
});
