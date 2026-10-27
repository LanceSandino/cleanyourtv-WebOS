// The holiday themes' frames (effects.overlay): one still, transparent picture per holiday, drawn here as SVG (our own drawing, under
// the project's licence) and rendered by Chrome into themes/<id>/frame.png at half size (960 x 540: the shapes are soft, and the TV
// draws it at 1920 x 1080). The SVG is kept next to it as the source. A frame is a mood over the background, the wallpaper and the
// photos: darker edges in the holiday's colour, soft out-of-focus shapes, and a few sharper ones in the corners, at low opacity, away
// from the clock and the buttons. Nothing moves: a still picture costs the TV nothing after it is drawn once.
//   node tools/holiday-art.mjs            all of them        node tools/holiday-art.mjs halloween   one
// Needs Google Chrome (set CHROME to its path when it is not found); nothing is installed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'themes');
const chrome =
  process.env.CHROME ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p =>
    fs.existsSync(p)
  );
if (!chrome) {
  console.error('Chrome was not found: set CHROME to its path');
  process.exit(2);
}

// a repeatable "random" so the pictures come out the same each time
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = n => Math.round(n * 10) / 10;

// ---- shapes ----
const bat = (x, y, w, rot, fill, op) =>
  `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(w / 64)})" opacity="${op}" fill="${fill}" d="M32 8c-2 0-3 2-3 4l-2-1c-4-5-12-8-20-8 4 3 6 7 5 11-3-2-7-2-10 0 5 1 9 4 11 8 5-3 11-4 16-2 1 2 2 3 3 3s2-1 3-3c5-2 11-1 16 2 2-4 6-7 11-8-3-2-7-2-10 0-1-4 1-8 5-11-8 0-16 3-20 8l-2 1c0-2-1-4-3-4z"/>`;
