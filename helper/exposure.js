// What is open on the TV and what runs (TV health > Open ports and services; a paired phone's TV tab): the ports that listen, which
// program holds each, whether it is reachable from the network or only from the TV itself, and how it is guarded, from a table of
// the ports we know (PORTS, not guessed: anything not in it is "unknown"); our own parts, boot scripts and watchdog, Telemachus, and
// LG's daemons that the debloat stops. Read in this process only when asked, cached 30 s: /proc/net/tcp, tcp6, udp and udp6, then one
// sweep of /proc/<pid>/fd to find the process that holds each socket (it stops once every socket has its owner). LG's full list of
// running systemd services is a separate request (systemctl through exec.js, cached a minute). Nothing here names an address, a MAC,
// a token or a key: a port is "loopback" or "LAN", nothing more.
//   report()      {at, ports: [{proto, port, bind, program, what, how, tone}], udpReplies: {count, programs}, services: {...}}
//   lgServices()  {at, units: [{unit, description}]}
const fs = require('fs');
const P = require('./paths'),
  exec = require('./exec'),
  metrics = require('./metrics');

const REPORT_MS = 30000,
  UNITS_MS = 60000,
  DEBLOAT_MS = 5 * 60000, // the debloat check starts a few programs (pidof, systemctl): at most every five minutes from here
  CHUNK = 64,
  EPHEMERAL = 32768; // UDP sockets from here up without an entry are reply ports of discovery clients: counted, not listed

