// The phone remote's page (remote.js serves it on the LAN): the arrows round OK, Back, Home and Settings, the volume, play and pause, a
// touchpad for the pointer (drag to move, tap to click, two fingers to scroll), typing into the TV's search box, and the apps of the
// dock. It pairs itself from the code in its address (#p=<code>, from the QR code on the TV) or one typed in, keeps its key in this
// browser (localStorage) and sends it with every press. Add to Home Screen opens it full screen, like an app.
const web = require('./web'),
  i18n = require('./i18n');

const JS = String.raw`
var K = 'cytv-remote-key', key = '';
try { key = localStorage.getItem(K) || ''; } catch (e) {}
function $(id) { return document.getElementById(id); }
function call(path, body) {
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-remote-key': key }, body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
}
function note(t, bad) { var m = $('msg'); m.textContent = t || ''; m.className = t ? (bad ? 'm e' : 'm') : 'm hide'; }
function buzz() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
var down = false;
function state(ok) {
  $('dot').className = ok ? 'on' : '';
  $('tv').textContent = ok ? t('Connected to the TV') : t('The TV does not answer. Is it on, and the phone on the same Wi-Fi?');
}
function press(k) {
  buzz();
  call('/press', { key: k }).then(function (r) {
    if (r.status === 401) return login(t('This phone is not paired any more. Pair it again from the TV.'));
    state(r.status < 500 || r.status === 502);
    if (r.error && r.status !== 401) note(t(r.error), true); else note('');
  }, function () { state(false); });
}
function login(why) {
  key = '';
  try { localStorage.removeItem(K); } catch (e) {}
  $('main').className = 'hide';
  $('login').className = '';
  note(why || '', !!why);
}
function pair(code) {
  note(t('Pairing…'));
  var name = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Phone';
  fetch('/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code, name: name }) })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j.key) return login(t(j.error || 'Pairing did not work.'));
      key = j.key;
      try { localStorage.setItem(K, key); } catch (e) {}
      note('');
      start();
    }, function () { login(t('The TV does not answer. Is it on, and the phone on the same Wi-Fi?')); });
}
function start() {
  $('login').className = 'hide';
  $('main').className = '';
  call('/ping').then(function (r) { if (r.status === 401) login(t('This phone is not paired any more. Pair it again from the TV.')); else state(true); }, function () { state(false); });
}
/* the buttons: data-k is the key; holding an arrow repeats it */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-k]');
  if (b && !b.hasAttribute('data-hold')) press(b.getAttribute('data-k'));
});
var rep = 0;
['touchstart', 'mousedown'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var b = e.target.closest && e.target.closest('[data-hold]');
    if (!b) return;
    e.preventDefault();
    var k = b.getAttribute('data-k');
    press(k);
    clearInterval(rep);
    var n = 0;
    rep = setInterval(function () { if (++n > 3) press(k); }, 120);
  }, { passive: false });
});
['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (ev) { document.addEventListener(ev, function () { clearInterval(rep); }); });
/* tabs */
[].forEach.call(document.querySelectorAll('nav button'), function (b) {
  b.onclick = function () {
    [].forEach.call(document.querySelectorAll('nav button'), function (x) { x.className = x === b ? 'on' : ''; });
    [].forEach.call(document.querySelectorAll('section'), function (s) { s.className = s.id === b.getAttribute('data-p') ? '' : 'hide'; });
    if (b.getAttribute('data-p') === 'apps') apps();
  };
});
/* the touchpad: one finger moves the pointer, a tap clicks, two fingers scroll */
var pad = $('pad'), last = null, moved = 0, acc = { x: 0, y: 0 }, flush = 0;
function pt(e) { var a = e.touches[0]; return { x: a.clientX, y: a.clientY, n: e.touches.length }; }
pad.addEventListener('touchstart', function (e) { e.preventDefault(); last = pt(e); moved = 0; }, { passive: false });
pad.addEventListener('touchmove', function (e) {
  e.preventDefault();
  var p = pt(e);
  if (!last) { last = p; return; }
  var dx = p.x - last.x, dy = p.y - last.y;
  last = p;
  moved += Math.abs(dx) + Math.abs(dy);
  if (p.n > 1) { if (Math.abs(dy) > 2) call('/scroll', { dy: Math.round(-dy / 4) }); return; }
  acc.x += dx * 1.6; acc.y += dy * 1.6;
  if (!flush) flush = setTimeout(function () { flush = 0; var x = Math.round(acc.x), y = Math.round(acc.y); acc = { x: 0, y: 0 }; if (x || y) call('/move', { dx: x, dy: y }); }, 30);
}, { passive: false });
pad.addEventListener('touchend', function (e) { e.preventDefault(); if (moved < 8) { buzz(); call('/click'); } last = null; }, { passive: false });
/* typing into the TV's search box */
$('send').onclick = function () { var v = $('txt').value; if (!v) return; call('/text', { text: v }).then(function (r) { if (r.error) note(t(r.error), true); else { $('txt').value = ''; note(''); } }); };
$('bs').onclick = function () { buzz(); call('/backspace', { count: 1 }); };
$('ent').onclick = function () { buzz(); call('/enter'); };
/* the apps, in the order of the dock, with their icons */
var appsDone = false;
function apps() {
  if (appsDone) return;
  call('/apps').then(function (r) {
    if (!r.apps) return;
    appsDone = true;
    var g = $('grid');
    g.textContent = '';
    r.apps.forEach(function (a) {
      var b = document.createElement('button'), i = document.createElement('img'), s = document.createElement('span');
      b.className = 'app';
      s.textContent = a.title;
      b.appendChild(i);
      b.appendChild(s);
      b.onclick = function () { buzz(); call('/launch', { id: a.id }); };
      g.appendChild(b);
      fetch('/icon/' + encodeURIComponent(a.id), { headers: { 'x-remote-key': key } }).then(function (x) { return x.ok ? x.blob() : null; }).then(function (bl) { if (bl) i.src = URL.createObjectURL(bl); });
    });
  });
}
$('off').onclick = function () { if (confirm(t('Turn the TV off?'))) call('/power'); };
$('go').onclick = function () { var c = $('code').value.replace(/\D/g, ''); if (c.length === 6) pair(c); };
var m = /p=(\d{6})/.exec(location.hash);
if (m) { history.replaceState(null, '', location.pathname); pair(m[1]); }
else if (key) start();
else login('');
setInterval(function () { if (key && !document.hidden) call('/ping').then(function (r) { state(r.status === 200); }, function () { state(false); }); }, 15000);
`;