// a cobweb in a corner: spokes from the corner and sagging strands between them
function cobweb(cx, cy, dirX, dirY, r, stroke, op) {
  const spokes = 7,
    rings = [0.18, 0.32, 0.48, 0.66, 0.86];
  const ang = i => (Math.PI / 2) * (i / (spokes - 1));
  const pt = (i, k) => [cx + dirX * Math.cos(ang(i)) * r * k, cy + dirY * Math.sin(ang(i)) * r * k];
  let d = '';
  for (let i = 0; i < spokes; i++) {
    const [x, y] = pt(i, 1);
    d += `M${cx} ${cy}L${f(x)} ${f(y)}`;
  }
  for (const k of rings)
    for (let i = 0; i < spokes - 1; i++) {
      const [x1, y1] = pt(i, k),
        [x2, y2] = pt(i + 1, k),
        [mx, my] = pt(i + 0.5, k * 0.9);
      d += `M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
    }
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" opacity="${op}"/>`;
}
const spider = (x, len, op) =>
  `<g opacity="${op}" stroke="#0a1a1c" stroke-width="3" stroke-linecap="round" fill="#0a1a1c"><path d="M${x} 0V${len}" stroke-width="1.6" stroke="#9fd8cf"/>` +
  `<path fill="none" d="M${x - 9} ${len + 12}l-14-10m14 18l-18-2m18 10l-14 10M${x + 9} ${len + 12}l14-10m-14 18l18-2m-18 10l14 10"/>` +
  `<circle cx="${x}" cy="${len + 12}" r="11"/><circle cx="${x}" cy="${len + 30}" r="14"/><circle cx="${x - 4}" cy="${len + 9}" r="2.2" fill="#7dffb0" stroke="none"/><circle cx="${x + 4}" cy="${len + 9}" r="2.2" fill="#7dffb0" stroke="none"/></g>`;
function pumpkin(x, y, r, op) {
  const body = [-0.62, -0.3, 0, 0.3, 0.62]
    .map(
      k =>
        `<ellipse cx="${f(x + k * r)}" cy="${f(y)}" rx="${f(r * 0.42)}" ry="${f(r * 0.78)}" fill="url(#pk)" stroke="#8a3a08" stroke-width="2"/>`
    )
    .join('');
  const face =
    `<path fill="#ffe27a" d="M${f(x - r * 0.45)} ${f(y - r * 0.12)}l${f(r * 0.18)} ${f(-r * 0.25)} ${f(r * 0.18)} ${f(r * 0.25)}zM${f(x + r * 0.09)} ${f(y - r * 0.12)}l${f(r * 0.18)} ${f(-r * 0.25)} ${f(r * 0.18)} ${f(r * 0.25)}z` +
    `M${f(x - r * 0.5)} ${f(y + r * 0.2)}q${f(r * 0.5)} ${f(r * 0.45)} ${f(r)} 0l${f(-r * 0.16)} ${f(r * 0.1)} ${f(-r * 0.14)} ${f(-r * 0.12)} ${f(-r * 0.14)} ${f(r * 0.14)} ${f(-r * 0.14)} ${f(-r * 0.14)} ${f(-r * 0.14)} ${f(r * 0.12)}z"/>`;
  const stem = `<path d="M${f(x - r * 0.06)} ${f(y - r * 0.72)}q${f(r * 0.04)} ${f(-r * 0.3)} ${f(r * 0.22)} ${f(-r * 0.36)}" stroke="#3d5a1e" stroke-width="${f(r * 0.12)}" fill="none" stroke-linecap="round"/>`;
  return `<g opacity="${op}"><ellipse cx="${x}" cy="${f(y)}" rx="${f(r * 1.25)}" ry="${f(r * 0.9)}" fill="#ffb347" opacity="0.18" filter="url(#b12)"/>${stem}${body}${face}</g>`;
}
const leaf = (x, y, s, rot, fill, op, blur) =>
  `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s / 24)})" fill="${fill}" opacity="${op}"${blur ? ` filter="url(#${blur})"` : ''} d="M12 1C7 5 3 9 4 15c1 4 4 7 8 8 4-1 7-4 8-8 1-6-3-10-8-14zm0 4v17" stroke="rgba(0,0,0,.25)" stroke-width="0.8"/>`;
const heart = (x, y, s, fill, op, blur) =>
  `<path transform="translate(${f(x - s / 2)} ${f(y - s / 2)}) scale(${f(s / 24)})" fill="${fill}" opacity="${op}"${blur ? ` filter="url(#${blur})"` : ''} d="M12 21C5 15 1 11 1 6.5 1 3.4 3.4 1 6.5 1 8.6 1 10.6 2.2 12 4c1.4-1.8 3.4-3 5.5-3C20.6 1 23 3.4 23 6.5 23 11 19 15 12 21z"/>`;
const star = (x, y, r, fill, op, blur) =>
  `<path transform="translate(${f(x)} ${f(y)}) scale(${f(r / 12)})" fill="${fill}" opacity="${op}"${blur ? ` filter="url(#${blur})"` : ''} d="M0-12l3 8.6 9.2.4-7.2 5.6 2.6 8.8L0 6.2l-7.6 5.2 2.6-8.8-7.2-5.6 9.2-.4z"/>`;
function flake(x, y, r, op) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      ex = Math.cos(a) * r,
      ey = Math.sin(a) * r;
    d += `M${f(x)} ${f(y)}l${f(ex)} ${f(ey)}`;
    const bx = x + ex * 0.6,
      by = y + ey * 0.6;
    for (const s of [-1, 1]) {
      const b = a + (s * Math.PI) / 4;
      d += `M${f(bx)} ${f(by)}l${f(Math.cos(b) * r * 0.32)} ${f(Math.sin(b) * r * 0.32)}`;
    }
  }
  return `<path d="${d}" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="${op}"/>`;
}
const bokeh = (x, y, r, fill, op, blur) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" opacity="${op}" filter="url(#${blur || 'b8'})"/>`;
// a firework, still: thin rays out of a point
function burst(x, y, r, color, op) {
  let d = '';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2,
      r0 = r * 0.25;
    d += `M${f(x + Math.cos(a) * r0)} ${f(y + Math.sin(a) * r0)}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`;
  }
  return `<g opacity="${op}"><path d="${d}" stroke="${color}" stroke-width="3" stroke-linecap="round" filter="url(#b2)"/><circle cx="${x}" cy="${y}" r="${f(r * 0.9)}" fill="${color}" opacity="0.12" filter="url(#b24)"/></g>`;
}
// the darker edges in the holiday's colour, clear in the middle where Home's content is
const vignette = (rgb, a) =>
  `<radialGradient id="vg" cx="50%" cy="46%" r="75%"><stop offset="0.45" stop-color="rgb(${rgb})" stop-opacity="0"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="${a}"/></radialGradient><rect width="1920" height="1080" fill="url(#vg)"/>`;
const wash = (rgb, a) => `<rect width="1920" height="1080" fill="rgb(${rgb})" opacity="${a}"/>`;
const fog = (y, rgb, a) =>
  `<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity="0"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="${a}"/></linearGradient><rect y="${y}" width="1920" height="${1080 - y}" fill="url(#fg)"/>`;

