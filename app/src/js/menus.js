/* ---------- menus ---------- */
var stack = [],
  ovEl = null;
/* webOS 5's Chromium (68) can leave the old text in the compositor tile when an element's content is replaced, so menu and list text shows
   twice (issue 4). There the element is swapped for a fresh one instead of rewriting its content; newer engines just set innerHTML. */
var OLDGPU = (function () {
  var m = /Chrome\/(\d+)/.exec(navigator.userAgent || '');
  return !!m && +m[1] < 79;
})();
function setHtml(el, h) {
  if (!OLDGPU || !el.parentNode) {
    el.innerHTML = h;
    return el;
  }
  var n = el.cloneNode(false);
  n.innerHTML = h;
  el.parentNode.replaceChild(n, el);
  return n;
}
/* A menu can be built by a function (build): after a row with stay changes something, the menu is built again and stays open with the
   new values, and the menu below is built again when Back returns to it. A note row is text only: the focus skips it. */
/* the first menu over Home slides in (drawMenu); the ones after it, and redraws, do not */
var ovEnter = false;
function openMenu(title, items, idx, build, preview) {
  if (PEEK) return void (PEEK.got = { title: title, items: build ? build() : items });
  if (!stack.length) ovEnter = true;
  var m = { title: title, items: build ? build() : items, idx: idx || 0, build: build || null, preview: preview || null };
  m.idx = usable(m, m.idx);
  stack.push(m);
  drawMenu();
}
function openBuilt(title, build, idx, preview) {
  openMenu(title, null, idx, build, preview);
}
function skip(it) {
  return !it || it.sep || it.note !== undefined || it.head !== undefined;
}
/* the row at i, or the nearest one after (then before) it that can take the focus */
function usable(m, i) {
  var n = m.items.length;
  i = Math.max(0, Math.min(i, n - 1));
  for (var j = i; j < n; j++) if (!skip(m.items[j])) return j;
  for (j = i; j >= 0; j--) if (!skip(m.items[j])) return j;
  return i;
}
function refreshMenu() {
  var m = stack[stack.length - 1];
  if (!m) return;
  if (m.build) {
    /* the focus stays on the row with the same label (after "Move right" a "Move left" row can appear above it) */
    var was = m.items[m.idx] && m.items[m.idx].label;
    m.items = m.build();
    for (var i = 0; i < m.items.length; i++)
      if (was && m.items[i].label === was && !skip(m.items[i])) {
        m.idx = i;
        break;
      }
    m.idx = usable(m, m.idx);
  }
  drawMenu();
}
function closeMenus() {
  stack = [];
  if (ovEl) {
    ovEl.remove();
    ovEl = null;
  }
  drawSide(null);
}
/* a menu whose rows carry a picture (pv, the theme list) shows it with a description left of the list. Its own element, outside
   the menu that is redrawn on every key, so the picture is only loaded again when the focused row's picture changes. */
var sideEl = null;
function drawSide(it) {
  if (!it) {
    if (sideEl) sideEl.remove();
    sideEl = null;
    return;
  }
  if (!sideEl) {
    sideEl = document.createElement('div');
    sideEl.id = 'ovside';
    sideEl.innerHTML = '<div class="pvbox"><img alt=""></div><div class="pt"></div><div class="pd"></div>';
    document.body.appendChild(sideEl);
  }
  var img = sideEl.querySelector('img'),
    url = it.pv ? API + '/api/theme/preview/' + it.pv : '';
  if (img.getAttribute('data-u') !== url) {
    img.setAttribute('data-u', url);
    img.style.visibility = 'hidden';
    img.onload = function () {
      img.style.visibility = '';
    };
    if (url) img.src = url;
    else img.removeAttribute('src');
  }
  sideEl.querySelector('.pt').textContent = it.label;
  sideEl.querySelector('.pd').textContent = it.desc || '';
}
function backMenu() {
  stack.pop();
  if (stack.length) refreshMenu();
  else closeMenus();
}
/* Inside a section (a menu opened from another), the list it came from stands on the left with the open section lit, and the
   section's rows on the right with a hint at the foot (couch-tv's settings look); a menu on its own is one panel, Home in view. */
var TICK = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15"/><path d="M9.5 16.5l4.2 4.2 8.8-9.2"/></svg>';
/* Hovering never moves the list, except on its first or last visible row, where it scrolls one row: 1 down, -1 up, 0 not at all.
   k: the row under the pointer, start: the first row on show, N: how many are on show, len: how many rows there are (upstream PR 68) */
function hoverDir(k, start, N, len) {
  if (k === start + N - 1 && start + N < len) return 1;
  if (k === start && start > 0) return -1;
  return 0;
}
/* Every menu has the same two panes (after couch-tv's settings):
   - a list with pictures (the themes) or a preview (m.preview: the screensaver's frame): the picture of the focused row, large, on the
     left, the rows on the right;
   - a menu opened from another: the list it came from on the left with that row lit, its own rows on the right;
   - a first menu: its rows on the left, and on the right what the focused row opens (rows marked peek: shown, not used), or its value.
   A hint at the foot; a solid background. */
