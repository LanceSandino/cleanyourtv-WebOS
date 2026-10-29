// The phone remote page's TV tab (remotepage.js puts it in the page; remote.js answers its requests through statusdata.js, only with
// this phone's paired key): the TV's health (processor per core, temperature, memory and swap, storage and the eMMC's wear, Wi-Fi,
// uptime, the service's own use), a summary of the settings, and on a tap the open ports with how each is guarded and the services.
// Read only. It asks every 3 s, and only while the tab is shown and the page is in front; nothing is kept on the TV or the phone.
// Everything it shows is set as text (textContent), never as markup. Only transform and opacity animate.

const JS = String.raw`
var tvOn = false, tvT = 0, tvSeq = 0;
function tvGet(path) {
  return fetch(path, { headers: { 'x-remote-key': key }, cache: 'no-store' })
    .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
}
function tvEl(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function tvBytes(b) {
  if (b === null || b === undefined) return '?';
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return Math.round(b / 1048576) + ' MB';
  return Math.round(b / 1024) + ' kB';
}
function tvRate(b) { return b === null || b === undefined ? '…' : tvBytes(b) + '/s'; }
function tvUp(s) {
  var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + m + ' min' : m + ' min';
}
/* a meter: its fill is scaled, never resized (transform only) */
function tvMeter(x, warn) {
  var m = tvEl('div', 'tvm' + (warn ? ' w' : '')), i = tvEl('i');
  i.style.transform = 'scaleX(' + Math.max(0, Math.min(1, x || 0)) + ')';
  m.appendChild(i);
  return m;
}
function tvLine(label, value, x, warn) {
  var r = tvEl('div', 'tvl');
  var t = tvEl('div', 'tvt');
  t.appendChild(tvEl('span', '', label));
  t.appendChild(tvEl('b', '', value));
  r.appendChild(t);
  if (x !== undefined && x !== null) r.appendChild(tvMeter(x, warn));
  return r;
}
function tvFill(id, nodes) {
  var box = $(id);
  box.textContent = '';
  nodes.forEach(function (n) { if (n) box.appendChild(n); });
}
function tvDraw(r) {
  var m = r.metrics, s = r.settings;
  $('tvup').textContent = t('Up %s').replace('%s', tvUp(m.uptime || 0));
  $('tvtemp').textContent = m.temp ? m.temp.c + ' °C' : '';
  $('tvcpu').textContent = m.cpu.total === null ? t('measuring…') : m.cpu.total + '%';
  tvFill('tvcores', m.cpu.cores.map(function (c) {
    return tvLine(t('Core %s').replace('%s', c.id + 1), !c.online ? t('offline') : (c.busy === null ? '…' : c.busy + '%') + (c.mhz ? ' · ' + (c.mhz / 1000).toFixed(2) + ' GHz' : ''), c.busy === null ? 0 : c.busy / 100, c.busy > 85);
  }));
  var mem = m.memory, used = mem.total - mem.available, sw = mem.swap;
  tvFill('tvmem', [
    tvLine(t('Memory'), tvBytes(used) + ' / ' + tvBytes(mem.total), mem.total ? used / mem.total : 0, mem.available < 150 * 1048576),
    sw.total ? tvLine(t('Swap') + (sw.devices[0] ? ' (' + sw.devices[0].name + ')' : ''), tvBytes(sw.used) + ' / ' + tvBytes(sw.total), sw.used / sw.total, sw.used / sw.total > 0.8) : null,
  ]);
  tvFill('tvdisks', (Array.isArray(m.disks) ? m.disks : []).map(function (d) {
    return tvLine(d.path, d.free === null ? '?' : t('%s free').replace('%s', tvBytes(d.free)), d.size ? 1 - d.free / d.size : 0, d.size && d.free / d.size < 0.1);
  }).concat([m.emmc ? tvLine(t('Flash wear'), m.emmc.used.join(' / ') + (m.emmc.eol ? ' · ' + t(m.emmc.eol) : '')) : null]));
  tvFill('tvnet', (m.net || []).map(function (n) {
    return tvLine(n.name, (n.dbm ? n.dbm + ' dBm · ' : '') + '↓ ' + tvRate(n.rx) + ' ↑ ' + tvRate(n.tx));
  }));
  tvFill('tvself', [tvLine(t('CleanYourTV service'), (m.self.cpu === null ? '…' : m.self.cpu + '%') + ' · ' + tvBytes(m.self.rss))]);
  var yes = function (b) { return b ? t('yes') : t('no'); };
  var on = function (b) { return b ? t('On') : t('Off'); };
  var dg = s.debloat, bad = dg.check ? dg.check.groups.filter(function (g) { return !g.ok; }) : [];
  var nOn = dg.groups.filter(function (g) { return g.on; }).length;
  tvFill('tvset', [
    tvLine(t('Versions'), t('service %s').replace('%s', s.versions.service) + ' · ' + t('launcher %s').replace('%s', s.versions.launcher)),
    tvLine(t('TV'), [s.tv.model, s.tv.sdk && 'webOS SDK ' + s.tv.sdk, s.tv.firmware].filter(Boolean).join(' · ')),
    s.updates ? tvLine(t('Updates'), (s.updates.channel === 'dev' ? t('Dev builds') : t('Stable releases')) + (s.updates.available ? ' · ' + t('%s available').replace('%s', s.updates.available) : '') + (s.updates.fromThisProject ? '' : ' · ' + t('another source'))) : null,
    s.home ? tvLine(t('CleanYourTV as Home'), on(s.home.takeover) + (s.home.takeover && !s.home.active ? ' · ' + t('not active now') : '')) : null,
    tvLine(t('Debloat'), !dg.on ? t('Off') : nOn + ' / ' + dg.groups.length + (dg.check ? (bad.length ? ' · ' + t('not in place: %s').replace('%s', bad.map(function (g) { return g.id; }).join(', ')) : ' · ' + t('works')) : '')),
    tvLine(t('Phone remote'), on(s.remote.on) + ' · ' + t('phones paired: %d').replace('%d', s.remote.phones)),
    tvLine(t('Linked'), 'Plex ' + yes(s.linked.plex) + ' · Stremio ' + yes(s.linked.stremio) + ' · Disney+ ' + yes(s.linked.disney)),
    tvLine(t('Telnet'), s.security.telnetOff ? t('Off') : t('On: an open root shell')),
    tvLine(t('API token'), s.security.apiToken ? t('required') : t('not required yet')),
  ]);
}
function tvPoll() {
  clearTimeout(tvT);
  if (!tvOn || document.hidden || !key) return;
  var my = ++tvSeq;
  tvGet('/status-data').then(function (r) {
    if (my !== tvSeq) return;
    if (r.status === 401) { tvOn = false; login(t('This phone is not paired any more. Pair it again from the TV.')); return; }
    state(r.status === 200);
    if (r.metrics) tvDraw(r);
    else if (r.error) note(t(r.error), true);
    tvT = setTimeout(tvPoll, 3000);
  }, function () {
    if (my !== tvSeq) return;
    state(false);
    tvT = setTimeout(tvPoll, 3000);
  });
}
/* the tab is shown (on) or left: asking starts and stops with it */
function tvTab(on) {
  tvOn = on;
  clearTimeout(tvT);
  tvSeq++;
  if (on) tvPoll();
}
document.addEventListener('visibilitychange', function () { if (tvOn) { if (document.hidden) { clearTimeout(tvT); tvSeq++; } else tvPoll(); } });
var TONE = { g: t('guarded'), a: t('open by design'), r: t('open, no check') };
function tvPorts() {
  $('tvexp').textContent = t('Reading…');
  tvGet('/status-exposure').then(function (r) {
    $('tvexp').textContent = t('Read again');
    if (r.status === 401) return login(t('This phone is not paired any more. Pair it again from the TV.'));
    if (!r.ports) return note(t(r.error || 'The TV did not answer.'), true);
    var rows = r.ports.map(function (p) {
      var row = tvEl('div', 'tvp ' + p.tone);
      row.appendChild(tvEl('i', 'dot'));
      var b = tvEl('div', 'tvpb');
      b.appendChild(tvEl('b', '', p.port + '/' + p.proto + ' · ' + p.what));
      b.appendChild(tvEl('span', '', (p.bind === 'loopback' ? t('loopback') : t('LAN')) + ' · ' + p.program + ' · ' + TONE[p.tone]));
      b.appendChild(tvEl('small', '', p.how));
      row.appendChild(b);
      return row;
    });
    if (r.udpReplies && r.udpReplies.count) rows.push(tvEl('small', '', t('UDP reply ports of discovery clients: %d').replace('%d', r.udpReplies.count) + ' (' + r.udpReplies.programs.join(', ') + ')'));
    var sv = r.services;
    rows.push(tvEl('h4', '', t('Services')));
    rows.push(tvLine(t('Our parts'), sv.parts.running.length + ' ' + t('running') + (sv.parts.failed.length ? ' · ' + t('failed: %s').replace('%s', sv.parts.failed.join(', ')) : '')));
    rows.push(tvLine(t('Boot scripts'), sv.boot.scripts.map(function (x) { return x.name; }).join(', ') || t('none')));
    rows.push(tvLine(t('Watchdog'), sv.boot.watchdog ? t('running') : t('not running')));
    if (sv.telemachus) rows.push(tvLine('Telemachus', sv.telemachus.running ? t('running') : t('not running')));
    if (sv.debloat && sv.debloat.on)
      sv.debloat.daemons.forEach(function (d) { rows.push(tvLine(d.name, t(d.state), undefined)); });
    tvFill('tvports', rows);
  }, function () { $('tvexp').textContent = t('Read again'); state(false); });
}
function tvUnits() {
  $('tvsvc').textContent = t('Reading…');
  tvGet('/status-services').then(function (r) {
    $('tvsvc').textContent = t('Read again');
    if (r.status === 401) return login(t('This phone is not paired any more. Pair it again from the TV.'));
    if (!r.units) return note(t(r.error || 'The TV did not answer.'), true);
    var box = tvEl('div', 'tvu');
    box.textContent = r.units.map(function (u) { return u.unit.replace(/\.service$/, ''); }).join(', ') || r.error || t('none');
    tvFill('tvunits', [tvEl('small', '', t('%d running').replace('%d', r.units.length)), box]);
  }, function () { $('tvsvc').textContent = t('Read again'); state(false); });
}
$('tvexp').onclick = function () { buzz(); tvPorts(); };
$('tvsvc').onclick = function () { buzz(); tvUnits(); };
`;