// tone when the port is reachable from the network: g (green) guarded as intended or discovery only, a (amber) reachable by design or
// with someone else's rules, r (red) reachable with no check at all. A port bound to the loopback address only is green whatever it is:
// nothing on the network reaches it. Checked on the owner's 86UR8000 (webOS 25) on 2026-10-29; docs/security.md has the same table.
// match: proto ('tcp' or 'udp'), port or from..to, and optionally program (a pattern for the process name) or self (held by this
// service).
const PORTS = [
  { proto: 'tcp', port: 22, what: 'SSH (a root shell)', ssh: true },
  { proto: 'tcp', port: 53, what: 'DNS for the TV itself (connman)', how: 'answers name lookups', tone: 'a' },
  { proto: 'udp', port: 53, what: 'DNS for the TV itself (connman)', how: 'answers name lookups', tone: 'a' },
  {
    proto: 'tcp',
    from: 3000,
    to: 3001,
    what: 'LG’s second-screen API (SSAP: LG ThinQ, Home Assistant)',
    how: 'a new device must be accepted on the TV first (LG’s prompt); an accepted device can control the TV',
    tone: 'a',
  },
  {
    proto: 'tcp',
    port: 7000,
    what: 'AirPlay (LG)',
    how: 'devices on the network can show media on the TV; LG’s AirPlay settings decide whether a code is asked',
    tone: 'a',
  },
  { proto: 'tcp', port: 8008, what: 'Google Cast (LG)', how: 'devices on the network can cast to the TV', tone: 'a' },
  { proto: 'tcp', port: 8009, what: 'Google Cast (LG)', how: 'devices on the network can cast to the TV', tone: 'a' },
  { proto: 'tcp', port: 8443, what: 'Google Cast (LG)', how: 'devices on the network can cast to the TV', tone: 'a' },
  {
    proto: 'tcp',
    port: 8765,
    what: 'CleanYourTV service',
    how: 'reachable from the network: it should listen on the loopback address only',
    tone: 'r',
    local: 'loopback only; web pages and other hosts are refused (Origin and Host checks); our apps send the API token',
  },
  {
    proto: 'tcp',
    port: 8766,
    what: 'Live TV setup page (while it is open)',
    how: 'a 6-digit code shown on the TV; closes after 10 minutes',
    tone: 'g',
  },
  {
    proto: 'tcp',
    port: 8767,
    what: 'Network notifications (opt-in)',
    how: 'a token (Authorization: Bearer); wrong tokens lock an address out for 10 minutes; an optional allow list; only the notification call',
    tone: 'g',
  },
  {
    proto: 'tcp',
    port: 8769,
    self: true,
    what: 'Voice and Home Assistant setup page (while it is open)',
    how: 'a random address shown on the TV; closes after 10 minutes',
    tone: 'g',
  },
  {
    proto: 'tcp',
    port: 8770,
    what: 'Telemachus (a separate program)',
    how: 'its own access rules, not CleanYourTV’s',
    tone: 'a',
    local: 'loopback only',
  },
  {
    proto: 'tcp',
    port: 8791,
    what: 'Wallpapers phone page (while it is open)',
    how: 'a 6-digit code shown on the TV; closes after 15 minutes',
    tone: 'g',
  },
  {
    proto: 'tcp',
    port: 8792,
    what: 'Cards phone page (while it is open)',
    how: 'a 6-digit code shown on the TV; closes after 10 minutes',
    tone: 'g',
  },
  // the share log runs as a program of its own (node sharelog.js) on the first free port from 8768: after the fixed ports above
  {
    proto: 'tcp',
    from: 8768,
    to: 8790,
    program: /^node\b/,
    what: 'Share log page (while it is open)',
    how: 'a random address shown on the TV; closes after 10 minutes; the report is masked',
    tone: 'g',
  },
  {
    proto: 'tcp',
    port: 8794,
    what: 'Phone remote',
    how: 'paired phones only (each its own key; the TV keeps a hash); home-network addresses only; requests from other pages are refused; plain HTTP on your Wi-Fi',
    tone: 'g',
  },
  {
    proto: 'tcp',
    port: 9080,
    what: 'Netflix second screen (DIAL)',
    how: 'phones on the network can start Netflix and hand it a video',
    tone: 'a',
  },
  {
    proto: 'tcp',
    port: 9998,
    what: 'WebAppMgr’s web inspector (DevTools)',
    how: 'no authentication: anyone on the network can run code inside the TV’s web apps, Home included. This TV’s kernel has no firewall table to close it: keep the TV off networks you do not trust',
    tone: 'r',
  },
  {
    proto: 'udp',
    port: 1900,
    what: 'SSDP discovery (UPnP)',
    how: 'discovery only: devices on the network learn that the TV is there',
    tone: 'g',
  },
  { proto: 'udp', port: 1902, what: 'LG’s SDDP discovery', how: 'discovery only', tone: 'g' },
  { proto: 'udp', port: 5353, what: 'mDNS discovery (Bonjour)', how: 'discovery only', tone: 'g' },
  {
    proto: 'tcp',
    program: /^upnpd$/,
    what: 'LG’s UPnP media renderer (DLNA)',
    how: 'devices on the network can play media on the TV',
    tone: 'a',
  },
  { proto: 'udp', program: /^upnpd$/, what: 'LG’s UPnP media renderer (DLNA)', how: 'discovery and media control', tone: 'a' },
];
const UNKNOWN = { what: 'Unknown: not in this table', tone: 'a' };

