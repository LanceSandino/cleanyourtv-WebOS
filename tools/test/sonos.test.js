// Sonos volume on screen (sonos.js, the volume bar of notify.js and notify/app): with stand-in Sonos players on this computer (their
// HTTP side and an SSDP responder, no real device): off by default, the search, the events, the bar only on a change and only while
// the screen is on, the guards of the event port, renewals, a speaker that moved, reading instead of events, switching off. And that it
// only ever reads: every request a stand-in receives is a search, a description, GetVolume, GetMute or a (un)subscription.
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  dgram = require('dgram');
const { ok, root, tmp, call, serve, sleep, req, memoryConfig, run } = require('./lib');

// luna-send for notify.js: logs what it was asked
const BIN = path.join(tmp, 'bin'),
  LUNALOG = path.join(tmp, 'luna.log');
fs.mkdirSync(BIN);
fs.writeFileSync(
  path.join(BIN, 'luna-send'),
  '#!/bin/sh\nfor a in "$@"; do last="$a"; done\nprintf \'%s\\n\' "$last" >> "' + LUNALOG + '"\necho \'{"returnValue":true}\'\n',
  { mode: 0o755 }
);
process.env.PATH = BIN + ':' + process.env.PATH;

const until = async (fn, ms) => {
  const end = Date.now() + (ms || 3000);
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(15);
  }
  return !!fn();
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a RenderingControl event as a Sonos sends it: the state inside LastChange, escaped
const event = (vol, mute) =>
  '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0"><e:property><LastChange>' +
  esc(
    '<Event xmlns="urn:schemas-upnp-org:metadata-1-0/RCS/"><InstanceID val="0"><Volume channel="Master" val="' +
      vol +
      '"/><Volume channel="LF" val="100"/><Volume channel="RF" val="100"/><Mute channel="Master" val="' +
      (mute ? 1 : 0) +
      '"/><Mute channel="LF" val="0"/><Bass val="2"/><NightMode val="0"/></InstanceID></Event>'
  ) +
  '</LastChange></e:property></e:propertyset>';
function notifyTo(callback, sid, vol, mute, o) {
  const x = o || {};
  const m = /^<http:\/\/([^:/]+):(\d+)(\/[^>]*)>$/.exec(callback);
  const body = event(vol, mute);
  return new Promise(res => {
    const q = http.request(
      {
        host: m[1],
        port: +m[2],
        method: x.method || 'NOTIFY',
        path: x.path || m[3],
        headers: {
          'content-type': 'text/xml',
          NT: 'upnp:event',
          NTS: 'upnp:propchange',
          SID: sid,
          SEQ: '1',
          'content-length': Buffer.byteLength(body),
        },
      },
      rs => {
        rs.resume();
        rs.on('end', () => res(rs.statusCode));
      }
    );
    q.on('error', e => res(e.code));
    q.end(body);
  });
}

// a stand-in player: its description, GetVolume/GetMute, (un)subscriptions, and events to its subscribers
function player(o) {
  const sp = Object.assign(
    { volume: 10, muted: false, events: true, timeout: 1800, refuseRenew: false, log: [], subs: new Map(), n: 0 },
    o
  );
  sp.server = http.createServer((q, r) => {
    const parts = [];
    q.on('data', c => parts.push(c));
    q.on('end', () => {
      const action = String(q.headers.soapaction || '').replace(/^"[^#]*#|"$/g, '');
      sp.log.push({ method: q.method, url: q.url, action, sid: q.headers.sid || '', te: q.headers['transfer-encoding'] || '' });
      if (q.method === 'GET' && q.url === '/xml/device_description.xml') {
        r.writeHead(200, { 'content-type': 'text/xml' });
        return r.end(
          '<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><device><deviceType>urn:schemas-upnp-org:device:ZonePlayer:1</deviceType>' +
            '<modelName>' +
            sp.model +
            '</modelName><displayName>X</displayName><roomName>' +
            esc(sp.room) +
            '</roomName><UDN>uuid:' +
            sp.id +
            '</UDN></device></root>'
        );
      }
      if (q.method === 'POST' && q.url === '/MediaRenderer/RenderingControl/Control') {
        if (action === 'GetVolume')
          return r.end(
            '<s:Envelope><s:Body><u:GetVolumeResponse><CurrentVolume>' +
              sp.volume +
              '</CurrentVolume></u:GetVolumeResponse></s:Body></s:Envelope>'
          );
        if (action === 'GetMute')
          return r.end(
            '<s:Envelope><s:Body><u:GetMuteResponse><CurrentMute>' +
              (sp.muted ? 1 : 0) +
              '</CurrentMute></u:GetMuteResponse></s:Body></s:Envelope>'
          );
        r.writeHead(500);
        return r.end();
      }
      if (q.method === 'SUBSCRIBE' && q.url === '/MediaRenderer/RenderingControl/Event') {
        if (q.headers.sid) {
          if (sp.refuseRenew || !sp.subs.has(q.headers.sid)) {
            sp.subs.delete(q.headers.sid); // as a speaker that restarted: it no longer knows the subscription
            r.writeHead(412);
            return r.end();
          }
          r.writeHead(200, { SID: q.headers.sid, TIMEOUT: 'Second-' + sp.timeout });
          return r.end();
        }
        const sid = 'uuid:' + sp.id + '_sub' + ++sp.n;
        sp.subs.set(sid, q.headers.callback);
        sp.lastCallback = q.headers.callback;
        sp.lastSid = sid;
        r.writeHead(200, { SID: sid, TIMEOUT: 'Second-' + sp.timeout });
        r.end();
        // the first event, at once, with the current state
        if (sp.events) setTimeout(() => notifyTo(q.headers.callback, sid, sp.volume, sp.muted), 5);
        return;
      }
      if (q.method === 'UNSUBSCRIBE') {
        sp.subs.delete(q.headers.sid);
        return r.end();
      }
      r.writeHead(404);
      r.end();
    });
  });
  sp.change = (vol, mute) => {
    sp.volume = vol;
    sp.muted = !!mute;
    if (!sp.events) return Promise.resolve([]);
    return Promise.all(Array.from(sp.subs).map(e => notifyTo(e[1], e[0], vol, mute)));
  };
  return new Promise(r =>
    sp.server.listen(0, '127.0.0.1', () => {
      sp.port = sp.server.address().port;
      r(sp);
    })
  );
}

