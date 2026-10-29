// TV health (metrics.js, exposure.js, statusdata.js, the phone's TV tab): the readings from fake /proc and /sys trees (per-core CPU with
// a core going offline, temperature, memory, swap, Wi-Fi in dBm, eMMC wear, free space), the load average never read, one reading
// shared for 2 s, processes by CPU and memory, the listening ports with their owners and how each is guarded, the services, and the
// phone's /status-data: only with a paired key, and nothing secret in it.
const fs = require('fs'),
  path = require('path'),
  http = require('http');
const { ok, tmp, call, sleep, req, memoryConfig, run, root } = require('./lib');

const PROC = process.env.CYTV_PROC,
  SYS = path.join(tmp, 'sys'),
  INITD = path.join(tmp, 'initd'),
  BIN = path.join(tmp, 'bin');
process.env.CYTV_SYS = SYS;
process.env.CYTV_SHADOW = path.join(tmp, 'no-shadow'); // never this computer's own
process.env.CYTV_INITD = INITD;
process.env.CYTV_DISKS = [tmp, path.join(tmp, 'missing')].join(':');
process.env.CYTV_SYSTEMCTL = path.join(BIN, 'systemctl');
process.env.CYTV_SSHD_CONFIG = path.join(tmp, 'sshd_config');
const put = (f, s) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
};
// /proc/stat with the counters of each core: [user, nice, system, idle, iowait, irq, softirq, steal]; a missing core is offline
const stat = cores =>
  'cpu  1 2 3 4 5 6 7 8 0 0\n' +
  Object.keys(cores)
    .map(i => 'cpu' + i + ' ' + cores[i].join(' ') + ' 0 0')
    .join('\n') +
  '\nintr 1 2 3\nctxt 99\n';
const netdev = (rx, tx) =>
  'Inter-|   Receive                            |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n' +
  '    lo:  100 1 0 0 0 0 0 0  100 1 0 0 0 0 0 0\n' +
  ' wlan0: ' +
  rx +
  ' 10 0 0 0 0 0 0 ' +
  tx +
  ' 10 0 0 0 0 0 0\n' +
  '  eth0: 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n';

