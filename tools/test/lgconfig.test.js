// The service's overrides of LG's settings (lgconfig.js), against a stand-in for configd: LG's base settings plus the files in the
// layer's selected country folder, read again on reconfigure.
const fs = require('fs'),
  path = require('path');
const { ok, tmp, req, run } = require('./lib');

run(async () => {
  const layer = path.join(tmp, 'rmm');
  for (const d of [layer, path.join(layer, 'USA'), path.join(layer, 'CAN')]) fs.mkdirSync(d);
  const PRE = 'com.webos.service.preloadmanager';
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
});
