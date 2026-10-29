// LG's app pre-loading stopped (lgpreload.js), against a stand-in for LG's preload manager that behaves as the one on webOS 25 did:
// setPreloadPolicy {"application": {"id", "isEnabled"}} sets isEnabled (false when left out) and marks the app allowed, which it saves;
// nothing else is saved, and a restart brings LG's own state back.
const fs = require('fs'),
  path = require('path');
const { ok, tmp, sleep, req, memoryConfig, run } = require('./lib');

run(async () => {
  const LG = [
    { id: 'com.webos.app.lgchannels', isEnabled: true, isAllowed: true, preloadType: 'periodic' },
    { id: 'com.webos.app.home', isEnabled: true, isAllowed: true, preloadType: 'periodic' },
    { id: 'com.webos.app.hdmi4', isEnabled: true, isAllowed: true, preloadType: 'periodic' },
    { id: 'netflix', isEnabled: true, isAllowed: true, preloadType: 'periodic' },
    { id: 'com.webos.app.browser', isEnabled: true, isAllowed: true, preloadType: 'oneshot' },
    { id: 'vudu', isEnabled: true, isAllowed: false, preloadType: 'oneshot' },
    { id: 'airplay', isEnabled: false, isAllowed: true, preloadType: 'periodic' },
    { id: 'org.webosbrew.hbchannel', isEnabled: true, isAllowed: true, preloadType: 'periodic' },
  ];
  const pm = { apps: [], saved: 0, deaf: false };
  const pmRestart = () => (pm.apps = JSON.parse(JSON.stringify(LG)));
  pmRestart();
  const calls = [];
  const luna = async (uri, p) => {
    calls.push(uri.replace('luna://', '') + (p && p.application ? ' ' + p.application.id + '=' + p.application.isEnabled : ''));
    if (/preloadmanager\/getPreloadPolicy$/.test(uri)) return { returnValue: true, applications: JSON.parse(JSON.stringify(pm.apps)) };
    if (/preloadmanager\/setPreloadPolicy$/.test(uri)) {
      const a = pm.apps.filter(x => x.id === p.application.id)[0];
      if (!a || pm.deaf) return { returnValue: true };
      a.isEnabled = !!p.application.isEnabled;
      if (!a.isAllowed) pm.saved++; // LG's preference file would change
      a.isAllowed = true;
      return { returnValue: true };
    }
    return { returnValue: true };
  };
  const enabled = () =>
    pm.apps
      .filter(a => a.isEnabled)
      .map(a => a.id)
      .join();
  const sets = () => calls.filter(c => /setPreloadPolicy/.test(c));

  const G = req('lgpreload');
  ok(
    G.toStop(LG).join() === 'com.webos.app.lgchannels,com.webos.app.hdmi4,netflix,com.webos.app.browser',
    'what it switches off: the apps LG would pre-load, not Home, not the Homebrew Channel, not apps that are not allowed or already off'
  );
  const conf = memoryConfig({ options: { debloat: true } });
  let prof = { lgPreload: 'api' };
  const record = path.join(tmp, 'lgpreload.json');
  const pre = G.create({ config: conf, luna, profile: { get: () => prof } }, { record, startMs: 1e6, checkMs: 1e6 });

  await pre.sync();
  ok(
    enabled() === 'com.webos.app.home,vudu,org.webosbrew.hbchannel',
    "with the debloat on: LG's pre-loading is off for every app but Home and the Homebrew Channel (vudu is not allowed: not pre-loaded anyway): " +
      enabled()
  );
  ok(pm.saved === 0 && pm.apps.filter(a => a.id === 'vudu')[0].isAllowed === false, "LG's saved allowed list is not changed");
  ok(sets().every(c => / \S+=false$/.test(c)) && sets().length === 4, 'four calls, each switching one app off');
  ok(
    JSON.parse(fs.readFileSync(record, 'utf8')).join() === 'com.webos.app.lgchannels,com.webos.app.hdmi4,netflix,com.webos.app.browser',
    'the apps it switched off are recorded'
  );
  ok(/^LG pre-loading stopped for .*netflix.* \(Home kept\)$/.test(pre.status().last), 'its status: ' + pre.status().last);
  await pre.sync();
  ok(sets().length === 4, 'nothing more while they stay off');
  pmRestart(); // the preload manager restarted: LG's own state again
  await pre.sync();
  ok(
    enabled() === 'com.webos.app.home,vudu,org.webosbrew.hbchannel' && sets().length === 8,
    'after a restart of the preload manager: off again'
  );
  conf.update('test', c => {
    c.options.debloatOff = ['preload'];
  });
  await pre.sync();
  ok(
    enabled() ===
      'com.webos.app.lgchannels,com.webos.app.home,com.webos.app.hdmi4,netflix,com.webos.app.browser,vudu,org.webosbrew.hbchannel',
    'the group switched off: the apps it switched off pre-load again, airplay stays as LG had it: ' + enabled()
  );
  ok(!fs.existsSync(record) && pm.saved === 0, 'the record is gone, and the saved allowed list was never changed');
  const n = sets().length;
  await pre.sync();
  ok(sets().length === n, 'nothing more after that');
  conf.update('test', c => {
    c.options = { debloat: false };
  });
  await pre.sync();
  ok(sets().length === n && !pre.status().on, 'debloat off: nothing');
  conf.update('test', c => {
    c.options = { debloat: true };
  });
  prof = { lgPreload: '' };
  await pre.sync();
  ok(sets().length === n, 'a TV where it was not tried: nothing');
  prof = { lgPreload: 'api' };
  const disable = path.join(process.env.CYTV_DIR, 'DISABLE');
  fs.writeFileSync(disable, '');
  await pre.sync();
  ok(sets().length === n, "while LG's Home is chosen: nothing");
  fs.unlinkSync(disable);
  pm.deaf = true; // a preload manager that answers but changes nothing
  await pre.sync();
  ok(/kept pre-loading/.test(pre.status().last), 'when the preload manager does not follow, the status says so: ' + pre.status().last);
  pm.deaf = false;
  pmRestart();
  // the manager switching a debloat group reaches it through debloat.js
  conf.update('test', c => {
    c.options.debloatOff = ['preload'];
  });
  await pre.sync();
  conf.update('test', c => {
    c.options.debloatOff = [];
  });
  const pre2 = G.create({ config: conf, luna, profile: { get: () => prof } }, { record, startMs: 1e6, checkMs: 1e6 });
  pre2.start();
  await req('debloat').change(['preload'], []); // the scripts are not there here; only the hook matters
  for (let i = 0; i < 40 && enabled() !== 'com.webos.app.home,vudu,org.webosbrew.hbchannel'; i++) await sleep(25);
  ok(enabled() === 'com.webos.app.home,vudu,org.webosbrew.hbchannel', 'a change of the debloat groups in the manager applies it at once');
  ok(
    calls.every(c => /^com\.webos\.service\.preloadmanager\/(get|set)PreloadPolicy/.test(c)),
    'it only ever asks and tells the preload manager: nothing restarted, no other service called'
  );
  ok(
    req('debloat').GROUPS.indexOf('preload') >= 0 && req('debloat').cleanOff(['preload', 'x']).join() === 'preload',
    'preload is a debloat group'
  );
  // the copies LG already started in the background are closed (closeByAppId, then the web app manager's killApp where that did not
  // take); an app that was on the screen in its process (someone opened it) is never closed
  {
    const cc = [];
    const running = [
      { id: 'netflix', processid: '1001' },
      { id: 'com.webos.app.lgchannels', processid: '1002' },
      { id: 'com.webos.app.browser', processid: '1003' },
    ];
    const luna2 = async (uri, p) => {
      if (/applicationManager\/running$/.test(uri)) return { returnValue: true, running };
      if (/closeByAppId$/.test(uri)) {
        cc.push('close ' + p.id);
        return { returnValue: p.id !== 'com.webos.app.lgchannels' };
      }
      if (/killApp$/.test(uri)) {
        cc.push('kill ' + p.appId);
        return { returnValue: true };
      }
      return luna(uri, p);
    };
    const apps = { onScreen: () => ({ 'com.webos.app.browser': '1003' }) };
    pmRestart();
    const rec2 = path.join(tmp, 'lgpreload2.json');
    const pre2 = G.create(
      {
        config: memoryConfig({ options: { debloat: true } }),
        luna: luna2,
        profile: { get: () => ({ lgPreload: 'api' }) },
        feature: n => (n === 'apps' ? apps : null),
      },
      { record: rec2, startMs: 1e6, checkMs: 1e6 }
    );
    await pre2.sync();
    ok(
      cc.join() === 'close netflix,close com.webos.app.lgchannels,kill com.webos.app.lgchannels',
      'the pre-loaded copies are closed (killApp where closeByAppId did not take); the browser someone opened stays: ' + cc.join()
    );
    try {
      fs.unlinkSync(rec2);
    } catch (_) {}
  }
});
