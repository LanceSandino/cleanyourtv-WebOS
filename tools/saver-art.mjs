// The screensaver's materials (Style: Frame, saver.js), made here (our own work, under the project's licence) and written into app/ as
// WebP (Chromium 68 shows it). The frame itself is built on the TV from four mitred sides, lit by saver.js from its profile; these are
// what the sides and the mat are made of:
//   saver-wood-<kind>.webp   a board, 2048 x 96, the grain along it: growth rings that wander, fibres, pores, a little colour change
//   saver-metal-<kind>.webp  brushed metal, 2048 x 96
//   saver-paper.webp         the fine tooth of mat board, a tile laid over the mat at low opacity
//   saver-canvas.webp        a canvas weave, a tile laid over a photo (Finish: Canvas, Painting)
//   saver-linen.webp         linen, an opaque tile (Mat: Linen)
// Chrome draws each one pixel by pixel on a canvas (seeded noise, so they come out the same each time) and hands it back as WebP.
//   node tools/saver-art.mjs            all of them        node tools/saver-art.mjs wood-walnut   one
// Needs Google Chrome (set CHROME to its path when it is not found); nothing is installed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'app');
const chrome =
  process.env.CHROME ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p =>
    fs.existsSync(p)
  );
if (!chrome) {
  console.error('Chrome was not found: set CHROME to its path');
  process.exit(2);
}