// the tab's markup; T translates and escapes (remotepage.js)
function html(T) {
  const card = (title, id) => '<div class=tvc><h3>' + T(title) + '</h3><div id=' + id + '></div></div>';
  return (
    '<section id=tv class=hide><div class=tvh><b id=tvup></b><span id=tvtemp></span></div>' +
    '<div class=tvc><h3>' +
    T('Processor') +
    '</h3><div class=tvbig id=tvcpu>…</div><div id=tvcores></div></div>' +
    card('Memory', 'tvmem') +
    card('Storage', 'tvdisks') +
    card('Network', 'tvnet') +
    card('This service', 'tvself') +
    card('Settings', 'tvset') +
    '<div class=tvc><h3>' +
    T('Open ports and services') +
    '</h3><div id=tvports></div><button class="key tvb" id=tvexp>' +
    T('Show') +
    '</button></div>' +
    '<div class=tvc><h3>' +
    T('LG’s running services') +
    '</h3><div id=tvunits></div><button class="key tvb" id=tvsvc>' +
    T('Show') +
    '</button></div>' +
    '<small>' +
    T('Read only. It asks the TV every 3 seconds while this tab is open; nothing is kept on the TV.') +
    '</small></section>'
  );
}

// the tab's styles; u(n) is the page's unit (remotepage.js)
const css = u =>
  `#tv{display:block}.tvh{display:flex;align-items:baseline;justify-content:space-between;margin:0 ${u(4)} ${u(10)};font-size:${u(13)};color:#9a9ca5}
.tvh b{font-weight:600;color:#c9cbd1}.tvc{margin-bottom:${u(12)};padding:${u(14)} ${u(16)};border-radius:${u(20)};background:#141519;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
.tvc h3{margin:0 0 ${u(8)};font-size:${u(12)};font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#80838c}
.tvc h4{margin:${u(14)} 0 ${u(6)};font-size:${u(12)};color:#80838c}.tvbig{font-size:${u(30)};font-weight:700;margin-bottom:${u(6)};font-variant-numeric:tabular-nums}
.tvl{margin:${u(7)} 0}.tvt{display:flex;justify-content:space-between;font-size:${u(13)};color:#9a9ca5}
.tvt span{flex:0 1 auto;min-width:0;max-width:50%;margin-right:${u(10)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tvt b{flex:1 1 0;min-width:0;font-weight:600;color:#e8e9ed;text-align:right;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.tvm{height:${u(5)};margin-top:${u(5)};border-radius:${u(3)};overflow:hidden;background:#24262c}
.tvm i{display:block;height:100%;background:#4d8ef7;transform-origin:0 0;transition:transform .4s}.tvm.w i{background:#ff9f0a}
.tvp{display:flex;align-items:flex-start;padding:${u(8)} 0;border-top:1px solid rgba(255,255,255,.05)}.tvp:first-child{border-top:0}
.tvp .dot{flex:none;width:${u(10)};height:${u(10)};margin:${u(5)} ${u(10)} 0 0;border-radius:50%}
.tvp.g .dot{background:#30d158}.tvp.a .dot{background:#ff9f0a}.tvp.r .dot{background:#ff453a;box-shadow:0 0 ${u(8)} rgba(255,69,58,.6)}
.tvpb{min-width:0}.tvpb b{display:block;font-size:${u(13.5)};font-weight:600}.tvpb span{display:block;font-size:${u(12)};color:#9a9ca5}
.tvpb small,.tvc small{margin-top:${u(3)};font-size:${u(11.5)}}.tvu{font-size:${u(12)};line-height:1.5;color:#9a9ca5;overflow-wrap:anywhere}
.tvb{width:100%;height:${u(42)};margin-top:${u(8)};border-radius:${u(14)};font-size:${u(14)};font-weight:600}`;

module.exports = { JS, html, css };
