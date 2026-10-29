/* ---------- Search (the top button Search): a title typed with the TV's keyboard, or said into it. First what this TV already has
   (/api/search, helper/search.js; nothing leaves the TV): "In your apps" the titles in the apps' rows (Continue watching), each opened
   where its card opens; "Search in" the apps that open their own search with the words (YouTube); and when no app has it, Telemachus,
   Plex and Stremio to look in. Then, a moment after the typing stops and unless Customize > Search switched it off, "Where to watch"
   (/api/search/where, helper/where.js: the words go to Plex's catalogue, Disney+, Stremio's catalogue, your Plex server and
   Telemachus): one row per title with its services, the apps on this TV as chips (Left and Right choose, OK opens), the others named
   with their offer. The field has the keys while it has the focus (the TV's keyboard shows); OK or Down goes to the results, Up from
   the first one back to the field; OK opens a result when it is let go, Back closes. Over Home and its menus, under the screensaver;
   the words stay in the page until it is reloaded. ---------- */
var SEARCH = (function () {
  var open = false,
    els = null,
    local = [] /* the rows of /api/search: {head} or {item, group} */,
    whereRows = [] /* the rows of Where to watch: {head}, {note} or {where, group: 'where'} */,
    list = [] /* the rows as drawn, the two together */,
    at = -1 /* -1: the field has the focus; else the result in list */,
    chip = 0 /* in a Where to watch row: the app chosen */,
    start = 0 /* the first row on show */,
    note = '',
    shownQ = '' /* the words the results are for */,
    asked = 0,
    askedWhere = 0,
    typeT = 0,
    whereT = 0,
    swallow = false,
    okDown = false,
    lastKeyAt = 0,
    lastWheel = 0,
    ROOM = 700; /* the height the rows may take under the field */
  /* a group's heading */
  function head(id) {
    return id === 'have' ? t('In your apps') : id === 'where' ? t('Where to watch') : id === 'search' ? t('Search in') : t('Look in');
  }
  function whereOn() {
    return !(cfg.search && cfg.search.where === false);
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
      clearTimeout(whereT);
      typeT = setTimeout(ask, 200);
      whereT = setTimeout(askWhere, 900); /* the services only once the typing stops */
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
      out.push({ head: head(g.id), id: g.id });
      g.items.forEach(function (it) {
        out.push({ item: it, group: g.id });
      });
    });
    return out;
  }
  /* what is drawn: In your apps, then Where to watch, then the rest; the focus stays on the same result when rows come in */
  function compose() {
    var was = list[at],
      wasKey = was && (was.item || was.where) ? (was.item || was.where).key : '',
      cut = 0;
    while (cut < local.length && (local[cut].group === 'have' || local[cut].id === 'have')) cut++;
    list = local.slice(0, cut).concat(whereRows, local.slice(cut));
    if (at >= 0) {
      at = -1;
      for (var i = 0; i < list.length; i++) if (wasKey && usable(i) && (list[i].item || list[i].where).key === wasKey) at = i;
      if (at < 0) at = first();
      if (!list[at] || !list[at].where) chip = 0;
    }
  }
  function words() {
    return els ? els.q.value.replace(/\s+/g, ' ').trim() : '';
  }
  function ask() {
    if (!open) return;
    var w = words(),
      n = ++asked;
    if (!w) {
      local = [];
      whereRows = [];
      ++askedWhere;
      note = t('Type a title: Home looks for it in the apps on this TV.');
      at = -1;
      compose();
      return draw();
    }
    api('/api/search?q=' + encodeURIComponent(w)).then(
      function (r) {
        if (n !== asked || !open) return;
        local = rowsOf(r);
        shownQ = (r && r.q) || w;
        compose();
        note = list.length ? '' : whereRows.length ? '' : t('Nothing found on this TV.');
        draw();
      },
      function () {
        if (n !== asked || !open) return;
        local = [];
        note = t('The service did not answer.');
        compose();
        draw();
      }
    );
  }
  /* Where to watch: asked of the service, which asks the services (never with fewer than two letters) */
  function askWhere() {
    if (!open) return;
    var w = words(),
      n = ++askedWhere;
    if (!whereOn() || w.replace(/[^\w\u00c0-\uffff]/g, '').length < 2) {
      whereRows = [];
      compose();
      return draw();
    }
    whereRows = [{ head: head('where'), id: 'where' }, { note: t('Asking where it is...') }];
    compose();
    draw();
    api('/api/search/where?q=' + encodeURIComponent(w)).then(
      function (r) {
        if (n !== askedWhere || !open) return;
        var g = ((r && r.groups) || []).filter(function (x) {
          return x.id === 'where' && x.items && x.items.length;
        })[0];
        whereRows = g
          ? [{ head: head('where'), id: 'where' }].concat(
              g.items.map(function (x) {
                return { where: x, group: 'where' };
              })
            )
          : [];
        compose();
        if (!list.length && !note) note = t('Nothing found on this TV.');
        if (list.length) note = '';
        draw();
      },
      function () {
        if (n !== askedWhere || !open) return;
        whereRows = [];
        compose();
        draw();
      }
    );
  }
  /* the apps a Where to watch row can open (its chips), and the services it only names */
  function chips(x) {
    return (x.where.offers || []).filter(function (o) {
      return !!o.launch;
    });
  }
  function usable(i) {
    var x = list[i];
    return !!x && (!!x.item || (!!x.where && chips(x).length > 0));
  }
  function first() {
    for (var i = 0; i < list.length; i++) if (usable(i)) return i;
    return -1;
  }
  /* the next result up or down, or -1 */
  function next(d) {
    for (var i = at + d; i >= 0 && i < list.length; i += d) if (usable(i)) return i;
    return -1;
  }
  function money(v, cur) {
    try {
      if (cur) return new Intl.NumberFormat(LOC, { style: 'currency', currency: cur }).format(v);
    } catch (e) {}
    return String(v);
  }
  function offerText(o) {
    var p = o.price !== null && o.price !== undefined ? money(o.price, o.currency) : '';
    if (o.offer === 'subscription') return t('subscription');
    if (o.offer === 'free') return t('free');
    if (o.offer === 'rent') return p ? t('rent %s').replace('%s', p) : t('rent');
    if (o.offer === 'buy') return p ? t('buy %s').replace('%s', p) : t('buy');
    if (o.offer === 'library') return t('in your library');
    if (o.offer === 'catalogue') return t('in its catalogue');
    return '';
  }
  function label(x) {
    var it = x.item;
    if (x.group === 'have') return [it.title, [it.sub, it.appTitle].filter(Boolean).join(' \u00b7 ')];
    if (x.group === 'search') return [it.appTitle, '\u201c' + shownQ + '\u201d'];
    return [t('Open %s').replace('%s', it.appTitle), ''];
  }
  /* how tall a row is drawn, for what fits on the screen */
  function height(x) {
    return x.head !== undefined ? 50 : x.note !== undefined ? 56 : x.where ? 132 : 84;
  }
  function draw() {
    var l = layer();
    l.field.classList.toggle('f', at < 0);
    /* the first row on show: the focused one and the heading above it fit */
    if (at < 0) start = 0;
    else {
      if (start > Math.max(0, at - 1)) start = Math.max(0, at - 1);
      for (;;) {
        var h0 = 0;
        for (var j = start; j <= at; j++) h0 += height(list[j]);
        if (h0 <= ROOM || start >= at) break;
        start++;
      }
    }
    var h = '',
      used = 0;
    for (var i = start; i < list.length; i++) {
      used += height(list[i]);
      if (used > ROOM && i > at) break;
      var x = list[i];
      if (x.head !== undefined) h += '<div class="srh" data-n="' + i + '"></div>';
      else if (x.note !== undefined) h += '<div class="srn" data-n="' + i + '"></div>';
      else if (x.where)
        h +=
          '<div class="row srow wrow' +
          (i === at ? ' f' : usable(i) ? '' : ' dim') +
          '" data-i="' +
          i +
          '"><div class="wt"><span class="lb"></span><span class="st"></span></div><div class="wc"></div><div class="wo"></div></div>';
      else
        h +=
          '<div class="row srow' +
          (i === at ? ' f' : '') +
          '" data-i="' +
          i +
          '"><img alt=""><span class="lb"></span><span class="st"></span></div>';
    }
    if (note) h += '<div id="sr-note"></div>';
    l.list.innerHTML = h;
    [].forEach.call(l.list.children, function (el) {
      if (el.id === 'sr-note') return void (el.textContent = note);
      if (el.className === 'srh') return void (el.textContent = list[+el.getAttribute('data-n')].head);
      if (el.className === 'srn') return void (el.textContent = list[+el.getAttribute('data-n')].note);
      var k = +el.getAttribute('data-i'),
        x = list[k];
      if (x.where) return fillWhere(el, x, k);
      var txt = label(x),
        img = el.querySelector('img');
      icon(img, x.item.app);
      el.querySelector('.lb').textContent = txt[0];
      el.querySelector('.st').textContent = txt[1];
      el.addEventListener('click', function () {
        at = k;
        pick();
      });
      hover(el, k);
    });
    var cur = list[at],
      o = cur && cur.where ? chips(cur)[chip] : null;
    l.hint.textContent =
      at < 0
        ? t('OK or Down: the results \u00b7 Back: close')
        : o
          ? (o.exact ? t('OK opens it in %s') : t('OK opens %s: find the title there')).replace('%s', o.appTitle) +
            (chips(cur).length > 1 ? ' \u00b7 ' + t('Left and Right: another app') : '')
          : t('OK to open, Back to close');
  }
  function icon(img, app) {
    img.onerror = function () {
      img.style.visibility = 'hidden';
    };
    img.src = API + '/icon/' + encodeURIComponent(app);
  }
  /* the pointer over a result selects it (real movement only, not right after a key) */
  function hover(el, k) {
    el.addEventListener('mousemove', function () {
      if (at === k || !usable(k) || Date.now() - lastKeyAt < 1500) return;
      at = k;
      chip = 0;
      draw();
    });
  }
  /* a Where to watch row: the title, its year and kind, the apps on this TV as chips, the other services named with their offer */
  function fillWhere(el, x, k) {
    var w = x.where,
      cs = chips(x),
      others = (w.offers || []).filter(function (o) {
        return !o.launch;
      });
    el.querySelector('.lb').textContent = w.title;
    el.querySelector('.st').textContent = [
      w.year ? String(w.year) : '',
      w.kind === 'series' ? t('Series') : w.kind === 'movie' ? t('Film') : '',
    ]
      .filter(Boolean)
      .join(' \u00b7 ');
    var box = el.querySelector('.wc');
    cs.forEach(function (o, n) {
      var c = document.createElement('span');
      c.className = 'wchip' + (k === at && n === chip ? ' on' : '');
      c.innerHTML = '<img alt=""><span></span>';
      icon(c.firstChild, o.app);
      var tx = offerText(o);
      c.lastChild.textContent = o.offer === 'rent' || o.offer === 'buy' ? o.appTitle + ' \u00b7 ' + tx : o.appTitle;
      c.addEventListener('click', function (ev) {
        ev.stopPropagation();
        at = k;
        chip = n;
        pick();
      });
      box.appendChild(c);
    });
    el.querySelector('.wo').textContent = others.length
      ? t('Also: %s').replace(
          '%s',
          others
            .map(function (o) {
              var tx = offerText(o);
              return o.name + (tx ? ' (' + tx + ')' : '');
            })
            .join(' \u00b7 ')
        )
      : '';
    el.addEventListener('click', function () {
      if (!usable(k)) return;
      if (at !== k) chip = 0;
      at = k;
      pick();
    });
    hover(el, k);
  }
  function toField() {
    at = -1;
    draw();
    els.q.focus();
  }
  function toRow(i) {
    at = i;
    chip = 0;
    els.q.blur(); /* the TV's keyboard goes away */
    draw();
  }
  function pick() {
    var x = list[at];
    if (!x) return;
    var go = x.item ? x.item.launch : x.where ? (chips(x)[chip] || {}).launch : null;
    if (!go) return;
    close();
    launch(go.id, go.params || {});
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
    askWhere();
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
    clearTimeout(whereT);
    asked++;
    askedWhere++;
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
      var cur = list[at],
        n = cur && cur.where ? chips(cur).length : 0;
      if (rtl() && (k === 37 || k === 39)) k = 76 - k; /* the chips run the other way in a right-to-left language */
      if (k === 38) {
        var u = next(-1);
        if (u >= 0) {
          at = u;
          chip = 0;
          draw();
        } else toField();
      } else if (k === 40) {
        var d = next(1);
        if (d >= 0) {
          at = d;
          chip = 0;
          draw();
        }
      } else if (k === 37 || k === 39) {
        var c2 = chip + (k === 39 ? 1 : -1);
        if (n && c2 >= 0 && c2 < n) {
          chip = c2;
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
        chip = 0;
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
