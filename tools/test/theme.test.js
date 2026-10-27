// Themes (theme.js): the repository's themes/ folder is valid, values are checked and clamped, extends works, a theme is downloaded
// from GitHub (a local stand-in here) when chosen and kept, a bad download is refused, and the service ships none.
const fs = require('fs'),
  path = require('path');
const { root, tmp, ok, call, serve, req, memoryConfig, run } = require('./lib');
const nc = req('netcompat');

run(async () => {
  const themeMod = req('theme'),
    tdir = path.join(root, 'themes');
  const folders = fs.readdirSync(tdir).filter(n => fs.statSync(path.join(tdir, n)).isDirectory());
  ok(folders.length >= 5 && folders.indexOf('classic') >= 0, 'the themes folder holds one folder per theme');
  const known = new Set(themeMod.SCHEMA.map(r => r[0])),
    unknownKeys = [];
  const walk = (o, pre) => {
    for (const k of Object.keys(o)) {
      const key = pre ? pre + '.' + k : k;
      if (key === 'slots') continue; // a list, checked by themeschema.slots
      if (key === 'holiday' && themeMod.holidayOf(o[k])) continue; // a holiday theme's dates (MM-DD), checked by holidayOf
      if (o[k] && typeof o[k] === 'object') walk(o[k], key);
      else if (!known.has(key) && ['name', 'author', 'description', 'extends'].indexOf(key) < 0) unknownKeys.push(key);
    }
  };
  let allOk = true;
  const tbad = [];
  for (const id of folders) {
    const fd = path.join(tdir, id);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(fd, 'theme.json'), 'utf8'));
    } catch (e) {
      allOk = false;
      tbad.push(id + ': theme.json');
      continue;
    }
    const t = themeMod.normalize(raw, id, null, fd);
    walk(raw, '');
    if (!t || (raw.effects && raw.effects.wallpaper && t.v['effects.wallpaper'] !== raw.effects.wallpaper)) {
      allOk = false;
      tbad.push(id + ': theme or wallpaper');
    }
    const pv = ['jpg', 'png', 'webp'].map(x => path.join(fd, 'preview.' + x)).filter(f => fs.existsSync(f))[0];
    if (!pv || !themeMod.imageOk(fs.readFileSync(pv), pv, 600 * 1024)) {
      allOk = false;
      tbad.push(id + ': screenshot (preview.jpg, an image of at most 600 KB)');
    }
  }
  ok(allOk, 'every theme folder has a valid theme.json, its wallpaper and a screenshot' + (tbad.length ? ': ' + tbad.join('; ') : ''));
  ok(unknownKeys.length === 0, 'theme files use only keys of the schema' + (unknownKeys.length ? ': ' + unknownKeys.join(', ') : ''));
  ok(
    fs.readFileSync(path.join(tdir, 'index.json'), 'utf8') === require(path.join(root, 'tools', 'theme-index.js')).build(),
    'themes/index.json is up to date (run: node tools/theme-index.js)'
  );
  ok(
    themeMod.SCHEMA.every(r => ['name', 'author', 'description', 'extends'].indexOf(r[0].split('.')[0]) < 0),
    "no setting group shares a name with the theme's own fields (name, author, description, extends)"
  );
  const bad = themeMod.normalize(
    {
      name: 'x'.repeat(500),
      colors: { night: 'red; background:url(//evil)', ink: '#12345', accent: 5 },
      grid: { cols: 99, tileH: -5, radius: 1e9, mode: 'sideways', align: 'middle' },
      type: { scale: '2', font: 'comic' },
      clock: { layout: 'sideways', scale: 50 },
      effects: { glow: 7, speed: NaN, wallpaper: '../../etc/passwd', wallpaperDim: 5 },
      css: 'body{display:none}',
    },
    'evil'
  );
  ok(
    bad.name.length === 40 &&
      bad.v['colors.night'] === '#07080b' &&
      bad.v['colors.ink'] === '#f5f6f8' &&
      bad.v['colors.accent'] === '#f5f6f8',
    'colours must be #rrggbb, anything else falls back'
  );
  ok(
    bad.v['grid.cols'] === 14 &&
      bad.v['grid.tileH'] === 80 &&
      bad.v['grid.radius'] === 100 &&
      bad.v['grid.mode'] === 'below' &&
      bad.v['grid.align'] === 'left' &&
      bad.v['type.scale'] === 1 &&
      bad.v['type.font'] === 'default' &&
      bad.v['clock.layout'] === 'inline' &&
      bad.v['clock.scale'] === 2.5,
    'numbers are clamped, enums and types are checked'
  );
  ok(
    bad.v['effects.glow'] === 1 &&
      bad.v['effects.speed'] === 1 &&
      bad.v['effects.wallpaper'] === '' &&
      bad.v['effects.wallpaperDim'] === 0.9 &&
      !('css' in bad.v),
    'effects are clamped, a wallpaper path is refused and unknown keys are dropped'
  );
  ok(themeMod.normalize({}, '../x') === null, 'a bad theme id is refused');
  // clock.greeting and dock.tileAlpha: a stacked greeting over the clock and a see-through dock
  const glass = themeMod.resolve(themeMod.normalize({ clock: { layout: 'stack', greeting: true }, dock: { tileAlpha: 0.3 } }, 'glass'));
  ok(
    glass.vars['--greet-d'] === 'block' && glass.vars['--dock-tile-alpha'] === '0.3' && glass.attrs.clock === 'stack',
    'clock.greeting shows the greeting and dock.tileAlpha makes the dock tiles see-through'
  );
  const plain = themeMod.resolve(themeMod.normalize({}, 'plain'));
  ok(
    plain.vars['--greet-d'] === 'none' && plain.vars['--dock-tile-alpha'] === '1',
    'by default there is no greeting and the dock tiles are opaque'
  );
  // settings added for the Glass theme (focus plate, name under a tile, name motion, clock typography, centred glow, pill sheen, dock
  // panel colour, header fade): each reaches the launcher, a bad value falls back, and a theme that does not use them gets a reply
  // without them, so the existing themes look and answer exactly as before
  const LATER_VARS = ['--clock-wt', '--name-wt', '--pill-sheen', '--dock-panel-rgb'],
    LATER_ATTRS = ['datecaps', 'divider', 'ampm', 'shelfm', 'label', 'hdr', 'focus', 'glow', 'dockpanel'];
  const later = themeMod.resolve(
    themeMod.normalize(
      {
        colors: { pill: '#ff0000', dockPanel: '#141417' },
        surface: { pillGloss: 0.2 },
        clock: { weight: 300, dateCaps: true, divider: true, ampm: 'small' },
        shelf: { weight: 300, motion: 'slide' },
        dock: { panel: 0.9 },
        grid: { label: 'focus', header: 'fade' },
        tile: { focus: 'glass' },
        effects: { glowShape: 'center' },
      },
      'later'
    )
  );
  ok(
    later.vars['--clock-wt'] === '300' &&
      later.vars['--name-wt'] === '300' &&
      later.vars['--dock-panel-rgb'] === '20,20,23' &&
      later.attrs.dockpanel === 'on' &&
      later.vars['--dock-panel'] === '0.9' &&
      later.vars['--pill-sheen'] === 'linear-gradient(180deg,rgba(255,0,0,0.2),rgba(255,0,0,0) 75%)' &&
      later.attrs.datecaps === 'on' &&
      later.attrs.divider === 'on' &&
      later.attrs.ampm === 'small' &&
      later.attrs.shelfm === 'slide' &&
      later.attrs.label === 'focus' &&
      later.attrs.hdr === 'fade' &&
      later.attrs.focus === 'glass' &&
      later.attrs.glow === 'center',
    'the focus plate, the name under a tile and its motion, the clock typography, the centred glow, the pill sheen, the dock panel colour and the header fade reach the launcher'
  );
  const laterBad = themeMod.normalize(
    {
      colors: { dockPanel: 'black' },
      surface: { pillGloss: 3 },
      clock: { weight: 1200, ampm: 'tiny', divider: 'yes' },
      shelf: { motion: 'spin' },
      grid: { label: 'all', header: 'hide' },
      tile: { focus: 'neon' },
      effects: { glowShape: 'square' },
    },
    'laterbad'
  );
  ok(
    laterBad.v['colors.dockPanel'] === null &&
      laterBad.v['surface.pillGloss'] === 0.5 &&
      laterBad.v['clock.weight'] === 900 &&
      laterBad.v['clock.ampm'] === 'inline' &&
      laterBad.v['clock.divider'] === false &&
      laterBad.v['shelf.motion'] === 'none' &&
      laterBad.v['grid.label'] === 'none' &&
      laterBad.v['grid.header'] === 'keep' &&
      laterBad.v['tile.focus'] === 'ring' &&
      laterBad.v['effects.glowShape'] === 'top',
    'the new settings are clamped and checked like the others'
  );
  const untouched = [];
  for (const id of folders) {
    if (id === 'glass') continue;
    const fd = path.join(tdir, id),
      rv = themeMod.resolve(themeMod.normalize(JSON.parse(fs.readFileSync(path.join(fd, 'theme.json'), 'utf8')), id, null, fd));
    if (LATER_VARS.some(k => k in rv.vars) || LATER_ATTRS.some(k => k in rv.attrs)) untouched.push(id);
  }
  ok(
    !untouched.length && !LATER_VARS.some(k => k in plain.vars) && !LATER_ATTRS.some(k => k in plain.attrs),
    'the themes that do not use the new settings resolve without them (their look and reply are unchanged)' +
      (untouched.length ? ': ' + untouched.join(', ') : '')
  );
  // slots for cards: checked and clamped, placed like the clock, kept by a theme that extends it, and only in replies of themes with slots
  const slotted = themeMod.normalize(
    {
      slots: [
        { id: 'greeting', anchor: 'top', align: 'left', x: 102, y: 70, w: 900, h: 26, card: 'greeting', grid: 'keep' },
        { id: 'side', align: 'right', w: 99999, card: 'Bad Type!' },
        { id: 'side', align: 'center' },
        { id: '../x' },
        { id: 'mid', align: 'center', anchor: 'bottom', x: 300, y: 40 },
      ],
    },
    'slotted'
  );
  const rs = themeMod.resolve(slotted).slots;
  ok(
    rs.length === 3 &&
      rs[0].l === '102px' &&
      rs[0].t === '70px' &&
      rs[0].w === '900px' &&
      rs[0].card === 'greeting' &&
      rs[0].keep === true &&
      rs[1].r === '96px' &&
      rs[1].w === '1920px' &&
      rs[1].card === '' &&
      rs[1].keep === false &&
      rs[2].l === '50%' &&
      rs[2].b === '40px' &&
      rs[2].tx === 'translateX(-50%)',
    'theme slots are checked, clamped and placed (a duplicate or bad id is dropped)'
  );
  ok(
    themeMod.resolve(themeMod.normalize({ name: 'kid' }, 'kid2', slotted.v)).slots.length === 3 &&
      !('slots' in themeMod.resolve(themeMod.normalize({ slots: [] }, 'none2', slotted.v))) &&
      !('slots' in plain),
    'a theme that extends one with slots keeps them, "slots": [] removes them, and a theme without slots has no slots key'
  );
  const cardsShape = req('cards');
  const cs = cardsShape.sanitize({
    greeting: { type: 'greeting', name: 'Salih', x: { deep: { deeper: 1 } } },
    side: { type: 'ha-entities', entities: ['light.a', { entity: 'sensor.b', name: 'B' }, { nested: { no: 1 } }] },
    'Bad Id': { type: 'greeting' },
    row: { type: 'Not Valid' },
    empty: { type: 'none' },
  });
  ok(
    JSON.stringify(cs) ===
      JSON.stringify({
        greeting: { type: 'greeting', name: 'Salih' },
        side: { type: 'ha-entities', entities: ['light.a', { entity: 'sensor.b', name: 'B' }, {}] },
        empty: { type: 'none' },
      }) && cardsShape.sanitize([]) === undefined,
    'cards from the launcher are checked for shape: slot ids, card types, short option values'
  );
  const tbase = themeMod.normalize({ grid: { cols: 7 }, dock: { count: 6 } }, 'base'),
    tkid = themeMod.normalize({ grid: { cols: 'many' }, bar: { style: 'round' } }, 'kid', tbase.v);
  ok(
    tkid.v['grid.cols'] === 7 && tkid.v['dock.count'] === 6 && tkid.v['bar.style'] === 'round',
    'a theme that extends another keeps its values where its own are missing or invalid'
  );

  // a stand-in for raw.githubusercontent.com: the repository's folder, plus a few themes that are wrong on purpose
  const tWrong = {
    kid: JSON.stringify({ name: 'Kid', extends: 'bloom', bar: { style: 'flat' } }),
    notjson: '{ this is not json',
    huge: JSON.stringify({ name: 'x'.repeat(40000) }),
    badwall: JSON.stringify({ name: 'Bad wallpaper', effects: { wallpaper: 'w.jpg' } }),
    orphan: JSON.stringify({ name: 'Orphan', extends: 'missing-base' }),
    pixkid: JSON.stringify({ name: 'Pixel kid', extends: 'pixel', dock: { count: 4 } }),
    badfont: JSON.stringify({ name: 'Bad typeface', type: { fontFile: 'f.woff2' } }),
  };
  let ghUp = true;
  const ghHits = [];
  const gh = await serve((q, r) => {
    const u = q.url.split('?')[0];
    ghHits.push(u);
    const send = (c, b, t) => {
      r.writeHead(c, { 'content-type': t || 'application/octet-stream' });
      r.end(b);
    };
    if (!ghUp) return q.socket.destroy();
    let m = /^\/themes\/([a-z0-9-]+)\/theme\.json$/.exec(u);
    if (m && tWrong[m[1]]) return send(200, tWrong[m[1]]);
    if (/^\/themes\/badwall\/w\.jpg$/.test(u)) return send(200, Buffer.from('this is not a jpeg at all, just text'));
    if (/^\/themes\/badfont\/f\.woff2$/.test(u)) return send(200, Buffer.from('this is not a font file, only some text'));
    const f = path.join(root, u);
    if (!f.startsWith(tdir + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'no');
    send(200, fs.readFileSync(f));
  });
  const tlocal = path.join(tmp, 'themes-local');
  nc.mkdirp(path.join(tlocal, 'wallpapers'));
  fs.writeFileSync(path.join(tlocal, 'old.json'), '{}');
  fs.writeFileSync(path.join(tlocal, 'wallpapers', 'x.jpg'), 'x');
  process.env.CYTV_THEMES = tlocal;
  process.env.CYTV_THEMES_URL = gh.url + '/themes';
  const th = themeMod.create({ config: memoryConfig(), noStartup: true });
  ok(
    !fs.existsSync(path.join(tlocal, 'old.json')) && !fs.existsSync(path.join(tlocal, 'wallpapers')),
    'the files of the earlier layout (themes shipped with the service) are removed'
  );
  const tcall = (act, body, method) => call(th, '/api/theme/' + act, method || 'POST', body);
  let r = await tcall('list', null, 'GET');
  ok(
    r.j.current.id === 'classic' && r.j.themes.length === folders.length && r.j.themes[0].id === 'classic' && r.j.catalogue.ok === true,
    'the list comes from themes/index.json on GitHub, Classic first'
  );
  const rb = r.j.themes.filter(x => x.id === 'bloom')[0];
  ok(
    rb && rb.installed === false && rb.preview === true && /flower/i.test(rb.description),
    'a theme that is not on the TV is listed with its description and screenshot'
  );
  const rv = th.resolved();
  ok(
    rv.vars['--cols'] === '10' &&
      rv.vars['--tile-h'] === '151px' &&
      rv.vars['--acc'] === '#f5f6f8' &&
      rv.vars['--view-top'] === '300px' &&
      rv.vars['--dock-t'] === '60px' &&
      rv.vars['--grid-t'] === '350px' &&
      rv.cols === 10 &&
      rv.attrs.grid === 'below',
    'Classic is built in and resolves to the original positions'
  );
  const pv = await call(th, '/api/theme/preview/bloom', 'GET');
  ok(pv.code === 200 && Buffer.isBuffer(pv.out) && pv.out.length > 1000, 'the screenshot is fetched from GitHub and served');
  const hitsBefore = ghHits.length;
  await call(th, '/api/theme/preview/bloom', 'GET');
  ok(ghHits.length === hitsBefore, 'a screenshot is kept on the TV and not fetched again');
  r = await tcall('set', { id: 'bloom' });
  ok(
    r.code === 200 && r.j.current.id === 'bloom' && r.j.themes.filter(x => x.id === 'bloom')[0].installed === true,
    'choosing a theme downloads it and applies it'
  );
  ok(
    fs.existsSync(path.join(tlocal, 'bloom', 'theme.json')) && fs.existsSync(path.join(tlocal, 'bloom', 'bloom.jpg')),
    'the theme file and its wallpaper are kept on the TV'
  );
  const bl = th.resolved();
  ok(
    bl.wallpaper &&
      bl.wallpaper.id === 'bloom' &&
      bl.wallpaper.file === 'bloom.jpg' &&
      bl.attrs.grid === 'push' &&
      bl.attrs.galign === 'center' &&
      bl.push &&
      bl.push.up > 0 &&
      bl.dockN === 6 &&
      bl.vars['--dock-t'] !== 'auto' &&
      bl.vars['--dock-b'] === 'auto' &&
      bl.vars['--tile-w'] === '193px',
    'a dock at the bottom with the push layout resolves to a scrolling grid below it, centred'
  );
  r = await tcall('wallpaper/bloom/bloom.jpg', null, 'GET');
  ok(r.code === 200, 'a downloaded wallpaper is served');
  r = await tcall('wallpaper/bloom/other.jpg', null, 'GET');
  ok(r.code === 404, 'a file the theme does not name is not served');
  r = await tcall('wallpaper/..%2f..%2fpasswd', null, 'GET');
  ok(r.code === 404, 'a path is not served as a wallpaper');
  // a theme's own typeface: downloaded with the theme, served from its folder, named first in --font
  ok(
    themeMod.fontOk(Buffer.from('wOF2' + 'x'.repeat(40)), 'a.woff2') &&
      !themeMod.fontOk(Buffer.from('wOF2' + 'x'.repeat(40)), 'a.ttf') &&
      !themeMod.fontOk(Buffer.from('<html>' + 'x'.repeat(40)), 'a.woff2'),
    'a typeface file is checked by its first bytes against its name'
  );
  r = await tcall('set', { id: 'pixel' });
  const px = th.resolved();
  ok(
    r.code === 200 &&
      fs.existsSync(path.join(tlocal, 'pixel', 'pixel.woff2')) &&
      px.font &&
      px.font.id === 'pixel' &&
      px.font.file === 'pixel.woff2' &&
      /^"CYTV Theme Font",/.test(px.vars['--font']),
    "a theme's typeface is downloaded with it and named first in the font"
  );
  r = await tcall('font/pixel/pixel.woff2', null, 'GET');
  ok(r.code === 200, 'the typeface is served');
  r = await tcall('font/pixel/other.woff2', null, 'GET');
  ok(r.code === 404, 'a typeface the theme does not name is not served');
  r = await tcall('set', { id: 'pixkid' });
  ok(
    r.code === 200 && th.resolved().font && th.resolved().font.id === 'pixel' && th.resolved().dockN === 4,
    'a theme that extends one with a typeface uses that file from its folder'
  );
  r = await tcall('set', { id: 'badfont' });
  ok(r.code !== 200 && !fs.existsSync(path.join(tlocal, 'badfont')), 'a typeface that is not a font is refused and nothing is kept');
  r = await tcall('set', { id: 'kid' });
  ok(
    r.code === 200 &&
      fs.existsSync(path.join(tlocal, 'kid', 'theme.json')) &&
      th.resolved().attrs.bar === 'flat' &&
      th.resolved().attrs.grid === 'push',
    'a theme that extends another one downloads and uses it'
  );
  r = await tcall('set', { id: 'nope' });
  ok(r.code === 400 && /unknown theme/.test(r.j.error), 'a theme that is not on GitHub is refused');
  r = await tcall('set', { id: 'notjson' });
  ok(r.code === 502 && !fs.existsSync(path.join(tlocal, 'notjson')), 'a theme file that is not JSON is refused and nothing is kept');
  r = await tcall('set', { id: 'huge' });
  ok(r.code === 502 && /too large/.test(r.j.error) && !fs.existsSync(path.join(tlocal, 'huge')), 'a theme file over 32 KB is refused');
  r = await tcall('set', { id: 'badwall' });
  ok(
    r.code === 502 && /not an image/.test(r.j.error) && !fs.existsSync(path.join(tlocal, 'badwall')),
    'a wallpaper that is not an image is refused and nothing is kept'
  );
  r = await tcall('set', { id: 'orphan' });
  ok(r.code === 502 && !fs.existsSync(path.join(tlocal, 'orphan', 'theme.json')), 'a theme whose base theme is missing is refused');
  r = await tcall('set', { id: '../x' });
  ok(r.code === 400, 'a bad theme id is refused');
  r = await tcall('set', { accent: 'blue' });
  ok(r.code === 400, 'an accent must be a hex colour');
  r = await tcall('set', { id: 'bloom', accent: '#FF8A3D' });
  ok(
    th.resolved().vars['--acc'] === '#ff8a3d' &&
      th.resolved().vars['--acc-ink'] === '#0b0c10' &&
      th.resolved().vars['--focus'] === '#ff8a3d',
    "an accent overrides the theme's own, with readable text on it"
  );
  r = await tcall('revert');
  ok(r.j.current.id === 'bloom' || r.j.current.id === 'kid', 'revert goes back to the previous theme');
  // holiday themes: off unless switched on; on, the theme whose dates include today is downloaded and applied over the chosen theme
  // (its colours and effects on the chosen layout and wallpaper), and the chosen theme comes back after the dates
  let today = new Date(2026, 9, 20); // 20 October: Halloween's dates
  await tcall('set', { id: 'bloom' });
  const hcfg = memoryConfig({ theme: { id: 'bloom', accent: '' } });
  const th2 = themeMod.create({ config: hcfg, noStartup: true, now: () => today });
  const bloomRv = th2.resolved();
  ok(bloomRv.id === 'bloom' && th2.holiday() === null, 'Holiday themes are off unless switched on');
  r = await call(th2, '/api/theme/holidays', 'POST', { on: true });
  const hv = th2.resolved();
  ok(
    r.j.holidays.on === true &&
      r.j.holidays.active === 'halloween' &&
      fs.existsSync(path.join(tlocal, 'halloween', 'theme.json')) &&
      hv.id === 'halloween' &&
      hv.attrs.particles === 'bats' &&
      hv.vars['--acc'] === '#ff7a18',
    "switched on in Halloween's dates: its theme is downloaded and applied, with its bats and colours"
  );
  ok(
    hv.vars['--cols'] === bloomRv.vars['--cols'] &&
      hv.vars['--tile-h'] === bloomRv.vars['--tile-h'] &&
      JSON.stringify(hv.wallpaper && hv.wallpaper.id) === JSON.stringify(bloomRv.wallpaper && bloomRv.wallpaper.id) &&
      hcfg.get().theme.id === 'bloom',
    'over the chosen theme: its layout and wallpaper stay, and it stays the saved theme'
  );
  await call(th2, '/api/theme/set', 'POST', { id: 'classic' });
  ok(hcfg.get().theme.holidays === true, 'choosing another theme keeps Holiday themes on');
  today = new Date(2026, 10, 5); // 5 November: no holiday
  ok(th2.holiday() === null && th2.resolved().id === 'classic', 'after the dates the chosen theme is back');
  today = new Date(2026, 11, 30); // 30 December: New Year's dates run over the new year
  await th2.ensureHoliday();
  ok(
    th2.holiday() === 'new-year' && th2.holiday(new Date(2027, 0, 2)) === 'new-year' && th2.holiday(new Date(2027, 0, 3)) === null,
    'a date range over the new year (27 December to 2 January) holds on both sides'
  );
  r = await call(th2, '/api/theme/holidays', 'POST', { on: false });
  ok(r.j.holidays.on === false && th2.resolved().id === 'classic', 'switched off: the chosen theme only');
  ok(
    JSON.parse(fs.readFileSync(path.join(tdir, 'index.json'), 'utf8')).themes.filter(t => t.holiday).length === 6,
    'the catalogue names the six holiday themes with their dates'
  );

  ghUp = false;
  await th.refreshCatalogue(true);
  r = await tcall('list', null, 'GET');
  ok(
    r.j.catalogue.ok === false && r.j.catalogue.error && r.j.themes.some(x => x.id === 'bloom' && x.installed),
    'GitHub unreachable: the list shows the themes on the TV and says why'
  );
  r = await tcall('set', { id: 'bloom' });
  ok(r.code === 200 && r.j.current.id === 'bloom', 'GitHub unreachable: a downloaded theme can still be chosen');
  r = await tcall('set', { id: 'midnight' });
  ok(
    r.code === 502 && /could not download/.test(r.j.error),
    'GitHub unreachable: a theme that was never downloaded says it could not be downloaded'
  );
  gh.server.close();

  // the documentation table is generated from the schema; the service ships no themes
  const gen = require(path.join(root, 'tools', 'theme-docs.js')),
    docs = fs.readFileSync(path.join(root, 'docs', 'themes.md'), 'utf8');
  ok(docs.indexOf(gen.table()) >= 0, 'docs/themes.md holds the table generated from the schema (run: node tools/theme-docs.js)');
  const noComments = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/#.*$/gm, '');
  ok(
    !/themes/.test(noComments('ipk/build.py')) && !/themes/.test(noComments('scripts/bootstrap.sh')),
    'the package build and the setup do not ship or copy themes'
  );
});