const DEFS =
  '<defs>' +
  [2, 4, 8, 12, 18, 24, 36]
    .map(s => `<filter id="b${s}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${s}"/></filter>`)
    .join('') +
  '<radialGradient id="pk" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffb04a"/><stop offset="1" stop-color="#d8590c"/></radialGradient>' +
  '</defs>';

// ---- the frames ----
const FRAMES = {
  halloween() {
    // teal fog, a huge blurred clawed shadow reaching in from the top, soft bats, a cobweb, a spider and jack-o'-lanterns
    const claw =
      '<g opacity="0.42" filter="url(#b36)" fill="none" stroke="#021012" stroke-linecap="round">' +
      '<path d="M1180 -60C1150 120 1080 260 980 360" stroke-width="70"/><path d="M1300 -60C1300 140 1270 300 1200 430" stroke-width="64"/>' +
      '<path d="M1420 -40C1440 140 1440 290 1400 420" stroke-width="58"/><path d="M1540 0C1580 140 1600 250 1590 350" stroke-width="50"/>' +
      '<path d="M1360 -120C1380 -40 1400 20 1420 60" stroke-width="260"/></g>';
    let bats = '';
    for (const [x, y, w, r, o, b] of [
      [150, 300, 170, 12, 0.32, 'b8'],
      [260, 640, 210, -18, 0.26, 'b12'],
      [1640, 420, 190, 20, 0.3, 'b8'],
      [1500, 900, 230, -8, 0.22, 'b12'],
      [880, 120, 90, 6, 0.4, 'b4'],
      [1010, 170, 60, -10, 0.45, 'b2'],
    ])
      bats += `<g filter="url(#${b})">${bat(x, y, w, r, '#021315', o)}</g>`;
    return (
      wash('0,120,120', 0.14) +
      claw +
      bats +
      fog(760, '60,255,170', 0.1) +
      vignette('0,22,26', 0.82) +
      cobweb(0, 0, 1, 1, 330, '#bfe9e2', 0.32) +
      cobweb(1920, 1080, -1, -1, 260, '#bfe9e2', 0.18) +
      spider(250, 210, 0.75) +
      pumpkin(1735, 1010, 74, 0.85) +
      pumpkin(1850, 1040, 50, 0.8) +
      pumpkin(80, 1050, 46, 0.7)
    );
  },
  harvest() {
    let s = wash('120,60,10', 0.1) + vignette('30,14,4', 0.78);
    const cols = ['#d9662b', '#b8452a', '#e0a43a', '#8f3a1c'];
    for (let i = 0; i < 16; i++) {
      const left = i % 2 === 0,
        x = left ? rnd() * 300 : 1920 - rnd() * 320,
        y = left ? rnd() * 300 : 1080 - rnd() * 320;
      s += leaf(x, y, 40 + rnd() * 70, rnd() * 360, cols[i % 4], 0.35 + rnd() * 0.35, i % 3 ? 'b2' : 'b8');
    }
    for (let i = 0; i < 7; i++) s += leaf(rnd() * 1920, 900 + rnd() * 160, 30 + rnd() * 40, rnd() * 360, cols[i % 4], 0.22, 'b12');
    return s + pumpkin(1720, 1010, 70, 0.8) + pumpkin(1840, 1035, 48, 0.75);
  },
  'winter-holidays'() {
    let s = wash('20,60,90', 0.1);
    // a string of lights along the top edge: the wire, and a bulb with its glow hanging from it every 96 px
    const lights = ['#ff4d5a', '#ffd166', '#5ee08c', '#6fb7ff'],
      wy = x => 34 + Math.sin((x / 1920) * Math.PI * 4) * 16;
    let wire = 'M0 ' + f(wy(0));
    for (let x = 20; x <= 1920; x += 20) wire += 'L' + x + ' ' + f(wy(x));
    s += `<path d="${wire}" stroke="#123d28" stroke-width="5" fill="none" opacity="0.9"/>`;
    for (let i = 0; i < 20; i++) {
      const x = 48 + i * 96,
        y = wy(x) + 14,
        c = lights[i % 4];
      s +=
        bokeh(x, y + 4, 26, c, 0.45, 'b12') +
        `<rect x="${x - 4}" y="${f(y - 12)}" width="8" height="8" rx="2" fill="#2a3a30"/><ellipse cx="${x}" cy="${f(y + 4)}" rx="8" ry="12" fill="${c}" opacity="0.95"/>`;
    }
    for (let i = 0; i < 9; i++) s += bokeh(rnd() * 1920, rnd() * 1080, 30 + rnd() * 50, '#ffffff', 0.08, 'b24');
    s += fog(850, '235,245,255', 0.28) + vignette('6,20,30', 0.72);
    for (const [x, y, r, o] of [
      [120, 230, 40, 0.5],
      [230, 150, 22, 0.4],
      [1790, 260, 44, 0.45],
      [1700, 180, 20, 0.4],
      [90, 900, 30, 0.35],
      [1830, 880, 34, 0.35],
    ])
      s += flake(x, y, r, o);
    return s;
  },
  'new-year'() {
    let s = wash('20,20,60', 0.08);
    const golds = ['#f5c542', '#ffe08a', '#d4a017', '#ffffff'];
    for (let i = 0; i < 26; i++) {
      const edge = i % 4,
        x = edge === 0 ? rnd() * 260 : edge === 1 ? 1920 - rnd() * 260 : rnd() * 1920,
        y = edge < 2 ? rnd() * 1080 : edge === 2 ? rnd() * 160 : 1080 - rnd() * 160;
      s += bokeh(x, y, 8 + rnd() * 26, golds[i % 4], 0.35 + rnd() * 0.3, i % 3 ? 'b4' : 'b12');
    }
    s += burst(1720, 160, 150, '#f5c542', 0.55) + burst(200, 180, 110, '#ffe08a', 0.45);
    for (let i = 0; i < 18; i++) s += star(rnd() * 1920, rnd() * 1080, 4 + rnd() * 6, '#fff6d8', 0.35, 'b2');
    return s + vignette('5,5,20', 0.75);
  },
  valentines() {
    let s = wash('120,10,40', 0.08);
    const pinks = ['#ff5c8a', '#ff8fb1', '#e8335f', '#ffd1dc'];
    for (let i = 0; i < 18; i++) {
      const c = i % 4,
        x = c % 2 ? 1920 - rnd() * 340 : rnd() * 340,
        y = c < 2 ? rnd() * 320 : 1080 - rnd() * 320;
      s += heart(x, y, 30 + rnd() * 80, pinks[i % 4], 0.3 + rnd() * 0.35, i % 3 ? 'b4' : 'b12');
    }
    for (let i = 0; i < 8; i++) s += heart(rnd() * 1920, rnd() * 1080, 90 + rnd() * 120, '#ff5c8a', 0.06, 'b24');
    return s + vignette('30,4,14', 0.76);
  },
  'independence-day'() {
    let s =
      wash('10,20,60', 0.08) +
      burst(1700, 170, 170, '#ff4d5a', 0.5) +
      burst(1450, 110, 100, '#ffffff', 0.4) +
      burst(230, 160, 140, '#5b8cff', 0.5);
    // bunting along the top edge
    let flags = '';
    const cols = ['#c8102e', '#ffffff', '#1d3f8f'];
    for (let i = 0; i < 16; i++) {
      const x = 40 + i * 120,
        y = 18 + Math.sin(i * 0.9) * 6;
      flags += `<path d="M${x} ${f(y)}h100a50 50 0 0 1 -100 0z" fill="${cols[i % 3]}" opacity="0.55"/>`;
    }
    s += `<path d="M0 18Q480 40 960 18T1920 18" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.4"/>` + flags;
    for (let i = 0; i < 20; i++) s += star(rnd() * 1920, 140 + rnd() * 940, 5 + rnd() * 9, i % 3 ? '#ffffff' : '#ff4d5a', 0.3, 'b2');
    return s + vignette('4,8,24', 0.74);
  },
};

const only = process.argv[2];
for (const id of Object.keys(FRAMES)) {
  if (only && id !== only) continue;
  seed = 7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">${DEFS}${FRAMES[id]()}</svg>\n`;
  const dir = path.join(ROOT, id);
  fs.writeFileSync(path.join(dir, 'frame.svg'), svg);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-frame-'));
  const html = path.join(tmp, 'f.html');
  fs.writeFileSync(
    html,
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;width:960px;height:540px}</style></head><body><img src="file://${path.join(dir, 'frame.svg')}"></body></html>`
  );
  const out = path.join(dir, 'frame.png');
  const r = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--allow-file-access-from-files',
      '--window-size=960,540',
      '--screenshot=' + out,
      'file://' + html,
    ],
    { encoding: 'utf8', timeout: 60000 }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0 || !fs.existsSync(out)) {
    console.error(id + ': Chrome did not render it: ' + (r.stderr || '').slice(-300));
    process.exitCode = 1;
    continue;
  }
  console.log(id + ': ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
}