run(async () => {
  const S = req('sonos');

  // ---- what a Sonos sends, read from it
  ok(
    JSON.stringify(S.parseEvent(event(12, false))) === '{"volume":12,"muted":false}' &&
      JSON.stringify(S.parseEvent(event(0, true))) === '{"volume":0,"muted":true}',
    'an event gives the master volume and mute (not the left and right channels)'
  );
  ok(
    S.parseEvent('<e:propertyset><LastChange>&lt;Event&gt;&lt;Bass val=&quot;2&quot;/&gt;&lt;/Event&gt;</LastChange></e:propertyset>') ===
      null,
    'an event without the volume changes nothing'
  );
  ok(
    JSON.stringify(
      S.parseDescription('<UDN>uuid:RINCON_AB12</UDN><modelName>Sonos Beam</modelName><roomName>Den &amp; hall</roomName>')
    ) === '{"id":"RINCON_AB12","name":"Den & hall","model":"Sonos Beam","theater":true}' &&
      S.parseDescription('<UDN>uuid:other</UDN>') === null,
    'a description gives the id, the room and the model; one that is not a Sonos player is ignored'
  );

  // ---- read only: the code has no way to change a speaker
  const src = fs.readFileSync(path.join(root, 'helper', 'sonos.js'), 'utf8');
  ok(
    JSON.stringify(S.READ_ONLY) === '["GetVolume","GetMute"]' && !/\bSet[A-Z]\w*|RampToVolume|SetRelativeVolume|#Set/.test(src),
    'the only speaker actions in the code are GetVolume and GetMute (no Set*, no ramp)'
  );

  // ---- stand-ins: a soundbar and a second speaker, and the SSDP answers for them
  const bar = await player({ id: 'RINCON_00112233445501400', model: 'Sonos Beam', room: 'Den' });
  const one = await player({ id: 'RINCON_TESTONE01400', model: 'Sonos One', room: 'Kitchen', events: false });
  let searches = 0,
    barSilent = false; // the soundbar misses the search (asleep, a lost datagram)
  const ssdp = dgram.createSocket('udp4');
  ssdp.on('message', (m, from) => {
    const t = m.toString();
    if (!/^M-SEARCH \* HTTP\/1\.1/.test(t) || t.indexOf('ST: urn:schemas-upnp-org:device:ZonePlayer:1') < 0) return;
    searches++;
    const reply = (loc, id) => {
      const b = Buffer.from(
        'HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age = 1800\r\nEXT:\r\nLOCATION: ' +
          loc +
          '\r\nSERVER: Linux UPnP/1.0 Sonos/97.2 (ZPS14)\r\nST: urn:schemas-upnp-org:device:ZonePlayer:1\r\nUSN: uuid:' +
          id +
          '::urn:schemas-upnp-org:device:ZonePlayer:1\r\n\r\n'
      );
      ssdp.send(b, 0, b.length, from.port, from.address);
    };
    if (!barSilent) reply('http://127.0.0.1:' + bar.port + '/xml/device_description.xml', bar.id);
    reply('http://127.0.0.1:' + one.port + '/xml/device_description.xml', one.id);
    reply('http://10.9.9.9:1400/xml/device_description.xml', 'RINCON_ELSEWHERE01400'); // points at another address
    reply('http://127.0.0.1:8765/api/manager/status', 'RINCON_WRONGPATH01400'); // not a description
  });
  await new Promise(r => ssdp.bind(0, '127.0.0.1', r));

  let power = 'Active',
    output = 'external_arc',
    fg = 'netflix',
    lunaCalls = 0;
  const shows = [];
  /** @type {any} */ let hdmiFeed = null;
  const conf = memoryConfig({});
  const ctx = {
    config: conf,
    luna: async uri => {
      lunaCalls++;
      if (/getPowerState/.test(uri)) return { returnValue: true, state: power };
      if (/getSoundOutput/.test(uri)) return { returnValue: true, soundOutput: output };
      if (/getForegroundAppInfo/.test(uri)) return { returnValue: true, appId: fg };
      return { returnValue: true };
    },
    notify: { show: async (p, internal) => shows.push(Object.assign({ internal }, p)) },
    // the soundbar's reports over HDMI (hdmivolume.js, tested in hdmivolume.test.js): fed by hand here
    hdmivolume: { start: fn => (hdmiFeed = fn), stop: () => (hdmiFeed = null), state: () => (hdmiFeed ? 'listening' : 'off') },
  };
  const opts = {
    findMs: 250,
    firstEventMs: 400,
    pollMs: 80,
    retryMs: 150,
    screenMs: 20,
    holdMs: 250,
    ackMs: 150,
    hdmiWinsMs: 300,
    ssdp: { address: '127.0.0.1', port: ssdp.address().port },
    selfOk: true,
  };
  const son = S.create(ctx, opts);

  // ---- off by default: nothing on the network
  son.start();
  await sleep(150);
  ok(
    son.status().enabled === false && son.status().state === 'off' && !searches && !bar.log.length && !one.log.length,
    'off by default: no search, no request to any speaker'
  );
  const st0 = await call(son, '/api/sonos/status');
  ok(st0.code === 200 && st0.j.enabled === false && st0.j.speaker === null, 'GET /api/sonos/status answers while off');

  // ---- the search
  const f = await call(son, '/api/sonos/find', 'POST', {});
  const ids = (f.j.speakers || []).map(x => x.id).join();
  ok(f.code === 200 && ids === bar.id + ',' + one.id, 'the search finds both players, the soundbar first: ' + ids);
  ok(
    f.j.speakers[0].name === 'Den' && f.j.speakers[0].model === 'Sonos Beam' && f.j.speakers[0].theater && !('host' in f.j.speakers[0]),
    'each with its room and model, without its address'
  );
  ok(
    ids.indexOf('ELSEWHERE') < 0 && ids.indexOf('WRONGPATH') < 0,
    'an answer that points at another address, or at anything but a Sonos description, is ignored'
  );

  // ---- on, found automatically: the soundbar, by events, and no bar for the state it starts in
  let r = await call(son, '/api/sonos/set', 'POST', { enabled: true });
  ok(r.code === 200 && r.j.enabled && r.j.speaker === null, 'switched on, speaker chosen automatically');
  ok(await until(() => son.status().mode === 'events'), 'it follows the soundbar by events: ' + JSON.stringify(son.status()));
  ok(
    son.status().using.id === bar.id && son.status().volume === 10 && son.status().muted === false,
    'the soundbar is the one followed, at its volume'
  );
  await sleep(100);
  ok(!shows.length, 'no bar for the volume it starts at (the first event repeats it)');
  ok(conf.get().sonos.enabled === true && conf.get().sonos.speaker === null, 'the setting is saved, still automatic');
  ok(conf.get().sonos.seenBar === bar.id, 'the soundbar found is remembered by its id');

  // ---- changes show the bar
  await bar.change(12, false);
  ok(await until(() => shows.length === 1), 'a change of the volume shows the bar');
  const s1 = shows[0] || {};
  ok(
    s1.kind === 'volume' && s1.volume === 12 && s1.muted === false && s1.internal === true && s1.position === 'top-left' && s1.stay === 600,
    'with the new volume: ' + JSON.stringify(s1)
  );
  await bar.change(12, true);
  ok((await until(() => shows.length === 2)) && shows[1].muted === true && shows[1].volume === 12, 'muting shows the bar, muted');
  await bar.change(12, true);
  await sleep(120);
  ok(shows.length === 2, 'an event without a change shows nothing');

  // ---- the event port answers only the current subscription
  const cb = bar.lastCallback,
    sid = bar.lastSid;
  ok(/^<http:\/\/127\.0\.0\.1:\d+\/sonos\/[0-9a-f]{24}>$/.test(cb || ''), 'the events go to a random path on a port of the TV');
  ok((await notifyTo(cb, 'uuid:someone_else', 50, false)) === 412, 'an event with another subscription id is refused');
  ok((await notifyTo(cb, sid, 50, false, { path: '/sonos/' + '0'.repeat(24) })) === 403, 'an event on another path is refused');
  ok((await notifyTo(cb, sid, 50, false, { method: 'POST' })) === 403, 'anything but NOTIFY is refused');
  await sleep(80);
  ok(son.status().volume === 12 && shows.length === 2, 'none of them changed the volume shown');

  ok(
    JSON.stringify(conf.get().sonos.seenAt) === JSON.stringify({ host: '127.0.0.1', port: bar.port }),
    'and where it answered: ' + JSON.stringify(conf.get().sonos.seenAt)
  );

  // ---- a soundbar that misses a search is asked at its last address first, without a search
  barSilent = true;
  let searched = searches;
  await call(son, '/api/sonos/set', 'POST', { enabled: false });
  await call(son, '/api/sonos/set', 'POST', { enabled: true });
  ok(
    (await until(() => son.status().mode === 'events')) && son.status().using.id === bar.id && searches === searched,
    'the soundbar is found again at its last address, without a search: ' + JSON.stringify(son.status())
  );

  // ---- gone from its last address and silent: found where the TV's neighbour table has its network card (its id holds the address)
  ok(
    S.macOf(bar.id) === '00:11:22:33:44:55' && S.macOf('RINCON_A1B2C3D4E5F601400') === 'a1:b2:c3:d4:e5:f6' && S.macOf('uuid:x') === '',
    "a player's id gives its network card's address"
  );
  const arp = path.join(tmp, 'arp');
  const arpHead = 'IP address       HW type     Flags       HW address            Mask     Device\n';
  fs.writeFileSync(
    arp,
    arpHead +
      '192.168.9.7      0x1         0x0         00:11:22:33:44:55     *        wlan0\n' + // incomplete: not an answer
      '127.0.0.1        0x1         0x2         00:11:22:33:44:55     *        wlan0\n'
  );
  ok(
    S.arpFor(arp, '00:11:22:33:44:55') === '127.0.0.1' && S.arpFor(arp, 'aa:bb:cc:dd:ee:ff') === '',
    'the neighbour table gives its address'
  );
  const nowhere = { host: '127.0.0.1', port: 9 }; // nothing answers there
  const son3 = S.create(ctx, Object.assign({}, opts, { arp, speakerPort: bar.port, hdmi: { bin: path.join(tmp, 'none') } }));
  await conf.update('test', c => {
    c.sonos.seenAt = nowhere;
  });
  son3.start();
  ok(
    (await until(() => son3.status().mode === 'events')) && son3.status().using.id === bar.id,
    'the soundbar is followed at the address from the neighbour table: ' + JSON.stringify(son3.status())
  );
  ok(conf.get().sonos.seenAt.port === bar.port, 'and that address is kept');
  son3.stop();
  await until(() => son3.status().state === 'off');
  await conf.update('test', c => {
    c.sonos.enabled = true;
  });

  // ---- a soundbar that misses a search is looked for again, never swapped for the only other speaker that answered (2026-11-13)
  await call(son, '/api/sonos/set', 'POST', { enabled: false });
  await conf.update('test', c => {
    c.sonos.seenAt = nowhere;
  });
  await call(son, '/api/sonos/set', 'POST', { enabled: true });
  ok(
    (await until(() => /soundbar did not answer/.test(son.status().error || ''))) &&
      !(son.status().using && son.status().using.id === one.id),
    'with the soundbar silent it follows no other speaker: ' + JSON.stringify(son.status())
  );
  barSilent = false;
  ok(
    await until(() => son.status().mode === 'events' && son.status().using && son.status().using.id === bar.id, 4000),
    'the soundbar is followed again once it answers: ' + JSON.stringify(son.status())
  );

  // ---- only while the screen is on and the sound goes out of the TV
  power = 'Active Standby';
  await sleep(40);
  await bar.change(14, false);
  await sleep(150);
  ok(shows.length === 2 && son.status().volume === 14, 'in standby the volume is followed but not shown');
  power = 'Active';
  output = 'tv_speaker';
  await sleep(40);
  await bar.change(15, false);
  await sleep(150);
  ok(shows.length === 2, 'not while the TV plays through its own speakers (it shows its own volume then)');
  output = 'external_arc';
  await sleep(40);
  await bar.change(16, false);
  ok((await until(() => shows.length === 3)) && shows[2].volume === 16, 'shown again with the screen on and the sound on the soundbar');
  // over an HDMI input (a console) the bar's window does not stay open after the bar fades: an open window over the picture may
  // make the TV lower its HDR brightness
  fg = 'com.webos.app.hdmi4';
  await bar.change(17, false);
  ok(
    (await until(() => shows.length === 4)) && shows[3].stay === 0 && shows[2].stay === 600,
    'over an HDMI input the window closes when the bar fades; over an app it stays ready'
  );
  fg = 'netflix';
  ok(lunaCalls > 0, 'the power state and the sound output come from the TV');

  // ---- the soundbar's own report over HDMI: shown at once; the network's later (and maybe older) readings do not move the bar back
  ok(typeof hdmiFeed === 'function' && son.status().hdmi === 'listening', 'while on, the HDMI listener runs');
  const h0 = shows.length;
  hdmiFeed({ volume: 19, muted: false, press: true });
  ok((await until(() => shows.length === h0 + 1)) && shows[h0].volume === 19, 'a report over HDMI shows the bar with its volume');
  await bar.change(18, false); // the speaker's event, late, from before the last press
  await bar.change(19, false);
  await sleep(120);
  ok(shows.length === h0 + 1 && son.status().volume === 19, 'the network events right after it change nothing');
  await sleep(250);
  await bar.change(21, false); // later: a change in the Sonos app
  ok((await until(() => shows.length === h0 + 2)) && shows[h0 + 1].volume === 21, 'a change on the network later shows again');
  hdmiFeed({ volume: 21, muted: true, press: true });
  ok((await until(() => shows.length === h0 + 3)) && shows[h0 + 2].muted === true, 'mute over HDMI shows the bar muted');
  hdmiFeed({ volume: 21, muted: true, press: false }); // LG asking again: the same answer
  await sleep(100);
  ok(shows.length === h0 + 3, 'the same report again shows nothing');
  hdmiFeed({ volume: 21, muted: false, press: true });
  await until(() => shows.length === h0 + 4);
  await sleep(350);

  // ---- a burst of changes: one launch at a time, and the last value always arrives
  const slow = [];
  ctx.notify = {
    show: p => {
      slow.push(p.volume);
      return sleep(60);
    },
  };
  for (const v of [17, 18, 19, 20, 21]) await bar.change(v, false);
  await until(() => slow[slow.length - 1] === 21, 1500);
  ok(
    slow.length < 5 && slow[slow.length - 1] === 21,
    'a burst of changes launches the bar fewer times, ending at the last value: ' + slow.join()
  );
  ctx.notify = { show: async (p, internal) => shows.push(Object.assign({ internal }, p)) };

  // ---- the open bar's page waits on GET /api/sonos/wait (over HTTP, as the page asks): a change answers it at once, no launch
  const api = await serve((q, s2) => son.handle(q, s2, q.url.split('?')[0], async () => ({})));
  const waitAt = (since, shown) =>
    new Promise(done =>
      http.get(api.url + '/api/sonos/wait?since=' + since + (shown ? '&shown=' + shown : ''), r => {
        let b = '';
        r.on('data', c => (b += c));
        r.on('end', () => {
          let j = null;
          try {
            j = JSON.parse(b);
          } catch (_) {}
          done({ code: r.statusCode, j });
        });
      })
    );
  // the service's log, for its timing lines
  const logged = [],
    log0 = console.log;
  console.log = function () {
    logged.push(Array.prototype.join.call(arguments, ' '));
    log0.apply(console, arguments);
  };
  await bar.change(23, false);
  await until(() => shows.length && shows[shows.length - 1].volume === 23);
  const s23 = shows[shows.length - 1],
    n6 = shows.length;
  ok(s23.seq > 0, 'each launch carries the number of its change: ' + s23.seq);
  let answered = null;
  waitAt(s23.seq).then(x => (answered = x));
  await sleep(60);
  ok(!answered, 'the page that has the latest change is held');
  await bar.change(24, false);
  ok(
    (await until(() => answered)) &&
      answered.code === 200 &&
      answered.j.volume === 24 &&
      answered.j.seq > s23.seq &&
      answered.j.stay === 600,
    'a change answers the waiting page at once: ' + JSON.stringify(answered && answered.j)
  );
  // the page asks again as soon as it has shown it (notify/app does), and keeps asking during a burst: no launch, the changes in
  // order, the last one last
  const got = [24];
  let since = answered.j.seq,
    pageOpen = true;
  const pageLoop = (async () => {
    while (pageOpen) {
      const x = await waitAt(since, since); // the change it has, which it has just shown
      if (!x.j || x.j.stop) break;
      if (x.j.seq) {
        got.push(x.j.volume);
        since = x.j.seq;
      }
      await sleep(25); // the page shows it, then asks again
    }
  })();
  for (const v of [25, 26, 27, 28, 29]) await bar.change(v, false);
  ok(await until(() => got[got.length - 1] === 29), 'a burst reaches the open page, ending at the last value: ' + got.join());
  ok(
    shows.length === n6 && got.every((v, i) => !i || v > got[i - 1]),
    'without a launch, each value once and in order (none piled up): ' + got.join() + ', launches ' + (shows.length - n6)
  );
  ok(
    logged.some(l => /^sonos: bar 23 \(event\): checks \d+ ms, launch \d+ ms, shown -$/.test(l)),
    'the log times a change that was launched (this page did not say it showed it): ' + logged.filter(l => / 23 /.test(l)).join(' | ')
  );
  ok(
    logged.some(l => /^sonos: bar 24 \(event\): checks \d+ ms, wake \d+ ms, shown \d+ ms$/.test(l)) &&
      logged.some(l => /^sonos: bar 25 \(event\): checks \d+ ms, wake \d+ ms, shown \d+ ms$/.test(l)),
    'and each change handed to the open page: when it arrived, the checks, the wake and when the page showed it: ' +
      logged.filter(l => /: bar 2[4-8]/.test(l)).join(' | ')
  );
  // the page closed after it was handed a change (it does not ask again): the latest value is launched
  pageOpen = false;
  await pageLoop;
  let last = null;
  waitAt(since).then(x => (last = x)); // its last request
  await sleep(30);
  await bar.change(30, false);
  ok((await until(() => last)) && last.j.volume === 30, 'the page is handed the next change');
  await sleep(60);
  ok(shows.length === n6, 'nothing launched while it may still ask again');
  ok(
    (await until(() => shows.length === n6 + 1, 1500)) && shows[n6].volume === 30,
    'it did not ask again (its window closed): the latest value is launched'
  );
  await waitAt(shows[n6].seq, shows[n6].seq).then(() => {}); // the launched page shows it and asks (answered idle)
  ok(
    logged.some(l => /^sonos: bar 30 \(event\): checks \d+ ms, wake, no answer, launch \d+ ms, shown \d+ ms$/.test(l)),
    'the log says so: ' + logged.filter(l => /: bar 30/.test(l)).join(' | ')
  );
  // a launch at a time: a page that asks while its own launch is still under way gets the latest value, and nothing else is launched
  const launched = [];
  ctx.notify = {
    show: p => {
      launched.push(p);
      return sleep(250);
    },
  };
  await sleep(200);
  await bar.change(31, false);
  await until(() => launched.length === 1);
  await bar.change(32, false);
  await sleep(40);
  const coldPage = await waitAt(launched[0].seq, launched[0].seq); // the page from the launch has shown 31 and asks
  ok(coldPage.j && coldPage.j.volume === 32, 'the page from a launch that is still under way gets the latest value at once');
  await waitAt(coldPage.j.seq, coldPage.j.seq); // shows 32 and asks again (answered after holdMs)
  ok(launched.map(x => x.volume).join() === '31', 'and no second launch follows: ' + launched.map(x => x.volume).join());
  ok(
    logged.some(l => /^sonos: bar 31 \(event\): checks \d+ ms, launch \d+ ms, shown \d+ ms$/.test(l)) &&
      logged.some(l => /^sonos: bar 32 \(event\): checks \d+ ms, wake \d+ ms, shown \d+ ms$/.test(l)),
    'a change that came during a launch is timed as handed to the page that asked: ' + logged.filter(l => /: bar 3[12]/.test(l)).join(' | ')
  );
  ctx.notify = { show: async (p, internal) => shows.push(Object.assign({ internal }, p)) };
  // a wait with no change ends after a while and is asked again; while the screen is off it says stop (the window then closes)
  const idle = await waitAt(Date.now() + 1e6);
  ok(idle.j && idle.j.idle === true, 'a wait without a change ends after holdMs: ' + JSON.stringify(idle.j));
  power = 'Active Standby';
  await sleep(40);
  const dark = await waitAt(Date.now() + 1e6);
  ok(dark.j && dark.j.stop === true, 'with the screen off it says stop');
  power = 'Active';
  await sleep(40);

  // ---- the chosen speaker; one that was not found is refused
  r = await call(son, '/api/sonos/set', 'POST', { speaker: 'RINCON_NOPE01400' });
  ok(r.code === 400 && /search again/.test(r.j.error), 'an unknown speaker is refused');
  r = await call(son, '/api/sonos/set', 'POST', { speaker: one.id, position: 'bottom-right' });
  ok(
    r.code === 200 && r.j.speaker.id === one.id && r.j.position === 'bottom-right',
    'another speaker chosen from the list, and a place on screen'
  );
  ok(await until(() => bar.subs.size === 0), 'the soundbar is unsubscribed when another speaker is chosen');

  // ---- a speaker whose events never arrive: its volume is read instead
  ok(
    await until(() => son.status().mode === 'polling', 2000),
    'without events it reads the volume instead: ' + JSON.stringify(son.status())
  );
  ok(await until(() => !one.subs.size), 'and drops the subscription that brings nothing');
  const n0 = shows.length;
  one.change(33, false);
  ok(await until(() => shows.length === n0 + 1), 'a change read that way shows the bar');
  ok((shows[n0] || {}).volume === 33 && shows[n0].position === 'bottom-right', 'with that volume, in the chosen place');

  // ---- a speaker that moved: found again by its id, its new address saved
  r = await call(son, '/api/sonos/set', 'POST', { speaker: bar.id });
  ok(await until(() => son.status().mode === 'events'), 'back on the soundbar');
  bar.server.close();
  const moved = await player({ id: bar.id, model: 'Sonos Beam', room: 'Den', volume: 21 });
  bar.port = moved.port; // the SSDP stand-in now answers with the new address
  son.sync();
  ok(
    await until(() => son.status().mode === 'events' && conf.get().sonos.speaker.port === moved.port, 3000),
    'a speaker that moved is found again by its id'
  );
  ok(son.status().using.id === bar.id && son.status().volume === 21, 'and followed at its new address');

  // ---- renewals, and a speaker that forgot the subscription
  moved.timeout = 2;
  const n1 = moved.n;
  son.sync();
  await until(() => moved.n > n1);
  const renewSid = moved.lastSid;
  ok(
    await until(() => moved.log.some(x => x.method === 'SUBSCRIBE' && x.sid === renewSid), 2500),
    'the subscription is renewed before it ends'
  );
  moved.refuseRenew = true;
  const subsBefore = moved.n;
  ok(await until(() => moved.n > subsBefore, 2500), 'a refused renewal subscribes again');
  moved.refuseRenew = false;
  moved.timeout = 1800;

  // ---- the place on screen and LG's bar change without subscribing again, so a change right after still shows
  await until(() => son.status().mode === 'events');
  const subsN = moved.n,
    n5 = shows.length;
  r = await call(son, '/api/sonos/set', 'POST', { position: 'top-right', hideLg: false });
  await moved.change(22, false);
  ok(
    (await until(() => shows.length === n5 + 1)) && shows[n5].position === 'top-right' && shows[n5].volume === 22 && moved.n === subsN,
    "a new place or LG's bar keeps the subscription, and the next change shows in the new place"
  );

  // ---- switched off: unsubscribed, the event port closed
  await until(() => son.status().mode === 'events');
  const lastCb = moved.lastCallback,
    lastSid = moved.lastSid;
  let held = null;
  waitAt(Date.now() + 1e6).then(x => (held = x));
  await sleep(40);
  r = await call(son, '/api/sonos/set', 'POST', { enabled: false });
  ok(r.j.enabled === false && r.j.state === 'off', 'switched off');
  ok(hdmiFeed === null && r.j.hdmi === 'off', 'and the HDMI listener stops');
  ok((await until(() => held)) && held.j.stop === true, 'a waiting page is told to stop');
  const offWait = await waitAt(0);
  ok(offWait.j && offWait.j.stop === true, 'and while it is off a wait is told to stop at once');
  const nLog = logged.length;
  await sleep(100);
  ok(
    logged.slice(nLog).every(l => !/^sonos: bar /.test(l)),
    'nothing is timed while it is off'
  );
  console.log = log0;
  api.server.close();
  ok(await until(() => moved.subs.size === 0), 'the speaker is unsubscribed');
  const closed = await notifyTo(lastCb, lastSid, 40, false);
  ok(closed === 'ECONNREFUSED', 'the event port is closed: ' + closed);

  // ---- nothing but reads reached any speaker
  const all = bar.log.concat(one.log, moved.log);
  const kinds = {};
  all.forEach(x => (kinds[x.method + ' ' + (x.action || x.url)] = 1));
  const allowed = [
    'GET /xml/device_description.xml',
    'POST GetVolume',
    'POST GetMute',
    'SUBSCRIBE /MediaRenderer/RenderingControl/Event',
    'UNSUBSCRIBE /MediaRenderer/RenderingControl/Event',
  ];
  ok(
    Object.keys(kinds).every(k => allowed.indexOf(k) >= 0) && all.length > 10,
    'every request a speaker received only reads or (un)subscribes: ' + Object.keys(kinds).join(', ')
  );
  ok(
    all.every(x => !x.te),
    'requests without a body say so (no chunked SUBSCRIBE)'
  );
  ssdp.close();
  one.server.close();
  moved.server.close();

  // ---- LG's own volume bar (lgvolume.js on lgconfig.js): one setting in configd's RAM layer, in every country folder, while it applies
  const layer = path.join(tmp, 'rmm'),
    oldDir = path.join(tmp, 'tvconfig-remote'),
    record = path.join(tmp, 'lgconfig-record.json');
  for (const d of [layer, path.join(layer, 'USA'), path.join(layer, 'CAN'), oldDir]) fs.mkdirSync(d);
  const lgFile = path.join(layer, 'USA', 'com.webos.surfacemanager.json'),
    lgFile2 = path.join(layer, 'CAN', 'com.webos.surfacemanager.json'),
    oldFile = path.join(oldDir, 'com.webos.surfacemanager.json');
  fs.writeFileSync(oldFile, '{"volumeOSD": false}\n'); // what 1.6.19 wrote where configd never reads it
  let out2 = 'external_arc',
    prof = { lgVolumeBar: 'configd' };
  const lcalls = [];
  const ctx2 = {
    config: memoryConfig({}),
    profile: { get: () => prof },
    luna: async uri => {
      lcalls.push(uri.replace('luna://', ''));
      if (/getSoundOutput/.test(uri)) return { returnValue: true, soundOutput: out2 };
      if (/getPowerState/.test(uri)) return { returnValue: true, state: 'Active' };
      return { returnValue: true };
    },
    notify: { show: async () => {} },
  };
  const son2 = S.create(
    ctx2,
    Object.assign({}, opts, {
      outputMs: 60,
      lgDir: layer,
      lgRecord: record,
      lgOldDir: oldDir,
      findMs: 50,
      retryMs: 5000,
      ssdp: { address: '127.0.0.1', port: 9 },
    })
  );
  const reconf = () => lcalls.filter(u => u === 'com.webos.service.config/reconfigure').length;
  const lgText = () => (fs.existsSync(lgFile) ? fs.readFileSync(lgFile, 'utf8') : null);
  ok(!fs.existsSync(oldFile), "1.6.19's file in the layer configd never reads is removed");
  son2.start();
  await sleep(100);
  ok(
    lgText() === null && son2.status().lgBar === 'shown' && son2.status().hideLg === true,
    "off: LG's bar is left alone (hideLg is on by default)"
  );
  son2.set({ enabled: true });
  ok(await until(() => lgText() !== null), "on, with the sound on HDMI ARC: LG's bar is hidden");
  ok(
    lgText() === '{"volumeOSD":false}\n' && fs.readFileSync(lgFile2, 'utf8') === lgText() && reconf() === 1,
    'by one setting in every country folder of the layer, then configd reads its layers again'
  );
  ok(son2.status().lgBar === 'hidden' && fs.existsSync(record), 'the status says so, and what was written is recorded');
  out2 = 'tv_speaker';
  ok(await until(() => lgText() === null && !fs.existsSync(lgFile2)), "the sound moves to the TV's speakers: LG's bar comes back");
  ok(reconf() === 2, 'and configd reads its layers again');
  out2 = 'external_optical';
  ok(await until(() => lgText() !== null), 'optical: hidden again');
  out2 = 'bt_soundbar';
  ok(await until(() => lgText() === null), 'any other output (a Bluetooth speaker, headphones): shown');
  out2 = 'external_arc';
  await until(() => lgText() !== null);
  fs.unlinkSync(lgFile); // the TV's RAM was reset under it (a snapshot resume)
  ok(await until(() => lgText() !== null), 'a setting that disappeared is put back');
  son2.set({ hideLg: false });
  ok((await until(() => lgText() === null)) && son2.status().hideLg === false, "Hide LG's volume bar switched off: shown");
  son2.set({ hideLg: true });
  ok(await until(() => lgText() !== null), 'and on again: hidden');
  son2.set({ enabled: false });
  ok((await until(() => lgText() === null)) && son2.status().lgBar === 'shown', "Sonos volume switched off: LG's bar is back");
  const n2 = reconf();
  fs.writeFileSync(lgFile, '{"volumeOSD": true, "other": 1}\n'); // someone else's file of that name
  son2.set({ enabled: true });
  await sleep(250);
  ok(lgText() === '{"volumeOSD": true, "other": 1}\n', 'a file that is not ours is neither replaced');
  son2.set({ enabled: false });
  await sleep(150);
  ok(lgText() === '{"volumeOSD": true, "other": 1}\n', 'nor removed');
  ok(!fs.existsSync(lgFile2), 'while its own file in the other folder comes and goes as before');
  fs.unlinkSync(lgFile);
  const n3 = reconf();
  prof = { lgVolumeBar: '' };
  son2.set({ enabled: true });
  await sleep(250);
  ok(
    lgText() === null && son2.status().lgBar === 'unsupported' && reconf() === n3 && n3 >= n2,
    'a TV where it was not tried: nothing is written'
  );
  prof = { lgVolumeBar: 'configd' };
  const gone = req('lgvolume').create(ctx2, { dir: path.join(tmp, 'no-such-layer'), record });
  ok(
    !gone.supported() && (await gone.hide()) === false && !fs.existsSync(path.join(tmp, 'no-such-layer')),
    'without the layer folder: nothing, and the folder is not made'
  );
  son2.set({ enabled: false });
  await sleep(100);
  const lgUris = {};
  lcalls.forEach(u => (lgUris[u] = 1));
  ok(
    Object.keys(lgUris).every(u =>
      /^(com\.webos\.service\.audio\/getSoundOutput|com\.webos\.service\.tvpower\/power\/getPowerState|com\.webos\.service\.config\/reconfigure|com\.webos\.applicationManager\/getForegroundAppInfo)$/.test(
        u
      )
    ),
    'the TV is only asked for its sound output and power state, and configd to read its layers: never its volume or mute: ' +
      Object.keys(lgUris).join(', ')
  );

  // ---- notify.js: the volume bar is for the service's own parts only
  const notify = req('notify');
  await notify.show({ kind: 'volume', volume: 140, muted: 1, position: 'middle-center', seconds: 99, stay: 99999 }, true);
  const sent = fs.readFileSync(LUNALOG, 'utf8').trim().split('\n').pop();
  let p = {};
  try {
    p = JSON.parse(sent).params;
  } catch (_) {}
  ok(
    p.kind === 'volume' &&
      p.volume === 100 &&
      p.muted === true &&
      p.position === 'top-left' &&
      p.seconds === 10 &&
      p.stay === 1800 &&
      !('title' in p),
    'the volume bar is launched with a clamped volume and a known place: ' + JSON.stringify(p)
  );
  const net = await notify.show({ kind: 'volume', volume: 5 });
  ok(net && net.error === 'nothing to show', 'a network sender cannot show the volume bar');

  // ---- the notify page: the bar beside the card, the window closed only when both are gone
  const html = fs.readFileSync(path.join(root, 'notify', 'app', 'index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  // the page with stand-ins for the DOM, webOSSystem, its timers (virtual time: advance) and, when given, XMLHttpRequest and the
  // API token
  function notifyPage(first, XHR, token) {
    const els = {},
      listeners = {},
      timers = [];
    let now = 0,
      closes = 0;
    const el = id => {
      if (els[id]) return els[id];
      const cls = [];
      const e = {
        style: {},
        textContent: '',
        classList: {
          add: c => cls.indexOf(c) < 0 && cls.push(c),
          remove: c => cls.indexOf(c) >= 0 && cls.splice(cls.indexOf(c), 1),
          contains: c => cls.indexOf(c) >= 0,
        },
        removeAttribute() {},
      };
      Object.defineProperty(e, 'className', {
        get: () => cls.join(' '),
        set: v => {
          cls.length = 0;
          String(v)
            .split(/\s+/)
            .filter(Boolean)
            .forEach(c => cls.push(c));
        },
      });
      return (els[id] = e);
    };
    const sys = { launchParams: JSON.stringify(first), setInputRegion() {}, setKeyMask() {} };
    const later2 = (fn, ms) => timers.push({ fn, at: now + ms, id: timers.length + 1 }) && timers.length;
    // animation frames run only when time passes (advance): an overlay window gets them late or not at all
    let frames = [];
    const raf = fn => frames.push(fn);
    const advance = ms => {
      while (frames.length) {
        const f = frames;
        frames = [];
        f.forEach(fn => fn());
      }
      const end = now + ms;
      for (;;) {
        const due = timers.filter(t => t.fn && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        now = due.at;
        const fn = due.fn;
        due.fn = null;
        fn();
      }
      now = end;
    };
    const launch = params => {
      sys.launchParams = JSON.stringify(params);
      (listeners.webOSRelaunch || []).forEach(fn => fn());
    };
    const press = k => (listeners.keydown || []).forEach(fn => fn({ keyCode: k }));
    new Function(
      'document',
      'webOSSystem',
      'window',
      'requestAnimationFrame',
      'setTimeout',
      'clearTimeout',
      'Image',
      'XMLHttpRequest',
      'CYTV_TOKEN',
      script
    )(
      { getElementById: el, addEventListener: (t, fn) => (listeners[t] = (listeners[t] || []).concat(fn)) },
      sys,
      { close: () => closes++ },
      raf,
      later2,
      id => {
        const t = timers[id - 1];
        if (t) t.fn = null;
      },
      function () {},
      XHR,
      token
    );
    return { els, launch, advance, press, closes: () => closes };
  }
  const pg = notifyPage({ kind: 'volume', volume: 12, muted: false, seconds: 3, position: 'top-right' });
  const { els, launch, advance, press } = pg;
  const vol = els.vol,
    card = els.card;
  ok(
    vol.classList.contains('on') && !card.classList.contains('on'),
    'a volume launch shows the bar at once (no animation frame), not the card'
  );
  ok(
    els.vnum.textContent === '12' && els.vfill.style.transform === 'translateX(-88%)',
    'with the number and the fill (moved, not resized)'
  );
  ok(vol.style.right === '64px' && vol.style.top === '64px', 'in the place asked for');
  advance(1500);
  launch({ kind: 'volume', volume: 13, muted: true, seconds: 3, position: 'top-right' });
  ok(
    els.vnum.textContent === '13' && vol.classList.contains('muted') && vol.classList.contains('on') && els.mute.classList.contains('on'),
    'a change while it shows updates it in place, muted, with the mute badge at once'
  );
  // the remote's volume and mute keys may reach this window (where the empty input region is not honoured): they must not dismiss it
  [447, 448, 449, 175, 174, 173].forEach(press);
  ok(vol.classList.contains('on') && els.mute.classList.contains('on') && !pg.closes(), 'the volume and mute keys do not dismiss the bar');
  advance(2500);
  ok(vol.classList.contains('on') && !pg.closes(), 'each change keeps it up for its seconds again');
  launch({ title: 'Front door', text: 'Someone is there', seconds: 8 });
  advance(0); // the card still waits for its first full layout
  ok(card.classList.contains('on') && vol.classList.contains('on'), 'a notification card while the bar shows: both');
  advance(1000);
  ok(!vol.classList.contains('on') && card.classList.contains('on'), 'the bar goes after its time');
  advance(1000);
  ok(!pg.closes(), 'the window stays while the card still shows');
  advance(8000);
  ok(
    !card.classList.contains('on') && els.mute.classList.contains('on') && els.mute.style.left === '64px' && !pg.closes(),
    'muted: a mute badge stays, in the top corner the bar does not use, and keeps the window open'
  );
  launch({ kind: 'volume', volume: 13, muted: false, seconds: 3, position: 'top-right' });
  ok(!els.mute.classList.contains('on'), 'the sound back: the badge goes');
  advance(4000);
  ok(!card.classList.contains('on') && pg.closes() === 1, 'and closes once nothing shows');
  // the service's volume bar keeps the window open, empty, so the next change shows at once
  launch({ kind: 'volume', volume: 20, muted: false, seconds: 3, position: 'top-left', stay: 600 });
  advance(4000);
  ok(!vol.classList.contains('on') && pg.closes() === 1, 'with a stay, the window stays open after the bar fades');
  launch({ title: 'Door', text: 'Someone is there', seconds: 2 });
  advance(5000);
  ok(!card.classList.contains('on') && pg.closes() === 1, 'also after a card shown meanwhile');
  launch({ kind: 'volume', volume: 21, muted: false, seconds: 3, position: 'top-left', stay: 600 });
  ok(vol.classList.contains('on') && els.vnum.textContent === '21', 'the next change shows in the open window');
  advance(599000);
  ok(pg.closes() === 1, 'each change keeps it open for the whole stay again');
  advance(2000);
  ok(pg.closes() === 2, 'and it closes once the stay has passed');
  // any other key that reaches the window still clears it at once, as before
  launch({ title: 'Door', text: 'Someone is there', seconds: 8 });
  launch({ kind: 'volume', volume: 22, muted: false, seconds: 3, position: 'top-left' });
  advance(0);
  press(13);
  advance(400);
  ok(
    !card.classList.contains('on') && !vol.classList.contains('on') && pg.closes() === 3,
    'another key clears the card and the bar and closes'
  );
  // ---- the open page waits on the service for the next change (sonos.js /api/sonos/wait), with the API token
  const xhrs = [];
  function FakeXHR() {
    this.headers = {};
    this.aborted = false;
    xhrs.push(this);
  }
  FakeXHR.prototype.open = function (m, u) {
    this.method = m;
    this.url = u;
  };
  FakeXHR.prototype.setRequestHeader = function (k, v) {
    this.headers[k] = v;
  };
  FakeXHR.prototype.send = function () {
    this.sent = true;
  };
  FakeXHR.prototype.abort = function () {
    this.aborted = true;
  };
  FakeXHR.prototype.answer = function (code, o) {
    this.status = code;
    this.responseText = JSON.stringify(o);
    this.onload();
  };
  const vp = { kind: 'volume', muted: false, seconds: 3, position: 'top-left', stay: 600 };
  const w = notifyPage(Object.assign({ volume: 30, seq: 100 }, vp), FakeXHR, 'T0K');
  const lastX = () => xhrs[xhrs.length - 1];
  ok(
    xhrs.length === 1 &&
      lastX().method === 'GET' &&
      lastX().url === 'http://127.0.0.1:8765/api/sonos/wait?since=100&shown=100' &&
      lastX().headers['x-cytv-token'] === 'T0K' &&
      lastX().sent,
    'a volume launch shows the bar and waits for the next change, with the API token: ' + (lastX() || {}).url
  );
  lastX().answer(200, Object.assign({ volume: 31, seq: 101 }, vp));
  ok(
    w.els.vnum.textContent === '31' && w.els.vol.classList.contains('on') && !w.closes(),
    'a change from the service shows in the open page at once, without a launch'
  );
  ok(xhrs.length === 2 && /since=101&shown=101$/.test(lastX().url), 'and it asks for the next one, saying which it showed');
  lastX().answer(200, { idle: true });
  ok(xhrs.length === 3 && /since=101$/.test(lastX().url), 'a wait that ended without a change is asked again');
  lastX().answer(200, Object.assign({ volume: 31, seq: 101 }, vp));
  ok(xhrs.length === 4 && w.els.vnum.textContent === '31', 'a change it already has is not shown again');
  w.launch(Object.assign({ volume: 32, seq: 102 }, vp));
  ok(xhrs.length === 4 && w.els.vnum.textContent === '32', 'a launch meanwhile shows; still one request at a time');
  lastX().answer(500, {});
  w.advance(1000);
  ok(xhrs.length === 5 && /since=102&shown=102$/.test(lastX().url), 'a failed request is tried again after a second');
  w.advance(4000);
  ok(!w.els.vol.classList.contains('on') && xhrs.length === 5 && !w.closes(), 'the bar fades; the kept window still waits');
  lastX().answer(200, { stop: true });
  w.advance(500);
  ok(xhrs.length === 5 && w.closes() === 1, 'the service says stop (the option or the screen off): no more requests, the window closes');
  // over an HDMI input (stay 0) the window closes when the bar fades, and its request goes with it
  const h = notifyPage(Object.assign({ volume: 40, seq: 200 }, vp, { stay: 0 }), FakeXHR, 'T0K');
  const hx = lastX();
  h.advance(3500);
  ok(h.closes() === 1 && hx.aborted, 'without a stay the window closes when the bar fades, and its request is ended first');
  // the card alone (a notification) never waits
  const x0 = xhrs.length;
  notifyPage({ title: 'Door', text: 'Someone is there', seconds: 2 }, FakeXHR, 'T0K');
  ok(xhrs.length === x0, 'a notification card alone does not wait on the service');
});
