// The screensaver frame's woods (Style: Frame, saver.js), cut from photographed wood: the diffuse (colour) maps of Poly Haven's
// textures, CC0 (public domain, https://polyhaven.com/license), not kept in the repository. Each wood is a board of 2048 x 96, the
// grain along it, written into app/ as WebP (Chromium 68 shows it): a band across the 2K texture (turned when its grain runs up and
// down), toned with a canvas filter for the woods that share a texture. The frame's sides are cut from this board on the TV.
//   node tools/saver-wood.mjs <folder>          all of them, from the 2K JPGs downloaded into <folder>
//   node tools/saver-wood.mjs <folder> oak      one
// The files, from https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/<asset>/<file>:
//   dark_wood/dark_wood_diff_2k.jpg  oak_veneer_01/oak_veneer_01_diff_2k.jpg  kitchen_wood/kitchen_wood_diff_2k.jpg
// It prints each board's average colour: saver.js MATERIAL keeps it as the colour under the board. Needs Google Chrome (set CHROME
// to its path when it is not found); nothing is installed.
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

// each wood: the texture, whether its grain runs up and down (turned to lie along the board), where the band starts (px from the
// top of the turned texture), and the canvas filter that tones it
const WOODS = {
  walnut: { src: 'dark_wood_diff_2k.jpg', turn: false, y: 900, filter: 'hue-rotate(10deg) saturate(0.5) brightness(0.92)' },
  cherry: { src: 'dark_wood_diff_2k.jpg', turn: false, y: 300, filter: 'hue-rotate(6deg) saturate(0.78) brightness(1.06)' },
  oak: { src: 'oak_veneer_01_diff_2k.jpg', turn: true, y: 620, filter: 'none' },
  teak: { src: 'oak_veneer_01_diff_2k.jpg', turn: true, y: 1400, filter: 'sepia(0.3) saturate(1.25) brightness(0.74) contrast(1.05)' },
  ash: { src: 'oak_veneer_01_diff_2k.jpg', turn: true, y: 1100, filter: 'saturate(0.55) brightness(1.24) contrast(0.95)' },
  grey: { src: 'kitchen_wood_diff_2k.jpg', turn: true, y: 820, filter: 'saturate(0.6) brightness(1.04)' },
  black: { src: 'oak_veneer_01_diff_2k.jpg', turn: true, y: 300, filter: 'saturate(0.12) contrast(1.45) brightness(0.3)' },
};
const W = 2048,
  H = 96,
  Q = 0.86;

// what runs in the page: the texture drawn turned and toned into the board, then the board as WebP and its average colour
const PAGE = `
function cut(src, turn, y, filter, w, h, q) {
  var im = new Image();
  im.onload = function () {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    g.filter = filter;
    if (turn) {
      /* a quarter turn: the texture's columns become the board's rows */
      g.translate(0, h);
      g.rotate(-Math.PI / 2);
      g.drawImage(im, y, 0, h, w, 0, 0, h, w);
    } else g.drawImage(im, 0, y, w, h, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, s = [0, 0, 0], n = d.length / 4;
    for (var i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
    var avg = '#' + s.map(function (v) { var x = Math.round(v / n).toString(16); return x.length < 2 ? '0' + x : x; }).join('');
    document.getElementById('o').textContent = avg + ' ' + c.toDataURL('image/webp', q);
  };
  im.src = src;
}
`;

function render(dir, id) {
  const o = WOODS[id],
    file = path.join(dir, o.src);
  if (!fs.existsSync(file)) {
    console.error(id + ': ' + o.src + ' is not in ' + dir);
    process.exitCode = 1;
    return;
  }
  const src = 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-saver-wood-'));
  const html = path.join(tmp, 'a.html');
  fs.writeFileSync(
    html,
    `<!doctype html><html><body><pre id="o"></pre><script>${PAGE}\ncut(${JSON.stringify(src)}, ${o.turn}, ${o.y}, ${JSON.stringify(
      o.filter
    )}, ${W}, ${H}, ${Q});</script></body></html>`
  );
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--virtual-time-budget=20000', '--dump-dom', 'file://' + html], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const m = /(#[0-9a-f]{6}) data:image\/webp;base64,([A-Za-z0-9+/=]+)/.exec(r.stdout || '');
  if (!m) {
    console.error(id + ': Chrome did not cut it: ' + (r.stderr || r.stdout || '').slice(-300));
    process.exitCode = 1;
    return;
  }
  const out = path.join(OUT, 'saver-wood-' + id + '.webp');
  fs.writeFileSync(out, Buffer.from(m[2], 'base64'));
  console.log(id + ': ' + path.relative(process.cwd(), out) + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB), average ' + m[1]);
}

const dir = process.argv[2],
  only = process.argv[3];
if (!dir || !fs.existsSync(dir)) {
  console.error('usage: node tools/saver-wood.mjs <folder with the Poly Haven 2K JPGs> [wood]');
  process.exit(2);
}
for (const id of Object.keys(WOODS)) if (!only || id === only) render(dir, id);