var PEEK = null; /* while set, openMenu keeps what it would open here instead of opening it (peekOf) */
function peekOf(it) {
  if (!it || !it.peek || !it.fn) return null;
  PEEK = {};
  try {
    it.fn();
  } catch (e) {}
  var got = PEEK.got || null;
  PEEK = null;
  return got;
}
function rowHtml(it, i, m, withPv) {
  if (it.sep) return '<div class="msep"></div>';
  if (it.note !== undefined) return '<div class="mnote" data-n="' + i + '"></div>';
  if (it.head !== undefined) return '<div class="mhead" data-n="' + i + '"></div>';
  return (
    '<div class="row' +
    (m && i === m.idx ? ' f' : '') +
    (it.dim ? ' dim' : '') +
    '" data-i="' +
    i +
    '">' +
    (it.icon ? svg(it.icon) : '') +
    (withPv && it.pv ? '<span class="th"></span>' : '') +
    '<span class="lb"></span>' +
    (it.sub === '✓' ? '<span class="ck">' + TICK + '</span>' : it.sub ? '<span class="st"></span>' : '') +
    '</div>'
  );
}
function fillRows(box, items) {
  [].forEach.call(box.querySelectorAll('.mnote'), function (el) {
    el.textContent = items[+el.getAttribute('data-n')].note;
  });
  [].forEach.call(box.querySelectorAll('.mhead'), function (el) {
    el.textContent = items[+el.getAttribute('data-n')].head;
  });
  [].forEach.call(box.querySelectorAll('.row'), function (row) {
    var it = items[+row.getAttribute('data-i')];
    row.querySelector('.lb').textContent = it.label;
    if (it.sub && it.sub !== '✓') row.querySelector('.st').textContent = it.sub;
    var th = row.querySelector('.th');
    if (th) th.style.backgroundImage = 'url("' + API + '/api/theme/preview/' + it.pv + '")';
  });
}
function drawMenu(win) {
  /* win: the first row on show, when the pointer asks for one (otherwise the selection sits on the fourth row) */
  var m = stack[stack.length - 1],
    up = stack.length > 1 ? stack[stack.length - 2] : null,
    pic =
      !!m.preview ||
      m.items.some(function (x) {
        return !!x.pv;
      }),
    mode = pic ? 'pic' : up ? 'nest' : 'root',
    N = mode === 'root' ? 13 : 10,
    start = Math.max(0, Math.min(m.idx - (mode === 'root' ? 6 : 3), m.items.length - N)),
    secs = [];
  if (typeof win === 'number') start = Math.max(0, Math.min(win, m.items.length - N));
  m.start = start;
  if (!ovEl) {
    ovEl = document.createElement('div');
    ovEl.id = 'ov';
    document.body.appendChild(ovEl);
  }
  var h = '',
    rows = '',
    i;
  for (i = start; i < Math.min(m.items.length, start + N); i++) rows += rowHtml(m.items[i], i, m, mode !== 'pic');
  var more = function (a, b) {
    return '<div class="more">' + (a ? '▲' : '') + '</div>' + rows + '<div class="more">' + (b ? '▼' : '') + '</div>';
  };
  var cur = m.items[m.idx],
    peek = mode === 'root' ? peekOf(cur) : null;
  if (mode === 'nest') {
    for (var j = 0; j < up.items.length; j++) if (!skip(up.items[j])) secs.push(j);
    var at = secs.indexOf(up.idx),
      s0 = Math.max(0, Math.min(at - 6, secs.length - 13));
    secs = secs.slice(s0, s0 + 13);
    h += '<div class="secs"><h2 class="sh"></h2>';
    for (j = 0; j < secs.length; j++)
      h +=
        '<div class="sec' +
        (secs[j] === up.idx ? ' on' : '') +
        '" data-s="' +
        secs[j] +
        '">' +
        (up.items[secs[j]].icon ? '<span class="si">' + svg(up.items[secs[j]].icon) + '</span>' : '') +
        '<span class="lb"></span></div>';
    h += '</div><div class="panel"><h2></h2>' + more(start > 0, start + N < m.items.length) + '<div class="hint"></div></div>';
  } else if (mode === 'pic') {
    h +=
      '<div class="pvl"><h2 class="sh"></h2><div class="pvbox"></div><div class="pt"></div><div class="pd"></div></div>' +
      '<div class="panel"><h2></h2>' +
      more(start > 0, start + N < m.items.length) +
      '<div class="hint"></div></div>';
  } else {
    h +=
      '<div class="secs list"><h2 class="sh"></h2>' +
      more(start > 0, start + N < m.items.length) +
      '</div><div class="panel peek"><h2></h2>';
    if (peek) for (i = 0; i < Math.min(peek.items.length, 9); i++) h += rowHtml(peek.items[i], i, null, false);
    else if (cur && !skip(cur)) h += '<div class="pdesc"><div class="pdt"></div><div class="pds"></div></div>';
    h += '<div class="hint"></div></div>';
  }
  ovEl = setHtml(ovEl, h);
  drawSide(null);
  ovEl.className = mode + (ovEnter && !OLDGPU ? ' enter' : '');
  ovEnter = false;
  var hint = ovEl.querySelector('.hint');
  if (mode === 'root') {
    ovEl.querySelector('.sh').textContent = m.title;
    if (peek) {
      ovEl.querySelector('.panel h2').textContent = peek.title;
      fillRows(ovEl.querySelector('.panel'), peek.items);
      hint.textContent = t('OK or Right to open, Back to close');
    } else {
      ovEl.querySelector('.panel h2').textContent = '';
      if (cur && !skip(cur)) {
        ovEl.querySelector('.pdt').textContent = cur.label;
        ovEl.querySelector('.pds').textContent = cur.desc || cur.sub || '';
      }
      hint.textContent = t('OK to change, Back to close');
    }
  } else {
    ovEl.querySelector('.panel h2').textContent = m.title;
    hint.textContent = t('OK to change, Back to go back');
  }
  if (mode === 'pic') {
    /* the focused row's picture: a theme's screenshot, or the menu's own preview (the screensaver's frame) */
    ovEl.querySelector('.sh').textContent = up ? up.title : m.title;
    var box = ovEl.querySelector('.pvbox');
    if (m.preview) m.preview(box, cur);
    else if (cur && cur.pv) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = API + '/api/theme/preview/' + cur.pv;
      box.appendChild(img);
    }
    if (cur && !skip(cur)) {
      ovEl.querySelector('.pt').textContent = cur.label;
      ovEl.querySelector('.pd').textContent = cur.desc || '';
    }
  }
  if (mode === 'nest') {
    ovEl.querySelector('.sh').textContent = up.title;
    [].forEach.call(ovEl.querySelectorAll('.sec'), function (el) {
      var k = +el.getAttribute('data-s');
      el.querySelector('.lb').textContent = up.items[k].label;
      /* the pointer on another section: that one opens instead */
      el.addEventListener('click', function () {
        stack.pop();
        up.idx = k;
        refreshMenu();
        pickMenu();
      });
    });
  }
  /* the menu's own rows: in the list on the left (a first menu) or on the right */
  var own = mode === 'root' ? ovEl.querySelector('.secs') : ovEl.querySelector('.panel');
  fillRows(own, m.items);
  [].forEach.call(own.querySelectorAll('.row'), function (row) {
    var it = m.items[+row.getAttribute('data-i')];
    var pt = 0,
      rowHeld = false;
    if (it.hold) {
      row.addEventListener('mousedown', function () {
        rowHeld = false;
        clearTimeout(pt);
        pt = setTimeout(function () {
          rowHeld = true;
          it.hold();
        }, 650);
      });
      row.addEventListener('mouseup', function () {
        clearTimeout(pt);
      });
    }
    row.addEventListener('click', function () {
      if (rowHeld) return void (rowHeld = false);
      m.idx = +row.getAttribute('data-i');
      pickMenu();
    });
    /* the Magic Remote's pointer over a row selects it (real movement only, so the list does not jump under a resting pointer);
       on the first or last row on show the list scrolls one row, at most about three times a second (upstream PR 68) */
    row.addEventListener('mousemove', function (ev) {
      var k = +row.getAttribute('data-i');
      if (m.idx === k || Date.now() - lastKey < 1500) return;
      if (lastMX >= 0 && Math.abs(ev.clientX - lastMX) + Math.abs(ev.clientY - lastMY) < 24) return;
      lastMX = ev.clientX;
      lastMY = ev.clientY;
      var s1 = m.start || 0,
        now = Date.now(),
        dir = hoverDir(k, s1, N, m.items.length);
      if (dir && now - (m.scrollAt || 0) < 350) dir = 0;
      if (dir) m.scrollAt = now;
      m.idx = k;
      drawMenu(s1 + dir);
    });
  });
}
/* a row without stay closes the menus (it opened an app or finished a task); with stay the menu stays and shows the new values */
function pickMenu() {
  var m = stack[stack.length - 1],
    it = m.items[m.idx];
  if (it && it.fn && !skip(it)) {
    var n = stack.length;
    it.fn();
    if (stack.length !== n || stack[stack.length - 1] !== m) return;
    if (it.stay) refreshMenu();
    else closeMenus();
  }
}
/* the next row up or down that can take the focus, or -1 */
function menuStep(m, d) {
  for (var i = m.idx + d; i >= 0 && i < m.items.length; i += d) if (!skip(m.items[i])) return i;
  return -1;
}
function menuKey(k) {
  var m = stack[stack.length - 1],
    n = k === 38 ? menuStep(m, -1) : k === 40 ? menuStep(m, 1) : -1;
  if (n >= 0) {
    m.idx = n;
    drawMenu();
  } else if (k === 38 || k === 40) {
    /* the first or last row: nothing to move to */
  } else if (k === 13) pickMenu();
  else if (k === 461 || k === 27 || k === 8) backMenu();
  else if (k === 37 && stack.length > 1) backMenu(); /* Left: back to the sections on the left (right-to-left languages swap it) */
  else if (k === 39 && stack.length === 1 && m.items[m.idx] && m.items[m.idx].peek) pickMenu(); /* Right: into what the row opens */
  else return false;
  return true;
}

