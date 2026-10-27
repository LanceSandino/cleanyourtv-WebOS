// The launcher's own logic that needs no browser (app/src/js): where Up and Down land, the clock's AM/PM and the greeting. Each function
// is taken from its source file as the page has it.
const fs = require('fs'),
  path = require('path');
const { root, ok, run } = require('./lib');

// the text of "function <name>(...) {...}" in an app/src/js file
function source(file, name) {
  const src = fs.readFileSync(path.join(root, 'app', 'src', 'js', file), 'utf8'),
    at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error(name + ' is not in ' + file);
  let i = src.indexOf('{', at),
    depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(name + ' has no end');
}
// functions from a file, together, as one scope (one can call another)
function load(file, names, extra) {
  return new Function((extra || '') + names.map(n => source(file, n)).join('\n') + '\nreturn {' + names.join(',') + '};')();
}

run(async () => {
  // ---- Up and Down (focus.js) ----
  const F = load('focus.js', ['nearest', 'landCol']);
  // Classic: four 408 px dock tiles 32 px apart and ten grid tiles of 151 px, 24 px apart, both from x 96
  const dock = [0, 1, 2, 3].map(i => 96 + i * 440 + 204),
    grid = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => 96 + i * 175.2 + 75.6),
    last = [0, 1, 2].map(i => 96 + i * 175.2 + 75.6),
    bar = [1080, 1270, 1460, 1700];
  const xs = [bar, dock, grid, grid, last];
  ok(
    F.nearest([10, 20, 30], 21) === 1 && F.nearest([10, 20, 30], 15) === 0 && F.nearest([], 5) === 0,
    'nearest: the closest centre wins, a tie the first'
  );
  ok(F.landCol(xs, 1, 0, 2, null) === 1, 'Down from the first dock app lands on the grid tile under its centre');
  ok(F.landCol(xs, 2, 8, 1, null) === 3 && F.landCol(xs, 2, 7, 1, null) === 2, 'Up from the grid lands on the dock app above the tile');
  const mem = { from: 2, col: 8, to: 1, toCol: 3 };
  ok(
    F.landCol(xs, 1, 3, 2, mem) === 8,
    'Down again at once goes back to column 8, where the focus came from (proportional columns gave 9)'
  );
  ok(F.landCol(xs, 1, 2, 2, mem) === 6, 'after a move along the dock, Down takes the nearest tile again');
  ok(F.landCol(xs, 3, 4, 4, null) === 2, 'Down from column 4 to a last row of three lands on its last tile');
  ok(F.landCol(xs, 4, 1, 3, null) === 1, 'Up from the second tile of a short last row stays in column 1 (proportional columns gave 5)');
  ok(F.landCol(xs, 1, 3, 0, null) === 3, 'Up from the last dock app lands on the top button above it');
  ok(F.landCol(xs, 1, 0, 2, { from: 2, col: 9, to: 1, toCol: 0 }) === 9, 'the remembered column wins over the nearest one');
  const input = fs.readFileSync(path.join(root, 'app', 'src', 'js', 'input.js'), 'utf8');
  ok(
    /k === 38 && r > 0\) vMove\(r - 1\)/.test(input) && /k === 40 && r < rows\.length - 1\) vMove\(r \+ 1\)/.test(input),
    'the arrow keys move between rows with vMove'
  );
  ok(
    /function rebuild\(\) \{\s*geoReset\(\);/.test(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'layout.js'), 'utf8')),
    'a rebuild measures the rows again'
  );
});
