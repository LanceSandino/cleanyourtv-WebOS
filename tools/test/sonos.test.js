// Sonos volume on screen (sonos.js, the volume bar of notify.js and notify/app): with stand-in Sonos players on this computer (their
// HTTP side and an SSDP responder, no real device): off by default, the search, the events, the bar only on a change and only while
// the screen is on, the guards of the event port, renewals, a speaker that moved, reading instead of events, switching off. And that it
// only ever reads: every request a stand-in receives is a search, a description, GetVolume, GetMute or a (un)subscription.
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  dgram = require('dgram');
const { ok, root, tmp, call, sleep, req, memoryConfig, run } = require('./lib');

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
  const bar = await player({ id: 'RINCON_TESTBAR01400', model: 'Sonos Beam', room: 'Den' });
  const one = await player({ id: 'RINCON_TESTONE01400', model: 'Sonos One', room: 'Kitchen', events: false });
  let searches = 0;
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
    reply('http://127.0.0.1:' + bar.port + '/xml/device_description.xml', bar.id);
    reply('http://127.0.0.1:' + one.port + '/xml/device_description.xml', one.id);
    reply('http://10.9.9.9:1400/xml/device_description.xml', 'RINCON_ELSEWHERE01400'); // points at another address
    reply('http://127.0.0.1:8765/api/manager/status', 'RINCON_WRONGPATH01400'); // not a description
  });
  await new Promise(r => ssdp.bind(0, '127.0.0.1', r));

  let power = 'Active',
    output = 'external_arc',
    lunaCalls = 0;
  const shows = [];
  const conf = memoryConfig({});
  const ctx = {
    config: conf,
    luna: async uri => {
      lunaCalls++;
      if (/getPowerState/.test(uri)) return { returnValue: true, state: power };
      if (/getSoundOutput/.test(uri)) return { returnValue: true, soundOutput: output };
      return { returnValue: true };
    },
    notify: { show: async (p, internal) => shows.push(Object.assign({ internal }, p)) },
  };
  const opts = {
    findMs: 250,
    firstEventMs: 400,
    pollMs: 80,
    retryMs: 150,
    screenMs: 20,
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
  ok(lunaCalls > 0, 'the power state and the sound output come from the TV');

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
  r = await call(son, '/api/sonos/set', 'POST', { enabled: false });
  ok(r.j.enabled === false && r.j.state === 'off', 'switched off');
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
      /^(com\.webos\.service\.audio\/getSoundOutput|com\.webos\.service\.tvpower\/power\/getPowerState|com\.webos\.service\.config\/reconfigure)$/.test(
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
  const sys = { launchParams: '{}', setInputRegion() {}, setKeyMask() {} };
  const page = new Function('document', 'webOSSystem', 'window', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', 'Image', script);
  const later2 = (fn, ms) => timers.push({ fn, at: now + ms, id: timers.length + 1 }) && timers.length;
  const advance = ms => {
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
  sys.launchParams = JSON.stringify({ kind: 'volume', volume: 12, muted: false, seconds: 3, position: 'top-right' });
  page(
    { getElementById: el, addEventListener: (t, fn) => (listeners[t] = (listeners[t] || []).concat(fn)) },
    sys,
    { close: () => closes++ },
    fn => fn(),
    later2,
    id => {
      const t = timers[id - 1];
      if (t) t.fn = null;
    },
    function () {}
  );
  const vol = els.vol,
    card = els.card;
  ok(vol.classList.contains('on') && !card.classList.contains('on'), 'a volume launch shows the bar, not the card');
  ok(
    els.vnum.textContent === '12' && els.vfill.style.transform === 'translateX(-88%)',
    'with the number and the fill (moved, not resized)'
  );
  ok(vol.style.right === '64px' && vol.style.top === '64px', 'in the place asked for');
  advance(1500);
  launch({ kind: 'volume', volume: 13, muted: true, seconds: 3, position: 'top-right' });
  ok(
    els.vnum.textContent === '13' && vol.classList.contains('muted') && vol.classList.contains('on'),
    'a change while it shows updates it in place, muted'
  );
  advance(2500);
  ok(vol.classList.contains('on') && !closes, 'each change keeps it up for its seconds again');
  launch({ title: 'Front door', text: 'Someone is there', seconds: 8 });
  ok(card.classList.contains('on') && vol.classList.contains('on'), 'a notification card while the bar shows: both');
  advance(1000);
  ok(!vol.classList.contains('on') && card.classList.contains('on'), 'the bar goes after its time');
  advance(1000);
  ok(!closes, 'the window stays while the card still shows');
  advance(8000);
  ok(!card.classList.contains('on') && closes === 1, 'and closes once neither shows');
  // the service's volume bar keeps the window open, empty, so the next change shows at once
  launch({ kind: 'volume', volume: 20, muted: false, seconds: 3, position: 'top-left', stay: 600 });
  advance(4000);
  ok(!vol.classList.contains('on') && closes === 1, 'with a stay, the window stays open after the bar fades');
  launch({ title: 'Door', text: 'Someone is there', seconds: 2 });
  advance(5000);
  ok(!card.classList.contains('on') && closes === 1, 'also after a card shown meanwhile');
  launch({ kind: 'volume', volume: 21, muted: false, seconds: 3, position: 'top-left', stay: 600 });
  ok(vol.classList.contains('on') && els.vnum.textContent === '21', 'the next change shows in the open window');
  advance(599000);
  ok(closes === 1, 'each change keeps it open for the whole stay again');
  advance(2000);
  ok(closes === 2, 'and it closes once the stay has passed');
});