/* The wheel on the home screen goes tile by tile in reading order: along the dock, then along the grid row after row (the end of a row
   goes on with the next one), and the other way back. The top buttons stay with the Up key and the pointer; from them the wheel goes
   down to the first tile (upstream PR 68). */
function homeStep(dir) {
  var first = rows[1] === rows[0] ? 2 : 1; /* without a dock, row 1 is the row of buttons again */
  if (r < first) {
    if (dir > 0) setFocus(first, 0);
    return;
  }
  var nr = r,
    nc = c + dir;
  if (nc < 0) {
    nr = r - 1;
    if (nr < first) return;
    nc = rows[nr].length - 1;
  } else if (nc >= rows[r].length) {
    nr = r + 1;
    if (nr >= rows.length) return;
    nc = 0;
  }
  setFocus(nr, nc);
}
/* the Magic Remote's wheel moves an open menu one row per notch, and on the home screen one tile (homeStep); lastKey keeps the pointer
   from taking the selection back while the list moves under it. Live TV, the screensaver and the photo chooser have their own. */
var lastWheel = 0;
document.addEventListener(
  'wheel',
  function (e) {
    if (LIVE.on || !e.deltaY || SAVER.active() || WALLPICK.open()) return;
    e.preventDefault();
    lastKey = Date.now();
    if (lastKey - lastWheel < (stack.length ? 70 : 100)) return;
    lastWheel = lastKey;
    if (stack.length) menuKey(e.deltaY > 0 ? 40 : 38);
    else homeStep(e.deltaY > 0 ? 1 : -1);
  },
  { passive: false }
);

/* Back on the home screen lists the running apps to close them, as LG's Home does with its Recents on a second Back (issue 16) */
function runningMenu() {
  api('/api/running').then(
    function (x) {
      if (x.error) return toast(t('Could not read the open apps. Try again in a moment.'), true);
      openMenu(t('Running apps'), runningItems(x.apps || []));
      stack[stack.length - 1].running = true;
    },
    function () {
      toast(t('Could not read the open apps. Try again in a moment.'), true);
    }
  );
}
/* the list is only true for the moment it was read: it goes when Home is left, so it is never shown out of date */
function closeRunningMenu() {
  if (
    stack.some(function (m) {
      return m.running;
    })
  )
    closeMenus();
}
function runningItems(list) {
  if (!list.length) return [{ label: t('No apps are running'), dim: true }];
  var items = list.map(function (a) {
    return {
      label: a.title,
      sub: t('Close'),
      stay: true,
      fn: function () {
        closeRunning(list, [a.id]);
      },
    };
  });
  if (list.length > 1)
    items.push({
      label: t('Close all'),
      stay: true,
      fn: function () {
        closeRunning(
          list,
          list.map(function (a) {
            return a.id;
          })
        );
      },
    });
  return items;
}
/* the app manager's running list lags by seconds after a close, so the rows go at once instead of after a new reading */
function closeRunning(list, ids) {
  var m = stack[stack.length - 1],
    left = list.filter(function (a) {
      return ids.indexOf(a.id) < 0;
    });
  api('/api/running/close', ids.length > 1 ? { all: true } : { id: ids[0] }).then(
    function (x) {
      if (!x || x.returnValue !== true) toast(t('Could not close the app. Try again, or close it from the app itself.'), true);
    },
    function () {
      toast(t('Could not close the app. Try again, or close it from the app itself.'), true);
    }
  );
  ids.forEach(function (id) {
    delete running[id];
  });
  markRunning();
  m.items = runningItems(left);
  m.idx = Math.min(m.idx, m.items.length - 1);
  drawMenu();
}

function inputsMenu() {
  api('/api/inputs').then(function (x) {
    var items = (x.devices || [])
      .filter(function (d) {
        return d.appId;
      })
      .map(function (d) {
        var port = 'HDMI ' + d.port,
          named = d.label && d.label !== port && d.label !== 'HDMI ' + d.port,
          parts = [];
        if (named) parts.push(port);
        if (d.hdmiPlugIn) parts.push(t('Connected'));
        if (d.activate) parts.push(t('Active'));
        return {
          icon: 'hdmi',
          label: d.label || port,
          sub: parts.join(' \u00B7 '),
          dim: !d.hdmiPlugIn,
          fn: function () {
            launch(d.appId);
          },
          /* hold OK: pin the input to Home, where it is a tile like an app */
          hold: function () {
            inputMenu(d.appId, d.label || port);
          },
        };
      });
    openMenu(t('Inputs'), items);
  });
}
function isPinned(id) {
  return apps.some(function (a) {
    return a.id === id && a.input;
  });
}
function inputMenu(id, name) {
  var on = isPinned(id);
  openMenu(name, [
    {
      label: t('Open'),
      fn: function () {
        launch(id);
      },
    },
    {
      label: on ? t('Remove from Home') : t('Add to Home'),
      fn: function () {
        pinInput(id, name, !on);
      },
    },
  ]);
}
/* the service keeps the pinned inputs (also for the Inputs picker) and lists them with the apps */
function pinInput(id, name, on) {
  api('/api/inputs/pin', { id: id, on: on }).then(
    function (x) {
      if (!x || x.returnValue !== true) return toast(t('Could not change Home. Try again in a moment.'), true);
      toast((on ? t('%s added to Home') : t('%s removed from Home')).replace('%s', name));
      lastSig = '';
      load();
    },
    function () {
      toast(t('Could not change Home. Try again in a moment.'), true);
    }
  );
}

