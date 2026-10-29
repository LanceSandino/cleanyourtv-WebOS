// Does the debloat work? For each group that is on, what it should have done, looked at on the TV itself: the stubs mounted over
// LG's programs (/proc/mounts) and none of them running, LG's daemons stopped (systemctl is-active), the ad servers in the hosts file,
// no app LG would pre-load (lgpreload.js) and LG's settings as they should be (lgsettings.js). An LG update or LG starting a daemon
// again shows here as a group "not in place" (own-your-glass's status idea). And the debloat at boot is a job that waits a minute
// and can be lost (upstream issue 29): a minute and a half after the service starts, and when the TV wakes, a group of the scripts
// that is not in place runs debloat-stop.sh again, once each time, and says so in the log.
//   GET /api/debloat/check    {on, groups: [{id, ok, notes: [what is wrong]}]}
const fs = require('fs');
const P = require('./paths'),
  exec = require('./exec');

const HOSTS = () => process.env.CYTV_HOSTS || '/etc/hosts';
// what each group of the scripts (debloat-stop.sh) does: programs stubbed (luna dynamic services) and systemd daemons stopped
const SCRIPT_GROUPS = {
  ads: { bins: ['adoverlay-service'], hosts: true },
  adapps: { bins: ['admanager'] },
  tracking: { bins: ['acr2'] },
  logs: { units: ['remotelogger', 'service-logger'] },
  suggestions: { units: ['contentminer', 'nudge'], bins: ['sportsalarm'] },
};

function create(ctx, opts) {
  const o = Object.assign({ startMs: 90000, tickMs: 10000, wakeGapMs: 60000 }, opts);
  const options = () => ctx.config.options();
  const debloatOn = () => options().debloat !== false && !fs.existsSync(P.DISABLE);
  const groupOn = g => (options().debloatOff || []).indexOf(g) < 0 && !(g === 'adapps' && (options().debloatOff || []).indexOf('ads') >= 0);
  const read = f => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch (_) {
      return '';
    }
  };

  async function scriptGroup(id) {
    const g = SCRIPT_GROUPS[id],
      notes = [],
      mounts = read(P.PROC + '/mounts');
    for (const b of g.bins || []) {
      if (!fs.existsSync(P.SBIN + '/' + b)) continue; // not on this firmware
      if (mounts.indexOf(' ' + P.SBIN + '/' + b + ' ') < 0) notes.push(b + ' is not stubbed');
      const r = await exec.sh('pidof ' + b, 5000);
      if (r.ok && r.out.trim()) notes.push(b + ' is running');
    }
    for (const u of g.units || []) {
      const r = await exec.sh('systemctl is-active ' + u + '.service', 5000);
      if (r.out.trim() === 'active') notes.push(u + ' is running');
    }
    if (g.hosts && read(HOSTS()).indexOf('# cleanyourtv-debloat') < 0) notes.push('the ad servers are not in the hosts file');
    return notes;
  }

  async function check() {
    if (!debloatOn()) return { on: false, groups: [] };
    const groups = [];
    for (const id of Object.keys(SCRIPT_GROUPS)) if (groupOn(id)) groups.push({ id, notes: await scriptGroup(id) });
    const pre = ctx.feature && ctx.feature('lgpreload');
    if (pre && groupOn('preload')) {
      const st = pre.status();
      if (st.supported) groups.push({ id: 'preload', notes: /kept pre-loading|failed/.test(st.last || '') ? [st.last] : [] });
    }
    const lgs = ctx.feature && ctx.feature('lgsettings');
    if (lgs) {
      const by = {};
      for (const c of await lgs.check()) {
        by[c.group] = by[c.group] || [];
        if (!c.ok) by[c.group].push(c.key + ' is not as it should be');
      }
      for (const g of Object.keys(by)) groups.push({ id: g, notes: by[g] });
    }
    return { on: true, groups: groups.map(g => ({ id: g.id, ok: !g.notes.length, notes: g.notes })) };
  }

  // the groups of the scripts that are on but not in place: debloat-stop.sh again (it does only what is missing)
  async function repair(why) {
    if (!debloatOn()) return;
    const r = await check();
    const bad = r.groups.filter(g => !g.ok && SCRIPT_GROUPS[g.id]);
    if (!bad.length) return;
    console.log('debloat: not in place ' + why + ' (' + bad.map(g => g.id + ': ' + g.notes.join(', ')).join('; ') + '); applied again');
    await exec.sh('sh ' + P.D + '/debloat-stop.sh', 60000);
  }

  async function handle(req, res) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(await check()));
  }
  function start() {
    setTimeout(() => repair('after the start'), o.startMs);
    let tick = Date.now();
    setInterval(() => {
      const now = Date.now();
      if (now - tick > o.wakeGapMs) setTimeout(() => repair('after the TV woke'), 30000);
      tick = now;
    }, o.tickMs);
  }
  return { name: 'debloatcheck', paths: ['/api/debloat/check'], handle, start, check, repair };
}

module.exports = { create, SCRIPT_GROUPS };