// "0100007F" (IPv4) or 32 hex digits (IPv6), as /proc/net prints them (each 32-bit word in the CPU's order, little-endian on the TVs):
// 'loopback', 'all' (every address) or 'interface' (one address of the TV, reachable from the network); never the address itself
function bindOf(hex) {
  const v4 = h => {
    const b = Buffer.from(h, 'hex').reverse();
    return b[0] === 127 ? 'loopback' : b.readUInt32BE(0) === 0 ? 'all' : 'interface';
  };
  const h = String(hex || '').toUpperCase();
  if (/^[0-9A-F]{8}$/.test(h)) return v4(h);
  if (!/^[0-9A-F]{32}$/.test(h)) return 'interface';
  if (/^0{32}$/.test(h)) return 'all';
  if (h === '00000000000000000000000001000000') return 'loopback';
  if (/^0{16}FFFF0000/.test(h)) return v4(h.slice(24)); // ::ffff:a.b.c.d
  return 'interface';
}
// /proc/net/tcp(6) or udp(6): the sockets that wait for the network: TCP in LISTEN (0A); UDP unconnected (07) and not on loopback only
function parseSockets(text, proto) {
  const out = [];
  for (const line of String(text).split('\n').slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c.length < 10) continue;
    const local = c[1].split(':'),
      bind = bindOf(local[0]);
    if (proto === 'tcp' ? c[3] !== '0A' : c[3] !== '07' || bind === 'loopback') continue;
    if (!/^\d+$/.test(c[9]) || c[9] === '0') continue;
    out.push({ proto, port: parseInt(local[1], 16), bind, inode: c[9] });
  }
  return out;
}
// root's password as a state only, never its hash: 'locked' (! or * : no password can log in), 'empty' (a login with no password),
// 'set', or '' when it cannot be read
function rootPassword(shadow) {
  const line = String(shadow || '')
    .split('\n')
    .filter(l => /^root:/.test(l))[0];
  if (!line) return '';
  const h = line.split(':')[1];
  return h === '' ? 'empty' : /^[!*]/.test(h) ? 'locked' : 'set';
}
// dropbear's flags (-s: no password logins, -g: none for root) or OpenSSH's PasswordAuthentication; with root's password locked, no
// password can log in whatever the flags say (the owner's TV: dropbear -R from the Homebrew Channel, root locked, keys only)
function sshGuard(program, cmdline, sshdConfig, rootPw) {
  if (rootPw === 'empty') return { how: 'root has an empty password: anyone on the network can log in', tone: 'r' };
  if (/^sshd/.test(program)) {
    const off = /^\s*PasswordAuthentication\s+no\b/im.test(sshdConfig || '');
    return off
      ? { how: 'OpenSSH; password login is off (PasswordAuthentication no): a key is needed', tone: 'g' }
      : { how: 'OpenSSH; password login is not switched off in its settings', tone: 'a' };
  }
  const flags = String(cmdline || '')
    .split('\0')
    .slice(1)
    .filter(a => /^-[A-Za-z]+$/.test(a))
    .join('');
  if (/[sg]/.test(flags))
    return { how: 'dropbear; password login is off (' + (/s/.test(flags) ? '-s' : '-g') + '): a key is needed', tone: 'g' };
  if (rootPw === 'locked') return { how: "dropbear; root's password is locked, so only a key logs in", tone: 'g' };
  return {
    how: 'dropbear does not refuse passwords (no -s): root logs in with a key, and with a password only if one was ever set',
    tone: 'a',
  };
}
// the entry for one socket: what it is and how it is guarded
function classify(s, info) {
  /** @type {any} an entry of PORTS, or the Sonos event port's */
  const e =
    PORTS.filter(
      x =>
        x.proto === s.proto &&
        (x.port === undefined || x.port === s.port) &&
        (x.from === undefined || (s.port >= x.from && s.port <= x.to)) &&
        (!x.program || x.program.test(s.program || '')) &&
        (x.self === undefined || x.self === !!s.self)
    )[0] ||
    (s.self && info.sonosPort && s.port === info.sonosPort
      ? {
          what: 'Sonos volume events (opt-in)',
          how: 'answers only the chosen speaker’s address, on a random path, while the option is on',
          tone: 'g',
        }
      : null);
  const out = { proto: s.proto, port: s.port, bind: s.bind === 'loopback' ? 'loopback' : 'LAN', program: s.program || '?' };
  if (!e) {
    if (s.bind === 'loopback')
      return Object.assign(out, { what: UNKNOWN.what, how: 'loopback only: nothing on the network reaches it', tone: 'g' });
    return Object.assign(out, { what: UNKNOWN.what, how: 'listens on the network', tone: UNKNOWN.tone });
  }
  if (s.bind === 'loopback')
    return Object.assign(out, { what: e.what, how: e.local || 'loopback only: nothing on the network reaches it', tone: 'g' });
  if (e.ssh) return Object.assign(out, { what: e.what }, sshGuard(s.program, s.cmdline, info.sshdConfig, info.rootPw));
  return Object.assign(out, { what: e.what, how: e.how, tone: e.tone });
}
// one row per protocol, port and program (IPv4 and IPv6 together, the wider binding kept); UDP reply ports counted apart
function merge(rows) {
  const by = new Map(),
    replies = { count: 0, programs: [] };
  for (const r of rows) {
    if (r.proto === 'udp' && r.port >= EPHEMERAL && r.what === UNKNOWN.what) {
      replies.count++;
      if (replies.programs.indexOf(r.program) < 0) replies.programs.push(r.program);
      continue;
    }
    const k = r.proto + ' ' + r.port + ' ' + r.program,
      had = by.get(k);
    if (!had || (had.bind === 'loopback' && r.bind === 'LAN')) by.set(k, r);
  }
  const rank = { r: 0, a: 1, g: 2 };
  const ports = Array.from(by.values()).sort((x, y) => rank[x.tone] - rank[y.tone] || x.port - y.port || (x.proto < y.proto ? -1 : 1));
  replies.programs.sort();
  return { ports, udpReplies: replies };
}