// ---- what runs in the page: noise, then one function per material; each returns [r, g, b, a] (0-255) for a pixel ----
const PAGE = String.raw`
function noiseOf(seed) {
  var p = [], i, s = seed;
  for (i = 0; i < 256; i++) p[i] = i;
  for (i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; var j = s % (i + 1), t = p[i]; p[i] = p[j]; p[j] = t; }
  var G = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  /* gradient noise, about -1..1; px, py: the lattice repeats after that many cells (for tiles), 0 for never */
  function n2(x, y, px, py) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
    function g(ix, iy, dx, dy) {
      if (px) ix = ((ix % px) + px) % px;
      if (py) iy = ((iy % py) + py) % py;
      var h = G[p[(p[ix & 255] + iy) & 255] & 7];
      return h[0] * dx + h[1] * dy;
    }
    var a = g(xi, yi, xf, yf), b = g(xi + 1, yi, xf - 1, yf), c = g(xi, yi + 1, xf, yf - 1), d = g(xi + 1, yi + 1, xf - 1, yf - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41;
  }
  function fbm(x, y, oct, px, py) {
    var s = 0, a = 0.5, k;
    px = px || 0; py = py || 0;
    for (k = 0; k < oct; k++) { s += a * n2(x, y, px, py); x *= 2; y *= 2; px *= 2; py *= 2; a *= 0.5; }
    return s;
  }
  return { n2: n2, fbm: fbm };
}
function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
/* a board: rings across it that wander along it, the latewood darker with a sharp edge, fibres, pores, rays */
function wood(o) {
  var N = noiseOf(o.seed), M = noiseOf(o.seed + 11), E = hex(o.early), L = hex(o.late);
  return function (x, y) {
    /* the rings drift slowly along the board and their spacing changes a little: mostly straight grain, as on a moulding */
    var warp = N.fbm(x * 0.0007, y * 0.004 + 3.1, 3) * o.warp + M.fbm(x * 0.004, y * 0.03, 2) * 0.12;
    var t = (y + o.off) / o.ring + warp + N.fbm(x * 0.0004 + 5, y * 0.012, 2) * 1.2 + Math.sin(x * 0.0019 + N.n2(x * 0.0005, 1.7) * 2) * o.arch;
    var f = t - Math.floor(t);
    var late = sstep(0, 1, Math.pow(f, o.sharp)) * (1 - sstep(0.93, 1, f));
    var c = mix(E, L, late * o.contrast);
    /* fibres: long fine streaks along the grain, at two scales */
    var fib = N.fbm(x * 0.012, y * 1.1 + 9, 3) * o.fib + M.n2(x * 0.05, y * 3.1) * o.fib * 0.45,
      broad = M.fbm(x * 0.0015, y * 0.012 + 5, 2) * o.broad;
    var k = 1 + fib + broad;
    /* pores: short dark dashes along the grain, more in the late wood */
    var pn = M.n2(x * 0.07, y * 2.4 + 2);
    if (pn > o.poreT) k *= 1 - o.pore * Math.min(1, (pn - o.poreT) / 0.2) * (0.35 + late);
    if (o.ray) { var rn = N.n2(x * 0.018 + 40, y * 0.4); if (rn > 0.66) k *= 1 + o.ray * (rn - 0.66) / 0.34; }
    return [c[0] * k, c[1] * k, c[2] * k, 255];
  };
}
/* brushed metal: fine streaks along it, a little slow variation */
function metal(o) {
  var N = noiseOf(o.seed), C = hex(o.color);
  return function (x, y) {
    var k = 1 + N.fbm(x * 0.003, y * 2.4, 3) * 0.16 + N.n2(x * 0.02 + 7, y * 7) * 0.08 + N.fbm(x * 0.0008, y * 0.01, 2) * 0.1;
    return [C[0] * k, C[1] * k, C[2] * k, 255];
  };
}
/* the tooth of mat board: light and dark specks, mostly clear (a tile: the noise repeats every 256 px) */
function paper() {
  var N = noiseOf(21);
  return function (x, y) {
    var v = N.fbm(x / 1.6, y / 1.6, 2, 160, 160) * 0.7 + N.fbm(x / 6, y / 6, 2, 43, 43) * 0.3;
    var a = Math.min(1, Math.abs(v) * 1.8);
    return v > 0 ? [255, 255, 255, a * 13] : [60, 50, 40, a * 16];
  };
}
/* a canvas weave: threads over and under, uneven, mostly clear */
function canvasTile() {
  var N = noiseOf(5);
  return function (x, y) {
    /* the threads wander a little and are not all as thick: a woven cloth, not a grid */
    var jx = x + N.n2(x / 24, y / 24, 8, 8) * 1.2, jy = y + N.n2(x / 24 + 9, y / 24, 8, 8) * 1.2;
    var cx = ((jx % 4) + 4) % 4, cy = ((jy % 4) + 4) % 4, over = (Math.floor(jx / 4) + Math.floor(jy / 4)) % 2 === 0;
    var tx = Math.sin((cx / 4) * Math.PI), ty = Math.sin((cy / 4) * Math.PI);
    var h = (over ? tx * 0.75 + ty * 0.25 : ty * 0.75 + tx * 0.25) + N.fbm(x / 2, y / 2, 2, 96, 96) * 0.45;
    var light = (h - 0.5) * 2;
    return light > 0 ? [255, 250, 240, Math.min(1, light) * 46] : [40, 32, 24, Math.min(1, -light) * 58];
  };
}
/* linen: warm off-white, uneven threads both ways with slubs */
function linen() {
  var N = noiseOf(8), B = hex('#d9cfbc');
  return function (x, y) {
    var h = N.fbm(x / 64, y / 1.6, 3, 4, 160) * 0.5 + N.fbm(x / 1.6, y / 64 + 3, 3, 160, 4) * 0.5;
    var k = 1 + h * 0.16 + Math.sin((x * Math.PI) / 1.6) * Math.sin((y * Math.PI) / 1.6) * 0.04;
    return [B[0] * k, B[1] * k, B[2] * k, 255];
  };
}
function draw(w, h, fn, q) {
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  var g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, x, y, i = 0;
  for (y = 0; y < h; y++)
    for (x = 0; x < w; x++) {
      var px = fn(x, y);
      d[i++] = px[0]; d[i++] = px[1]; d[i++] = px[2]; d[i++] = px[3];
    }
  g.putImageData(im, 0, 0);
  document.getElementById('o').textContent = c.toDataURL('image/webp', q);
}
`;