function appMenu(a) {
  openBuilt(a.title, function () {
    var di = dockIds(),
      pos = di.indexOf(a.id),
      move = function (d) {
        var x = di.slice();
        x[pos] = x[pos + d];
        x[pos + d] = a.id;
        setDock(x);
      },
      items = [
        {
          label: t('Open'),
          fn: function () {
            launch(a.id);
          },
        },
      ];
    if (pos >= 0) {
      if (pos > 0)
        items.push({
          label: t('Move left in dock'),
          stay: true,
          fn: function () {
            move(-1);
          },
        });
      if (pos < di.length - 1)
        items.push({
          label: t('Move right in dock'),
          stay: true,
          fn: function () {
            move(1);
          },
        });
      items.push({
        label: t('Remove from dock'),
        stay: true,
        fn: function () {
          setDock(
            di.filter(function (i) {
              return i !== a.id;
            })
          );
        },
      });
    } else if (di.length < TH.dockN)
      items.push({
        label: t('Add to dock'),
        stay: true,
        fn: function () {
          setDock(di.concat(a.id));
        },
      });
    else
      items.push({
        label: t('Add to dock...'),
        stay: true,
        fn: function () {
          openMenu(
            t('Replace which app?'),
            di.map(function (id, i) {
              return {
                label: title(id),
                stay: true,
                fn: function () {
                  var d = di.slice();
                  d[i] = a.id;
                  setDock(d);
                  backMenu();
                },
              };
            })
          );
        },
      });
    if (a.input)
      items.push({
        label: t('Remove from Home'),
        fn: function () {
          pinInput(a.id, a.title, false);
        },
      });
    else
      items.push({
        label: t('Hide app'),
        fn: function () {
          hideApp(a.id);
          toast(t('%s is hidden. Customize > Hidden apps shows it again.').replace('%s', a.title));
        },
      });
    if (a.rm) items.push({ label: t('Uninstall...'), stay: true, fn: uninstallMenu.bind(null, a) });
    return items;
  });
}
/* uninstalling (helper/apps.js): asked first; LG's system apps and the ones CleanYourTV needs are not offered */
function uninstallMenu(a) {
  openMenu(t('Uninstall %s?').replace('%s', a.title), [
    { label: t('Cancel'), fn: backMenu, stay: true },
    {
      label: t('Uninstall'),
      sub: t("removed from the TV with its data; LG's app store installs it again"),
      fn: function () {
        toast(t('Uninstalling %s...').replace('%s', a.title));
        api('/api/uninstall', { id: a.id }).then(
          function (r) {
            if (r && r.returnValue) {
              toast(t('%s is uninstalled.').replace('%s', a.title));
              setTimeout(load, 1500);
            } else toast(t((r && r.error) || 'The TV did not remove the app.'), true);
          },
          function () {
            toast(t('The service did not answer.'), true);
          }
        );
      },
    },
  ]);
}

function removeButton(o) {
  cfg.topbar = topbar().filter(function (b) {
    return b !== o;
  });
  saveCfg();
}
/* moves a button one place among the shown ones (a hidden Live TV button keeps its place in the saved list) */
function moveButton(o, d) {
  var tb = topbar().slice(),
    i = tb.indexOf(o),
    j = i + d;
  while (j >= 0 && j < tb.length && !liveOn() && tb[j].action === 'live') j += d;
  if (i < 0 || j < 0 || j >= tb.length) return;
  tb[i] = tb[j];
  tb[j] = o;
  cfg.topbar = tb;
  saveCfg();
}
function barMenu(o) {
  openBuilt(barLabel(o), function () {
    var sb = shownBar(),
      pos = sb.indexOf(o),
      items = [];
    if (pos > 0)
      items.push({
        label: t('Move left'),
        stay: true,
        fn: function () {
          moveButton(o, -1);
        },
      });
    if (pos >= 0 && pos < sb.length - 1)
      items.push({
        label: t('Move right'),
        stay: true,
        fn: function () {
          moveButton(o, 1);
        },
      });
    items.push({
      label: t('Remove this button'),
      stay: true,
      fn: function () {
        removeButton(o);
        backMenu();
      },
    });
    return items;
  });
}
/* Customize: how Home looks. What the TV and the service do is in the manager app (More settings...) */
function customizeMenu() {
  openBuilt(t('Customize'), function () {
    var nh = hiddenIds().length;
    return [
      { head: t('Home') },
      { label: t('Dock'), icon: 'dock', stay: true, peek: true, fn: dockMenu },
      { label: t('Top buttons'), icon: 'buttons', stay: true, peek: true, fn: topButtonsMenu },
      { label: t('Hidden apps'), icon: 'hidden', sub: nh ? String(nh) : '', stay: true, peek: true, fn: hiddenMenu },
      {
        label: t('Continue watching'),
        icon: 'play',
        peek: true,
        sub: cfg.watch && cfg.watch.on === false ? t('Off') : t('On'),
        stay: true,
        fn: watchMenu,
      },
      {
        label: t('App order'),
        icon: 'sort',
        sub: cfg.sort === 'alpha' ? t('A to Z') : t('Most used first'),
        stay: true,
        fn: function () {
          cfg.sort = cfg.sort === 'alpha' ? 'usage' : 'alpha';
          saveCfg();
        },
      },
      {
        label: t('Mark running apps'),
        icon: 'dot',
        sub: cfg.runDots === true ? t('Green dot') : t('No dot'),
        stay: true,
        fn: function () {
          if (cfg.runDots === true) delete cfg.runDots;
          else cfg.runDots = true;
          saveCfg();
        },
      },
      { head: t('Look') },
      {
        label: t('Theme'),
        icon: 'theme',
        stay: true,
        desc: t('The look of Home: its colours, the clock, the dock and the apps, a picture.'),
        fn: themeMenu,
      },
      /* only where the theme has slots for cards */
      (TH.slots || []).length
        ? {
            label: t('Cards'),
            icon: 'cards',
            sub: t('in the CleanYourTV app'),
            fn: function () {
              launch('com.cleanyourtv.manager', { open: 'cards' });
            },
          }
        : null,
      { label: t('Accent colour'), icon: 'accent', stay: true, fn: accentMenu },
      {
        label: t('Clock'),
        icon: 'clock',
        sub: cfg.clock === '24' ? t('24-hour') : cfg.clock === '12' ? t('12-hour') : t('Automatic'),
        stay: true,
        fn: clockMenu,
      },
      { head: t('Photos') },
      {
        label: t('Wallpapers'),
        icon: 'photo',
        peek: true,
        sub: cfg.wall && cfg.wall.on ? t('On') : t('Off'),
        stay: true,
        fn: wallMenu,
      },
      {
        label: t('Screensaver'),
        icon: 'frame',
        peek: true,
        sub: cfg.saver && cfg.saver.on ? t('On') : t('Off'),
        stay: true,
        fn: saverMenu,
      },
      { head: t('More') },
      {
        label: t('Phone remote...'),
        icon: 'phone',
        sub: t('in the CleanYourTV app'),
        fn: function () {
          launch('com.cleanyourtv.manager', { open: 'remote' });
        },
      },
      {
        label: t('More settings...'),
        icon: 'more',
        sub: t('Home, Live TV, Debloat, updates'),
        fn: function () {
          launch('com.cleanyourtv.manager');
        },
      },
      /* the hidden gestures, said where people already look instead of over Home (issue: hold OK was undiscoverable) */
      { note: t('Hold OK on an app for its options. Back on Home lists the open apps.') },
    ].filter(function (it) {
      return it;
    });
  });
}
/* Wallpapers: switched on here and how often the photo changes; the photos are added in the manager (uploads from a phone, Immich) */
function wallMenu() {
  openBuilt(t('Wallpapers'), function () {
    var w = cfg.wall || { on: false },
      e = wallSecs(),
      n = +String((cfg.wallpapers && cfg.wallpapers.stamp) || '0').split(':')[0] || 0,
      EV = [0, 10, 30, 60, 180, 300, 900, 3600],
      name = function (x) {
        return !x
          ? t('Each time Home opens')
          : x < 60
            ? t('Every %s s').replace('%s', x)
            : x === 60
              ? t('Every minute')
              : t('Every %s min').replace('%s', x / 60);
      };
    return [
      {
        label: t('Use Wallpapers'),
        sub: (w.on ? t('On') : t('Off')) + ' \u00B7 ' + (n ? t(n + ' photos') : t('no photos yet')),
        stay: true,
        fn: function () {
          cfg.wall = { on: !w.on, secs: e, pick: w.pick };
          saveCfg();
        },
      },
      {
        label: t('New photo'),
        sub: name(e),
        stay: true,
        fn: function () {
          var k = EV.indexOf(e);
          cfg.wall = { on: !!w.on, secs: EV[(k < 0 ? 6 : k + 1) % EV.length], pick: w.pick };
          saveCfg();
        },
      },
      /* one chosen photo instead of a new one now and then (wallpick.js); choosing again or here goes back to all of them */
      {
        label: t('Photo'),
        sub: w.pick ? t('One chosen photo') : t('All photos, shuffled'),
        stay: true,
        fn: function () {
          if (!w.pick) return WALLPICK.start();
          cfg.wall = { on: !!w.on, secs: e };
          saveCfg();
        },
      },
      n
        ? {
            label: t('Choose a photo...'),
            sub: t('browse them on the screen'),
            stay: true,
            fn: function () {
              WALLPICK.start();
            },
          }
        : null,
      { sep: true },
      {
        label: t('Add photos...'),
        sub: t('in the CleanYourTV app'),
        fn: function () {
          launch('com.cleanyourtv.manager', { open: 'wallpapers' });
        },
      },
    ].filter(function (it) {
      return it;
    });
  });
}
/* Screensaver (saver.js): the photo feed's photos, or the Wallpapers photos, when Home is left alone, instead of LG's screensaver. The
   photo feed is set up on a phone (the Wallpapers phone page, Photo feed), since the setup code is too long for a remote. */