const read = f => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch (_) {
    return '';
  }
};
const tick = () => new Promise(r => setImmediate(r));

// every process's name, and the owner of each wanted socket (inode -> pid); command lines only of the few programs that need one
async function sweep(wanted) {
  let pids = [];
  try {
    pids = fs.readdirSync(P.PROC).filter(p => /^\d+$/.test(p));
  } catch (_) {}
  const procs = new Map(),
    owners = new Map();
  let left = wanted.size;
  for (let i = 0; i < pids.length; i += CHUNK) {
    for (const pid of pids.slice(i, i + CHUNK)) {
      const comm = read(P.PROC + '/' + pid + '/comm').trim();
      if (!comm) continue;
      const p = { comm, cmdline: /^(sh|dropbear|sshd|node)$/.test(comm) ? read(P.PROC + '/' + pid + '/cmdline') : '' };
      procs.set(+pid, p);
      if (!left) continue;
      let fds = [];
      try {
        fds = fs.readdirSync(P.PROC + '/' + pid + '/fd');
      } catch (_) {}
      for (const fd of fds) {
        let l = '';
        try {
          l = fs.readlinkSync(P.PROC + '/' + pid + '/fd/' + fd);
        } catch (_) {
          continue;
        }
        const m = /^socket:\[(\d+)\]$/.exec(l);
        if (m && wanted.has(m[1]) && !owners.has(m[1])) {
          owners.set(m[1], +pid);
          if (!--left) break;
        }
      }
    }
    await tick();
  }
  return { procs, owners };
}