function html(lang) {
  const T = s => web.esc(i18n.tr(lang, s));
  const arrow = d =>
    '<svg viewBox="0 0 24 24"><path d="' +
    { u: 'M6 15l6-6 6 6', d: 'M6 9l6 6 6-6', l: 'M15 6l-6 6 6 6', r: 'M9 6l6 6-6 6' }[d] +
    '"/></svg>';
  return (
    `<!doctype html><html lang=${lang}><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name=apple-mobile-web-app-capable content=yes><meta name=mobile-web-app-capable content=yes><meta name=theme-color content="#0d0e12">
<meta name=apple-mobile-web-app-status-bar-style content=black-translucent><link rel=manifest href=/manifest.json><title>${T('TV remote')}</title>
<style>*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{height:100%}body{font:17px -apple-system,system-ui,sans-serif;background:#0d0e12;color:#eee;margin:0;padding:16px 16px 20px;padding:max(16px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom));max-width:520px;margin:0 auto;user-select:none;-webkit-user-select:none}
.hide{display:none!important}header{display:flex;align-items:center;margin:4px 0 14px}header h1{font-size:20px;margin:0;flex:1}#dot{width:10px;height:10px;border-radius:50%;background:#6b3a3a;margin-right:10px}#dot.on{background:#2fb45a}
#tv{font-size:13px;color:#999;margin:-8px 0 12px}.m{padding:12px 14px;border-radius:12px;background:#1d2a1f;margin:12px 0}.m.e{background:#3a1717}
button{font:inherit;color:#eee;background:#1c1d23;border:0;border-radius:16px;padding:0;cursor:pointer}button:active{background:#2c2d35}
svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ring{position:relative;width:280px;height:280px;width:min(78vw,300px);height:min(78vw,300px);margin:8px auto 18px;border-radius:50%;background:#16171c;box-shadow:inset 0 0 0 1px #24252c}
.ring button{position:absolute;width:33%;height:33%;background:transparent;display:flex;align-items:center;justify-content:center;border-radius:50%}
.ring .u{left:33.5%;top:0}.ring .d{left:33.5%;bottom:0}.ring .l{left:0;top:33.5%}.ring .r{right:0;top:33.5%}
.ring .ok{left:30%;top:30%;width:40%;height:40%;background:#24252c;font-weight:700;font-size:18px}
.row{display:flex;margin:10px 0}.row>*{flex:1;height:58px;display:flex;align-items:center;justify-content:center;font-size:15px}.row>*+*{margin-left:10px}
nav{display:flex;margin:0 0 14px;background:#16171c;border-radius:14px;padding:4px}nav button{flex:1;height:40px;background:transparent;font-size:15px;color:#aaa;border-radius:10px}nav button.on{background:#2a2b33;color:#fff}
#pad{height:380px;height:min(60vh,420px);border-radius:20px;background:#16171c;box-shadow:inset 0 0 0 1px #24252c;display:flex;align-items:center;justify-content:center;color:#666;font-size:14px;touch-action:none}
input{font:inherit;width:100%;padding:14px;border-radius:12px;border:1px solid #333;background:#1a1b21;color:#eee;margin:8px 0}
.p{background:#f5f6f8;color:#111;font-weight:600}#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.app{display:flex;flex-direction:column;align-items:center;padding:10px 4px;background:transparent}
.app img{width:64px;height:64px;border-radius:16px;background:#1c1d23;object-fit:cover}.app span{font-size:12px;color:#ccc;margin-top:6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#login p{color:#aaa}#login button{width:100%;height:52px;margin-top:6px}small{color:#777;display:block;margin-top:18px;font-size:12px;line-height:1.4}</style>
<header><span id=dot></span><h1>${T('TV remote')}</h1></header><div id=msg class="m hide"></div>
<div id=login class=hide><p>${T('On the TV: Customize, Phone remote, Pair a phone. Then scan the code, or type the six digits here.')}</p>
<input id=code inputmode=numeric autocomplete=one-time-code maxlength=6><button class=p id=go>${T('Pair')}</button></div>
<div id=main class=hide><div id=tv></div>
<nav><button class=on data-p=keys>${T('Remote')}</button><button data-p=touch>${T('Touchpad')}</button><button data-p=type>${T('Type')}</button><button data-p=apps>${T('Apps')}</button></nav>
<section id=keys><div class=ring><button class=u data-k=UP data-hold aria-label=up>${arrow('u')}</button><button class=l data-k=LEFT data-hold aria-label=left>${arrow('l')}</button>
<button class=ok data-k=ENTER>OK</button><button class=r data-k=RIGHT data-hold aria-label=right>${arrow('r')}</button><button class=d data-k=DOWN data-hold aria-label=down>${arrow('d')}</button></div>
<div class=row><button data-k=BACK>${T('Back')}</button><button data-k=HOME>${T('Home')}</button><button data-k=MENU>${T('Settings')}</button></div>
<div class=row><button data-k=VOLUMEDOWN data-hold aria-label="volume down">−</button><button data-k=MUTE>${T('Mute')}</button><button data-k=VOLUMEUP data-hold aria-label="volume up">+</button></div>
<div class=row><button data-k=REWIND aria-label=rewind>«</button><button data-k=PLAY aria-label=play>▶</button><button data-k=PAUSE aria-label=pause>❚❚</button><button data-k=FASTFORWARD aria-label="fast forward">»</button></div>
<div class=row><button id=off>${T('Turn the TV off')}</button></div></section>
<section id=touch class=hide><div id=pad>${T('Drag to move the pointer, tap to click, two fingers to scroll')}</div>
<div class=row><button data-k=BACK>${T('Back')}</button><button data-k=HOME>${T('Home')}</button></div></section>
<section id=type class=hide><input id=txt autocomplete=off autocapitalize=off placeholder="${T('Text for the box on the TV')}">
<div class=row><button class=p id=send>${T('Send')}</button><button id=bs>${T('Delete')}</button><button id=ent>${T('Enter')}</button></div>
<small>${T('Open a search box on the TV first; the text goes where its cursor is.')}</small></section>
<section id=apps class=hide><div id=grid></div></section>
<small>${T('Works on the same Wi-Fi as the TV. Add it to the Home Screen to open it like an app.')}</small></div>
` +
    i18n.script(lang, JS) +
    '<script>' +
    JS +
    '</script></html>'
  );
}
const manifest = () =>
  JSON.stringify({
    name: 'TV remote',
    short_name: 'TV remote',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0e12',
    theme_color: '#0d0e12',
  });

module.exports = { html, manifest };
