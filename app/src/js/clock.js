/* ---------- the clock and dates follow the language (the TV's, or the manager's Language setting; text: i18n/runtime.js) ---------- */
var LOC_TV = (window.webOSSystem && webOSSystem.locale) || navigator.language || 'en-GB',
  LOC = LOC_TV;
/* the Language setting from the service's settings: '' follows the TV */
function useLang(code) {
  var loc = code ? code : LOC_TV;
  setLang(code || '');
  if (loc === LOC) return;
  LOC = loc;
  if (window.tick) tick(); /* the date in the new language at once, not at the next quarter minute */
}
/* a button's label: built-in buttons are translated, buttons you added keep the app's own name */
function barLabel(o) {
  return o.action === 'inputs'
    ? t('Inputs')
    : o.app === 'com.palm.app.settings'
      ? t('Settings')
      : o.action === 'customize'
        ? t('Customise')
        : o.action === 'live'
          ? t('Live TV')
          : o.label || '';
}
/* the parts of a formatted time (Intl formatToParts) as [the time, its day period (AM/PM, or ''), whether the day period comes first].
   Chromium 68 (webOS 5) calls that part "dayperiod", Chromium 79 "dayPeriod". */
function splitTime(parts) {
  var main = '',
    ap = '',
    first = false;
  for (var i = 0; i < parts.length; i++) {
    if (/^dayperiod$/i.test(parts[i].type)) {
      ap = parts[i].value;
      first = !/\S/.test(main);
    } else main += parts[i].value;
  }
  return [main.replace(/^\s+|\s+$/g, ''), ap, first];
}
/* the time into #time; clock.ampm small sets AM/PM apart, smaller (where Intl can split the time; else the time as one text) */
function drawTime(el, d) {
  var txt = d.toLocaleTimeString(LOC, clockOpts()),
    sp = null;
  if (TH.ampm && window.Intl && Intl.DateTimeFormat.prototype.formatToParts) {
    sp = splitTime(new Intl.DateTimeFormat(LOC, clockOpts()).formatToParts(d));
    if (!sp[1]) sp = null;
  }
  var key = sp ? sp.join('|') : txt;
  if (el._k === key) return;
  el._k = key;
  if (!sp) {
    el.textContent = txt;
    return;
  }
  el.textContent = '';
  var ap = document.createElement('span');
  ap.className = 'ap' + (sp[2] ? ' first' : '');
  ap.textContent = sp[1];
  var tm = document.createTextNode(sp[0]);
  el.appendChild(sp[2] ? ap : tm);
  el.appendChild(sp[2] ? tm : ap);
}
/* which greeting the hour gets: night from 22:00 to 4:59 */
function greetPart(h) {
  return h >= 22 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
/* "Good morning" and the others by the hour, with a name when one is given */
function greeting(h, name) {
  var p = greetPart(h);
  if (name)
    return (
      p === 'night'
        ? t('Good night, %s')
        : p === 'morning'
          ? t('Good morning, %s')
          : p === 'afternoon'
            ? t('Good afternoon, %s')
            : t('Good evening, %s')
    ).replace('%s', name);
  return p === 'night'
    ? t('Good night')
    : p === 'morning'
      ? t('Good morning')
      : p === 'afternoon'
        ? t('Good afternoon')
        : t('Good evening');
}
function clockOpts() {
  var c = cfg.clock,
    o = { hour: 'numeric', minute: '2-digit' };
  if (c === '24') {
    o.hourCycle = 'h23';
  } else if (c === '12') {
    o.hourCycle = 'h12';
    o.hour = 'numeric';
  }
  return o;
}

var apps = [],
  cfg = {},
  usage = {},
  warned = false,
  rows = [],
  r = 1,
  c = 0,
  colors = {},
  tiles = {},
  lastSig = '',
  gSide = 0,
  gColor = '',
  gT = 0,
  saveT = 0;
function $(id) {
  return document.getElementById(id);
}
var toastT;
/* a short message at the bottom; an error stays twice as long, so its next step can be read from the couch */
function toast(t, err) {
  var e = $('toast');
  e.textContent = t;
  e.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(
    function () {
      e.classList.remove('on');
    },
    err ? 8000 : 4000
  );
}
var MIN_SERVICE = '1.4.3';
function oldSvc(v) {
  var a = String(v).split('.'),
    b = MIN_SERVICE.split('.');
  for (var i = 0; i < 3; i++) {
    var x = +a[i] || 0,
      y = +b[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}
function api(p, body) {
  return fetch(API + p, body ? { method: 'POST', body: JSON.stringify(body) } : {}).then(function (x) {
    return x.json();
  });
}
/* one line in the service log (Share log shows it); nothing waits for it */
function logLine(m) {
  try {
    var x = new XMLHttpRequest();
    x.open('GET', API + '/api/log?m=' + encodeURIComponent(m));
    x.send();
  } catch (e) {}
}
/* a timing for tools/perf-tv.sh ("perf launcher ready 412") */
function perfMark(m) {
  logLine('perf ' + m);
}
var perfReady = false;
function launch(id, params) {
  if (id === '__live') return LIVE.enter();
  api('/api/launch', { id: id, params: params }).then(function (x) {
    if (x && x.returnValue === false) toast(t('Could not open %s. Is it still installed?').replace('%s', title(id)), true);
  });
}
function store() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ apps: apps, cfg: cfg, usage: usage, colors: colors }));
  } catch (e) {}
}
function storeSoon() {
  clearTimeout(saveT);
  saveT = setTimeout(store, 1500);
}