function create(ctx) {
  let last = null,
    run = null,
    units = null,
    unitsRun = null;

  // the debloat check (debloatcheck.js), at most every five minutes from these views
  function debloatState() {
    const dc = ctx.feature && ctx.feature('debloatcheck');
    if (!dc || !dc.recent) return Promise.resolve(null);
    return dc.recent(DEBLOAT_MS).then(
      r => {
        if (!r.on) return { on: false, at: r.at, groups: [], daemons: [] };
        const groups = require('./debloatcheck').SCRIPT_GROUPS,
          daemons = [];
        for (const g of r.groups) {
          const def = groups[g.id];
          if (!def) continue;
          for (const name of (def.bins || []).concat(def.units || [])) {
            if (daemons.some(d => d.name === name)) continue;
            const notes = g.notes.join('\n');
            daemons.push({
              name,
              group: g.id,
              state:
                notes.indexOf(name + ' is running') >= 0
                  ? 'running again'
                  : notes.indexOf(name + ' is not stubbed') >= 0
                    ? 'not stubbed'
                    : 'stopped',
            });
          }
        }
        return { on: true, at: r.at, groups: r.groups.map(g => ({ id: g.id, ok: g.ok })), daemons };
      },
      () => null
    );
  }
  async function services(procs) {
    const parts = ctx.parts ? ctx.parts() : { running: [], failed: [] };
    let boot = [];
    try {
      boot = fs.readdirSync(P.INITD).sort();
    } catch (_) {}
    const has = re => {
      for (const p of procs.values()) if (re.test(p.comm) || re.test(p.cmdline)) return true;
      return false;
    };
    const telemachus = boot.some(n => /telemachus/i.test(n)) || has(/^telemachusd$/);
    return {
      parts: { running: parts.running.slice(), failed: parts.failed.slice() },
      boot: {
        scripts: boot.map(name => ({ name, ours: /cleanyourtv/.test(name) })),
        home: !fs.existsSync(P.DISABLE), // the launcher is Home at the next start
        watchdog: has(/cleanyourtv\/watchdog\.sh/),
      },
      telemachus: telemachus ? { running: has(/^telemachusd$/) } : null,
      debloat: await debloatState(),
    };
  }
  async function make() {
    const socks = [];
    for (const [f, proto] of [
      ['tcp', 'tcp'],
      ['tcp6', 'tcp'],
      ['udp', 'udp'],
      ['udp6', 'udp'],
    ])
      for (const s of parseSockets(read(P.PROC + '/net/' + f), proto)) socks.push(s);
    const { procs, owners } = await sweep(new Set(socks.map(s => s.inode)));
    const sonos = ctx.feature && ctx.feature('sonos');
    const info = {
      sonosPort: sonos && sonos.eventPort ? sonos.eventPort() : 0,
      sshdConfig: read(P.SSHD_CONFIG),
      rootPw: rootPassword(read(P.SHADOW)),
    };
    const rows = socks.map(s => {
      const pid = owners.get(s.inode),
        p = pid !== undefined ? procs.get(pid) : null;
      return classify(
        Object.assign({}, s, {
          program: p ? metrics.scriptName(p.comm, p.cmdline) : '',
          cmdline: p ? p.cmdline : '',
          self: pid === process.pid,
        }),
        info
      );
    });
    return Object.assign({ at: Date.now() }, merge(rows), { services: await services(procs) });
  }
  function report() {
    if (last && Date.now() - last.at < REPORT_MS) return Promise.resolve(last);
    if (!run)
      run = make().then(
        r => {
          run = null;
          last = r;
          return r;
        },
        e => {
          run = null;
          throw e;
        }
      );
    return run;
  }
  // LG's running services, on request only (the "More" of the view)
  function lgServices() {
    if (units && Date.now() - units.at < UNITS_MS) return Promise.resolve(units);
    if (!unitsRun)
      unitsRun = exec
        .run(P.SYSTEMCTL, ['list-units', '--type=service', '--state=running', '--no-legend', '--no-pager', '--plain'], { timeout: 8000 })
        .then(r => {
          unitsRun = null;
          units = { at: Date.now(), error: r.ok ? '' : 'systemctl did not answer', units: parseUnits(r.out) };
          return units;
        });
    return unitsRun;
  }
  return { report, lgServices };
}
// systemctl list-units --plain --no-legend: "<unit> loaded active running <description>"
function parseUnits(text) {
  return String(text)
    .split('\n')
    .map(l => /^\s*(\S+\.service)\s+\S+\s+\S+\s+\S+\s*(.*)$/.exec(l))
    .filter(Boolean)
    .slice(0, 400)
    .map(m => ({ unit: m[1], description: m[2].trim().slice(0, 80) }));
}

module.exports = { create, PORTS, bindOf, parseSockets, sshGuard, rootPassword, classify, merge, parseUnits };
