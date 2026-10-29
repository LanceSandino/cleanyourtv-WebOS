// The phone remote's page (remote.js serves it on the LAN), drawn like LG's remote: the power key (it asks first) next to whether the
// TV answers, the volume and channel rockers with Mute and Home between them, the ring of arrows round OK with Settings, Info, Back and
// Exit at its corners, rewind, play, pause and fast forward, the four colour keys, and a number pad behind 123. A touchpad for the
// pointer (drag to move, a quick stroke goes further than a slow one, tap to click, two fingers to scroll; at most one move and one
// scroll are on their way at a time, what the fingers do meanwhile is added up), typing into the TV's search box, and the apps of the
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
/* a message over the remote: it goes away by itself (or with a tap); on the pairing screen it stays */
var noteT = 0;
function note(s, bad) {
  var m = $('msg');
  clearTimeout(noteT);
  m.textContent = s || '';
  m.className = s ? (bad ? 'm e' : 'm') : 'm hide';
  if (s && $('login').className === 'hide') noteT = setTimeout(function () { note(''); }, 6000);
}
$('msg').onclick = function () { note(''); };
/* a short buzz: vibrate where there is one; Safari on the iPhone has none, but a switch toggled through its label taps (iOS 18 on) */
var hap = null;
function buzz() {
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT') return;
    if (!hap) {
      hap = document.createElement('label');
      hap.className = 'hap';
      hap.setAttribute('aria-hidden', 'true');
      hap.innerHTML = '<input type=checkbox switch tabindex=-1>';
      document.body.appendChild(hap);
    }
    hap.click();
  } catch (e) {}
}
var up = null;
function state(ok) {
  if (ok === up) return;
  up = ok;
  $('dot').className = ok ? 'on' : 'off';
  $('tv').textContent = ok ? t('Connected to the TV') : t('The TV does not answer. Is it on, and the phone on the same Wi-Fi?');
}
/* every call after pairing: a phone no longer paired goes back to pairing, an error is shown, the dot follows the answers */
function send(path, body) {
  return call(path, body).then(function (r) {
    if (r.status === 401) { login(t('This phone is not paired any more. Pair it again from the TV.')); return r; }
    state(r.status < 500 || r.status === 502);
    if (r.error) note(t(r.error), true);
    else if ($('msg').textContent) note('');
    return r;
  }, function () { state(false); });
}
function press(k) {
  buzz();
  send('/press', { key: k });
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
function ping() {
  call('/ping').then(function (r) {
    if (r.status === 401) login(t('This phone is not paired any more. Pair it again from the TV.'));
    else state(r.status === 200);
  }, function () { state(false); });
}
function start() {
  $('login').className = 'hide';
  $('main').className = '';
  ping();
}
/* the keys: data-k is the key; a key with data-hold (the arrows, the volume) repeats while it is held; OK, Back, Home and Settings held
   are LG's long press (/hold); a colour key held is given an app (colours), and then opens it. A key looks pressed while touched */
var LONG = { ENTER: 1, BACK: 1, HOME: 1, MENU: 1 }, COLOURS = { RED: 1, GREEN: 1, YELLOW: 1, BLUE: 1 }, CK = 'cytv-remote-colours', ck = {};
try { ck = JSON.parse(localStorage.getItem(CK) || '{}') || {}; } catch (e) {}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-k]');
  if (!b || b.hasAttribute('data-hold')) return;
  if (b._long) { b._long = false; return; }
  var k = b.getAttribute('data-k');
  if (COLOURS[k] && ck[k]) { buzz(); send('/launch', { id: ck[k].id }); }
  else press(k);
});
var rep = 0, held = null, longT = 0;
function lift() {
  clearInterval(rep);
  clearTimeout(longT);
  if (held) held.classList.remove('dn');
  held = null;
}
['touchstart', 'mousedown'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    lift();
    held = b;
    b.classList.add('dn');
    var lk = b.getAttribute('data-k');
    if (lk && (LONG[lk] || COLOURS[lk])) {
      b._long = false;
      longT = setTimeout(function () {
        b._long = true;
        buzz();
        if (COLOURS[lk]) colourPick(lk);
        else send('/hold', { key: lk });
      }, 550);
    }
    if (!b.hasAttribute('data-hold')) return;
    e.preventDefault();
    var k = b.getAttribute('data-k'), n = 0;
    press(k);
    rep = setInterval(function () { if (++n > 3) press(k); }, 120);
  }, { passive: false });
});
['touchend', 'touchcancel', 'mouseup'].forEach(function (ev) { document.addEventListener(ev, lift); });
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
/* tabs */
function tab(p) {
  [].forEach.call(document.querySelectorAll('nav button'), function (x) { x.className = x.getAttribute('data-p') === p ? 'on' : ''; });
  [].forEach.call(document.querySelectorAll('section'), function (s) { s.className = s.id === p ? '' : 'hide'; });
  if (p === 'apps') apps();
}
[].forEach.call(document.querySelectorAll('nav button'), function (b) {
  b.onclick = function () { tab(b.getAttribute('data-p')); };
});
/* 123: the number pad over the keys */
$('nb').onclick = function () {
  buzz();
  var open = $('num').className !== 'open';
  if (open) tab('keys');
  $('num').className = open ? 'open' : '';
  $('nb').className = open ? 'key nb on' : 'key nb';
};
/* the touchpad: one finger moves the pointer, a tap clicks, two fingers scroll. What the fingers do is added up, and at most one move
   and one scroll are on their way: the next leaves when the last has come back (and not sooner than its gap), with all that was added */
