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