// the woods: the colour of the early and the late wood of a ring, how far apart the rings are (px), how they wander, how open the grain is
const WOODS = {
  walnut: {
    early: '#654532',
    late: '#3a2519',
    ring: 12,
    warp: 0.5,
    arch: 0.12,
    sharp: 4,
    contrast: 0.6,
    fib: 0.16,
    broad: 0.12,
    poreT: 0.58,
    pore: 0.3,
    off: 13,
    seed: 3,
  },
  oak: {
    early: '#c6a479',
    late: '#9b7649',
    ring: 11,
    warp: 0.5,
    arch: 0.15,
    sharp: 5,
    contrast: 0.7,
    fib: 0.12,
    broad: 0.08,
    poreT: 0.5,
    pore: 0.32,
    ray: 0.1,
    off: 40,
    seed: 5,
  },
  teak: {
    early: '#a7733f',
    late: '#734a22',
    ring: 13,
    warp: 0.6,
    arch: 0.1,
    sharp: 4,
    contrast: 0.55,
    fib: 0.16,
    broad: 0.14,
    poreT: 0.6,
    pore: 0.25,
    off: 7,
    seed: 7,
  },
  ash: {
    early: '#ddcdb0',
    late: '#b39a75',
    ring: 12,
    warp: 0.5,
    arch: 0.15,
    sharp: 5,
    contrast: 0.65,
    fib: 0.09,
    broad: 0.06,
    poreT: 0.52,
    pore: 0.25,
    off: 61,
    seed: 9,
  },
  cherry: {
    early: '#9f5e3f',
    late: '#743c25',
    ring: 13,
    warp: 0.5,
    arch: 0.1,
    sharp: 4,
    contrast: 0.45,
    fib: 0.13,
    broad: 0.15,
    poreT: 0.7,
    pore: 0.15,
    off: 23,
    seed: 12,
  },
  grey: {
    early: '#9d978e',
    late: '#716c65',
    ring: 11,
    warp: 0.5,
    arch: 0.15,
    sharp: 5,
    contrast: 0.7,
    fib: 0.14,
    broad: 0.08,
    poreT: 0.5,
    pore: 0.32,
    ray: 0.06,
    off: 31,
    seed: 14,
  },
  black: {
    early: '#2c2a28',
    late: '#141312',
    ring: 11,
    warp: 0.5,
    arch: 0.15,
    sharp: 5,
    contrast: 0.8,
    fib: 0.2,
    broad: 0.06,
    poreT: 0.5,
    pore: 0.4,
    off: 52,
    seed: 16,
  },
};
const METALS = { brass: { color: '#a98b55', seed: 4 }, silver: { color: '#b7bbc0', seed: 6 } };

// what to make: name -> [width, height, the call that draws it, WebP quality]
const ART = {};
for (const k of Object.keys(WOODS)) ART['wood-' + k] = [2048, 96, `wood(${JSON.stringify(WOODS[k])})`, 0.88];
for (const k of Object.keys(METALS)) ART['metal-' + k] = [2048, 96, `metal(${JSON.stringify(METALS[k])})`, 0.86];
ART.paper = [256, 256, 'paper()', 0.9];
ART.canvas = [192, 192, 'canvasTile()', 0.9];
ART.linen = [256, 256, 'linen()', 0.9];

function render(id) {
  const [w, h, fn, q] = ART[id];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-saver-art-'));
  const html = path.join(tmp, 'a.html');
  fs.writeFileSync(
    html,
    `<!doctype html><html><body><pre id="o"></pre><script>${PAGE}\ndraw(${w}, ${h}, ${fn}, ${q});</script></body></html>`
  );
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--virtual-time-budget=60000', '--dump-dom', 'file://' + html], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const m = /data:image\/webp;base64,([A-Za-z0-9+/=]+)/.exec(r.stdout || '');
  if (!m) {
    console.error(id + ': Chrome did not draw it: ' + (r.stderr || r.stdout || '').slice(-300));
    process.exitCode = 1;
    return;
  }
  const out = path.join(OUT, 'saver-' + id + '.webp');
  fs.writeFileSync(out, Buffer.from(m[1], 'base64'));
  console.log(id + ': ' + path.relative(process.cwd(), out) + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
}

const only = process.argv[2];
for (const id of Object.keys(ART)) if (!only || id === only) render(id);