var seq = 0;
function lane(gap, next) {
  var L = { on: 0, at: 0, timer: 0 };
  L.go = function () {
    if (L.on || L.timer) return;
    var w = gap - (Date.now() - L.at);
    if (w > 0) { L.timer = setTimeout(function () { L.timer = 0; L.go(); }, w); return; }
    var job = next();
    if (!job) return;
    var id = ++seq;
    function done() { if (L.on !== id) return; L.on = 0; L.go(); }
    L.on = id;
    L.at = Date.now();
    setTimeout(done, 1500);
    send(job[0], job[1]).then(done, done);
  };
  return L;
}
function lim(n, m) { n = Math.round(n); return n > m ? m : n < -m ? -m : n; }
var mv = { x: 0, y: 0, click: false }, sc = { y: 0 };
var moves = lane(28, function () {
  var x = lim(mv.x, 300), y = lim(mv.y, 300);
  if (x || y) { mv.x -= x; mv.y -= y; return ['/move', { dx: x, dy: y }]; }
  if (mv.click) { mv.click = false; return ['/click', {}]; }
  return null;
});
var scrolls = lane(40, function () {
  var y = lim(sc.y, 50);
  if (!y) return null;
  sc.y -= y;
  return ['/scroll', { dy: y }];
});
var pad = $('pad'), spot = $('spot'), box = null, f = null, t0 = 0, most = 0, path = 0, speed = 0, still = { x: 0, y: 0 };
function pt(e) {
  var a = e.touches[0], b = e.touches[1];
  return { x: b ? (a.clientX + b.clientX) / 2 : a.clientX, y: b ? (a.clientY + b.clientY) / 2 : a.clientY, n: e.touches.length, t: Date.now() };
}
function show(p) { spot.style.transform = 'translate(' + Math.round(p.x - box.left) + 'px,' + Math.round(p.y - box.top) + 'px)'; }
pad.addEventListener('touchstart', function (e) {
  e.preventDefault();
  if (!f) {
    t0 = Date.now(); most = 0; path = 0; speed = 0; still = { x: 0, y: 0 };
    box = pad.getBoundingClientRect();
    pad.className = 'act';
  }
  f = pt(e);
  most = Math.max(most, f.n);
  show(f);
  spot.className = 'on';
}, { passive: false });
pad.addEventListener('touchmove', function (e) {
  e.preventDefault();
  if (!f) return;
  var p = pt(e);
  if (p.n !== f.n) { f = p; return; } /* a finger came or went: go on from here, without a jump */
  var dx = p.x - f.x, dy = p.y - f.y, dt = Math.max(8, p.t - f.t);
  f = p;
  path += Math.abs(dx) + Math.abs(dy);
  show(p);
  if (p.n > 1) { sc.y -= dy / 4; scrolls.go(); return; }
  /* mild acceleration: a slow finger is precise (about 1.2 times), a quick stroke goes up to about 3 times as far */
  speed = speed * 0.6 + (Math.sqrt(dx * dx + dy * dy) / dt) * 0.4;
  var g = 1.15 + 1.9 * Math.min(speed, 1);
  /* the first few pixels wait, so a tap clicks where the pointer is; a drag then takes them along */
  if (path < 6) { still.x += dx * g; still.y += dy * g; return; }
  mv.x += still.x + dx * g;
  mv.y += still.y + dy * g;
  still = { x: 0, y: 0 };
  moves.go();
}, { passive: false });
function lifted(e, cancel) {
  e.preventDefault();
  if (!f) return;
  if (e.touches.length) { f = pt(e); return; }
  if (!cancel && most === 1 && path < 10 && Date.now() - t0 < 400) { buzz(); mv.click = true; moves.go(); }
  f = null;
  pad.className = '';
  spot.className = '';
}
pad.addEventListener('touchend', function (e) { lifted(e, false); }, { passive: false });
pad.addEventListener('touchcancel', function (e) { lifted(e, true); }, { passive: false });
/* typing into the TV's search box */
function sendText() {
  var v = $('txt').value;
  if (!v) return;
  buzz();
  send('/text', { text: v }).then(function (r) { if (r && !r.error && r.status !== 401) $('txt').value = ''; });
}
$('send').onclick = sendText;
$('txt').onkeydown = function (e) { if (e.keyCode === 13) { e.preventDefault(); sendText(); } };
$('bs').onclick = function () { buzz(); send('/backspace', { count: 1 }); };
$('ent').onclick = function () { buzz(); send('/enter'); };
/* the apps, in the order of the dock, with their icons */
var appsDone = false;
function apps() {
  if (appsDone) return;
  send('/apps').then(function (r) {
    if (!r || !r.apps) return;
    appsDone = true;
    var g = $('grid');
    g.textContent = '';
    r.apps.forEach(function (a) {
      var b = document.createElement('button'), i = document.createElement('img'), s = document.createElement('span');
      b.className = 'app';
      i.alt = '';
      s.textContent = a.title;
      b.appendChild(i);
      b.appendChild(s);
      b.onclick = function () { buzz(); send('/launch', { id: a.id }); };
      g.appendChild(b);
      fetch('/icon/' + encodeURIComponent(a.id), { headers: { 'x-remote-key': key } }).then(function (x) { return x.ok ? x.blob() : null; }).then(function (bl) { if (bl) i.src = URL.createObjectURL(bl); });
    });
  });
}
/* a colour key's app: held, the key offers the apps of the TV (and its own LG key); the choice stays on this phone */
var COLOUR_NAMES = { RED: t('Red'), GREEN: t('Green'), YELLOW: t('Yellow'), BLUE: t('Blue') };
function colourLabels() {
  [].forEach.call(document.querySelectorAll('#ckl span'), function (s) {
    var c = ck[s.getAttribute('data-c')];
    s.textContent = c ? c.title : '';
  });
}
function colourPick(k) {
  send('/apps').then(function (r) {
    if (!r || !r.apps) return;
    var sh = $('sheet'), list = $('sheetlist');
    $('sheettitle').textContent = t('%s key').replace('%s', COLOUR_NAMES[k]);
    list.textContent = '';
    var add = function (label, fn, on) {
      var b = document.createElement('button');
      b.className = 'key opt' + (on ? ' on' : '');
      b.textContent = label;
      b.onclick = function () { fn(); try { localStorage.setItem(CK, JSON.stringify(ck)); } catch (e) {} colourLabels(); sh.className = 'hide'; };
      list.appendChild(b);
    };
    add(t('LG\u2019s own key (as on the remote)'), function () { delete ck[k]; }, !ck[k]);
    r.apps.forEach(function (a) { add(a.title, function () { ck[k] = { id: a.id, title: a.title }; }, ck[k] && ck[k].id === a.id); });
    sh.className = '';
  });
}
$('sheetno').onclick = function () { $('sheet').className = 'hide'; };
colourLabels();
$('off').onclick = function () { buzz(); if (confirm(t('Turn the TV off?'))) send('/power'); };
/* pairing with the six digits from the TV */
function go() {
  var c = $('code').value.replace(/\D/g, '');
  if (c.length === 6) pair(c);
  else note(t('Type the six digits shown on the TV.'), true);
}
$('go').onclick = go;
$('code').oninput = function () { var v = this.value.replace(/\D/g, '').slice(0, 6); if (v !== this.value) this.value = v; };
$('code').onkeydown = function (e) { if (e.keyCode === 13) { e.preventDefault(); go(); } };
var m = /p=(\d{6})/.exec(location.hash);
if (m) { history.replaceState(null, '', location.pathname); pair(m[1]); }
else if (key) start();
else login('');
setInterval(function () { if (key && !document.hidden) ping(); }, 15000);
document.addEventListener('visibilitychange', function () { if (key && !document.hidden) ping(); });
`;

// sizes scale with the phone: 1 unit is a pixel on a phone about 390 px wide and 680 px high, smaller when there is less room (so the
// remote fits without scrolling), a little larger on big phones
const u = n => 'calc(' + n + '*var(--u))';
const unit = vh =>
  'max(.74px,min(1.08px,(100vw - 24px)/364,(' + vh + ' - max(10px,env(safe-area-inset-top)) - max(10px,env(safe-area-inset-bottom)))/640))';

const CSS = `:root{--u:${unit('100vh')}}@supports (height:100svh){:root{--u:${unit('100svh')}}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
html{height:100%;background:#08090b;overscroll-behavior:none;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100%;display:flex;flex-direction:column;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:radial-gradient(130% 70% at 50% 0,#1b1d23 0,#0b0c0f 62%,#08090b 100%);color:#e8e9ed;font:16px -apple-system,BlinkMacSystemFont,system-ui,'Segoe UI',Roboto,sans-serif;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.hide{display:none!important}
#main,#login{position:relative;flex:1 0 auto;display:flex;flex-direction:column;width:100%;max-width:400px;margin:0 auto;padding:${u(14)} ${u(16)} ${u(18)};border-radius:${u(42)};background:linear-gradient(180deg,#26282f 0,#1c1d22 36%,#16171b 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 0 0 1px rgba(255,255,255,.035),0 18px 40px rgba(0,0,0,.6),0 2px 8px rgba(0,0,0,.5)}
button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;appearance:none}
.key{color:#eceef2;background:linear-gradient(180deg,#373940,#27292f);box-shadow:inset 0 1px 0 rgba(255,255,255,.11),0 ${u(2)} 0 #0c0d10,0 ${u(4)} ${u(8)} rgba(0,0,0,.45);transition:transform .08s}
.key.dn,.key:active{background:linear-gradient(180deg,#2a2c32,#202126);transform:translateY(${u(1.5)});box-shadow:inset 0 ${u(1)} ${u(3)} rgba(0,0,0,.65),0 ${u(0.5)} 0 #0c0d10}
svg{width:${u(24)};height:${u(24)};flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
svg.f{fill:currentColor;stroke-width:1.4}
.top{display:flex;align-items:center;height:${u(48)};margin-bottom:${u(12)}}
.pw{flex:none;width:${u(48)};height:${u(48)};border-radius:50%;color:#ff4d42}
.pw svg{stroke-width:2.5}.pw.dn,.pw:active{color:#ff7a70;box-shadow:inset 0 ${u(1)} ${u(3)} rgba(0,0,0,.65),0 0 ${u(14)} rgba(255,77,66,.45)}
#st{flex:1;min-width:0;display:flex;align-items:center;margin:0 ${u(12)}}
#dot{flex:none;width:${u(9)};height:${u(9)};margin-right:${u(8)};border-radius:50%;background:#5a5d65}
#dot.on{background:#30d158;box-shadow:0 0 ${u(8)} rgba(48,209,88,.65)}#dot.off{background:#ff453a;box-shadow:0 0 ${u(8)} rgba(255,69,58,.5)}
#tv{font-size:${u(11.5)};line-height:1.3;color:#9a9ca5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.nb{flex:none;height:${u(40)};padding:0 ${u(14)};border-radius:${u(20)};font-size:${u(15)};font-weight:700;letter-spacing:.04em}
.nb.on,.nb.on.dn{color:#111216;background:linear-gradient(180deg,#f3f4f6,#d6d8dd)}
nav{flex:none;display:flex;height:${u(38)};margin-bottom:${u(14)};padding:${u(3)};border-radius:${u(19)};background:#0f1013;box-shadow:inset 0 1px 2px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
nav button{flex:1;min-width:0;border-radius:${u(16)};font-size:${u(13.5)};font-weight:600;color:#8d9099;white-space:nowrap;overflow:hidden}
nav button.on{color:#fff;background:linear-gradient(180deg,#3a3c44,#2c2e35);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 1px 3px rgba(0,0,0,.5)}
section{flex:1 0 auto;display:flex;flex-direction:column}
#keys{position:relative;justify-content:space-evenly}
.rk,.dp,.pb,.ck{flex:none;margin:${u(7)} 0}
.rk{display:flex;align-items:center;justify-content:space-between}
.rock{width:${u(62)};height:${u(140)};display:flex;flex-direction:column;border-radius:${u(31)};background:linear-gradient(180deg,#373940,#25272d);box-shadow:inset 0 1px 0 rgba(255,255,255,.11),0 ${u(2)} 0 #0c0d10,0 ${u(5)} ${u(10)} rgba(0,0,0,.45)}
.rock button{flex:1;color:#eceef2}.rock button:first-child{border-radius:${u(31)} ${u(31)} ${u(12)} ${u(12)}}.rock button:last-child{border-radius:${u(12)} ${u(12)} ${u(31)} ${u(31)}}
.rock button.dn,.rock button:active{background:rgba(0,0,0,.3)}
.rock b{font-size:${u(11)};line-height:${u(16)};font-weight:700;letter-spacing:.14em;text-indent:.14em;text-align:center;color:#80838c}
.mid{display:flex;flex-direction:column;align-items:center}
.rd{width:${u(54)};height:${u(54)};border-radius:50%}.mid .rd+.rd{margin-top:${u(22)}}
.dp{position:relative;height:${u(224)}}
.cn{position:absolute;width:${u(62)};display:flex;flex-direction:column;align-items:center}
.cn .rd{width:${u(46)};height:${u(46)}}.cn svg{width:${u(21)};height:${u(21)}}
.cn span{max-width:100%;margin-top:${u(5)};font-size:${u(10.5)};font-weight:600;color:#8a8d96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl{left:0;top:0}.tr{right:0;top:0}.bl{left:0;bottom:0}.br{right:0;bottom:0}
.ring{position:absolute;left:50%;top:0;width:${u(224)};height:${u(224)};margin-left:${u(-112)};padding:${u(3)};border-radius:50%;background:#111215;box-shadow:0 ${u(6)} ${u(16)} rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.05)}
.ring:after{content:'';position:absolute;left:${u(3)};top:${u(3)};right:${u(3)};bottom:${u(3)};border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.08) 0,rgba(255,255,255,0) 45%,rgba(0,0,0,.2) 100%);pointer-events:none}
.w{width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;grid-gap:${u(1.5)};border-radius:50%;overflow:hidden;background:#15161a;transform:rotate(45deg)}
.w button{background:#2d2f36;color:#d9dbe0}.w button.dn,.w button:active{background:#41444d}
.w svg{width:${u(26)};height:${u(26)};transform:rotate(-45deg);stroke-width:2.4}
.ok{position:absolute;z-index:1;left:50%;top:50%;width:${u(100)};height:${u(100)};margin:${u(-50)} 0 0 ${u(-50)};border-radius:50%;font-size:${u(21)};font-weight:700;letter-spacing:.04em}
.ok,.ok.dn,.ok:active{box-shadow:0 0 0 ${u(4)} rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.12),0 ${u(4)} ${u(10)} rgba(0,0,0,.5)}
.pb,.ck{display:flex;justify-content:space-between}
.pb .key{width:${u(70)};height:${u(42)};border-radius:${u(21)}}.pb svg{width:${u(20)};height:${u(20)}}
.ck button{width:${u(70)};height:${u(30)}}
.ck button:before{content:'';display:block;width:100%;height:${u(14)};border-radius:${u(7)};box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 ${u(2)} ${u(4)} rgba(0,0,0,.5)}
.ck .r:before{background:#df3a3f}.ck .g:before{background:#3faa55}.ck .y:before{background:#e8c23b}.ck .b:before{background:#2f80df}
.ck button.dn:before,.ck button:active:before{opacity:.7;transform:translateY(1px)}
#ckl{display:flex;justify-content:space-between;margin-top:${u(2)}}#ckl span{width:${u(70)};font-size:${u(10)};line-height:1.2;color:#8a8d96;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sheet{position:fixed;left:0;top:0;right:0;bottom:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
#sheet .sh{width:100%;max-width:420px;max-height:80%;display:flex;flex-direction:column;padding:${u(18)} ${u(16)} max(${u(16)},env(safe-area-inset-bottom));border-radius:${u(24)} ${u(24)} 0 0;background:#17181d;box-shadow:0 -${u(6)} ${u(24)} rgba(0,0,0,.5)}
#sheet h2{margin:0 0 ${u(4)};font-size:${u(18)}}#sheet p{margin:0 0 ${u(12)};font-size:${u(12.5)};color:#8a8d96}
#sheetlist{overflow-y:auto;-webkit-overflow-scrolling:touch;margin-bottom:${u(12)}}
.opt{width:100%;height:${u(46)};margin-bottom:${u(8)};border-radius:${u(14)};justify-content:flex-start;padding:0 ${u(16)};font-size:${u(15)}}.opt.on{box-shadow:inset 0 0 0 2px #4d8ef7}
#sheetno{width:100%;height:${u(46)};border-radius:${u(14)}}
#num{position:absolute;z-index:2;left:0;top:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(3,1fr);grid-gap:${u(16)} ${u(18)};align-content:center;padding:${u(12)} ${u(16)};border-radius:${u(26)};background:#18191d;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);opacity:0;visibility:hidden;transform:translateY(${u(10)});transition:opacity .16s,transform .16s,visibility 0s .16s}
#num.open{opacity:1;visibility:visible;transform:none;transition:opacity .16s,transform .16s}
#num .key{height:${u(72)};border-radius:${u(24)};font-size:${u(26)};font-weight:600}#num .o{font-size:${u(18)};font-weight:700}
#pad{position:relative;flex:1 0 auto;min-height:${u(280)};display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:${u(28)};background:radial-gradient(120% 90% at 50% 0,#202127 0,#141518 70%);box-shadow:inset 0 1px 3px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,255,255,.04),0 1px 0 rgba(255,255,255,.05);touch-action:none}
.hint{display:flex;flex-direction:column;align-items:center;max-width:${u(230)};text-align:center;font-size:${u(13)};line-height:1.45;color:#6d7079;transition:opacity .2s}
.hint svg{width:${u(30)};height:${u(30)};margin-bottom:${u(10)};stroke-width:1.6}#pad.act .hint{opacity:.2}
#spot{position:absolute;left:0;top:0;width:${u(70)};height:${u(70)};margin:${u(-35)} 0 0 ${u(-35)};border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.24) 0,rgba(255,255,255,.07) 50%,rgba(255,255,255,0) 70%);opacity:0;transition:opacity .25s;pointer-events:none}
#spot.on{opacity:1;transition:none}
.row{flex:none;display:flex;margin-top:${u(14)}}
.row>*{flex:1;min-width:0;height:${u(52)};border-radius:${u(26)};font-size:${u(15)};font-weight:600}.row>*+*{margin-left:${u(12)}}
.row svg{width:${u(20)};height:${u(20)};margin-right:${u(6)}}.row .ob{flex:0 0 ${u(84)};font-size:${u(18)};font-weight:700}
.p{color:#111216;background:linear-gradient(180deg,#f4f5f7,#d8dade)}.p.dn,.p:active{background:linear-gradient(180deg,#d9dbdf,#c3c5ca)}
input{display:block;width:100%;height:${u(52)};padding:0 ${u(16)};border:0;border-radius:${u(16)};outline:none;font:inherit;font-size:max(16px,${u(17)});color:#f2f3f5;background:#0f1013;box-shadow:inset 0 1px 3px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.05);user-select:text;-webkit-user-select:text}
input:focus{box-shadow:inset 0 1px 3px rgba(0,0,0,.7),0 0 0 2px #4d8ef7}input::placeholder{color:#4f525a}
small{display:block;margin-top:${u(16)};font-size:${u(12)};line-height:1.45;color:#7a7d86}
#apps{display:block}#grid{display:grid;grid-template-columns:repeat(4,1fr);grid-gap:${u(10)} ${u(6)}}
.app{flex-direction:column;min-width:0;padding:${u(8)} 0;border-radius:${u(16)}}.app.dn,.app:active{background:rgba(255,255,255,.06)}
.app img{width:${u(60)};height:${u(60)};border-radius:${u(15)};object-fit:cover;background:#2a2c33;box-shadow:0 ${u(3)} ${u(8)} rgba(0,0,0,.45)}
.app span{max-width:100%;margin-top:${u(7)};font-size:${u(11.5)};color:#c9cbd1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#login{align-items:center;justify-content:center;text-align:center;padding:${u(28)} ${u(24)}}
.badge{width:${u(76)};height:${u(76)};margin-bottom:${u(18)};border-radius:50%;display:flex;align-items:center;justify-content:center}
.badge svg{width:${u(36)};height:${u(36)};stroke-width:1.7}
#login h1{margin:0 0 ${u(8)};font-size:${u(24)};font-weight:700}
#login p{max-width:${u(300)};margin:0 0 ${u(24)};font-size:${u(15)};line-height:1.45;color:#a0a3ab}
#code{max-width:${u(280)};height:${u(64)};padding:0 0 0 .3em;text-align:center;letter-spacing:.3em;font-size:max(16px,${u(30)});font-weight:600;font-variant-numeric:tabular-nums}
#go{width:100%;max-width:${u(280)};height:${u(54)};margin-top:${u(14)};border-radius:${u(27)};font-size:${u(17)};font-weight:700}
#login small{max-width:${u(280)};margin-top:${u(22)}}
#msg{position:fixed;z-index:9;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 8px);width:calc(100% - 32px);max-width:380px;padding:12px 16px;border-radius:16px;transform:translateX(-50%);font-size:15px;line-height:1.35;color:#e9f7ec;background:#1e3425;box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.06)}
#msg.e{color:#ffe9e7;background:#4a1a1a}
.hap{position:fixed;left:-60px;top:0;opacity:0;pointer-events:none}`;

// the icons, drawn on a 24 px grid in the text's colour (the filled ones with class f)
const ICONS = {
  power: '<path d="M12 3.5v8"/><path d="M7.4 6.6A7.5 7.5 0 1 0 16.6 6.6"/>',
  home: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v9.5h4.5V15h3v4.5H18V10"/>',
  back: '<path d="M9 5L4.5 9.5 9 14"/><path d="M5 9.5h9a5 5 0 0 1 0 10h-3"/>',
  gear:
    '<path d="M10.23 4.92L10.66 2.49H13.34L13.77 4.92A7.3 7.3 0 0 1 15.76 5.74L17.78 4.33L19.67 6.22L18.26 8.24A7.3 7.3 0 0 1 19.08 10.23' +
    'L21.51 10.66V13.34L19.08 13.77A7.3 7.3 0 0 1 18.26 15.76L19.67 17.78L17.78 19.67L15.76 18.26A7.3 7.3 0 0 1 13.77 19.08L13.34 21.51' +
    'H10.66L10.23 19.08A7.3 7.3 0 0 1 8.24 18.26L6.22 19.67L4.33 17.78L5.74 15.76A7.3 7.3 0 0 1 4.92 13.77L2.49 13.34V10.66L4.92 10.23' +
    'A7.3 7.3 0 0 1 5.74 8.24L4.33 6.22L6.22 4.33L8.24 5.74A7.3 7.3 0 0 1 10.23 4.92z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/>',
  exit: '<path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9.5"/>',
  mute: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1"/><rect x="13.7" y="5" width="3.8" height="14" rx="1"/>',
  rew: '<path d="M11.5 6.5v11L3.5 12z"/><path d="M20.5 6.5v11l-8-5.5z"/>',
  ff: '<path d="M12.5 6.5v11l8-5.5z"/><path d="M3.5 6.5v11l8-5.5z"/>',
  pointer: '<path d="M6 3.5l12.5 7.2-5.4 1.5 3.1 5.6-2.7 1.5-3.1-5.6-4 3.9z"/>',
  remote: '<rect x="7" y="2.5" width="10" height="19" rx="3.5"/><circle cx="12" cy="8.5" r="2.4"/><path d="M10 14.5h4M10 17.5h4"/>',
};
const icon = (n, cls) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + ICONS[n] + '</svg>';

function html(lang) {
  const T = s => web.esc(i18n.tr(lang, s));
  // a key: its LG key name, a label for screen readers, what it shows, and more classes or attributes
  const k = (name, label, inner, more) =>
    '<button class="key' +
    ((more && more.cls && ' ' + more.cls) || '') +
    '" data-k=' +
    name +
    (more && more.hold ? ' data-hold' : '') +
    (label ? ' aria-label="' + T(label) + '"' : '') +
    '>' +
    inner +
    '</button>';
  // a key at a corner of the ring, with its name under it as on the remote
  const corner = (pos, name, label, ico) =>
    '<div class="cn ' + pos + '">' + k(name, label, icon(ico), { cls: 'rd' }) + '<span>' + T(label) + '</span></div>';
  const wedge = (name, label, ico) => '<button data-k=' + name + ' data-hold aria-label="' + T(label) + '">' + icon(ico) + '</button>';
  const rocker = (upKey, upLabel, upIcon, text, downKey, downLabel, downIcon, hold) =>
    '<div class=rock><button data-k=' +
    upKey +
    (hold ? ' data-hold' : '') +
    ' aria-label="' +
    T(upLabel) +
    '">' +
    icon(upIcon) +
    '</button><b>' +
    text +
    '</b><button data-k=' +
    downKey +
    (hold ? ' data-hold' : '') +
    ' aria-label="' +
    T(downLabel) +
    '">' +
    icon(downIcon) +
    '</button></div>';
  const digits = '123456789'
    .split('')
    .map(d => k(d, '', d))
    .join('');
  return (
    `<!doctype html><html lang=${lang}><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name=apple-mobile-web-app-capable content=yes><meta name=mobile-web-app-capable content=yes><meta name=theme-color content="#08090b">
<meta name=apple-mobile-web-app-status-bar-style content=black-translucent><link rel=manifest href=/manifest.json><title>${T('TV remote')}</title>
<style>${CSS}</style>
<div id=msg class="m hide" role=status></div>
<div id=login class=hide><div class="key badge">${icon('remote')}</div><h1>${T('TV remote')}</h1>
<p>${T('On the TV: Customize, Phone remote, Pair a phone. Then scan the code, or type the six digits here.')}</p>
<input id=code inputmode=numeric pattern="[0-9]*" autocomplete=one-time-code maxlength=6 placeholder=000000 aria-label="${T('Code')}">
<button class="key p" id=go>${T('Pair')}</button>
<small>${T('Works on the same Wi-Fi as the TV. Add it to the Home Screen to open it like an app.')}</small></div>
<div id=main class=hide>
<div class=top><button class="key pw" id=off aria-label="${T('Turn the TV off')}">${icon('power')}</button><div id=st><i id=dot></i><span id=tv></span></div>
<button class="key nb" id=nb aria-label="${T('Numbers')}">123</button></div>
<nav><button class=on data-p=keys>${T('Remote')}</button><button data-p=touch>${T('Touchpad')}</button><button data-p=type>${T('Type')}</button><button data-p=apps>${T('Apps')}</button></nav>
<section id=keys>
<div class=rk>${rocker('VOLUMEUP', 'Volume up', 'plus', 'VOL', 'VOLUMEDOWN', 'Volume down', 'minus', true)}
<div class=mid>${k('MUTE', 'Mute', icon('mute'), { cls: 'rd' })}${k('HOME', 'Home', icon('home'), { cls: 'rd' })}</div>
${rocker('CHANNELUP', 'Channel up', 'up', 'CH', 'CHANNELDOWN', 'Channel down', 'down', false)}</div>
<div class=dp>${corner('tl', 'MENU', 'Settings', 'gear')}${corner('tr', 'INFO', 'Info', 'info')}${corner('bl', 'BACK', 'Back', 'back')}${corner('br', 'EXIT', 'Exit', 'exit')}
<div class=ring><div class=w>${wedge('UP', 'Up', 'up')}${wedge('RIGHT', 'Right', 'right')}${wedge('LEFT', 'Left', 'left')}${wedge('DOWN', 'Down', 'down')}</div>
${k('ENTER', '', 'OK', { cls: 'ok' })}</div></div>
<div class=pb>${k('REWIND', 'Rewind', icon('rew', 'f'))}${k('PLAY', 'Play', icon('play', 'f'))}${k('PAUSE', 'Pause', icon('pause', 'f'))}${k('FASTFORWARD', 'Fast forward', icon('ff', 'f'))}</div>
<div class=ck><button class=r data-k=RED aria-label="${T('Red')}"></button><button class=g data-k=GREEN aria-label="${T('Green')}"></button><button class=y data-k=YELLOW aria-label="${T('Yellow')}"></button><button class=b data-k=BLUE aria-label="${T('Blue')}"></button></div>
<div id=ckl><span data-c=RED></span><span data-c=GREEN></span><span data-c=YELLOW></span><span data-c=BLUE></span></div>
<div id=num>${digits}${k('DASH', 'Dash', '–')}${k('0', '', '0')}${k('ENTER', '', 'OK', { cls: 'o' })}</div></section>
<section id=touch class=hide><div id=pad><i id=spot></i><div class=hint>${icon('pointer')}<span>${T('Drag to move the pointer, tap to click, two fingers to scroll')}</span></div></div>
<div class=row>${k('BACK', '', icon('back') + '<span>' + T('Back') + '</span>')}${k('ENTER', '', 'OK', { cls: 'ob' })}${k('HOME', '', icon('home') + '<span>' + T('Home') + '</span>')}</div></section>
<section id=type class=hide><input id=txt autocomplete=off autocapitalize=off autocorrect=off spellcheck=false enterkeyhint=send placeholder="${T('Text for the box on the TV')}">
<div class=row><button class="key p" id=send>${T('Send')}</button><button class=key id=bs>${T('Delete')}</button><button class=key id=ent>${T('Enter')}</button></div>
<small>${T('Open a search box on the TV first; the text goes where its cursor is.')}</small></section>
<section id=apps class=hide><div id=grid></div><small>${T('Works on the same Wi-Fi as the TV. Add it to the Home Screen to open it like an app.')}</small></section></div>
<div id=sheet class=hide><div class=sh><h2 id=sheettitle></h2><p>${T('Hold a colour key to give it an app; a tap then opens it.')}</p><div id=sheetlist></div>
<button class=key id=sheetno>${T('Cancel')}</button></div></div>
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
    background_color: '#08090b',
    theme_color: '#08090b',
  });

module.exports = { html, manifest };
