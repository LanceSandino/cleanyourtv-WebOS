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

  // ---- the clock (clock.js): AM/PM apart for clock.ampm small, and the greeting by the hour ----
  const C = load('clock.js', ['splitTime', 'greetPart', 'greeting'], 'var t = function (s) { return "<" + s + ">"; };\n');
  const P = (a, b) => a.map((v, i) => ({ type: b[i], value: v }));
  const us = C.splitTime(P(['9', ':', '49', ' ', 'PM'], ['hour', 'literal', 'minute', 'literal', 'dayPeriod'])),
    old = C.splitTime(P(['9', ':', '49', ' ', 'PM'], ['hour', 'literal', 'minute', 'literal', 'dayperiod'])),
    ko = C.splitTime(P(['오후', ' ', '9', ':', '49'], ['dayPeriod', 'literal', 'hour', 'literal', 'minute'])),
    h24 = C.splitTime(P(['21', ':', '49'], ['hour', 'literal', 'minute']));
  ok(
    us.join('|') === '9:49|PM|false' && old.join('|') === '9:49|PM|false',
    'AM/PM is split from the time (also as Chromium 68 names the part, "dayperiod")'
  );
  ok(ko.join('|') === '9:49|오후|true', 'a day period that comes first (Korean) is marked so');
  ok(h24.join('|') === '21:49||false', 'a 24-hour time has no day period');
  ok(
    [0, 4, 5, 11, 12, 17, 18, 21, 22, 23].map(C.greetPart).join(' ') ===
      'night night morning morning afternoon afternoon evening evening night night',
    'the greeting: night from 22:00 to 4:59, morning to 12, afternoon to 18, then evening'
  );
  ok(
    C.greeting(23) === '<Good night>' &&
      C.greeting(9, 'Sam') === '<Good morning, %s>'.replace('%s', 'Sam') &&
      C.greeting(2, 'Sam') === '<Good night, %s>'.replace('%s', 'Sam'),
    'the greeting is translated, with the name in its place'
  );
  const en = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'en.json'), 'utf8')),
    langs = fs.readdirSync(path.join(root, 'i18n')).filter(f => /^[a-z]{2}\.json$/.test(f));
  ok(
    en['Good night'] &&
      langs.every(f => {
        const L = JSON.parse(fs.readFileSync(path.join(root, 'i18n', f), 'utf8'));
        return L['Good night'] && L['Good night, %s'] && L['Good night, %s'].indexOf('%s') >= 0;
      }),
    'Good night is translated in every language (' + langs.length + ')'
  );

  // ---- a grid of wide tiles (Glass) keeps a padded icon at its size, as the dock does, instead of stretching it over the tile ----
  const FT = load('colour.js', ['fit']);
  const fakeTile = () => {
    const cls = [];
    return {
      _i: { style: {}, removeAttribute() {} },
      _col: { k: 'pad', box: [0.1, 0.1, 0.9, 0.9] },
      classList: { remove() {}, add: c => cls.push(c) },
      style: {},
      cls,
    };
  };
  const wideT = fakeTile(),
    squareT = fakeTile();
  FT.fit(wideT, true);
  FT.fit(squareT, false);
  ok(
    wideT.cls.indexOf('fill') < 0 && wideT._i.style.width === 'auto' && squareT.cls.indexOf('fill') >= 0,
    'a padded icon fills a square grid tile, and keeps its size on a wide one'
  );
  const tsrc = fs.readFileSync(path.join(root, 'app', 'src', 'js', 'theme.js'), 'utf8');
  ok(
    /wide: tw \/ \(t\.tileH \|\| 151\) > 1\.5/.test(tsrc) &&
      /fit\(t, TH\.wide\)/.test(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'layout.js'), 'utf8')) &&
      /\|\| TH\.wide\)/.test(fs.readFileSync(path.join(root, 'app', 'src', 'js', 'tiles.js'), 'utf8')),
    'grid tiles more than 1.5 times as wide as tall count as wide, when they are drawn and when their icon loads'
  );

  // ---- focus.css: the theme options animate only transform and opacity (the TV's GPU is weak) ----
  const fcss = fs.readFileSync(path.join(root, 'app', 'src', 'css', 'focus.css'), 'utf8'),
    moved = [];
  const flat = v => {
    let x = v;
    while (/\([^()]*\)/.test(x)) x = x.replace(/\([^()]*\)/g, '');
    return x;
  };
  (fcss.match(/transition:[^;]*;/g) || []).forEach(tr =>
    flat(tr.replace(/^transition:|;$/g, ''))
      .split(',')
      .forEach(part => {
        const prop = part.trim().split(/\s+/)[0];
        if (prop && ['transform', 'opacity', 'none'].indexOf(prop) < 0) moved.push(prop);
      })
  );
  (fcss.match(/@keyframes[^{]*\{([^{}]*\{[^}]*\})*\s*\}/g) || []).forEach(k =>
    (k.match(/([a-z-]+)\s*:/g) || []).forEach(p => {
      if (['transform:', 'opacity:'].indexOf(p.replace(/\s+/g, '')) < 0) moved.push(p);
    })
  );
  ok(!moved.length, 'focus.css animates only transform and opacity' + (moved.length ? ': ' + moved.join(', ') : ''));
  ok(
    /\.snap \.glass/.test(fcss) && /\.snap \.cap/.test(fcss) && /\[data-shelfm\]\.snap \.nm-in/.test(fcss),
    'the plate, the name under a tile and the large name do not animate while an arrow key is held'
  );
  ok(
    (fcss.match(/calc\([0-9.]+s \* var\(--spd\)\)/g) || []).length >= 8 &&
      !/[^(]\b0?\.\d+s\b(?! \*)/.test(fcss.replace(/calc\([^)]*\)/g, '')),
    'every duration follows the theme speed (effects.speed)'
  );

  // ---- the dock (config.js): a theme with room for more apps than the saved dock fills it with the most used ones ----
  const D = load(
    'config.js',
    ['dockIds', 'byOrder', 'isHidden'],
    "var cfg = { dock: ['a', 'b', 'c', 'd'], hidden: ['h'] }, TH = { dockN: 5 }, DEFAULTS = { dock: [] }," +
      ' usage = { e: 9, h: 50, f: 3, g: 1 },' +
      " apps = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }, { id: 'd', title: 'D' }, { id: 'e', title: 'E' }," +
      " { id: 'f', title: 'F' }, { id: 'g', title: 'G' }, { id: 'h', title: 'H' }, { id: 'HDMI_1', title: 'PS5', input: 'hdmi' }," +
      " { id: '__live', title: 'Live TV' }];"
  );
  ok(
    D.dockIds().join() === 'a,b,c,d,e',
    'four saved dock apps in a five-app dock: the most used other app fills the fifth (not hidden, an input or Live TV)'
  );
});