/* the screensaver's settings with the focused row's choice in place: what the menu's picture shows (SAVER.sample) */
function saverPreview(box, cur) {
  var s = {},
    c = cfg.saver || {};
  for (var k in c) s[k] = c[k];
  if (cur && cur.pvk) s[cur.pvk] = cur.pvv;
  SAVER.sample(box, s);
}
function saverMenu() {
  openBuilt(
    t('Screensaver'),
    function () {
      var s = cfg.saver || {},
        after = s.after || 300,
        secs = s.secs || 15,
        AF = [60, 120, 300, 600, 900, 1800],
        SE = [10, 15, 30, 60, 300, 900],
        fam = (cfg.photoFeed && cfg.photoFeed.photos) || 0,
        wall = +String((cfg.wallpapers && cfg.wallpapers.stamp) || '0').split(':')[0] || 0,
        framed = s.style !== 'photos',
        /* the frame's choices (saver.js): the first of each list is the default */
        FR = 'walnut oak teak ash cherry greyoak blackash black white charcoal sand navy sage burgundy brass silver none'.split(' '),
        FRN = {
          walnut: t('Walnut'),
          oak: t('Oak'),
          teak: t('Teak'),
          ash: t('Ash'),
          cherry: t('Cherry'),
          greyoak: t('Grey oak'),
          blackash: t('Black ash'),
          black: t('Black'),
          white: t('White'),
          charcoal: t('Charcoal'),
          sand: t('Sand'),
          navy: t('Navy'),
          sage: t('Sage'),
          burgundy: t('Burgundy'),
          brass: t('Brass'),
          silver: t('Silver'),
          none: t('No frame'),
        },
        PR = ['modern', 'thin', 'bevel', 'classic'],
        PRN = { modern: t('Modern'), thin: t('Thin'), bevel: t('Bevelled'), classic: t('Classic') },
        MA = ['auto', 'white', 'cream', 'grey', 'charcoal', 'black', 'linen'],
        MAN = {
          auto: t('From the photo'),
          white: t('White'),
          cream: t('Cream'),
          grey: t('Grey'),
          charcoal: t('Charcoal'),
          black: t('Black'),
          linen: t('Linen'),
        },
        LA = ['two', 'three', 'one'],
        LAN = { one: t('One (fills the frame unless portrait)'), two: t('Up to two side by side'), three: t('Up to three side by side') },
        FI = ['none', 'canvas', 'painting'],
        FIN = { none: t('None'), canvas: t('Canvas'), painting: t('Painting (canvas and varnish)') },
        LB = ['under', 'plaque', 'off'],
        LBN = { under: t('Under the photo'), plaque: t('Plaque'), off: t('Off') },
        val = function (k, list) {
          return list.indexOf(s[k]) >= 0 ? s[k] : list[0];
        },
        lb = s.label === false ? 'off' : s.label === 'plaque' ? 'plaque' : 'under',
        set = function (k, v) {
          var o = { on: s.on === true, after: after, secs: secs, clock: s.clock !== false };
          if (s.style === 'photos') o.style = 'photos';
          [
            ['frame', FR],
            ['profile', PR],
            ['mat', MA],
            ['layout', LA],
            ['finish', FI],
          ].forEach(function (p) {
            var x = val(p[0], p[1]);
            if (x !== p[1][0]) o[p[0]] = x;
          });
          if (lb !== 'under') o.label = lb === 'off' ? false : 'plaque';
          if (k === 'label') {
            delete o.label;
            if (v !== 'under') o.label = v === 'off' ? false : 'plaque';
          } else if (v === undefined) delete o[k];
          else o[k] = v;
          cfg.saver = o;
          saveCfg();
        },
        /* a list to pick one from, with a tick at the chosen one; Back goes back */
        choose = function (title, k, list, names) {
          return {
            label: title,
            sub: names[val(k, list)],
            fn: function () {
              openBuilt(
                title,
                function () {
                  s = cfg.saver || {}; /* read again: the list is built again after each pick */
                  var now = val(k, list);
                  return list.map(function (x) {
                    return {
                      label: names[x],
                      sub: x === now ? '\u2713' : '',
                      stay: true,
                      /* the picture shows this choice while the row has the focus */
                      pvk: k,
                      pvv: x,
                      fn: function () {
                        set(k, x === list[0] ? undefined : x);
                      },
                    };
                  });
                },
                list.indexOf(val(k, list)),
                saverPreview
              );
            },
          };
        },
        cycle = function (title, k, list, names) {
          var now = val(k, list);
          return {
            label: title,
            sub: names[now],
            stay: true,
            fn: function () {
              var nx = list[(list.indexOf(now) + 1) % list.length];
              set(k, nx === list[0] ? undefined : nx);
            },
          };
        };
      return [
        {
          label: t('Use the screensaver'),
          sub:
            (s.on ? t('On') : t('Off')) +
            ' \u00B7 ' +
            (fam ? t(fam + ' photos from the feed') : wall ? t('Wallpapers photos') : t('no photos yet')),
          stay: true,
          fn: function () {
            set('on', !s.on);
          },
        },
        {
          label: t('Starts after'),
          sub: after === 60 ? t('1 minute') : t(after / 60 + ' minutes'),
          stay: true,
          fn: function () {
            set('after', AF[(AF.indexOf(after) + 1) % AF.length]);
          },
        },
        {
          label: t('New photo'),
          sub: secs >= 60 ? t('Every %s min').replace('%s', secs / 60) : t('Every %s s').replace('%s', secs),
          stay: true,
          fn: function () {
            set('secs', SE[(SE.indexOf(secs) + 1) % SE.length]);
          },
        },
        {
          label: t('Time and date'),
          sub: s.clock !== false ? t('On') : t('Off'),
          stay: true,
          fn: function () {
            set('clock', s.clock === false);
          },
        },
        /* the frame (saver.js): each photo like a print on a wall, or fitted whole on black */
        {
          label: t('Style'),
          sub: framed ? t('Frame') : t('Photos'),
          stay: true,
          fn: function () {
            set('style', framed ? 'photos' : 'frame');
          },
        },
        framed ? choose(t('Frame'), 'frame', FR, FRN) : null,
        framed && val('frame', FR) !== 'none' ? cycle(t('Profile'), 'profile', PR, PRN) : null,
        framed ? choose(t('Mat'), 'mat', MA, MAN) : null,
        framed ? cycle(t('Photos at a time'), 'layout', LA, LAN) : null,
        framed ? cycle(t('Finish'), 'finish', FI, FIN) : null,
        framed
          ? {
              label: t('Label'),
              sub: LBN[lb],
              stay: true,
              fn: function () {
                set('label', LB[(LB.indexOf(lb) + 1) % LB.length]);
              },
            }
          : null,
        { sep: true },
        fam || wall
          ? {
              label: t('Show it now'),
              /* the menu stays under the photos: the key that ends them comes back here */
              stay: true,
              fn: function () {
                SAVER.start(true);
              },
            }
          : null,
        {
          label: t('Photo feed...'),
          sub: fam ? t(fam + ' photos') : t('set up on a phone or a computer'),
          fn: function () {
            launch('com.cleanyourtv.manager', { open: 'photofeed' }); /* straight to the QR code of the phone page's Photo feed tab */
          },
        },
      ].filter(function (it) {
        return it;
      });
    },
    0,
    saverPreview
  );
}
/* hold OK on a card under an app: open it or the app, remove it (a whole show for Telemachus), or hide that app's row */
function watchCardMenu(it) {
  var gone = function (g) {
    WATCH.remove(g);
    toast(t('Removed. Customize > Continue watching shows it again.'));
  };
  openMenu(
    it.title,
    [
      {
        label: it.progress > 0 || (it.source !== 'lg' && !it.next) ? t('Resume') : t('Play'),
        sub: it.sub || '',
        fn: function () {
          launch(it.launch.id, it.launch.params);
        },
      },
      it.owner
        ? {
            label: t('Open %s').replace('%s', title(it.owner)),
            fn: function () {
              launch(it.owner);
            },
          }
        : null,
      {
        label: t('Remove from this row'),
        sub: it.source === 'telemachus' && it.group.indexOf(':film:') < 0 ? t('the whole show') : '',
        fn: function () {
          gone(it.group);
        },
      },
      it.owner
        ? {
            label: t('Hide the row of %s').replace('%s', title(it.owner)),
            fn: function () {
              gone('app:' + it.owner);
            },
          }
        : null,
      {
        label: t('Continue watching settings...'),
        stay: true,
        fn: watchMenu,
      },
    ].filter(function (x) {
      return x;
    })
  );
}
/* Continue watching (watch.js): shown on Home or not, and Plex, Stremio and Disney+ linked with their own TV sign-in: a code entered on
   a phone (plex.tv/link, disneyplus.com/begin) or a link opened there (Stremio), never a password on the TV. The service keeps the keys; this menu sees only whether
   a service is linked, and asks again every 3 s while a code waits. */