run(async () => {
  // ---- the fake trees, as the 86UR8000 (webOS 25, Realtek) has them ----
  put(
    PROC + '/stat',
    stat({
      0: [100, 0, 100, 800, 0, 0, 0, 0],
      1: [100, 0, 100, 800, 0, 0, 0, 0],
      2: [0, 0, 0, 1000, 0, 0, 0, 0],
      3: [0, 0, 0, 1000, 0, 0, 0, 0],
    })
  );
  put(PROC + '/loadavg', '31.90 32.00 29.70 1/336 4242\n'); // what that TV reads while 86% idle: it must never be shown
  put(PROC + '/uptime', '93784.12 300000.00\n');
  put(
    PROC + '/meminfo',
    'MemTotal:        1754824 kB\nMemFree:           79164 kB\nMemAvailable:     406664 kB\nBuffers:           92428 kB\nCached:           320296 kB\nActive(anon):     443036 kB\nSwapTotal:        614396 kB\nSwapFree:         285276 kB\n'
  );
  put(
    PROC + '/swaps',
    'Filename\t\t\t\tType\t\tSize\tUsed\tPriority\n/dev/f2io-0                             partition\t614396\t329120\t-2\n'
  );
  put(PROC + '/net/dev', netdev(1000000, 50000));
  put(
    PROC + '/net/wireless',
    'Inter-| sta-|   Quality        |   Discarded packets               | Missed | WE\n face | tus | link level noise |  nwid  crypt   frag  retry   misc | beacon | 22\n wlan0: 0000    0.  216.    0.       0      0      0      0      0        0\n  p2p0: 0000    0     0     0        0      0      0      0      0        0\n'
  );
  put(SYS + '/devices/system/cpu/present', '0-3\n');
  for (const [i, f] of [
    [0, 1156000],
    [1, 1156000],
    [2, 1100000],
    [3, 1100000],
  ])
    put(SYS + '/devices/system/cpu/cpu' + i + '/cpufreq/scaling_cur_freq', f + '\n');
  put(SYS + '/class/thermal/thermal_zone0/type', 'rtk-thermal\n');
  put(SYS + '/class/thermal/thermal_zone0/temp', '66000\n');
  put(SYS + '/block/mmcblk0/device/life_time', '0x01 0x02\n');
  put(SYS + '/block/mmcblk0/device/pre_eol_info', '0x01\n');

  // every file the service opens, to prove the load average is never one of them
  const opened = [];
  const spy = (obj, fn) => {
    const orig = obj[fn];
    obj[fn] = function (f) {
      opened.push(String(f));
      return orig.apply(this, arguments);
    };
  };
  for (const fn of ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream']) spy(fs, fn);
  spy(fs.promises, 'readFile');

  const M = req('metrics');
  // ---- the parsers ----
  const c1 = M.parseCpu(stat({ 0: [10, 0, 10, 80, 0, 0, 0, 0], 1: [10, 0, 10, 80, 0, 0, 0, 0], 2: [0, 0, 0, 100, 0, 0, 0, 0] }));
  const c2 = M.parseCpu(stat({ 0: [60, 0, 10, 130, 0, 0, 0, 0], 1: [10, 0, 10, 80, 0, 0, 0, 0], 3: [50, 0, 0, 50, 0, 0, 0, 0] }));
  const sh = M.cpuShares(c1, c2, 4);
  ok(
    JSON.stringify(sh) ===
      JSON.stringify([
        { id: 0, online: true, busy: 0.5 },
        { id: 1, online: true, busy: 0 },
        { id: 2, online: false, busy: 0 },
        { id: 3, online: true, busy: 0 },
      ]),
    'CPU per core from /proc/stat deltas; a core gone offline, or one that just came online, counts as idle: ' + JSON.stringify(sh)
  );
  const back = M.cpuShares({ 0: { total: 500, idle: 100 } }, { 0: { total: 400, idle: 50 } }, 1);
  ok(back[0].busy === 0, 'counters that went backwards (a core re-plugged) count as idle, never a negative or huge share');
  ok(M.coreCount('0-3') === 4 && M.coreCount('0-1,3\n') === 4 && M.coreCount('') === 0, 'the cores there are, from "present"');
  const mi = M.parseMeminfo(fs.readFileSync(PROC + '/meminfo', 'utf8'));
  ok(
    mi.total === 1754824 * 1024 && mi.available === 406664 * 1024 && mi.swapTotal - mi.swapFree === (614396 - 285276) * 1024,
    'memory and swap from /proc/meminfo, in bytes'
  );
  ok(
    M.parseMeminfo('MemTotal: 100 kB\nMemFree: 10 kB\nBuffers: 5 kB\nCached: 20 kB\n').available === 35 * 1024,
    'an old kernel without MemAvailable: free + buffers + cached'
  );
  const sw = M.parseSwaps(fs.readFileSync(PROC + '/swaps', 'utf8'));
  ok(sw.length === 1 && sw[0].name === 'f2io-0' && sw[0].used === 329120 * 1024, 'the swap device by its name, size and use');
  const wl = M.parseWireless(fs.readFileSync(PROC + '/net/wireless', 'utf8'));
  ok(wl.wlan0.dbm === -40 && wl.wlan0.quality === null && wl.p2p0.dbm === null, 'the Wi-Fi level 216 is -40 dBm (an unsigned byte)');
  ok(M.parseWireless('a\nb\n wlan0: 0000   70.  -43.  -256  0 0 0 0 0 0\n').wlan0.dbm === -43, 'a level already in dBm stays');
  const em = M.parseEmmc('0x01 0x02\n', '0x01\n');
  ok(
    JSON.stringify(em) === '{"used":["0-10%","10-20%"],"eol":"normal"}' && M.parseEmmc('0x0B 0x0B', '0x03').eol === 'urgent',
    'the eMMC wear: life time per area and the reserve state: ' + JSON.stringify(em)
  );
  const df = M.parseDf(
    'Filesystem           1024-blocks    Used Available Capacity Mounted on\noverlay                 989084    451100    537984  46% /var\ntmpfs                   746224     10000    736224   1% /tmp\n',
    ['/var', '/tmp', '/media/developer']
  );
  ok(
    df[0].size === 989084 * 1024 && df[0].free === 537984 * 1024 && df[1].path === '/tmp' && df[2].free === null,
    'free space from df -Pk, in the order asked; a path df did not answer is unknown'
  );
  const ps = M.parsePidStat('77 (Web (Content) 1) S 1 77 77 0 -1 4194560 100 0 0 0 250 50 0 0 20 0 9 0 1000 123456 2048 4294967295');
  ok(
    ps.comm === 'Web (Content) 1' && ps.ticks === 300 && ps.rss === 2048 && ps.threads === 9 && ps.state === 'S',
    'a process from its stat line, with brackets and spaces in its name'
  );
  ok(
    M.scriptName('node', 'node\0helper.js\0') === 'node helper.js' &&
      M.scriptName('sh', 'sh\0-c\0curl http://10.0.0.1/x?token=abc\0') === 'sh' &&
      M.scriptName('WebAppMgr', 'x') === 'WebAppMgr',
    'an interpreter is named by its script file only, never by an argument that could hold an address or a key'
  );

  // ---- the reading, with a clock the test moves ----
  const realNow = Date.now;
  let now = 1800000000000;
  Date.now = () => now;
  const metrics = M.create({ config: memoryConfig({}), feature: () => null });
  const reads = () => opened.filter(f => f === PROC + '/stat').length;
  let r0 = reads();
  const [a, a2] = await Promise.all([metrics.reading(), metrics.reading()]);
  ok(a === a2 && reads() - r0 === 1, 'two callers at once share one reading');
  ok(
    a.window === null && a.cpu.total === null && a.cpu.cores.length === 4 && a.cpu.cores.every(c => c.busy === null) && a.self.cpu === null,
    'the first reading has no CPU shares yet: measuring'
  );
  ok(
    a.uptime === 93784 &&
      a.temp.c === 66 &&
      a.temp.source === 'rtk-thermal' &&
      a.cpu.cores[0].mhz === 1156 &&
      a.memory.swap.devices[0].name === 'f2io-0' &&
      a.net[0].name === 'wlan0' &&
      a.net[0].dbm === -40 &&
      a.net.length === 1 &&
      a.emmc.used[1] === '10-20%' &&
      a.self.rss > 0,
    'temperature from the thermal zone (millidegrees), the clock per core, swap, Wi-Fi (eth0 without traffic left out), eMMC, the service'
  );
  ok(
    a.disks.length === 2 && a.disks[0].path === tmp && a.disks[0].size > 0 && a.disks[0].free > 0 && a.disks[1].free === null,
    'free space of each place (statfs or df), a missing one unknown: ' + JSON.stringify(a.disks)
  );
  now += 1500;
  r0 = reads();
  ok((await metrics.reading()) === a && reads() === r0, 'within 2 s the same reading is given again, nothing is read');
  // 2.5 s later: core 0 busy half the time, core 1 a quarter, core 2 went offline, core 3 idle; 500 kB came in over Wi-Fi
  now += 1000;
  put(PROC + '/stat', stat({ 0: [150, 0, 150, 900, 0, 0, 0, 0], 1: [150, 0, 100, 950, 0, 0, 0, 0], 3: [0, 0, 0, 1100, 0, 0, 0, 0] }));
  put(PROC + '/net/dev', netdev(1500000, 50000));
  const b = await metrics.reading();
  ok(
    b.window === 2.5 &&
      JSON.stringify(b.cpu.cores.map(c => [c.busy, c.online])) === '[[50,true],[25,true],[0,false],[0,true]]' &&
      b.cpu.total === 18.8 &&
      b.cpu.cores[2].mhz === null,
    'over 2.5 s: each core, the offline one idle, and the total over all four cores: ' + JSON.stringify(b.cpu)
  );
  ok(b.net[0].rx === 200000 && b.net[0].tx === 0 && typeof b.self.cpu === 'number', 'Wi-Fi traffic per second over the same window');
  // a pause of more than 30 s: the old counters are not used (that would be a long average, not now)
  now += 45000;
  const c = await metrics.reading();
  ok(c.cpu.total === null && c.window === null, 'after a pause of more than 30 s the CPU is measured afresh');
  Date.now = realNow;
  // LG's own temperature where the kernel has it (tvprofile.sensors)
  const tp = req('tvprofile');
  const s1 = tp.sensors('/p', '/s', f => f === '/p/lg/pm/temperature'),
    s2 = tp.sensors('/p', '/s', () => false);
  ok(
    s1.temperature.kind === 'lg' && s1.temperature.path === '/p/lg/pm/temperature' && s2.temperature.dir === '/s/class/thermal',
    "the temperature's source is decided in tvprofile.js: LG's /proc/lg/pm/temperature, else the thermal zones"
  );

  // ---- processes: two sweeps 2 s apart ----
  const procStat = (pid, comm, ticks, rss) =>
    put(
      PROC + '/' + pid + '/stat',
      pid + ' (' + comm + ') S 1 1 1 0 -1 0 0 0 0 0 ' + ticks + ' 0 0 0 20 0 3 0 100 1000 ' + rss + ' 4294967295\n'
    );
  procStat(100, 'WebAppMgr', 1000, 50000);
  procStat(200, 'node', 500, 16000);
  put(PROC + '/200/cmdline', 'node\0helper.js\0');
  procStat(300, 'kworker/0:1', 0, 0);
  const t0 = realNow();
  const pp = metrics.processes(3);
  setTimeout(() => {
    procStat(100, 'WebAppMgr', 1100, 50000); // 100 ticks in 2 s: half a core
    procStat(200, 'node', 520, 16000);
  }, 500);
  const pr = await pp;
  ok(
    realNow() - t0 >= 1900 &&
      pr.tasks === 3 &&
      pr.byCpu[0].name === 'WebAppMgr' &&
      Math.abs(pr.byCpu[0].cpu - 50) < 3 &&
      pr.byCpu[1].name === 'node helper.js' &&
      pr.byMemory[0].rss === 50000 * 4096,
    'processes: CPU from two sweeps 2 s apart, memory in bytes, an interpreter named by its script: ' + JSON.stringify(pr.byCpu)
  );
  ok(pr.byCpu.length === 3 && (await metrics.processes(2)).byCpu.length === 2, 'the top N, at most what was asked');

  // ---- the load average is never read ----
  ok(!opened.some(f => /loadavg/.test(f)), 'the load average (/proc/loadavg, near 32 on an idle Realtek TV) is never read');
  const code = ['metrics.js', 'exposure.js', 'statusdata.js'].map(f =>
    fs
      .readFileSync(path.join(root, 'helper', f), 'utf8')
      .split('\n')
      .map(l => l.replace(/\/\/.*$/, ''))
      .join('\n')
  );
  ok(!code.some(t => /loadavg|os\.loadavg/.test(t)), 'nor named in the code (comments aside)');

  // ---- the listening ports ----
  const E = req('exposure');
  ok(
    E.bindOf('0100007F') === 'loopback' &&
      E.bindOf('00000000') === 'all' &&
      E.bindOf('0104A8C0') === 'interface' &&
      E.bindOf('00000000000000000000000000000000') === 'all' &&
      E.bindOf('00000000000000000000000001000000') === 'loopback' &&
      E.bindOf('0000000000000000FFFF00000100007F') === 'loopback' &&
      E.bindOf('0000000000000000FFFF00000104A8C0') === 'interface' &&
      E.bindOf('80FE0000000000000211223344556677') === 'interface',
    'a bound address becomes loopback, all or interface (IPv4, IPv6 and IPv4-mapped), never the address'
  );
  const H = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n';
  const line = (n, local, st, inode) =>
    '   ' +
    n +
    ': ' +
    local +
    ' 00000000:0000 ' +
    st +
    ' 00000000:00000000 00:00000000 00000000     0        0 ' +
    inode +
    ' 1 0000000000000000 100 0 0 10 0\n';
  const H6 = H;
  const line6 = (n, local, st, inode) =>
    '   ' +
    n +
    ': ' +
    local +
    ' 00000000000000000000000000000000:0000 ' +
    st +
    ' 00000000:00000000 00:00000000 00000000     0        0 ' +
    inode +
    ' 1 0000000000000000 100 0 0 10 0\n';
  const hex = p => p.toString(16).toUpperCase().padStart(4, '0');
  const SONOS = 33021;
  put(
    PROC + '/net/tcp',
    H +
      line(0, '0100007F:' + hex(8765), '0A', 1001) +
      line(1, '00000000:' + hex(9998), '0A', 1002) +
      line(2, '00000000:' + hex(22), '0A', 1003) +
      line(3, '0104A8C0:' + hex(8794), '01', 1004) + // a connection, not a listener
      line(4, '00000000:' + hex(4444), '0A', 1007) +
      line(5, '00000000:' + hex(SONOS), '0A', 1008) +
      line(6, '00000000:' + hex(8769), '0A', 1009) +
      line(7, '0104A8C0:' + hex(8768), '0A', 1010)
  );
  put(
    PROC + '/net/tcp6',
    H6 +
      line6(0, '00000000000000000000000000000000:' + hex(8794), '0A', 1005) +
      line6(1, '0000000000000000FFFF00000100007F:' + hex(8770), '0A', 1006) +
      line6(2, '00000000000000000000000000000000:' + hex(22), '0A', 1011)
  );
  put(
    PROC + '/net/udp',
    H +
      line(0, '00000000:' + hex(1900), '07', 2001) +
      line(1, '00000000:' + hex(45000), '07', 2002) +
      line(2, '0100007F:' + hex(53), '07', 2003)
  );
  const proc = (pid, comm, cmdline, inodes) => {
    put(PROC + '/' + pid + '/comm', comm + '\n');
    put(PROC + '/' + pid + '/cmdline', cmdline);
    fs.mkdirSync(PROC + '/' + pid + '/fd', { recursive: true });
    inodes.forEach((n, i) => fs.symlinkSync('socket:[' + n + ']', PROC + '/' + pid + '/fd/' + (i + 3)));
    fs.symlinkSync('/dev/null', PROC + '/' + pid + '/fd/0');
  };
  proc(10, 'dropbear', 'dropbear\0-R\0', [1003, 1011]);
  proc(11, 'WebAppMgr', '/usr/bin/WebAppMgr\0', [1002]);
  proc(process.pid, 'node', 'node\0helper.js\0', [1001, 1005, 1008, 1009]);
  proc(12, 'telemachusd', 'telemachusd\0run\0', [1006]);
  proc(13, 'mystery', 'mystery\0', [1007]);
  proc(14, 'iconnectivity', 'x\0', [2001, 2002]);
  proc(15, 'sh', 'sh\0/media/developer/cleanyourtv/watchdog.sh\0', []);
  proc(16, 'node', 'node\0sharelog.js\0', [1010]);
  fs.mkdirSync(INITD, { recursive: true });
  for (const n of ['10-cleanyourtv-home', '15-cleanyourtv-debloat', '60-telemachus']) put(path.join(INITD, n), '#!/bin/sh\n');
  const feats = {
    sonos: { eventPort: () => SONOS },
    debloatcheck: {
      n: 0,
      recent() {
        this.n++;
        return Promise.resolve({
          at: 1,
          on: true,
          groups: [
            { id: 'tracking', ok: false, notes: ['acr2 is running'] },
            { id: 'logs', ok: true, notes: [] },
            { id: 'preload', ok: true, notes: [] },
          ],
        });
      },
    },
  };
  const ectx = {
    config: memoryConfig({}),
    feature: n => feats[n] || null,
    parts: () => ({ running: ['core', 'remote', 'metrics'], failed: ['voice'] }),
  };
  const ex = E.create(ectx);
  const rep = await ex.report();
  const port = (n, proto) => rep.ports.filter(p => p.port === n && (p.proto || 'tcp') === (proto || 'tcp'))[0] || {};
  ok(
    port(9998).tone === 'r' && port(9998).bind === 'LAN' && port(9998).program === 'WebAppMgr' && rep.ports[0].port === 9998,
    "WebAppMgr's DevTools on the network is red, and listed first"
  );
  // LG's web inspector and the security option that closes it (security.js, scripts/devtools-close.sh): while it is on and WebAppMgr
  // still has the port, red with "from the next start"; switched off, red with where to close it; closed, one green row "closed"
  const wam = { proto: 'tcp', port: 9998, bind: 'all', program: 'WebAppMgr' };
  const onButOpen = E.classify(wam, { devtoolsClosed: true }),
    off = E.classify(wam, { devtoolsClosed: false });
  const amber22 = { proto: 'tcp', port: 22, bind: 'LAN', program: 'dropbear', what: 'SSH', how: 'x', tone: 'a' },
    green1900 = { proto: 'udp', port: 1900, bind: 'LAN', program: 'x', what: 'SSDP', how: 'x', tone: 'g' };
  const closedRows = E.devtoolsRow([amber22, green1900], true),
    closedRow = closedRows.filter(p => p.port === 9998)[0] || {};
  ok(
    onButOpen.tone === 'r' &&
      /closed from the next start/.test(onButOpen.how) &&
      off.tone === 'r' &&
      /Security > LG’s web inspector closes it/.test(off.how) &&
      closedRow.bind === 'closed' &&
      closedRow.tone === 'g' &&
      closedRows.map(p => p.port).join() === '22,1900,9998' &&
      port(9998).how === onButOpen.how,
    'port 9998: open while closing is on says from the next start; switched off says where; closed is one green row: ' +
      JSON.stringify([onButOpen.how, closedRow])
  );
  ok(
    E.devtoolsRow([amber22], false).length === 1 && E.devtoolsRow([Object.assign({}, wam, { bind: 'LAN', tone: 'r' })], true).length === 1,
    'no "closed" row while the option is off, nor while WebAppMgr still listens'
  );
  ok(port(8765).tone === 'g' && port(8765).bind === 'loopback' && /API token/.test(port(8765).how), 'our service: loopback only, green');
  ok(
    port(8794).tone === 'g' &&
      port(8794).bind === 'LAN' &&
      /paired phones only/.test(port(8794).how) &&
      !rep.ports.some(p => p.port === 8794 && p.bind === 'loopback'),
    'the phone remote: on the LAN, paired phones only (IPv6 and IPv4 as one row; the connection is not a listener)'
  );
  ok(
    port(8770).bind === 'loopback' && port(8770).tone === 'g' && /Telemachus/.test(port(8770).what),
    'Telemachus bound to loopback (IPv4-mapped) is green, and not taken for the share log (8768 to 8790): ' + port(8770).what
  );
  ok(
    port(22).tone === 'a' && /no -s/.test(port(22).how) && rep.ports.filter(p => p.port === 22).length === 1,
    'SSH by dropbear without -s: amber, one row'
  );
  ok(
    port(4444).what === 'Unknown: not in this table' && port(4444).tone === 'a' && port(4444).program === 'mystery',
    'a port not in the table is unknown, amber, with its program'
  );
  ok(/Sonos/.test(port(SONOS).what) && port(SONOS).tone === 'g', "this service's Sonos event port is named from the Sonos part");
  ok(
    /Voice/.test(port(8769).what) && /Share log/.test(port(8768).what) && port(8768).program === 'node sharelog.js',
    'port 8769 held by the service is the voice page; the share log runs apart (8768 to 8790)'
  );
  ok(
    port(1900, 'udp').tone === 'g' &&
      !rep.ports.some(p => p.port === 53) &&
      rep.udpReplies.count === 1 &&
      rep.udpReplies.programs[0] === 'iconnectivity',
    'UDP: discovery listed, loopback left out, reply ports counted apart'
  );
  ok(
    rep.ports.every(p => ['g', 'a', 'r'].indexOf(p.tone) >= 0 && p.how && p.what),
    'every port has a colour and a line why'
  );
  const sv = rep.services;
  ok(
    JSON.stringify(sv.parts) === '{"running":["core","remote","metrics"],"failed":["voice"]}' &&
      sv.boot.scripts.length === 3 &&
      sv.boot.scripts[0].ours &&
      !sv.boot.scripts[2].ours &&
      sv.boot.watchdog === true &&
      sv.telemachus.running === true,
    'services: our parts, boot scripts (ours marked), the watchdog and Telemachus: ' + JSON.stringify(sv.boot)
  );
  ok(
    JSON.stringify(sv.debloat.daemons) ===
      JSON.stringify([
        { name: 'acr2', group: 'tracking', state: 'running again' },
        { name: 'livepick-plus', group: 'tracking', state: 'stopped' },
        { name: 'uploadd', group: 'logs', state: 'stopped' },
        { name: 'remotelogger', group: 'logs', state: 'stopped' },
        { name: 'service-logger', group: 'logs', state: 'stopped' },
        { name: 'rdxd', group: 'logs', state: 'stopped' },
      ]),
    "LG's daemons the debloat stops: stopped, or running again: " + JSON.stringify(sv.debloat.daemons)
  );
  const text = JSON.stringify(rep);
  ok(
    !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(text) && !/[0-9A-F]{8}(:[0-9A-F]{4})?"/.test(text) && !/([0-9a-f]{2}:){5}/i.test(text),
    'no address (IPv4, hex) or MAC in the report'
  );
  ok((await ex.report()) === rep && feats.debloatcheck.n === 1, 'the report is kept 30 s');
  ok(
    E.sshGuard('dropbear', 'dropbear\0-R\0-s\0').tone === 'g' && E.sshGuard('dropbear', 'dropbear\0-Rg\0').tone === 'g',
    'dropbear with -s or -g: green'
  );
  ok(
    E.rootPassword('root:!:19000:0:99999:7:::\nbin:*:1') === 'locked' &&
      E.rootPassword('root::19000::::::') === 'empty' &&
      E.rootPassword('root:$6$salt$hash:1') === 'set' &&
      E.rootPassword('') === '' &&
      E.sshGuard('dropbear', 'dropbear\0-R\0', '', 'locked').tone === 'g' &&
      E.sshGuard('dropbear', 'dropbear\0-R\0-s\0', '', 'empty').tone === 'r' &&
      E.sshGuard('dropbear', 'dropbear\0-R\0', '', 'set').tone === 'a' &&
      !/\$6\$|salt|hash/.test(JSON.stringify(E.sshGuard('dropbear', 'dropbear\0-R\0', '', E.rootPassword('root:$6$salt$hash:1')))),
    "SSH by root's password state (never its hash): locked is green whatever dropbear's flags, empty is red, set without -s amber"
  );
  ok(
    E.sshGuard('sshd', '', 'Port 22\nPasswordAuthentication no\n').tone === 'g' &&
      E.sshGuard('sshd', '', '#PasswordAuthentication no\n').tone === 'a',
    'OpenSSH: green only when its settings switch passwords off'
  );
  // docs/security.md's table says what PORTS says: each port in a row, with the colour it gets on the network
  const doc = fs.readFileSync(path.join(root, 'docs', 'security.md'), 'utf8');
  const section = (doc.split('## What is open on the TV')[1] || '').split('\n## ')[0];
  const docRows = section.split('\n').filter(l => /^\| [^-]/.test(l) && !/^\| Port /.test(l));
  const COLOUR = { g: 'green', a: 'amber', r: 'red' };
  const mismatched = E.PORTS.filter(e => {
    const key = e.port !== undefined ? String(e.port) : e.from !== undefined ? String(e.from) : e.program.source.replace(/[\^$]/g, '');
    const r = docRows.filter(l => new RegExp('^\\| [^|]*\\b' + key.replace(/[.*+?()[\]\\]/g, '\\$&') + '\\b').test(l))[0];
    if (!r) return true;
    const colour = r.split('|')[3] || '';
    return e.ssh ? !/green or amber/.test(colour) : colour.indexOf(COLOUR[e.tone]) < 0;
  });
  ok(
    section.length > 500 && !mismatched.length,
    'docs/security.md lists every port of the table with its colour: ' + mismatched.map(e => e.port || e.from || e.program).join(', ')
  );
  // LG's services, from systemctl, cached a minute
  put(
    path.join(BIN, 'systemctl'),
    '#!/bin/sh\necho "$@" >> ' +
      path.join(tmp, 'systemctl.log') +
      '\nprintf "  sam.service loaded active running System and Application Manager\\nwebappmgr.service loaded active running Web App Manager\\n"\n'
  );
  fs.chmodSync(path.join(BIN, 'systemctl'), 0o755);
  const u1 = await ex.lgServices(),
    u2 = await ex.lgServices();
  ok(
    u1 === u2 &&
      JSON.stringify(u1.units.map(u => u.unit)) === '["sam.service","webappmgr.service"]' &&
      fs.readFileSync(path.join(tmp, 'systemctl.log'), 'utf8').trim().split('\n').length === 1 &&
      /--state=running/.test(fs.readFileSync(path.join(tmp, 'systemctl.log'), 'utf8')),
    "LG's running services: systemctl once, kept a minute"
  );

  // ---- the phone's TV tab: only with a paired key, nothing secret ----
  const SECRETS = [
    'SECRET-feed-token-1',
    'SECRET-plex-token-2',
    'SECRET-stremio-key-3',
    'SECRET-disney-refresh-4',
    'SECRET-notify-token-5',
    'SECRET-ha-token-6',
    'http://playlist.example/list.m3u',
    'Sam’s phone',
    'secret/repo',
  ];
  const config = memoryConfig({
    options: { debloat: true, debloatOff: ['logs'], debloatOn: ['lgservers'] },
    photoFeed: { url: 'https://10.1.2.3:9', token: SECRETS[0] },
    watchAccounts: {
      plex: { token: SECRETS[1], server: { name: 'den', uri: 'http://10.1.2.4:32400' } },
      stremio: { authKey: SECRETS[2] },
      disney: {},
    },
    notifyApi: { enabled: true, token: SECRETS[4] },
    voice: { ha: { url: 'http://10.1.2.5:8123', token: SECRETS[5] } },
    live: { url: SECRETS[6] },
  });
  const manager = {
    name: 'manager',
    status: () => ({
      frontend: { version: '1.5.20', updateTo: null },
      service: { version: '1.6.32', updateTo: '1.6.33' },
      release: { version: '1.6.33' },
      channel: '',
      checkedAt: 5,
      home: { enabled: true, ours: true },
      repo: SECRETS[8],
      keys: { input: '241' },
      notifyApi: { token: SECRETS[4] },
      security: {
        source: { repo: SECRETS[8], ours: false },
        token: { enforced: true },
        telnet: { off: true },
        devtools: { closed: true, listening: false },
      },
    }),
  };
  const all = {
    manager,
    debloatcheck: feats.debloatcheck,
    sonos: feats.sonos,
  };
  const rctx = {
    version: '1.6.32',
    config,
    profile: { get: () => ({ model: '86UR8000AUA', firmware: '33.31.75', sdk: '10.3.2' }) },
    luna: async () => ({ returnValue: true }),
    feature: n => all[n] || null,
    parts: ectx.parts,
  };
  all.metrics = M.create(rctx);
  const R = req('remote').create(rctx);
  R.start();
  const lan = (p, headers) =>
    new Promise((resolve, reject) => {
      const q = http.request(
        {
          host: '127.0.0.1',
          port: +process.env.CYTV_REMOTE_PORT,
          path: p,
          method: p === '/pair' ? 'POST' : 'GET',
          agent: false,
          headers: headers || {},
        },
        res => {
          const parts = [];
          res.on('data', d => parts.push(d));
          res.on('end', () => {
            const t = Buffer.concat(parts).toString();
            let j = null;
            try {
              j = JSON.parse(t);
            } catch (_) {}
            resolve({ code: res.statusCode, text: t, j });
          });
        }
      );
      q.on('error', reject);
      q.end();
    });
  const pr1 = await call(R, '/api/remote/pair', 'POST', {});
  const paired = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ code: pr1.j.code, name: SECRETS[7] });
    const q = http.request(
      {
        host: '127.0.0.1',
        port: +process.env.CYTV_REMOTE_PORT,
        path: '/pair',
        method: 'POST',
        agent: false,
        headers: { 'content-type': 'application/json' },
      },
      res => {
        const parts = [];
        res.on('data', d => parts.push(d));
        res.on('end', () => resolve(JSON.parse(Buffer.concat(parts).toString())));
      }
    );
    q.on('error', reject);
    q.end(body);
  });
  const key = { 'x-remote-key': paired.key };
  const none = await lan('/status-data'),
    wrong = await lan('/status-data', { 'x-remote-key': paired.key.slice(0, 42) + (paired.key.slice(-1) === 'A' ? 'B' : 'A') }),
    noneX = await lan('/status-exposure'),
    noneS = await lan('/status-services'),
    other = await lan('/status-data', Object.assign({ origin: 'http://evil.example' }, key));
  ok(
    none.code === 401 && wrong.code === 401 && noneX.code === 401 && noneS.code === 401 && other.code === 403,
    'the TV tab needs a paired phone: no key, a wrong key and another site are refused: ' +
      [none.code, wrong.code, noneX.code, noneS.code, other.code]
  );
  const sd = await lan('/status-data', key);
  const st = sd.j && sd.j.settings;
  ok(
    sd.code === 200 &&
      sd.j.metrics.cpu.cores.length === 4 &&
      st.versions.service === '1.6.32' &&
      st.versions.launcher === '1.5.20' &&
      st.updates.available === '1.6.33' &&
      st.updates.channel === 'stable' &&
      st.updates.fromThisProject === false &&
      st.home.takeover === true &&
      st.remote.on === true &&
      st.remote.phones === 1 &&
      JSON.stringify(st.linked) === '{"plex":true,"stremio":true,"disney":false}' &&
      st.debloat.groups.filter(g => g.id === 'logs')[0].on === false &&
      st.debloat.groups.filter(g => g.id === 'lgservers')[0].on === true &&
      st.debloat.check.groups[0].ok === false &&
      st.security.telnetOff === true &&
      st.security.apiToken === true &&
      st.security.devtoolsClosed === true,
    'with its key: the health reading and the summary of the settings: ' + JSON.stringify(st)
  );
  const sx = await lan('/status-exposure', key),
    ss = await lan('/status-services', key);
  ok(sx.code === 200 && sx.j.ports.length > 3 && ss.code === 200 && ss.j.units.length === 2, 'and the ports, services and LG’s services');
  const leaked = [sd.text, sx.text, ss.text].join('\n');
  const found = SECRETS.concat([paired.key, config.get().remote.devices[0].hash, '10.1.2.']).filter(x => leaked.indexOf(x) >= 0);
  ok(!found.length, 'nothing secret reaches the phone (tokens, keys, the key hash, addresses, playlist, phone name, repository): ' + found);
  ok(
    !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(leaked.replace(/"(version|launcher|service|firmware|sdk|node|available)":"[^"]*"/g, '')),
    'no IPv4 address anywhere in the replies'
  );
  const page = await lan('/');
  ok(
    /data-p=tv/.test(page.text) && /id=tv /.test(page.text) && /status-data/.test(page.text) && /function tvTab/.test(page.text),
    'the phone page has the TV tab'
  );
  const sp = req('statuspage');
  let parses = true;
  try {
    new Function('var key="",$=function(){return{}},t=function(s){return s};' + sp.JS); // eslint-disable-line no-new-func
  } catch (e) {
    parses = false;
  }
  const transitions = (sp.css(n => n + 'px').match(/transition:[^;}]+/g) || []).join();
  ok(
    parses && !/transition:(?!transform)/.test(transitions.replace(/,/g, ';')),
    'the tab script parses, and only transform moves in its styles: ' + transitions
  );
  // the remote switched off on the TV: the tab stops with it
  await call(R, '/api/remote/on', 'POST', { on: false });
  await sleep(300);
  const offTry = await lan('/status-data', key).catch(() => ({ code: 0 }));
  ok(offTry.code === 0, 'switched off on the TV, the LAN server stops and the tab with it');
  R.stop();
});
