// The service's overrides of LG's settings (lgconfig.js) and LG's app pre-loading stopped through them (lgpreload.js), against a
// stand-in for configd: LG's base settings plus the files in the layer's selected country folder, read again on reconfigure.
const fs = require('fs'),
  path = require('path');
const { ok, tmp, sleep, req, memoryConfig, run } = require('./lib');

run(async () => {
  const layer = path.join(tmp, 'rmm');
  for (const d of [layer, path.join(layer, 'USA'), path.join(layer, 'CAN')]) fs.mkdirSync(d);
  const PRE = 'com.webos.service.preloadmanager',
    LIST = PRE + '.supportAppList';
  const BASE = {
    [PRE]: {
      maxPreloadApp: 6,
      supportAppList: [
        { id: 'com.webos.app.lgchannels', staticPriority: 1, isEnabled: true, isPinUp: true },
        { id: 'com.webos.app.home', staticPriority: 2, isEnabled: true, preloadMode: 'criu' },
        { id: 'netflix', staticPriority: 10, isEnabled: true },
        { id: 'airplay', staticPriority: 10, isEnabled: false },
        { id: 'org.webosbrew.hbchannel', staticPriority: 10, isEnabled: true },
      ],
    },
    'com.webos.surfacemanager': { volumeOSD: true },
  };
  // configd: base, then the selected folder (USA) of the layer, per key; only on reconfigure
  let effective = {},
    deaf = false;
  const calls = [];
  function reconfigure() {
    effective = {};
    for (const ns of Object.keys(BASE)) {
      let v = Object.assign({}, BASE[ns]);
      try {
        v = Object.assign(v, JSON.parse(fs.readFileSync(path.join(layer, 'USA', ns + '.json'), 'utf8')));
      } catch (_) {}
      for (const k of Object.keys(v)) effective[ns + '.' + k] = JSON.parse(JSON.stringify(v[k]));
    }
  }
  reconfigure();
  const luna = async (uri, p) => {
    calls.push(uri.replace('luna://', ''));
    if (/config\/reconfigure$/.test(uri)) {
      if (!deaf) reconfigure();
      return { returnValue: true };
    }
    if (/config\/getConfigs$/.test(uri)) {
      const configs = {};
      for (const n of p.configNames) if (n in effective) configs[n] = effective[n];
      return { returnValue: true, configs };
    }
    return { returnValue: true };
  };
  const reconf = () => calls.filter(c => c === 'com.webos.service.config/reconfigure').length;

  // ---- lgconfig.js
  const L = req('lgconfig');
  const rec = path.join(tmp, 'record.json');
  const cfg = L.create({ luna }, { dir: layer, record: rec });
  const SM = 'com.webos.surfacemanager';
  ok(cfg.supported(), 'a layer with country folders is used');
  const none = L.create({ luna }, { dir: path.join(tmp, 'nothing'), record: rec });
  ok(
    !none.supported() && (await none.set(SM, { volumeOSD: false })) === false && !fs.existsSync(path.join(tmp, 'nothing')),
    "without the layer: nothing, and LG's folder is not made"
  );
  ok((await cfg.clear(SM)) === false && !fs.existsSync(rec) && reconf() === 0, 'clearing what was never written changes nothing');
  ok(
    (await cfg.set('../../etc/passwd', { a: 1 })) === false && (await cfg.set('Bad Name', { a: 1 })) === false,
    'a bad namespace is refused'
  );
  ok((await cfg.set(SM, { volumeOSD: false })) === true, 'set');
  const usa = path.join(layer, 'USA', SM + '.json'),
    can = path.join(layer, 'CAN', SM + '.json');
  ok(
    fs.readFileSync(usa, 'utf8') === '{"volumeOSD":false}\n' && fs.readFileSync(can, 'utf8') === '{"volumeOSD":false}\n',
    'writes the settings into every country folder'
  );
  ok(
    reconf() === 1 && (await cfg.get([SM + '.volumeOSD']))[SM + '.volumeOSD'] === false,
    'configd reads its layers again and gives the new value'
  );
  ok(cfg.isSet(SM, { volumeOSD: false }) && cfg.owned(SM) && !cfg.isSet(SM, { volumeOSD: true }), 'isSet and owned');
  await cfg.set(SM, { volumeOSD: false });
  ok(reconf() === 1, 'setting the same again changes nothing');
  ok(
    (await cfg.clear(SM)) === true && !fs.existsSync(usa) && !fs.existsSync(can) && reconf() === 2,
    'clear removes them and configd reads again'
  );
  ok((await cfg.get([SM + '.volumeOSD']))[SM + '.volumeOSD'] === true, "LG's value is back");
  fs.writeFileSync(can, '{"volumeOSD": true}\n'); // a file of that name that is not ours
  ok(
    (await cfg.set(SM, { volumeOSD: false })) === false && fs.readFileSync(can, 'utf8') === '{"volumeOSD": true}\n',
    "someone else's file is not replaced"
  );
  ok(fs.existsSync(usa) && !cfg.owned(SM), 'the other folder gets ours, and it does not count as fully set');
  await cfg.clear(SM);
  ok(!fs.existsSync(usa) && fs.readFileSync(can, 'utf8') === '{"volumeOSD": true}\n', 'clear removes only its own');
  fs.unlinkSync(can);
  await cfg.set(SM, { volumeOSD: false });
  fs.writeFileSync(usa, '{"volumeOSD": false, "x": 1}\n'); // changed by someone after it was written
  await cfg.clear(SM);
  ok(fs.existsSync(usa) && !fs.existsSync(can), 'a file changed since it was written is left alone');
  fs.unlinkSync(usa);

  // ---- lgpreload.js
  const G = req('lgpreload');
  const kept = G.homeOnly(BASE[PRE].supportAppList);
  ok(
    kept.length === 5 &&
      kept
        .filter(a => a.isEnabled)
        .map(a => a.id)
        .join() === 'com.webos.app.home,org.webosbrew.hbchannel' &&
      kept[0].staticPriority === 1 &&
      kept[0].isPinUp === true,
    "the list keeps LG's entries and their settings, with only Home (and the Homebrew Channel) left on, and adds nothing"
  );
  const conf = memoryConfig({ options: { debloat: true } });
  let prof = { lgPreload: 'configd' },
    restarts = 0;
  const pre = G.create(
    { config: conf, luna, profile: { get: () => prof } },
    {
      dir: layer,
      record: path.join(tmp, 'record2.json'),
      startMs: 5,
      checkMs: 100000,
      restart: async () => (restarts++, { ok: true }),
    }
  );
  const listNow = async () => (await cfg.get([LIST]))[LIST];
  await pre.sync();
  let l = await listNow();
  ok(
    restarts === 1 &&
      l
        .filter(a => a.isEnabled)
        .map(a => a.id)
        .join() === 'com.webos.app.home,org.webosbrew.hbchannel' &&
      fs.existsSync(path.join(layer, 'CAN', PRE + '.json')),
    'with the debloat on: configd gives the list with only Home on, and the preload manager is restarted to read it'
  );
  ok(
    pre.status().on && pre.status().set && /stopped \(3 apps off, Home kept\)/.test(pre.status().last),
    'its status: ' + pre.status().last
  );
  await pre.sync();
  ok(restarts === 1, 'nothing more while it is in place');
  fs.unlinkSync(path.join(layer, 'USA', PRE + '.json')); // lost (the TV's RAM)
  await pre.sync();
  ok(restarts === 2 && fs.existsSync(path.join(layer, 'USA', PRE + '.json')), 'a lost setting is put back, with a restart');
  conf.update('test', c => {
    c.options.debloatOff = ['preload'];
  });
  await pre.sync();
  l = await listNow();
  ok(
    restarts === 3 && l.filter(a => a.isEnabled).length === 4 && !fs.existsSync(path.join(layer, 'USA', PRE + '.json')),
    "the group switched off: LG's list is back, with a restart"
  );
  await pre.sync();
  ok(restarts === 3, 'and nothing more after that');
  conf.update('test', c => {
    c.options = { debloat: false };
  });
  await pre.sync();
  ok(restarts === 3 && !pre.status().on, 'debloat off: nothing');
  conf.update('test', c => {
    c.options = { debloat: true };
  });
  prof = { lgPreload: '' };
  await pre.sync();
  ok(restarts === 3 && !fs.existsSync(path.join(layer, 'USA', PRE + '.json')), 'a TV where it was not tried: nothing');
  prof = { lgPreload: 'configd' };
  const disable = path.join(process.env.CYTV_DIR, 'DISABLE');
  fs.writeFileSync(disable, '');
  await pre.sync();
  ok(restarts === 3 && !fs.existsSync(path.join(layer, 'USA', PRE + '.json')), "while LG's Home is chosen: nothing");
  fs.unlinkSync(disable);
  deaf = true; // a configd that does not read the layer
  await pre.sync();
  ok(
    restarts === 3 && /did not take the list/.test(pre.status().last) && !fs.existsSync(path.join(layer, 'USA', PRE + '.json')),
    'when configd does not take the list: taken away again, and the preload manager is not restarted'
  );
  deaf = false;
  await pre.sync();
  ok(restarts === 3, 'nor tried again by the periodic look');
  conf.update('test', c => {
    c.options.debloatOff = ['preload'];
  });
  await pre.sync();
  ok(restarts === 3, 'and switching it off then restarts nothing');
  // the manager switching a debloat group reaches it through debloat.js, and tries again
  conf.update('test', c => {
    c.options.debloatOff = [];
  });
  const r0 = restarts;
  pre.start();
  await req('debloat').change(['preload'], []); // the scripts are not there here; only the hook matters
  for (let i = 0; i < 40 && restarts === r0; i++) await sleep(25);
  ok(restarts === r0 + 1 && pre.status().set, 'a change of the debloat groups in the manager applies it at once');
  ok(
    req('debloat').GROUPS.indexOf('preload') >= 0 && req('debloat').cleanOff(['preload', 'x']).join() === 'preload',
    'preload is a debloat group'
  );
});