function watchMenu() {
  var acc = {},
    timer = 0,
    NAMES = { plex: 'Plex', stremio: 'Stremio', disney: 'Disney+' },
    build = function () {
      var on = WATCH.on(),
        gone = WATCH.removed().length,
        items = [
          {
            label: t('Show on Home'),
            sub: on ? t('On') : t('Off'),
            stay: true,
            fn: function () {
              WATCH.setOn(!on);
            },
          },
          {
            label: t('Telemachus'),
            sub: WATCH.tmOn() ? t('On') : t('Off'),
            stay: true,
            fn: function () {
              WATCH.setTm(!WATCH.tmOn());
            },
          },
          {
            label: t('Rows from LG for other apps'),
            sub: WATCH.lgOn() ? t('On') : t('Off'),
            stay: true,
            fn: function () {
              WATCH.setLg(!WATCH.lgOn());
            },
          },
        ];
      /* LG's picks (what LG's servers chose for YouTube, Disney+, Apple TV, LG Channels); off keeps the rows the apps wrote themselves
         (Netflix, Prime Video). Then each app's row on its own: YouTube's, for one, is LG's pick of videos */
      if (WATCH.lgOn())
        items.push({
          label: t("LG's picks"),
          sub: WATCH.picksOn() ? t('On') : t('Off'),
          stay: true,
          fn: function () {
            WATCH.setPicks(!WATCH.picksOn());
          },
        });
      if (WATCH.lgOn())
        WATCH.lgApps().forEach(function (id) {
          items.push({
            label: title(id),
            sub: WATCH.appOn(id) ? t('On') : t('Off'),
            stay: true,
            fn: function () {
              WATCH.setApp(id, !WATCH.appOn(id));
            },
          });
        });
      if (gone)
        items.push({
          label: t('Show removed cards again'),
          sub: String(gone),
          stay: true,
          fn: WATCH.restore,
        });
      items.push({ head: t('Accounts') });
      ['plex', 'stremio', 'disney'].forEach(function (k) {
        var a = acc[k] || {},
          n = NAMES[k];
        /* a code shown (also when linking again) */
        if (a.state === 'waiting') {
          items.push({
            label: n,
            sub: t('Waiting for the code...'),
            stay: true,
            fn: function () {
              call('/api/watch/link', k); /* a new code */
            },
          });
          items.push({
            note:
              k === 'plex'
                ? t('On a phone or a computer, open plex.tv/link and enter %s').replace('%s', a.code)
                : k === 'disney'
                  ? t('On a phone or a computer, open disneyplus.com/begin and enter %s').replace('%s', a.code)
                  : t('On a phone or a computer, open %s and sign in to Stremio').replace('%s', a.url),
          });
        } else if (a.linked && a.error)
          /* linked, but the service refuses the TV's sign-in now (Disney+ after a password change): a new code */
          items.push({
            label: n,
            sub: t('Signed out: link again'),
            stay: true,
            fn: function () {
              call('/api/watch/link', k);
            },
          });
        else if (a.linked)
          items.push({
            label: n,
            sub: a.server ? t('Linked to %s').replace('%s', a.server) : t('Linked'),
            stay: true,
            fn: function () {
              openMenu(t('Unlink %s?').replace('%s', n), [
                { label: t('Cancel'), fn: backMenu, stay: true },
                {
                  label: t('Unlink'),
                  sub: t('its cards leave Home; linking again needs a new code'),
                  stay: true,
                  fn: function () {
                    backMenu();
                    call('/api/watch/unlink', k);
                  },
                },
              ]);
            },
          });
        else
          items.push({
            label: t('Link %s...').replace('%s', n),
            sub:
              a.state === 'expired'
                ? t('The code expired: try again')
                : a.state === 'error'
                  ? t('Could not link: try again')
                  : k === 'plex'
                    ? t('a code for plex.tv/link')
                    : k === 'disney'
                      ? t('a code for disneyplus.com/begin')
                      : t('a link to open on a phone'),
            stay: true,
            fn: function () {
              call('/api/watch/link', k);
            },
          });
      });
      items.push({
        note: t('Highlight an app on Home to see its episodes under it. Hold OK on one to remove it. The keys stay on the TV.'),
      });
      return items;
    },
    shown = function () {
      return stack.length && stack[stack.length - 1].build === build;
    },
    load = function () {
      clearTimeout(timer);
      api('/api/watch/accounts').then(
        function (r) {
          var was = JSON.stringify(acc);
          acc = r || {};
          if (shown() && JSON.stringify(acc) !== was) {
            refreshMenu();
            WATCH.refresh();
          }
          /* asked again only while this menu is open and a code waits */
          if (
            shown() &&
            ['plex', 'stremio', 'disney'].some(function (k) {
              return acc[k] && acc[k].state === 'waiting';
            })
          )
            timer = setTimeout(load, 3000);
        },
        function () {}
      );
    },
    call = function (p, k) {
      api(p, { service: k }).then(
        function (r) {
          if (r && r.error) toast(t('Could not link: try again'), true);
          load();
        },
        function () {}
      );
    };
  openBuilt(t('Continue watching'), build);
  load();
}
/* the apps that can go in the dock or on a button: not hidden, not Live TV, A to Z */
function pickApp(heading, skip, cb) {
  var list = apps
    .filter(function (a) {
      return a.id !== '__live' && !isHidden(a.id) && skip.indexOf(a.id) < 0;
    })
    .sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });
  openMenu(
    heading,
    list.map(function (a) {
      return {
        label: a.title,
        stay: true,
        fn: function () {
          cb(a);
        },
      };
    })
  );
}
function dockMenu() {
  openBuilt(t('Dock'), function () {
    var di = dockIds(),
      items = di.map(function (id, i) {
        return {
          label: title(id),
          stay: true,
          fn: function () {
            dockSlotMenu(i);
          },
        };
      });
    if (di.length < TH.dockN)
      items.push({
        label: t('Add an app...'),
        stay: true,
        fn: function () {
          pickApp(t('Add to dock'), di, function (a) {
            setDock(dockIds().concat(a.id));
            backMenu();
          });
        },
      });
    return items;
  });
}
/* one app in the dock; after a move the menu stays on the same app (now in its new place), so it can be moved again */
function dockSlotMenu(start) {
  var id = dockIds()[start];
  openBuilt(title(id), function () {
    var di = dockIds(),
      i = di.indexOf(id),
      move = function (d) {
        var x = di.slice();
        x[i] = x[i + d];
        x[i + d] = id;
        setDock(x);
      },
      items = [
        {
          label: t('Replace with...'),
          stay: true,
          fn: function () {
            pickApp(title(id), [id], function (a) {
              /* an app that is in the dock already swaps places with this one */
              var x = di.slice(),
                j = x.indexOf(a.id);
              if (j >= 0) x[j] = id;
              x[i] = a.id;
              setDock(x);
              backMenu();
              backMenu();
            });
          },
        },
      ];
    if (i > 0)
      items.push({
        label: t('Move left'),
        stay: true,
        fn: function () {
          move(-1);
        },
      });
    if (i >= 0 && i < di.length - 1)
      items.push({
        label: t('Move right'),
        stay: true,
        fn: function () {
          move(1);
        },
      });
    items.push({
      label: t('Remove from dock'),
      stay: true,
      fn: function () {
        setDock(
          di.filter(function (x) {
            return x !== id;
          })
        );
        backMenu();
      },
    });
    return items;
  });
}
function topButtonsMenu() {
  openBuilt(t('Top buttons'), function () {
    var items = shownBar().map(function (o) {
      return {
        icon: o.icon,
        label: barLabel(o),
        stay: true,
        fn: function () {
          barMenu(o);
        },
      };
    });
    items.push({ label: t('Add a button...'), stay: true, fn: addButtonMenu });
    return items;
  });
}
/* themes come from the service (GET /api/theme/list); choosing one applies it, a theme not on the TV is downloaded first */
function themeList(then) {
  api('/api/theme/list').then(
    function (r) {
      if (r.error) return toast(r.error, true);
      then(r);
    },
    function () {
      toast(t('Could not load the themes. Try again in a moment.'), true);
    }
  );
}
/* the service answers with the theme list again; the open theme or accent menu is built from it, so it shows the new choice */
function themeCall(path, b, after) {
  api(path, b).then(
    function (r) {
      if (r.error) return toast(r.error, true);
      lastSig = '';
      load();
      if (after) after(r);
    },
    function () {
      toast(t('Could not load the themes. Try again in a moment.'), true);
    }
  );
}
/* Customize > Clock: how it tells the time, where it stands and how large (the theme's by default, kept when the theme changes), and
   for a theme whose picture has a cut-out (Dawn), whether the clock stands behind the scenery or in front */
