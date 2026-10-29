// Updates (updates.js through the manager's API): the stable release or the dev build, against a stand-in for the GitHub API.
const fs = require('fs'),
  path = require('path');
const { ok, call, serve, req, memoryConfig, run } = require('./lib');
const { cmp } = req('version');

run(async () => {
  ok(
    cmp('1.5.10', '1.5.9') > 0 && cmp('1.5.3', '1.5.3') === 0 && cmp('1.4.9', '1.5.0') < 0 && cmp('v1.6.0', '1.5.99') > 0,
    'version compare'
  );

  const rel = (tag, ver, fe, body, pre) => ({
    tag_name: tag,
    name: pre ? 'Dev build' : tag,
    prerelease: !!pre,
    body,
    published_at: '2026-10-23T10:00:00Z',
    assets: [].concat.apply(
      [],
      ['com.cleanyourtv.manager_' + ver + '_all.ipk', 'frontend-' + fe + '.tgz'].map(n => [
        { name: n, browser_download_url: 'http://x/' + n },
        { name: n + '.sha256', browser_download_url: 'http://x/' + n + '.sha256' },
      ])
    ),
  });
  const api = await serve((q, r) => {
    const send = o => {
      r.writeHead(o ? 200 : 404, { 'content-type': 'application/json' });
      r.end(JSON.stringify(o || {}));
    };
    if (q.url === '/repos/o/r/releases/latest') return send(rel('v1.5.3', '1.5.3', '1.4.5', 'stable'));
    if (q.url === '/repos/o/r/releases/tags/dev') return send(rel('dev', '1.5.4', '1.4.6', 'build: abc1234\nbranch: dev', true));
    send(null);
  });
  const pr = req('updates').parseRelease(rel('v1.5.3', '1.5.3', '1.4.5', 'stable'));
  ok(pr.date === '2026-10-23', 'a release carries the day it was published, for the manager to show beside the version');
  process.env.CYTV_API = api.url;
  const D = process.env.CYTV_DIR;
  fs.writeFileSync(path.join(D, 'source'), 'o/r main\n');
  const manager = req('manager');
  let m; // the service reads its own version when it starts, so each case starts one
  const start = v => {
    m = manager.create({
      version: v,
      config: memoryConfig(),
      luna: async () => ({}),
      feature: () => null,
      inputhook: { status: () => ({}), ensure() {} },
    });
  };
  const ask = (act, method, body) => call(m, '/api/manager/' + act, method, body);
  const bf = path.join(D, 'BUILD');
  start('1.5.2');
  let r = await ask('check', 'POST');
  ok(r.j.service.updateTo === '1.5.3' && r.j.channel === '', 'stable: offers the newer release');
  start('1.5.3');
  r = await ask('check', 'POST');
  ok(r.j.service.updateTo === null, 'stable: nothing to offer at the same version');
  r = await ask('tests', 'GET');
  ok(
    r.j.builds.length === 1 && r.j.builds[0].tag === 'dev' && r.j.builds[0].build === 'abc1234' && r.j.builds[0].service === '1.5.4',
    'the list holds the dev build'
  );
  r = await ask('channel', 'POST', { tag: 'test-../x' });
  ok(r.code === 400, 'a bad channel name is refused');
  r = await ask('channel', 'POST', { tag: 'dev' });
  ok(
    r.j.channel === 'dev' && r.j.service.updateTo === '1.5.4' && r.j.release.test === true && r.j.release.version === '1.5.4',
    'the dev channel offers the dev build'
  );
  fs.writeFileSync(path.join(D, 'channel'), 'test-foo-bar\n');
  r = await ask('check', 'POST');
  ok(r.j.channel === 'dev' && r.j.service.updateTo === '1.5.4', 'a TV on an old test-<branch> channel follows the dev build');
  start('1.5.4');
  fs.writeFileSync(bf, 'abc1234\n');
  r = await ask('check', 'POST');
  ok(r.j.service.updateTo === null && r.j.service.build === 'abc1234', 'the same build is not offered again');
  fs.writeFileSync(bf, 'def5678\n');
  r = await ask('check', 'POST');
  ok(r.j.service.updateTo === '1.5.4', 'another commit of the same version is offered');
  r = await ask('channel', 'POST', { tag: '' });
  ok(
    r.j.channel === '' && r.j.service.updateTo === '1.5.3',
    'back on stable after a dev build offers the stable release, even an older one'
  );
  start('1.5.3');
  r = await ask('check', 'POST');
  ok(
    r.j.channel === '' && r.j.service.updateTo === '1.5.3',
    'back on stable after a dev build of the same version as the release offers the release (its files differ)'
  );
  fs.unlinkSync(bf);
  start('1.5.3');
  r = await ask('check', 'POST');
  ok(r.j.service.updateTo === null, 'stable without a dev build installed: no offer at the same version');

  // the launcher follows the service (pairLauncher): a service that runs as the release on offer installs that release's launcher,
  // only with Home (or the manager) in front, since the install brings Home forward, and each pair once
  fs.mkdirSync(path.join(D, 'app'), { recursive: true });
  fs.writeFileSync(path.join(D, 'app', 'version.json'), JSON.stringify({ version: '1.4.4' }));
  const paired = path.join(D, 'paired');
  if (fs.existsSync(paired)) fs.unlinkSync(paired);
  let fg = 'netflix';
  const mk = v =>
    req('updates').create({
      luna: async uri => (/getForegroundAppInfo/.test(uri) ? { returnValue: true, appId: fg } : {}),
      config: memoryConfig({}),
      version: v,
    });
  ok((await mk('1.5.2').pairLauncher()) === '', 'a service that is not the release on offer leaves the launcher alone');
  const u1 = mk('1.5.3');
  ok((await u1.pairLauncher()) === '' && !fs.existsSync(paired), 'not while another app is in front (Home would come forward)');
  fg = 'com.webos.app.home';
  const started = await u1.pairLauncher();
  ok(
    started === '1.4.5' && /launcher 1\.4\.5/.test(u1.job().message) && fs.readFileSync(paired, 'utf8').trim() === '1.5.3 - 1.4.5',
    "with Home in front, the release's launcher is installed, and the pair is written down"
  );
  for (let i = 0; i < 100 && u1.busy(); i++) await new Promise(res => setTimeout(res, 100)); // the stand-in has no files: it fails
  ok((await mk('1.5.3').pairLauncher()) === '', 'the same pair is not tried again (a launcher that did not start, or put back by hand)');
  fs.unlinkSync(paired);
  fs.writeFileSync(path.join(D, 'app', 'version.json'), JSON.stringify({ version: '1.4.5' }));
  ok((await mk('1.5.3').pairLauncher()) === '' && !fs.existsSync(paired), "nothing to do when the release's launcher is there");
  api.server.close();

  // a connection that drops after the headers ends the update check with an error, never a hang (issue 5)
  const drop = await serve((q, r) => {
    r.writeHead(200, { 'content-type': 'application/json', 'content-length': '100000' });
    r.write('{"tag_name": "v9.9.9", "assets": [');
    setTimeout(() => r.socket.destroy(), 150);
  });
  process.env.CYTV_API = drop.url;
  start('1.5.3');
  const t0 = Date.now();
  r = await ask('check', 'POST');
  ok(
    Date.now() - t0 < 6000 && r.j.checkError && r.j.checking === false,
    'an update check on a connection that drops mid-answer ends with an error (' + r.j.checkError + ')'
  );
  drop.server.close();

  // a package installed by the Homebrew Channel (or ares-install) is brought into use by bootstrap.sh update, once it stayed the same
  const exec = req('exec'),
    P = req('paths'),
    ran = [],
    real = exec.detached;
  exec.detached = sc => ran.push(sc);
  fs.mkdirSync(path.join(P.SERVICE_DIR, 'helper'), { recursive: true });
  fs.writeFileSync(path.join(P.SERVICE_DIR, 'helper', 'helper.js'), "const VERSION = '9.1.0';\n");
  fs.writeFileSync(path.join(P.SERVICE_DIR, 'bootstrap.sh'), '');
  const u = req('updates').create({ luna: async () => ({}), config: memoryConfig({}), version: '9.0.0' });
  u.watchPackage();
  const first = ran.length;
  u.watchPackage();
  u.watchPackage();
  ok(
    first === 0 && ran.length === 1 && /bootstrap\.sh update 9\.1\.0$/.test(ran[0]),
    'a package installed by another tool is applied once, after it was seen twice'
  );
  const same = req('updates').create({ luna: async () => ({}), config: memoryConfig({}), version: '9.1.0' });
  same.watchPackage();
  same.watchPackage();
  fs.writeFileSync(path.join(P.D, 'last-error.txt'), 'update to 9.1.0 failed at now');
  const failed = req('updates').create({ luna: async () => ({}), config: memoryConfig({}), version: '9.0.0' });
  failed.watchPackage();
  failed.watchPackage();
  ok(ran.length === 1, 'the running version is left alone, and a package whose update already failed is not tried again');
  fs.unlinkSync(path.join(P.D, 'last-error.txt'));
  exec.detached = real;
});
