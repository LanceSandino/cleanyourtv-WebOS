/* ---------- Up and Down: where the focus lands in the next row ---------- */
/* the index of the item whose centre is nearest to x (the first of two equally near ones) */
function nearest(xs, x) {
  var best = 0,
    bd = Infinity;
  for (var i = 0; i < xs.length; i++) {
    var d = Math.abs(xs[i] - x);
    if (d < bd - 0.5) {
      bd = d;
      best = i;
    }
  }
  return best;
}
/* Up or Down from item col of row `from` to row `to`: straight back to the item the focus came from when it returns at once (mem is the
   last move between rows), otherwise the item whose centre is nearest, so the focus lands on what is above or below it. xs holds the
   centres of the items of every row, as they are on the screen (a centred dock, a right-to-left layout). */
function landCol(xs, from, col, to, mem) {
  if (mem && mem.to === from && mem.toCol === col && mem.from === to && mem.col < xs[to].length) return mem.col;
  return nearest(xs[to], xs[from][col]);
}
/* the centres, read once after each rebuild (the rows only move then), and the last move between rows */
var rowXs = null,
  vmem = null;
function centres(list) {
  return list.map(function (e) {
    var b = e.getBoundingClientRect();
    return b.width ? b.left + b.width / 2 : NaN;
  });
}
function geoReset() {
  rowXs = null;
  vmem = null;
}
function vMove(to) {
  if (!rowXs) rowXs = rows.map(centres);
  var nc;
  /* a row that is not drawn (no top buttons) has no centres: spread the columns as before */
  if (isNaN(rowXs[r][c]) || rowXs[to].some(isNaN)) nc = mapCol(rows[r].length, rows[to].length, c);
  else nc = landCol(rowXs, r, c, to, vmem);
  vmem = { from: r, col: c, to: to, toCol: nc };
  setFocus(to, nc);
}

/* ---------- tile.focus glass and grid.label focus: a lit plate behind the focused tile, gliding from tile to tile, and the name of the
   focused grid tile under it. One plate lives in the dock and one in the grid, so each moves with its row (scrolling, a centred dock);
   they move with transform only. The places of the tiles are read once per rebuild. ---------- */
var deco = { gd: null, gg: null, cap: null },
  geoGen = 0;
function decoEl(cls) {
  var d = document.createElement('div');
  d.className = cls;
  return d;
}
/* after a theme is applied: make or drop the elements the theme uses */
function decoTheme() {
  var want = { gd: TH.glass, gg: TH.glass, cap: TH.label };
  for (var k in want) {
    if (want[k] && !deco[k]) deco[k] = decoEl(k === 'cap' ? 'cap' : 'glass');
    else if (!want[k] && deco[k]) {
      deco[k].remove();
      deco[k] = null;
    }
  }
  geoGen++;
  showName.side = 0;
  var n2 = $('name2');
  if (!TH.motion) {
    if (n2) n2.remove();
    $('name').className = '';
  } else if (!n2) {
    n2 = document.createElement('div');
    n2.id = 'name2';
    $('shelf').appendChild(n2);
  }
  tick(); /* the time as the theme writes it (clock.ampm) at once, not at the next quarter minute */
}
/* a rebuild emptied the dock and the grid: put the plates and the caption back, and read the places again */
function decoRebuild() {
  geoGen++;
  if (deco.gd) $('dock').appendChild(deco.gd);
  if (deco.gg) $('grid').appendChild(deco.gg);
  if (deco.cap) $('grid').appendChild(deco.cap);
  for (var k in deco) if (deco[k]) deco[k]._on = false;
}
/* the centre and bottom of every tile in its row's box, and the size of the plates (one layout read per rebuild) */
function measure() {
  for (var i = 1; i < rows.length; i++)
    for (var j = 0; j < rows[i].length; j++) {
      var e = rows[i][j];
      e._g = { x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + e.offsetHeight / 2, b: e.offsetTop + e.offsetHeight };
      e._gen = geoGen;
    }
  for (var k in deco) if (deco[k]) deco[k]._sz = [deco[k].offsetWidth, deco[k].offsetHeight];
}
function geo(e) {
  if (e._gen !== geoGen) measure();
  return e._g;
}
/* move an element to x, y; when it was hidden it appears there without travelling from its last place */
function glideTo(el, x, y, first) {
  var tr = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  if (el._on && !first) {
    el.style.transform = tr;
    return;
  }
  el.classList.add('jump');
  el.style.transform = tr;
  void el.offsetWidth;
  el.classList.remove('jump');
  el.classList.add('on');
  el._on = true;
}
function hide(el) {
  if (el && el._on) {
    el.classList.remove('on');
    el._on = false;
  }
}
function decorate(e, first) {
  if (!TH.glass && !TH.label) return;
  var tile = e.classList.contains('tile') ? e.parentNode : null,
    inDock = !!tile && tile.id === 'dock',
    inGrid = !!tile && tile.id === 'grid',
    g = tile ? geo(e) : null;
  if (TH.glass) {
    var on = inDock ? deco.gd : inGrid ? deco.gg : null;
    hide(inDock ? deco.gg : deco.gd);
    if (!inDock && !inGrid) hide(deco.gg);
    if (on) glideTo(on, g.x - on._sz[0] / 2, g.y - on._sz[1] / 2, first);
  }
  if (TH.label) {
    if (inGrid) {
      var t = e._a ? e._a.title : '';
      if (deco.cap.textContent !== t) deco.cap.textContent = t;
      glideTo(deco.cap, g.x, g.b, first);
    } else hide(deco.cap);
  }
}

/* ---------- the large name of the focused app (shelf.motion): two layers take turns, the new name comes in as the old one goes ---------- */
function showName(nm) {
  var a = $('name');
  if (!TH.motion) {
    if (a.textContent !== nm) a.textContent = nm;
    return;
  }
  var b = $('name2'),
    cur = showName.side ? b : a,
    next = showName.side ? a : b;
  if (cur.textContent === nm && cur.className === 'nm-in') return;
  next.textContent = nm;
  next.className = 'nm-in';
  cur.className = 'nm-out';
  showName.side = showName.side ? 0 : 1;
}