function clockMenu() {
  themeList(function (data) {
    var build = function () {
        var k = data.clock || { pos: '', size: '', front: true },
          AT = ['', 'tl', 'tc'],
          ATN = { '': t("The theme's"), tl: t('Top left'), tc: t('Top centre') },
          SZ = ['', 'small', 'large'],
          SZN = { '': t("The theme's"), small: t('Smaller'), large: t('Larger') },
          set = function (o) {
            themeCall('/api/theme/clock', o, update);
          };
        return [
          {
            label: t('Format'),
            sub: cfg.clock === '24' ? t('24-hour') : cfg.clock === '12' ? t('12-hour') : t('Automatic'),
            stay: true,
            fn: function () {
              cfg.clock = cfg.clock === '24' ? '12' : cfg.clock === '12' ? 'auto' : '24';
              saveCfg();
              tick();
            },
          },
          {
            label: t('Position'),
            sub: ATN[k.pos] || ATN[''],
            stay: true,
            fn: function () {
              set({ pos: AT[(AT.indexOf(k.pos) + 1) % AT.length] });
            },
          },
          {
            label: t('Size'),
            sub: SZN[k.size] || SZN[''],
            stay: true,
            fn: function () {
              set({ size: SZ[(SZ.indexOf(k.size) + 1) % SZ.length] });
            },
          },
          data.hasFront
            ? {
                label: t('Behind the picture'),
                sub: k.front !== false ? t('On') : t('Off'),
                stay: true,
                fn: function () {
                  set({ front: k.front === false });
                },
              }
            : null,
        ].filter(function (it) {
          return it;
        });
      },
      update = function (r) {
        data = r;
        if (stack.length && stack[stack.length - 1].build === build) refreshMenu();
      };
    openBuilt(t('Clock'), build);
  });
}
function themeMenu() {
  themeList(function (data) {
    var at = 0,
      build = function () {
        var r = data,
          cur = (r.current && r.current.id) || 'classic',
          name = function (id) {
            var n = id;
            (r.themes || []).forEach(function (x) {
              if (x.id === id) n = x.name;
            });
            return n;
          },
          items = (r.themes || []).map(function (x, i) {
            if (x.id === cur) at = i;
            return {
              label: x.name,
              pv: x.preview ? x.id : '',
              desc: (x.description || '') + (x.author ? '\n\n' + x.author : ''),
              sub: x.id === cur ? t('Selected') : x.installed || x.id === 'classic' ? '' : t('Downloads when chosen'),
              stay: true,
              fn: function () {
                if (x.id === cur) return;
                if (!x.installed) toast(t('Getting the theme...'));
                themeCall('/api/theme/set', { id: x.id }, update);
              },
            };
          });
        /* Holiday themes (the service's holiday themes: Halloween, Thanksgiving, the winter holidays...): during a holiday's dates its
           colours and effects go over the chosen theme, which comes back after */
        var hol = r.holidays || {};
        items.push({ sep: true });
        items.push({
          label: t('Holiday themes'),
          sub: hol.on ? (hol.active ? t('On, %s now').replace('%s', hol.name) : t('On')) : t('Off'),
          desc: t("A holiday's colours and frame go over your theme during its dates; yours comes back after."),
          stay: true,
          fn: function () {
            if (!hol.on) toast(t('Getting the holiday theme...'));
            themeCall('/api/theme/holidays', { on: !hol.on }, update);
          },
        });
        if (r.previous && r.previous.id) {
          items.push({ sep: true });
          items.push({
            icon: 'restore',
            label: t('Go back to the previous theme'),
            sub: name(r.previous.id),
            pv: (r.themes || []).some(function (x) {
              return x.id === r.previous.id && x.preview;
            })
              ? r.previous.id
              : '',
            desc: '',
            stay: true,
            fn: function () {
              themeCall('/api/theme/revert', {}, update);
            },
          });
        }
        return items;
      },
      update = function (r) {
        data = r;
        if (stack.length && stack[stack.length - 1].build === build) refreshMenu();
      };
    build();
    if (data.catalogue && !data.catalogue.ok) toast(t('Could not reach GitHub: showing the themes on this TV'));
    openBuilt(t('Theme'), build, at);
  });
}
function accentMenu() {
  themeList(function (data) {
    var at = 0,
      build = function () {
        var cur = (data.current && data.current.accent) || '';
        return (data.accents || []).map(function (a, i) {
          if (a.hex === cur) at = i;
          return {
            label: a.name === 'Theme default' ? t('Theme default') : t(a.name), // the other names are colours the service lists
            sub: a.hex === cur ? t('Selected') : '',
            stay: true,
            fn: function () {
              themeCall('/api/theme/set', { accent: a.hex }, update);
            },
          };
        });
      },
      update = function (r) {
        data = r;
        if (stack.length && stack[stack.length - 1].build === build) refreshMenu();
      };
    build();
    openBuilt(t('Accent colour'), build, at);
  });
}
function addButtonMenu() {
  var add = function (b) {
    cfg.topbar = topbar().concat([b]);
    saveCfg();
  };
  var items = PRESETS.filter(function (p) {
    return liveOn() || p.action !== 'live';
  }).map(function (p) {
    return {
      icon: p.icon,
      label: barLabel(p),
      stay: true,
      fn: function () {
        add(p);
        backMenu();
      },
    };
  });
  items.push({
    label: t('An app...'),
    stay: true,
    fn: function () {
      pickApp(t('Pick an app'), [], function (a) {
        add({ label: a.title, icon: 'grid', app: a.id });
        backMenu();
        backMenu();
      });
    },
  });
  openMenu(t('Add a button'), items);
}
function hiddenIds() {
  return (cfg.hidden || []).filter(function (id) {
    return apps.some(function (a) {
      return a.id === id;
    });
  });
}
function hiddenMenu() {
  openBuilt(t('Hidden apps'), function () {
    var h = hiddenIds();
    if (!h.length) return [{ note: t('No hidden apps. To hide one, hold OK on it on Home and choose Hide app.') }];
    var by = {};
    apps.forEach(function (a) {
      by[a.id] = a;
    });
    return [{ note: t('OK shows an app on Home again. Hold OK to uninstall it, where the TV allows that.') }].concat(
      h.map(function (id) {
        return {
          label: title(id),
          sub: by[id] && by[id].rm ? '' : t('part of the TV'),
          stay: true,
          fn: function () {
            unhideApp(id);
          },
          hold:
            by[id] && by[id].rm
              ? function () {
                  uninstallMenu(by[id]);
                }
              : null,
        };
      })
    );
  });
}
