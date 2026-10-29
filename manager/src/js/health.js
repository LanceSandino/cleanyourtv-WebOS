/* TV health (helper/metrics.js): the processor per core, temperature, memory and swap, storage and the flash's wear, Wi-Fi, uptime and
   the service's own use, read again every 2.5 s only while this screen is shown and the manager is in front (the TV makes one reading
   per 2 s at most, shared with a phone's TV tab). Top processes (refreshed every 5 s while shown), Open ports and services and LG's
   running services are read only when opened. The bars are scaled (transform), nothing else moves. */
var hm = null, // /api/metrics
  hp = null, // /api/metrics/processes
  hx = null, // /api/metrics/exposure
  hs = null, // /api/metrics/services
  hT = 0,
  hSeq = 0,
  hFor = ''; // the screen the reading in progress is for ('' when none is)
var HEALTH_VIEWS = { health: 1, healthproc: 1, exposure: 1, lgservices: 1 };
var TONES = { g: 'Guarded as it should be', a: 'Open by design or with its own rules', r: 'Open with no check at all' };
/* a sentence from the table (exposure.js), with its first letter in capitals */
function hCap(s) {
  s = String(s || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function hBytes(b) {
  if (b === null || b === undefined) return '?';
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return Math.round(b / 1048576) + ' MB';
  return Math.round(b / 1024) + ' kB';
}
function hRate(b) {
  return b === null || b === undefined ? '…' : hBytes(b) + '/s';
}
function hUp(s) {
  var d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + m + ' min' : m + ' min';
}
function hPct(x) {
  return x === null || x === undefined ? '…' : x + '%';
}
/* read what the shown screen needs, then again after a pause while it stays shown */
function healthPoll() {
  clearTimeout(hT);
  var my = ++hSeq,
    v = view;
  hFor = '';
  if (document.hidden || (v !== 'health' && v !== 'healthproc')) return;
  hFor = v;
  var path = v === 'health' ? '/api/metrics' : '/api/metrics/processes?n=8';
  api(path, null, 15000).then(
    function (r) {
      if (my !== hSeq) return;
      if (view !== v) {
        hFor = '';
        return;
      }
      if (v === 'health') hm = r;
      else hp = r;
      build();
      draw();
      hT = setTimeout(healthPoll, v === 'health' ? 2500 : 5000); /* a sweep of every process costs about 80 ms on the TV */
    },
    function () {
      if (my !== hSeq) return;
      if (view !== v) {
        hFor = '';
        return;
      }
      banner('The service did not answer', 'err');
      hT = setTimeout(healthPoll, 5000);
    }
  );
}
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    clearTimeout(hT);
    hSeq++;
  } else if (view === 'health' || view === 'healthproc') healthPoll();
});
/* the screens start their readings themselves when they are built (healthRows), also when Back returns to them */
function openHealth() {
  push('health');
}
function openProcs() {
  hp = null;
  push('healthproc');
}
function openExposure(again) {
  banner('Reading…', 'work');
  api('/api/metrics/exposure', null, 20000).then(
    function (r) {
      banner('');
      hx = r;
      if (view === 'exposure') {
        build();
        draw();
      } else if (!again) push('exposure');
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function openLgServices() {
  banner('Reading…', 'work');
  api('/api/metrics/services', null, 20000).then(
    function (r) {
      banner('');
      hs = r;
      push('lgservices');
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function healthTitle() {
  if (view === 'health') return 'TV health';
  if (view === 'healthproc') return 'Top processes';
  if (view === 'exposure') return 'Open ports and services';
  return 'LG’s running services';
}
function healthRows() {
  if ((view === 'health' || view === 'healthproc') && hFor !== view) setTimeout(healthPoll, 0);
  var back = function () {
    rows.push({ sep: true });
    rows.push({ label: 'Back', fn: pop });
  };
  if (view === 'healthproc') {
    if (!hp) rows.push({ label: 'Reading…', sub: 'two looks two seconds apart', fn: null });
    else {
      var row = function (p, by) {
        rows.push({
          label: p.ours ? p.name + ' (CleanYourTV)' : p.name,
          sub: by === 'cpu' ? hPct(p.cpu) + ' · ' + hBytes(p.rss) : hBytes(p.rss) + ' · ' + hPct(p.cpu),
          bar: by === 'cpu' ? Math.min(1, p.cpu / 100) : Math.min(1, p.rss / ((hm && hm.memory.total) || 1)),
          fn: null,
          info: {
            t: p.name,
            d:
              'Process ' +
              p.pid +
              ', ' +
              p.threads +
              ' threads: ' +
              hPct(p.cpu) +
              ' of one core over the last ' +
              hp.window +
              ' s, ' +
              hBytes(p.rss) +
              ' of memory in use.',
          },
        });
      };
      rows.push({ label: 'Most processor time', sub: hp.tasks + ' processes', dim: true, fn: null });
      hp.byCpu.forEach(function (p) {
        row(p, 'cpu');
      });
      rows.push({ sep: true });
      rows.push({ label: 'Most memory', dim: true, fn: null });
      hp.byMemory.forEach(function (p) {
        row(p, 'rss');
      });
    }
    back();
    return;
  }
  if (view === 'exposure') {
    var x = hx || { ports: [], services: null };
    x.ports.forEach(function (p) {
      rows.push({
        label: p.port + ' · ' + p.what,
        sub: (p.bind === 'loopback' ? 'loopback' : 'LAN') + ' · ' + p.program,
        tone: p.tone,
        fn: null,
        info: { t: p.port + '/' + p.proto + ' · ' + p.what, d: hCap(p.how) + '. ' + TONES[p.tone] + '.' },
      });
    });
    if (x.udpReplies && x.udpReplies.count)
      rows.push({
        label: 'UDP reply ports',
        sub: x.udpReplies.count + ' · ' + x.udpReplies.programs.join(', '),
        tone: 'g',
        fn: null,
        info: {
          t: 'UDP reply ports',
          d: 'Ports that discovery clients (LG’s and the TV’s apps) open for answers; nothing listens there for new requests.',
        },
      });
    var sv = x.services;
    if (sv) {
      rows.push({ sep: true });
      rows.push({
        label: 'Our parts',
        sub: sv.parts.running.length + ' running' + (sv.parts.failed.length ? ' · failed: ' + sv.parts.failed.join(', ') : ''),
        tone: sv.parts.failed.length ? 'a' : 'g',
        fn: null,
      });
      rows.push({
        label: 'Boot scripts',
        sub:
          sv.boot.scripts
            .map(function (b) {
              return b.name;
            })
            .join(', ') || 'none',
        fn: null,
      });
      rows.push({ label: 'Watchdog', sub: sv.boot.watchdog ? 'running' : 'not running', tone: sv.boot.watchdog ? 'g' : 'a', fn: null });
      if (sv.telemachus) rows.push({ label: 'Telemachus', sub: sv.telemachus.running ? 'running' : 'not running', fn: null });
      if (sv.debloat && sv.debloat.on)
        sv.debloat.daemons.forEach(function (d) {
          rows.push({
            label: d.name,
            sub: d.state + ' · ' + d.group,
            tone: d.state === 'stopped' ? 'g' : 'a',
            fn: null,
            info: { t: d.name, d: 'One of LG’s programs the debloat keeps from running (group ' + d.group + '): ' + d.state + '.' },
          });
        });
    }
    rows.push({ sep: true });
    rows.push({ label: 'LG’s running services', sub: 'the whole list', fn: openLgServices });
    rows.push({
      label: 'Read again',
      sub: 'kept 30 s on the TV',
      fn: function () {
        openExposure(true);
      },
    });
    back();
    return;
  }
  if (view === 'lgservices') {
    var u = (hs && hs.units) || [];
    if (!u.length) rows.push({ label: (hs && hs.error) || 'None', fn: null });
    u.forEach(function (s) {
      rows.push({ label: s.unit.replace(/\.service$/, ''), sub: s.description, fn: null });
    });
    back();
    return;
  }
  /* the health screen */
  var m = hm;
  if (!m) {
    rows.push({ label: 'Reading…', fn: null });
    back();
    return;
  }
  var cpu = m.cpu,
    mhz = cpu.cores
      .map(function (c) {
        return c.mhz;
      })
      .filter(Boolean),
    lo = Math.min.apply(null, mhz),
    hi = Math.max.apply(null, mhz),
    clock = !mhz.length ? '' : ' · ' + (lo / 1000).toFixed(2) + (hi !== lo ? '–' + (hi / 1000).toFixed(2) : '') + ' GHz';
  var cpuInfo = {
    t: 'Processor',
    d:
      'How busy the cores were over the last ' +
      (m.window || 2) +
      ' s, from the kernel’s own counters. A core LG switches off counts as idle. The load average is not shown: on these TVs it stays near 32 even when idle, because of kernel threads that wait for ever.',
  };
  rows.push({
    label: 'Processor',
    sub: (cpu.total === null ? 'measuring…' : cpu.total + '%') + ' · ' + cpu.cores.length + ' cores' + clock,
    bar: cpu.total === null ? 0 : cpu.total / 100,
    fn: null,
    info: cpuInfo,
  });
  cpu.cores.forEach(function (c) {
    rows.push({
      label: 'Core ' + (c.id + 1),
      sub: c.online ? hPct(c.busy) + (c.mhz ? ' · ' + (c.mhz / 1000).toFixed(2) + ' GHz' : '') : 'offline',
      bar: c.busy ? c.busy / 100 : 0,
      dim: !c.online,
      fn: null,
      info: cpuInfo,
    });
  });
  if (m.temp)
    rows.push({
      label: 'Temperature',
      sub: m.temp.c + ' °C · ' + m.temp.source,
      fn: null,
      info: {
        t: 'Temperature',
        d: 'The chip’s temperature from the kernel’s thermal sensor (LG’s own where the TV has one; it reads nothing for about a minute after a start).',
      },
    });
  var mem = m.memory,
    used = mem.total - mem.available,
    sw = mem.swap;
  rows.push({
    label: 'Memory',
    sub: hBytes(used) + ' of ' + hBytes(mem.total) + ' · ' + hBytes(mem.available) + ' available',
    bar: mem.total ? used / mem.total : 0,
    fn: null,
    info: {
      t: 'Memory',
      d: 'In use, and what apps can still have without the TV moving anything to swap (MemAvailable). LG’s web runtime and apps use most of it.',
    },
  });
  if (sw.total)
    rows.push({
      label: 'Swap',
      sub: hBytes(sw.used) + ' of ' + hBytes(sw.total) + (sw.devices[0] ? ' · ' + sw.devices[0].name : ''),
      bar: sw.used / sw.total,
      fn: null,
      info: { t: 'Swap', d: 'Memory the TV moved out to its swap space, to keep the apps in front in memory.' },
    });
  (Array.isArray(m.disks) ? m.disks : []).forEach(function (d) {
    rows.push({
      label: 'Storage ' + d.path,
      sub: d.free === null ? 'not read' : hBytes(d.free) + ' free of ' + hBytes(d.size),
      bar: d.size ? 1 - d.free / d.size : 0,
      fn: null,
      info: {
        t: 'Storage',
        d: 'Free space where the TV can write: /var (LG’s settings and apps’ data), /tmp (in memory) and /media/developer (Homebrew apps and CleanYourTV). Read at most once a minute.',
      },
    });
  });
  if (m.emmc)
    rows.push({
      label: 'Flash wear',
      sub: m.emmc.used.join(' · ') + (m.emmc.eol ? ' · ' + m.emmc.eol : ''),
      fn: null,
      info: {
        t: 'Flash wear',
        d: 'The built-in flash memory’s own estimate of how much of its life is used (two areas), and its reserve: normal, warning or urgent.',
      },
    });
  m.net.forEach(function (n) {
    rows.push({
      label: n.name === 'wlan0' ? 'Wi-Fi' : 'Ethernet',
      sub: (n.dbm ? n.dbm + ' dBm · ' : '') + '↓ ' + hRate(n.rx) + ' ↑ ' + hRate(n.tx),
      fn: null,
      info: {
        t: 'Network',
        d: 'The Wi-Fi signal (dBm: -50 is very good, -67 good, -75 weak) and the traffic over the last seconds.',
      },
    });
  });
  rows.push({ label: 'Up for', sub: hUp(m.uptime), fn: null });
  rows.push({
    label: 'CleanYourTV service',
    sub: hPct(m.self.cpu) + ' of one core · ' + hBytes(m.self.rss),
    fn: null,
    info: { t: 'CleanYourTV service', d: 'This service’s own share of one core and the memory it holds.' },
  });
  rows.push({ sep: true });
  rows.push({
    label: 'Top processes',
    sub: 'by processor and memory',
    fn: openProcs,
    info: { t: 'Top processes', d: 'The programs using the most processor time and memory, read only while that list is shown.' },
  });
  rows.push({
    label: 'Open ports and services',
    sub: 'what the network can reach',
    fn: function () {
      openExposure(false);
    },
    info: {
      t: 'Open ports and services',
      d: 'Every port that listens on the TV, the program that holds it, whether the network can reach it and how it is guarded (green, amber, red); our parts, boot scripts and watchdog; LG’s programs the debloat stops.',
    },
  });
  back();
}
