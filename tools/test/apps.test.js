// The launcher's app list (apps.js): the first answer is waited for, later ones come from memory while the list is asked again.
// Inputs pinned to Home are listed with the apps.
const { ok, call, req, memoryConfig, run } = require('./lib');

run(async () => {
  let asked = 0,
    title = 'One';
  const luna = async uri => {
    if (/listApps/.test(uri)) {
      asked++;
      await new Promise(r => setTimeout(r, 50));
      return {
        returnValue: true,
        apps: [
          { id: 'a.one', title, folderPath: '/x', icon: 'i.png' },
          { id: 'com.webos.app.home', title: 'Home' },
        ],
      };
    }
    if (/getAllInputStatus/.test(uri))
      return {
        returnValue: true,
        devices: [
          { appId: 'com.webos.app.hdmi1', port: 1, label: 'HDMI 1', hdmiPlugIn: false },
          { appId: 'com.webos.app.hdmi2', port: 2, label: 'PlayStation', hdmiPlugIn: true },
        ],
      };
    return { returnValue: true };
  };
  const config = memoryConfig({
    dock: ['a.one'],
    wallpapers: { immich: { url: 'http://immich', key: 'secret-immich-key' } },
    watchAccounts: {
      plex: { token: 'secret-plex-token', server: { token: 'secret-server-token' } },
      stremio: { authKey: 'secret-stremio-key' },
    },
  });
  const wpStub = { stamp: () => '3:abcd' };
  const apps = req('apps').create({ config, luna, version: '1.6.0', feature: n => (n === 'wallpapers' ? wpStub : null) });
  let r = await call(apps, '/api/apps');
  ok(
    r.out.indexOf('secret-immich-key') < 0 && r.j.config.wallpapers.stamp === '3:abcd',
    'the launcher gets a stamp of the Wallpapers photos, never the Immich key'
  );
  ok(r.out.indexOf('secret-') < 0 && !r.j.config.watchAccounts, "the launcher never gets Plex's or Stremio's keys");
  ok(
    asked === 1 && r.j.apps.length === 1 && r.j.apps[0].title === 'One' && r.j.config.dock[0] === 'a.one',
    'the first list is asked from the app manager, without LG Home'
  );
  title = 'Two';
  const t0 = Date.now();
  r = await call(apps, '/api/apps');
  ok(asked === 1 && r.j.apps[0].title === 'One' && Date.now() - t0 < 40, 'opened again soon: the list comes from memory at once');
  r = await call(apps, '/api/launch', 'POST', { id: 'bad id' });
  ok(r.code === 400, 'a bad app id is refused');

  // pinned inputs (hold OK on an input): kept by the service, listed with the apps under the input app's id
  r = await call(apps, '/api/inputs/pin', 'POST', { id: 'com.webos.app.hdmi2', on: true });
  ok(r.j.returnValue === true && config.get().pinnedInputs.length === 1, 'an input is pinned to Home');
  r = await call(apps, '/api/inputs/pin', 'POST', { id: 'com.webos.app.hdmi1', on: true });
  r = await call(apps, '/api/apps');
  const pins = r.j.apps.filter(a => a.input);
  ok(
    pins.length === 2 &&
      pins[0].id === 'com.webos.app.hdmi2' &&
      pins[0].title === 'PlayStation' &&
      pins[0].input === 2 &&
      pins[0].off === false &&
      pins[1].title === 'HDMI 1' &&
      pins[1].off === true,
    "pinned inputs are listed with the apps: the TV's name for the input, the port, and whether something is connected"
  );
  r = await call(apps, '/api/inputs/pin', 'POST', { id: 'com.webos.app.hdmi9', on: true });
  ok(r.j.returnValue === false && config.get().pinnedInputs.length === 2, 'an input the TV does not have is not pinned');
  config.update('test', c => {
    c.dock = ['a.one', 'com.webos.app.hdmi2'];
  });
  await call(apps, '/api/config', 'POST', { dock: ['a.one'], sort: 'alpha' });
  ok(config.get().pinnedInputs.length === 2, "saving the launcher's settings keeps the pinned inputs");
  await call(apps, '/api/config', 'POST', { dock: ['a.one'], runDots: true });
  const on = config.get().runDots === true;
  await call(apps, '/api/config', 'POST', { dock: ['a.one'], runDots: 'yes' });
  ok(on && config.get().runDots === undefined, 'the green dot on open apps is off by default and saved only when switched on');
  await call(apps, '/api/config', 'POST', {
    dock: ['a.one'],
    cards: { greeting: { type: 'greeting', name: 'Sam' }, 'x y': { type: 'a' } },
  });
  const savedCards = JSON.stringify(config.get().cards);
  await call(apps, '/api/config', 'POST', { dock: ['a.one'] });
  ok(
    savedCards === JSON.stringify({ greeting: { type: 'greeting', name: 'Sam' } }) && config.get().cards === undefined,
    'the launcher saves its cards (checked) with its other settings, and a save without them removes them'
  );
  await call(apps, '/api/config', 'POST', {
    watch: { on: true, hide: ['tm:The Show', 'plex:12', 'tm:The Show', 'nope', 'x:\n', 7] },
  });
  ok(
    JSON.stringify(config.get().watch) === '{"on":true,"hide":["tm:The Show","plex:12"]}',
    'Continue watching keeps the removed shows (checked, once each) with its switch'
  );
  await call(apps, '/api/config', 'POST', { wall: { on: true, secs: 10 } });
  const w10 = config.get().wall;
  await call(apps, '/api/config', 'POST', { wall: { on: true, secs: 0, pick: 'u/0123456789abcdef' } });
  const wPick = config.get().wall;
  await call(apps, '/api/config', 'POST', { wall: { on: true, secs: 0, pick: 'f/1f0e2d3c-feed' } });
  const wFeed = config.get().wall;
  await call(apps, '/api/config', 'POST', { wall: { on: true, secs: 0, pick: '../../etc/passwd' } });
  ok(
    wPick.pick === 'u/0123456789abcdef' && wFeed.pick === 'f/1f0e2d3c-feed' && config.get().wall.pick === undefined,
    'one chosen wallpaper is kept as the photo id it names; anything else is dropped'
  );
  await call(apps, '/api/config', 'POST', { wall: { on: true, every: 5 } });
  const wOld = config.get().wall;
  await call(apps, '/api/config', 'POST', { wall: { on: false, secs: 7 } });
  ok(
    w10.on && w10.secs === 10 && wOld.secs === 300 && config.get().wall.secs === 900,
    "Wallpapers: the photo interval is saved in seconds (10 s up to an hour), an older launcher's minutes are converted, an unknown value becomes 15 min"
  );

  config.update('test', c => {
    c.dock = ['a.one', 'com.webos.app.hdmi2'];
  });
  r = await call(apps, '/api/inputs/pin', 'POST', { id: 'com.webos.app.hdmi2', on: false });
  ok(
    r.j.returnValue === true && config.get().pinnedInputs.length === 1 && config.get().dock.indexOf('com.webos.app.hdmi2') < 0,
    'an input taken off Home leaves the dock too'
  );

  // ---- uninstalling (hold OK > Uninstall): only what the app manager calls removable, never LG's own or what CleanYourTV needs ----
  const removed = [];
  const luna2 = async (uri, p) => {
    if (/listApps/.test(uri))
      return {
        returnValue: true,
        apps: [
          { id: 'netflix', title: 'Netflix', folderPath: '/media/cryptofs/apps/usr/palm/applications/netflix', removable: true },
          { id: 'com.webos.app.lgchannels', title: 'LG Channels', folderPath: '/media/system/apps/x', removable: false },
          { id: 'org.webosbrew.hbchannel', title: 'Homebrew Channel', folderPath: '/media/developer/apps/x', removable: true },
          { id: 'com.cleanyourtv.manager', title: 'CleanYourTV', folderPath: '/media/developer/apps/y', removable: true },
          {
            id: 'com.example.dev',
            title: 'Dev app',
            folderPath: '/media/developer/apps/usr/palm/applications/com.example.dev',
            removable: true,
          },
        ],
      };
    if (/appInstallService/.test(uri)) removed.push(uri.replace('luna://com.webos.appInstallService/', '') + ' ' + p.id);
    return { returnValue: true };
  };
  const config2 = memoryConfig({ dock: ['netflix', 'com.example.dev'], hidden: ['com.example.dev'] });
  const apps2 = req('apps').create({ config: config2, luna: luna2, version: '1.6.0', feature: () => null });
  const list2 = (await call(apps2, '/api/apps')).j.apps;
  const rm = id => list2.filter(a => a.id === id)[0].removable;
  ok(
    rm('netflix') &&
      rm('com.example.dev') &&
      !rm('com.webos.app.lgchannels') &&
      !rm('org.webosbrew.hbchannel') &&
      !rm('com.cleanyourtv.manager'),
    "the launcher is told which apps can be uninstalled: store and developer apps, not LG's system apps, the Homebrew Channel or CleanYourTV"
  );
  const refused = [];
  for (const id of ['com.webos.app.lgchannels', 'org.webosbrew.hbchannel', 'com.cleanyourtv.manager', 'not.installed', '../x'])
    refused.push((await call(apps2, '/api/uninstall', 'POST', { id })).j.returnValue === false);
  ok(refused.every(Boolean) && !removed.length, 'LG apps, the apps CleanYourTV needs, unknown ids and bad ids are not uninstalled');
  const a1 = (await call(apps2, '/api/uninstall', 'POST', { id: 'netflix' })).j;
  const a2 = (await call(apps2, '/api/uninstall', 'POST', { id: 'com.example.dev' })).j;
  ok(
    a1.returnValue && a2.returnValue && removed.join() === 'remove netflix,dev/remove com.example.dev',
    "a store app goes through the app store's remove, a developer app through dev/remove"
  );
  ok(!config2.get().dock.length && !config2.get().hidden.length, 'an uninstalled app leaves the dock and the hidden list');
});
