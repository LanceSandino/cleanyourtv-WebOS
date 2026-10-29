/* ---------- Search (the top button Search): a title typed with the TV's keyboard, or said into it, is looked up by the service in what
   this TV already has (/api/search, helper/search.js; nothing leaves the TV): "In your apps" the titles in the apps' rows (Continue
   watching), each opened where its card opens; "Search in" the apps that open their own search with the words (YouTube); and when no
   app has it, Telemachus, Plex and Stremio to look in. The field has the keys while it has the focus (the TV's keyboard shows); OK or
   Down goes to the results, Up from the first one back to the field; OK opens a result, Back closes. Over Home and its menus, under
   the screensaver; the words stay in the page until it is reloaded. ---------- */
var SEARCH = (function () {
  var open = false,
    els = null,
    list = [] /* the rows as drawn: {head} or {item, group} */,
    at = -1 /* -1: the field has the focus; else the result in list */,
    start = 0 /* the first row on show */,
    note = '',
    shownQ = '' /* the words the results are for */,
    asked = 0,
    typeT = 0,
    swallow = false,
    okDown = false,
    lastKeyAt = 0,
    lastWheel = 0,
    N = 9; /* rows on show */
  /* a group's heading */
  function head(id) {
    return id === 'have' ? t('In your apps') : id === 'search' ? t('Search in') : t('Look in');
  }
  function layer() {
    if (els) return els;
    var w = document.createElement('div');
    w.id = 'sr';
    w.innerHTML =
      '<div class="box"><div id="sr-field">' +
      svg('search') +
      '<input id="sr-q" type="text" autocomplete="off" spellcheck="false"></div><div id="sr-list"></div></div><div id="sr-hint"></div>';
    document.body.appendChild(w);
    els = { w: w, field: $('sr-field'), q: $('sr-q'), list: $('sr-list'), hint: $('sr-hint') };
    els.q.addEventListener('input', function () {
      clearTimeout(typeT);
      typeT = setTimeout(ask, 200);
      if (window.SAVER) SAVER.stop(); /* typing on the TV's keyboard is not idle */
    });
    els.q.addEventListener('focus', function () {
      if (!open || at < 0) return;
      at = -1;
      draw();
    });
    return els;
  }
  /* the service's answer as rows: a heading per group, then its results */
  function rowsOf(r) {
    var out = [];
    ((r && r.groups) || []).forEach(function (g) {
      if (!g.items || !g.items.length) return;
      out.push({ head: head(g.id) });
      g.items.forEach(function (it) {
        out.push({ item: it, group: g.id });
      });
    });
    return out;
  }
  function words() {
    return els ? els.q.value.replace(/\s+/g, ' ').trim() : '';
  }
  function ask() {
    if (!open) return;
    var w = words(),
      n = ++asked;
    if (!w) {
      list = [];
      note = t('Type a title: Home looks for it in the apps on this TV. Nothing is sent anywhere.');
      at = -1;
      return draw();
    }
    api('/api/search?q=' + encodeURIComponent(w)).then(
      function (r) {
        if (n !== asked || !open) return;
        list = rowsOf(r);
        shownQ = (r && r.q) || w;
        note = list.length ? '' : t('Nothing found on this TV.');
        if (at >= list.length || (at >= 0 && list[at].head !== undefined)) at = first();
        draw();
      },
      function () {
        if (n !== asked || !open) return;
        list = [];
        note = t('The service did not answer.');
        at = -1;
        draw();
      }
    );
  }
  function first() {
    for (var i = 0; i < list.length; i++) if (list[i].item) return i;
    return -1;
  }
  /* the next result up or down, or -1 */
  function next(d) {
    for (var i = at + d; i >= 0 && i < list.length; i += d) if (list[i].item) return i;
    return -1;
  }
  function label(x) {
    var it = x.item;
    if (x.group === 'have') return [it.title, [it.sub, it.appTitle].filter(Boolean).join(' \u00b7 ')];
    if (x.group === 'search') return [it.appTitle, '\u201c' + shownQ + '\u201d'];
    return [t('Open %s').replace('%s', it.appTitle), ''];
  }
  function draw() {
    var l = layer();
    l.field.classList.toggle('f', at < 0);
    if (at >= 0) start = Math.max(0, Math.min(start, at - 1, list.length - N));
    if (at >= start + N) start = at - N + 1;
    if (at < 0) start = 0;
    var h = '';
    for (var i = start; i < Math.min(list.length, start + N); i++)
      h +=
        list[i].head !== undefined
          ? '<div class="srh" data-n="' + i + '"></div>'
          : '<div class="row srow' +
            (i === at ? ' f' : '') +
            '" data-i="' +
            i +
            '"><img alt=""><span class="lb"></span><span class="st"></span></div>';
    if (note) h += '<div id="sr-note"></div>';
    l.list.innerHTML = h;
    [].forEach.call(l.list.children, function (el) {
      if (el.id === 'sr-note') return void (el.textContent = note);
      if (el.className === 'srh') return void (el.textContent = list[+el.getAttribute('data-n')].head);
      var k = +el.getAttribute('data-i'),
        x = list[k],
        txt = label(x),
        img = el.querySelector('img');
      img.onerror = function () {
        img.style.visibility = 'hidden';
      };
      img.src = API + '/icon/' + encodeURIComponent(x.item.app);
      el.querySelector('.lb').textContent = txt[0];
      el.querySelector('.st').textContent = txt[1];
      el.addEventListener('click', function () {
        at = k;
        pick();
      });
      /* the pointer over a result selects it (real movement only, not right after a key) */
      el.addEventListener('mousemove', function () {
        if (at === k || Date.now() - lastKeyAt < 1500) return;
        at = k;
        draw();
      });
    });
    l.hint.textContent = at < 0 ? t('OK or Down: the results \u00b7 Back: close') : t('OK to open, Back to close');
  }
  function toField() {
    at = -1;
    draw();
    els.q.focus();
  }
  function toRow(i) {
    at = i;
    els.q.blur(); /* the TV's keyboard goes away */
    draw();
  }
  function pick() {
    var x = list[at];
    if (!x || !x.item) return;
    close();
    launch(x.item.launch.id, x.item.launch.params || {});
  }
  function show() {
    var l = layer();
    if (open) return toField();
    open = true;
    at = -1;
    start = 0;
    l.q.placeholder = t('A film, a show, a video...');
    l.w.className = 'on';
    ask();
    toField();
    var v = l.q.value;
    try {
      l.q.setSelectionRange(v.length, v.length);
    } catch (e) {}
  }
  function close() {
    if (!open) return;
    open = false;
    clearTimeout(typeT);
    asked++;
    okDown = false;
    if (els) {
      els.q.blur();
      els.w.className = '';
    }
  }
  function eat(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  /* while it is open every key is its own and goes no further (Home under it waits); in the field the typing keys are the field's */
  window.addEventListener(
    'keydown',
    function (e) {
      if (!open) return;
      var k = e.keyCode;
      lastKeyAt = Date.now();
      if (at < 0) {
        if (k === 13 || k === 40) {
          if (first() >= 0) toRow(first());
        } else if (k === 461 || k === 27) close();
        else {
          /* typing, Backspace, Left and Right in the text: the field's own, Home does not see them */
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          return;
        }
        swallow = true;
        return eat(e);
      }
      if (k === 38) {
        var u = next(-1);
        if (u >= 0) {
          at = u;
          draw();
        } else toField();
      } else if (k === 40) {
        var d = next(1);
        if (d >= 0) {
          at = d;
          draw();
        }
      } else if (k === 13) okDown = true; /* opened when OK is let go: a held OK repeats */
      else if (k === 461 || k === 27 || k === 8) close();
      swallow = true;
      eat(e);
    },
    true
  );
  window.addEventListener(
    'keyup',
    function (e) {
      if (open && okDown && e.keyCode === 13) {
        okDown = false;
        swallow = false;
        eat(e);
        return pick();
      }
      if (!swallow) return;
      swallow = false;
      eat(e);
    },
    true
  );
  /* the Magic Remote's wheel moves through the results */
  window.addEventListener(
    'wheel',
    function (e) {
      if (!open || !e.deltaY) return;
      eat(e);
      var now = Date.now();
      if (now - lastWheel < 70 || at < 0) return;
      lastWheel = now;
      var n = next(e.deltaY > 0 ? 1 : -1);
      if (n >= 0) {
        at = n;
        lastKeyAt = now;
        draw();
      }
    },
    { capture: true, passive: false }
  );
  return {
    show: show,
    close: close,
    open: function () {
      return open;
    },
  };
})();
