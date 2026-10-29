// Does the debloat work (debloatcheck.js): each group that is on is looked at on the TV (stand-ins here: /proc/mounts, LG's programs,
// the hosts file, daemons and processes); a group LG undid shows what is wrong, and the repair after the start runs debloat-stop.sh
// again only then.
const fs = require('fs'),
  path = require('path');
const { ok, tmp, req, memoryConfig, run } = require('./lib');

run(async () => {
  const sbin = path.join(tmp, 'sbin');
  if (!fs.existsSync(sbin)) fs.mkdirSync(sbin);
  for (const b of ['adoverlay-service', 'admanager', 'acr2', 'sportsalarm']) fs.writeFileSync(path.join(sbin, b), '');
  process.env.CYTV_SBIN = sbin;
  process.env.CYTV_HOSTS = path.join(tmp, 'hosts-check');
  delete require.cache[require.resolve('../../helper/paths.js')];
  const mountsOf = list => list.map(b => 'stub ' + path.join(sbin, b) + ' ext4 rw 0 0').join('\n') + '\n';
  fs.writeFileSync(path.join(process.env.CYTV_PROC, 'mounts'), mountsOf(['adoverlay-service', 'admanager', 'acr2', 'sportsalarm']));
  fs.writeFileSync(process.env.CYTV_HOSTS, '127.0.0.1 localhost\n127.0.0.1 eic.ads.lgtvcommon.com # cleanyourtv-debloat\n');
  const exec = req('exec'),
    realSh = exec.sh;
  const ran = [];
  let running = '';
  exec.sh = async cmd => {
    ran.push(cmd);
    if (/^pidof /.test(cmd)) return { ok: cmd === 'pidof ' + running, out: cmd === 'pidof ' + running ? '123\n' : '' };
    if (/systemctl is-active/.test(cmd)) return { ok: true, out: 'inactive\n' };
    return { ok: true, out: '' };
  };
  const conf = memoryConfig({ options: { debloat: true } });
  const lgs = { check: async () => [{ group: 'lgads', key: 'homePromotion', ok: true }] };
  const C = req('debloatcheck').create({ config: conf, feature: n => (n === 'lgsettings' ? lgs : null) });
  let r = await C.check();
  ok(
    r.on && r.groups.length === 6 && r.groups.every(g => g.ok),
    'everything in place: every group that is on is working: ' + r.groups.map(g => g.id + (g.ok ? '' : '!')).join()
  );
  await C.repair('after the start');
  ok(!ran.some(c => /debloat-stop\.sh/.test(c)), 'in place: the repair runs nothing');
  // LG brought acr2 back (no stub, running) and the hosts file lost the ad servers
  fs.writeFileSync(path.join(process.env.CYTV_PROC, 'mounts'), mountsOf(['adoverlay-service', 'admanager', 'sportsalarm']));
  fs.writeFileSync(process.env.CYTV_HOSTS, '127.0.0.1 localhost\n');
  running = 'acr2';
  r = await C.check();
  const tr = r.groups.filter(g => g.id === 'tracking')[0],
    ads = r.groups.filter(g => g.id === 'ads')[0];
  ok(
    !tr.ok && tr.notes.join() === 'acr2 is not stubbed,acr2 is running' && !ads.ok && /hosts/.test(ads.notes.join()),
    'a group LG undid says what is wrong: ' + JSON.stringify(r.groups.filter(g => !g.ok))
  );
  await C.repair('after the start');
  ok(ran.filter(c => /debloat-stop\.sh$/.test(c)).length === 1, 'not in place: the repair runs debloat-stop.sh again');
  conf.update('test', c => {
    c.options = { debloat: true, debloatOff: ['tracking', 'ads'] };
  });
  r = await C.check();
  ok(
    !r.groups.some(g => g.id === 'tracking' || g.id === 'ads' || g.id === 'adapps'),
    'groups switched off are not looked at (admanager goes with ads)'
  );
  conf.update('test', c => {
    c.options = { debloat: false };
  });
  r = await C.check();
  ok(!r.on && !r.groups.length, 'the debloat off: nothing to look at');
  exec.sh = realSh;
});
