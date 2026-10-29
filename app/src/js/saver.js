/* ---------- Screensaver: after cfg.saver.after seconds without a key or a pointer move on Home, or when the TV is about to start
   LG's own screensaver, the photo feed's photos (the service's /api/photofeed/next: one photo at a time, never the whole library;
   without a photo feed the Wallpapers photos) full screen with the time and the date. A new photo every cfg.saver.secs seconds, cross-faded
   (opacity only), fitted whole on black and darker at night. Left and Right step back and forward through the photos already shown
   (Right past the last one brings a new photo) and restart the timer; any other key or a pointer move ends it, and that key does
   nothing else. Photos come in a shuffled order: each is shown once before any comes back.
   LG asks every registered client before it starts its screensaver (tvpower registerScreenSaverRequest); while ours can show photos
   on Home the answer is no and ours starts instead, otherwise yes. Off, or no photos: LG's screensaver as before. ---------- */
var SAVER = (function () {
  var on = false,
    idle = 0,
    side = 0,
    timer = 0,
    clockT = 0,
    els = null,
    swallow = false,
    bridge = null,
    mx = -1,
    my = -1,
    cur = '',
    hist = [],
    at = -1,
    deck = [],
    deckStamp = '';
  var HIST = 50;
  function opts() {
    return optsFrom(cfg.saver || {});
  }
  function optsFrom(s) {
    return {
      on: s.on === true,
      after: s.after || 300,
      secs: s.secs || 15,
      clock: s.clock !== false,
      /* Style: Frame (the default) hangs the photos in a mat behind a frame, like a frame TV; Photos fits each whole on black */
      style: s.style === 'photos' ? 'photos' : 'frame',
      frame: FRAMES.indexOf(s.frame) >= 0 ? s.frame : 'walnut',
      profile: PROFILES[s.profile] ? s.profile : 'modern',
      mat: MATS[s.mat] ? s.mat : 'auto',
      layout: s.layout === 'one' || s.layout === 'three' ? s.layout : 'two',
      finish: s.finish === 'canvas' || s.finish === 'painting' ? s.finish : 'none',
      label: s.label === false ? 'off' : s.label === 'plaque' ? 'plaque' : 'under',
    };
  }
  function famN() {
    return (cfg.photoFeed && cfg.photoFeed.photos) || 0;
  }
  function wallN() {
    return +String((cfg.wallpapers && cfg.wallpapers.stamp) || '0').split(':')[0] || 0;
  }
  function photos() {
    return famN() > 0 || wallN() > 0;
  }
  function can() {
    return opts().on && photos() && !LIVE.on && !document.hidden;
  }
  function layers() {
    if (els) return els;
    var w = document.createElement('div');
    w.id = 'sv';
    /* the frame under the two photo layers (it does not fade: it is drawn once), the light of the room over them, the night dim */
    w.innerHTML =
      '<div id="svfr"></div><div class="svp"></div><div class="svp"></div><div id="svlt"></div><div id="svn"></div>' +
      '<div id="svc"><div id="svt"></div><div id="svd"></div></div>';
    document.body.appendChild(w);
    els = { w: w, fr: w.childNodes[0], p: [w.childNodes[1], w.childNodes[2]], n: w.childNodes[4] };
    return els;
  }
  /* the time and the date, as on Home (the Clock setting), and darker from ten at night to seven in the morning */
  function clock() {
    var d = new Date(),
      h = d.getHours();
    try {
      $('svt').textContent = d.toLocaleTimeString(LOC, clockOpts());
      $('svd').textContent = d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) {
      $('svt').textContent = ('0' + h).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    layers().n.style.opacity = h >= 22 || h < 7 ? '0.45' : '0.08';
  }
  /* the Wallpapers photos as a shuffled deck too: every one once before any comes back, never the one on the screen twice in a row */
  function shuffled(l) {
    var a = l.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)),
        x = a[i];
      a[i] = a[j];
      a[j] = x;
    }
    return a;
  }
  function wallUrl(cb) {
    api('/api/wallpapers/list').then(
      function (r) {
        var l = (r && r.photos) || [],
          url = function (id) {
            return API + '/api/wallpapers/photo/' + id;
          };
        if (!l.length) return cb(null);
        if (!deck.length || (r.stamp || '') !== deckStamp) {
          deckStamp = r.stamp || '';
          deck = shuffled(l);
          if (deck.length > 1 && url(deck[0]) === cur) deck.push(deck.shift());
        }
        cb({ url: url(deck.shift()), meta: {} });
      },
      function () {
        cb(null);
      }
    );
  }
  /* the next photo, {url, meta: {date, caption, width, height, color}}: the photo feed first, then the Wallpapers photos; null when
     there is none. A photo kept aside by the frame's pairing comes first. */
  function nextUrl(cb) {
    if (spare) {
      var s0 = spare;
      spare = null;
      return cb(s0);
    }
    if (!famN()) return wallUrl(cb);
    api('/api/photofeed/next').then(
      function (r) {
        if (r && r.id) cb({ url: API + '/api/photofeed/photo/' + encodeURIComponent(r.id), meta: r });
        else wallUrl(cb);
      },
      function () {
        wallUrl(cb);
      }
    );
  }
  function load(url, cb) {
    var im = new Image();
    im.onload = function () {
      cb(im);
    };
    im.onerror = function () {
      cb(null);
    };
    im.src = url;
  }
  /* ---- the frame (Style: Frame), like a frame TV: a frame of four mitred sides (a wood, a paint or a metal) around the screen, lit
     from above by its profile; the photos hang in a mat behind it, each in its own bevel-cut window with the day and the caption
     pencilled under it, or one photo fills the inside. Still: only the cross-fade moves, and the frame is drawn once, under the photos.
     The materials are small pictures next to the page (tools/saver-art.mjs). ---- */
  var FRAMES = 'walnut oak teak ash cherry greyoak blackash black white charcoal sand navy sage burgundy brass silver none'.split(' '),
    /* a material: its picture (a board or brushed metal along the side), its colour and how it shines */
    MATERIAL = {
      walnut: ['wood-walnut', '#523726'],
      oak: ['wood-oak', '#b8966b'],
      teak: ['wood-teak', '#946338'],
      ash: ['wood-ash', '#d2c0a0'],
      cherry: ['wood-cherry', '#8f4f33'],
      greyoak: ['wood-grey', '#8d877e'],
      blackash: ['wood-black', '#232120'],
      black: ['', '#161616'],
      white: ['', '#ecebe6'],
      charcoal: ['', '#3a3a3c'],
      sand: ['', '#c6b89e'],
      navy: ['', '#1f2a3d'],
      sage: ['', '#86967e'],
      burgundy: ['', '#5a2127'],
      brass: ['metal-brass', '#a98b55'],
      silver: ['metal-silver', '#b7bbc0'],
    },
    /* the width of each profile, px on the 1920 x 1080 page */
    PROFILES = { thin: 34, modern: 58, bevel: 70, classic: 86 },
    MATS = { white: '#f2f0eb', cream: '#ebe3cf', grey: '#c8c6c1', charcoal: '#2e2d2b', black: '#151515', linen: '#d9cfbc' },
    SIDES = ['top', 'right', 'bottom', 'left'],
    spare = null,
    frameKey = '';
  /* the height of the profile at each px across the side, from the outer edge (0) to the inside (b) */
  function heights(p, b) {
    var h = [],
      v,
      q = function (r, x) {
        return Math.sqrt(Math.max(0, r * r - x * x));
      };
    for (v = 0; v <= b; v++)
      h.push(
        p === 'thin'
          ? v < 5
            ? 1 + q(5, 5 - v)
            : v > b - 3
              ? 6 - (v - b + 3)
              : 6
          : p === 'bevel'
            ? v < 6
              ? 12 + q(6, 6 - v)
              : v > b - 3
                ? 6 - (v - b + 3) * 0.7
                : 18 - ((v - 6) * 12) / (b - 9)
            : p === 'classic'
              ? v < 6
                ? 12 + q(6, 6 - v)
                : v < 50
                  ? 18
                  : v < 64
                    ? 9 + 9 * (1 - q(1, (64 - v) / 14))
                    : v < b - 8
                      ? 9
                      : 9 + 0.8 * q(4, v - b + 4)
              : v < 8
                ? 2 + q(8, 8 - v)
                : v > b - 4
                  ? 6 + q(4, v - b + 4)
                  : 10
      );
    return h;
  }
  function unit(x) {
    var l = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
    return [x[0] / l, x[1] / l, x[2] / l];
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  var TOLIGHT = unit([-0.3, -0.75, 0.85]) /* the light: above, a little to the left, in front */,
    HALF = unit([TOLIGHT[0], TOLIGHT[1], TOLIGHT[2] + 1]);
  /* the light on one side, across it: a gradient of black (shade) and white (light, shine) over the material */
  function shading(prof, b, side, kind, color) {
    var h = heights(prof, b),
      inX = side === 'left' ? 1 : side === 'right' ? -1 : 0,
      inY = side === 'top' ? 1 : side === 'bottom' ? -1 : 0,
      room = { top: 0.05, right: -0.03, bottom: -0.07, left: 0.02 }[side] /* more light from above than from below */,
      shine = kind === 'metal' ? [30, 0.7] : kind === 'paint' ? [26, 0.2] : [16, 0.14],
      flat = Math.pow(HALF[2], shine[0]) * shine[1],
      base = lum(color) / 255,
      stops = [];
    for (var v = 0; v < b; v++) {
      var d = (h[Math.min(b, v + 1)] - h[Math.max(0, v - 1)]) / 2,
        n = unit([-d * inX, -d * inY, 1]),
        m = Math.max(0, dot(n, TOLIGHT)) / TOLIGHT[2] + room,
        sp = Math.pow(Math.max(0, dot(n, HALF)), shine[0]) * shine[1] - flat,
        want = Math.max(0, base * m + sp),
        col =
          want < base
            ? 'rgba(0,0,0,' + Math.min(0.9, 1 - want / Math.max(base, 0.01)).toFixed(3) + ')'
            : 'rgba(255,255,255,' + Math.min(0.75, (want - base) / Math.max(1 - base, 0.05)).toFixed(3) + ')';
      stops.push(col + ' ' + v + 'px', col + ' ' + (v + 1) + 'px');
    }
    return 'linear-gradient(to bottom,' + stops.join(',') + ')';
  }
  function lum(c) {
    var m = /(\d+),\s*(\d+),\s*(\d+)/.exec(c),
      v = m ? [+m[1], +m[2], +m[3]] : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11;
  }
  /* the four sides, each a strip along its edge (turned into place), mitred where they meet; drawn again only when it changes */
  function drawFrame(o, b, W, H) {
    var l = layers(),
      key = o.frame + ' ' + o.profile + ' ' + W + 'x' + H;
    if (frameKey === key) return;
    frameKey = key;
    l.fr.textContent = '';
    if (b) buildSides(l.fr, o, b, W, H);
  }
  function buildSides(box, o, b, W, H) {
    var mt = MATERIAL[o.frame],
      kind = !mt[0] ? 'paint' : mt[0].indexOf('metal') === 0 ? 'metal' : 'wood',
      at = { top: [1, 0, 0, 1, 0, 0], right: [0, 1, -1, 0, W, 0], bottom: [1, 0, 0, -1, 0, H], left: [0, 1, 1, 0, 0, 0] };
    SIDES.forEach(function (sd, i) {
      var len = sd === 'top' || sd === 'bottom' ? W : H,
        d = document.createElement('div'),
        clip = 'polygon(0 0,' + len + 'px 0,' + (len - b) + 'px ' + b + 'px,' + b + 'px ' + b + 'px)';
      d.className = 'svside';
      d.style.width = len + 'px';
      d.style.height = b + 'px';
      d.style.transform = 'matrix(' + at[sd].join(',') + ')';
      d.style.webkitClipPath = clip;
      d.style.clipPath = clip;
      d.style.backgroundColor = mt[1];
      d.style.backgroundImage = shading(o.profile, b, sd, kind, mt[1]) + (mt[0] ? ',url("saver-' + mt[0] + '.webp")' : '');
      /* each side a different stretch of the board, as if cut from different lengths */
      d.style.backgroundPosition = '0 0,' + -[0, 640, 128, 900][i] + 'px ' + -[0, 6, 3, 9][i] + 'px';
      box.appendChild(d);
    });
  }
  /* a still example of the frame for the menus (the Screensaver menu and its lists): the screen drawn small in a box, with a made-up
     picture (a sky, a sun, hills), never one of the photos; s: the screensaver settings to show */
  var SAMPLE =
    'radial-gradient(circle at 68% 34%, #fff1c4 0, #ffe2a0 7%, rgba(255,226,160,0) 8%),' +
    'linear-gradient(170deg, rgba(0,0,0,0) 58%, #5d7a4f 58.5%, #3e5634 100%),' +
    'linear-gradient(190deg, rgba(0,0,0,0) 50%, #7f9a6c 50.5%, #6a855a 100%),' +
    'linear-gradient(to bottom, #8db4d6 0%, #d9c5a8 48%, #e8b98f 60%)';
  function sample(host, s) {
    var o = optsFrom(s || {}),
      W = 1920,
      H = 1080,
      b = o.style === 'frame' && o.frame !== 'none' ? PROFILES[o.profile] : 0,
      box = document.createElement('div');
    box.id = 'svdemo';
    box.style.transform = 'scale(' + (host.clientWidth || 880) / W + ')';
    host.textContent = '';
    host.appendChild(box);
    var pic = function (w, h) {
      var win = document.createElement('div'),
        f = document.createElement('div');
      win.className = 'svw';
      win.style.width = w + 'px';
      win.style.height = h + 'px';
      f.className = 'svf';
      f.style.backgroundImage = SAMPLE;
      win.appendChild(f);
      if (o.finish !== 'none') win.appendChild(el('svx'));
      return win;
    };
    if (o.style !== 'frame') {
      /* Style: Photos: the picture whole on black */
      var only = pic(1440, 1080);
      only.style.margin = '0 auto';
      only.style.border = '0';
      box.style.background = '#000';
      box.appendChild(only);
      return;
    }
    if (b) buildSides(box, o, b, W, H);
    var Wi = W - 2 * b,
      Hi = H - 2 * b,
      full = o.layout === 'one',
      mat = full ? '#111111' : MATS[o.mat] || '#efe9df',
      m = document.createElement('div');
    m.className =
      'svp fr fin-' +
      o.finish +
      (full ? ' fr-full' : '') +
      (lum(mat) < 128 ? ' fr-dark' : '') +
      (o.mat === 'black' ? ' fr-core' : '') +
      (b ? '' : ' fr-none');
    m.style.cssText = 'position:absolute;left:' + b + 'px;top:' + b + 'px;width:' + Wi + 'px;height:' + Hi + 'px;opacity:1';
    m.style.backgroundColor = mat;
    m.style.backgroundImage = full ? '' : o.mat === 'linen' ? 'url("saver-linen.webp")' : 'url("saver-paper.webp")';
    var row = el('svrow');
    if (full) row.appendChild(pic(Wi, Hi));
    else {
      var n = o.layout === 'three' ? 3 : 2,
        w = Math.round(n === 3 ? Hi * 0.7 * 0.75 : Hi * 0.74 * 0.75),
        h = Math.round(w / 0.75);
      for (var i = 0; i < n; i++) {
        var col = el('svcol'),
          one = pic(w, h);
        if (i) col.style.marginLeft = Math.round(Wi * (n === 3 ? 0.035 : 0.055)) + 'px';
        col.appendChild(one);
        if (o.label === 'under') {
          var lab = el('svs');
          lab.style.width = w + 10 + 'px';
          lab.appendChild(el('svs1', t('Example')));
          lab.appendChild(el('svs2', dayText({ date: '2026-10-29' })));
          col.appendChild(lab);
        }
        row.appendChild(col);
      }
      row.style.marginTop = -Math.round(Hi * 0.04) + 'px';
    }
    m.appendChild(row);
    if (o.label === 'plaque') m.appendChild(el('svq', t('Example') + ' \u00B7 ' + dayText({ date: '2026-10-29' })));
    box.appendChild(m);
  }
  function ratio(im) {
    return im && im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1.5;
  }
  function shape(im) {
    var r = ratio(im);
    return Math.abs(r - 16 / 9) / (16 / 9) < 0.12 ? 'bleed' : r < 0.9 ? 'port' : 'land';
  }
  /* how many photos hang together: one that fills the frame alone; up to three portraits, or two landscapes, side by side */
  function groupOf(im, o) {
    var sh = shape(im);
    if (sh === 'bleed' || o.layout === 'one') return 1;
    return sh === 'port' ? (o.layout === 'three' ? 3 : 2) : 2;
  }
  function fills(im, o, n) {
    return n === 1 && (shape(im) === 'bleed' || (o.layout === 'one' && ratio(im) >= 1.25));
  }
  function matOf(meta) {
    var m = opts().mat;
    if (MATS[m]) return MATS[m];
    var c = meta && /^#[0-9a-f]{6}$/i.test(meta.color || '') ? meta.color : '';
    if (!c) return '#efe9df';
    var n = parseInt(c.slice(1), 16),
      rgb = [n >> 16, (n >> 8) & 255, n & 255];
    if (lum(c) < 60) return MATS.charcoal; /* a dark photo: a dark mat */
    return (
      'rgb(' +
      rgb
        .map(function (x) {
          return Math.round(238 + (x - 238) * 0.16);
        })
        .join(',') +
      ')'
    );
  }
  function el(cls, text) {
    var d = document.createElement('div');
    d.className = cls;
    if (text) d.textContent = text;
    return d;
  }
  /* a window cut in the mat with the photo behind it (and the canvas over it, Finish: Canvas or Painting) */
  function windowFor(im, maxW, maxH, o) {
    var r = ratio(im),
      w = maxW,
      h = w / r;
    if (h > maxH) {
      h = maxH;
      w = h * r;
    }
    var d = el('svw'),
      f = el('svf');
    d.style.width = Math.round(w) + 'px';
    d.style.height = Math.round(h) + 'px';
    f.style.backgroundImage = 'url("' + im.src + '")';
    d.appendChild(f);
    if (o.finish !== 'none') d.appendChild(el('svx'));
    return d;
  }
  function dayText(meta) {
    if (!meta || !meta.date) return '';
    try {
      return new Date(meta.date + 'T12:00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return meta.date;
    }
  }
  /* pencilled under a window, as on a signed print: the caption on the left, the day on the right */
  function pencil(meta, w) {
    var d = el('svs'),
      cap = (meta && meta.caption) || '',
      day = dayText(meta);
    d.style.width = w + 'px';
    if (cap) d.appendChild(el('svs1', cap));
    if (day) d.appendChild(el('svs2', day));
    return d;
  }
  function paintFrame(a, items, ims) {
    var o = opts(),
      l = layers(),
      W = window.innerWidth || 1920,
      H = window.innerHeight || 1080,
      b = o.frame === 'none' ? 0 : PROFILES[o.profile],
      Wi = W - 2 * b,
      Hi = H - 2 * b,
      n = ims.length,
      full = fills(ims[0], o, n),
      mat = full ? '#111111' : matOf(items[0].meta),
      dark = lum(mat) < 128;
    drawFrame(o, b, W, H);
    l.w.style.setProperty('--b', b + 'px');
    a.textContent = '';
    a.style.backgroundColor = mat;
    a.style.backgroundImage = full ? '' : o.mat === 'linen' ? 'url("saver-linen.webp")' : 'url("saver-paper.webp")';
    a.className =
      'svp fr fin-' +
      o.finish +
      (full ? ' fr-full' : '') +
      (dark ? ' fr-dark' : '') +
      (o.mat === 'black' ? ' fr-core' : '') +
      (b ? (b < 50 ? ' fr-narrow' : '') : ' fr-none');
    var row = el('svrow');
    if (full) {
      var fw = windowFor(ims[0], Wi, Hi, o);
      fw.style.width = Wi + 'px';
      fw.style.height = Hi + 'px';
      row.appendChild(fw);
    } else {
      var port = shape(ims[0]) === 'port',
        maxW = Wi * (n === 1 ? (port ? 0.5 : 0.68) : n === 2 ? (port ? 0.3 : 0.4) : 0.23),
        maxH = Hi * (n === 1 ? (port ? 0.76 : 0.68) : n === 2 ? (port ? 0.74 : 0.58) : 0.7);
      for (var i = 0; i < n; i++) {
        var col = el('svcol'),
          win = windowFor(ims[i], maxW, maxH, o);
        if (i) col.style.marginLeft = Math.round(Wi * (n === 3 ? 0.035 : 0.055)) + 'px';
        col.appendChild(win);
        if (o.label === 'under') col.appendChild(pencil(items[i].meta, parseInt(win.style.width, 10) + 10));
        row.appendChild(col);
      }
      row.style.marginTop = -Math.round(Hi * 0.04) + 'px'; /* a mat is cut a little higher than the middle */
    }
    a.appendChild(row);
    var m0 = items[0].meta,
      cap = (m0 && m0.caption) || '',
      day = dayText(m0);
    if (o.label === 'plaque' && (cap || day)) a.appendChild(el('svq', cap && day ? cap + ' · ' + day : cap || day));
    else if (o.label === 'under' && full && (cap || day)) {
      var lb = el('svl');
      if (cap) lb.appendChild(el('svl1', cap));
      if (day) lb.appendChild(el('svl2', day));
      a.appendChild(lb);
    }
    l.w.classList.add('framed');
    l.w.classList.toggle('inkdark', !dark && !full);
  }
  function loadAll(items, cb) {
    var out = [];
    (function one(i) {
      if (i >= items.length) return cb(out);
      load(items[i].url, function (im) {
        if (im) out.push(im);
        one(i + 1);
      });
    })(0);
  }
  /* loaded first, then swapped in, so the cross-fade never shows a half-drawn photo */
  function show(it) {
    var items = [it].concat(it.more || []);
    loadAll(items, function (ims) {
      if (!ims.length || !on || hist[at] !== it) return; /* failed, or stepped on meanwhile */
      var l = layers(),
        a = l.p[side],
        b = l.p[side ^ 1];
      side ^= 1;
      if (opts().style === 'frame') paintFrame(a, items.slice(0, ims.length), ims);
      else {
        a.textContent = '';
        a.className = 'svp';
        a.style.backgroundColor = '';
        a.style.backgroundImage = 'url("' + it.url + '")';
        l.w.classList.remove('framed');
        l.w.classList.remove('inkdark');
      }
      a.classList.add('on');
      b.classList.remove('on');
      cur = it.url;
    });
  }
  /* a new photo, remembered so Left can go back to it. In the frame, the photos after it of the same orientation hang beside it (up
     to two or three, Photos at a time); the first one that does not fit is kept for the next turn */
  var fetching = false;
  function nextPhoto() {
    if (fetching) return;
    fetching = true;
    var keep = function (it) {
      fetching = false;
      if (!on || !it) return;
      hist.push(it);
      if (hist.length > HIST) hist.shift();
      at = hist.length - 1;
      show(it);
    };
    nextUrl(function (it) {
      var o = opts();
      if (!it || o.style !== 'frame') return keep(it);
      load(it.url, function (im) {
        var g = im ? groupOf(im, o) : 1,
          port = im && shape(im) === 'port';
        if (g < 2) return keep(it);
        it.more = [];
        (function more() {
          nextUrl(function (it2) {
            if (!it2) return keep(it);
            load(it2.url, function (im2) {
              var sh2 = im2 && shape(im2);
              if (im2 && sh2 !== 'bleed' && (sh2 === 'port') === port) {
                it.more.push(it2);
                if (it.more.length + 1 < g) return more();
              } else if (im2) spare = it2;
              keep(it);
            });
          });
        })();
      });
    });
  }
  /* Left and Right: back and forward through what was shown; forward past the last one is a new photo */
  function step(d) {
    if (d < 0 && at > 0) show(hist[--at]);
    else if (d > 0 && at < hist.length - 1) show(hist[++at]);
    else if (d > 0) nextPhoto();
    clearInterval(timer);
    timer = setInterval(advance, opts().secs * 1000);
  }
  /* the timer: forward through the history first (after stepping back), then new photos */
  function advance() {
    if (at < hist.length - 1) show(hist[++at]);
    else nextPhoto();
  }
  function start(now) {
    if (on || !photos() || LIVE.on || (!now && !can())) return false;
    on = true;
    mx = my = -1;
    var l = layers();
    l.w.className = opts().clock ? 'on' : 'on noclock';
    clock();
    clockT = setInterval(clock, 15000);
    hist = [];
    at = -1;
    nextPhoto();
    timer = setInterval(advance, opts().secs * 1000);
    return true;
  }
  function stop() {
    idle = 0;
    if (!on) return;
    on = false;
    spare = null;
    clearInterval(timer);
    clearInterval(clockT);
    var l = layers();
    l.w.className = '';
    /* the photos leave the GPU's memory once the fade is over */
    setTimeout(function () {
      if (on) return;
      l.p[0].style.backgroundImage = l.p[1].style.backgroundImage = '';
      l.p[0].style.backgroundColor = l.p[1].style.backgroundColor = '';
      l.p[0].textContent = l.p[1].textContent = '';
      l.p[0].className = l.p[1].className = 'svp';
    }, 900);
  }
  /* The app that was in front when LG asked (another app idle, not Home): the photos were shown on Home instead of LG's clock, and
     ending them by a key or the pointer goes back to that app. Ended any other way (Home key, Home hidden) it stays where it is. */
  var from = '',
    pending = 0;
  function wake() {
    stop();
    if (!from) return;
    var a = from;
    from = '';
    launch(a);
  }
  /* Left and Right step through the photos; any other key ends it. That key (and the release of it) goes no further */
  function eat(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  window.addEventListener(
    'keydown',
    function (e) {
      idle = 0;
      if (!on) return;
      var k = e.keyCode;
      if (k === 37 || k === 39) {
        step((k === 39) !== rtl() ? 1 : -1); /* mirrored for a right-to-left language, as on Home */
        swallow = true;
        return eat(e);
      }
      wake();
      swallow = true;
      eat(e);
    },
    true
  );
  window.addEventListener(
    'keyup',
    function (e) {
      if (!swallow) return;
      swallow = false;
      eat(e);
    },
    true
  );
  /* the Magic Remote: a real move of the pointer (not the jitter of a remote put down) or a click ends it */
  window.addEventListener(
    'mousemove',
    function (e) {
      if (mx < 0 || Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) >= 24) {
        var first = mx < 0;
        mx = e.clientX;
        my = e.clientY;
        if (first && on) return;
        idle = 0;
        if (on) wake();
      }
    },
    true
  );
  var ateDown = false;
  window.addEventListener(
    'mousedown',
    function (e) {
      idle = 0;
      if (!on) return;
      wake();
      ateDown = true;
      eat(e);
    },
    true
  );
  ['mouseup', 'click'].forEach(function (ev) {
    window.addEventListener(
      ev,
      function (e) {
        if (!ateDown) return;
        if (ev === 'click') ateDown = false;
        eat(e);
      },
      true
    );
  });
  window.addEventListener(
    'wheel',
    function (e) {
      idle = 0;
      if (!on) return;
      wake();
      e.stopPropagation(); /* the wheel that ends the photos does nothing else (the menus' and Home's wheel) */
    },
    true
  );
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!pending) {
        from = '';
        stop();
      }
      return;
    }
    idle = 0;
    /* Home came forward for the photos (below) */
    if (pending) {
      clearTimeout(pending);
      pending = 0;
      setTimeout(function () {
        if (from) start(true);
      }, 300);
    }
  });
  /* the Home key while the photos show: they end and Home stays */
  document.addEventListener('webOSRelaunch', function () {
    var p = {};
    try {
      p = JSON.parse(webOSSystem.launchParams || '{}');
    } catch (e) {}
    if (on && p && p.launchType === 'homeKey') {
      from = '';
      stop();
    }
  });
  /* every five seconds: LG's question followed or not as the setting is now (also right after the launcher loaded it), and the idle
     time, counted in these ticks rather than from the clock, which can jump when the TV sets its time */
  setInterval(function () {
    if (opts().on !== !!bridge) listenOrNot();
    idle += 5;
    if (!on && can() && idle >= opts().after) start();
  }, 5000);

  /* LG's screensaver: asked through the TV's service bus while ours is switched on */
  function call(uri, p) {
    try {
      new PalmServiceBridge().call(uri, JSON.stringify(p));
    } catch (e) {}
  }
  function listen() {
    if (bridge || typeof PalmServiceBridge === 'undefined') return;
    try {
      bridge = new PalmServiceBridge();
      bridge.onservicecallback = function (m) {
        var j = null;
        try {
          j = JSON.parse(m);
        } catch (e) {}
        if (!j || j.timestamp === undefined) return;
        /* ours whenever it is on and has photos: on Home at once, over another app by bringing Home forward (and back on a key).
           Never over an HDMI input: a game console or a set-top box is in use even when the remote is not (a controller does not
           count for LG), so there LG decides, as it did before this launcher. */
        var mine = opts().on && photos() && !LIVE.on,
          answer = function (ack) {
            call('luna://com.webos.service.tvpower/power/responseScreenSaverRequest', {
              clientName: 'cleanyourtv',
              ack: ack,
              timestamp: j.timestamp,
            });
          };
        if (!mine) {
          answer(true);
          return logLine('screensaver: LG asked, LG allowed');
        }
        if (!document.hidden) {
          answer(false);
          start();
          return logLine('screensaver: LG asked, ours shown on Home');
        }
        if (on || pending) return answer(false);
        api('/api/foreground').then(
          function (f) {
            var id = (f && f.appId) || '';
            if (/^com\.webos\.app\.hdmi\d+$/.test(id)) {
              answer(true);
              return logLine('screensaver: LG asked over ' + id + ', left to LG (an HDMI input)');
            }
            answer(false);
            if (!id || id === 'com.webos.app.home') return;
            from = id;
            pending = setTimeout(function () {
              pending = 0; /* Home did not come forward: nothing more to do */
              from = '';
            }, 8000);
            launch('com.webos.app.home');
            logLine('screensaver: LG asked over ' + id + ', ours shown on Home');
          },
          function () {
            answer(true); /* the service did not answer: LG decides */
          }
        );
      };
      bridge.call(
        'luna://com.webos.service.tvpower/power/registerScreenSaverRequest',
        JSON.stringify({ subscribe: true, clientName: 'cleanyourtv' })
      );
    } catch (e) {
      bridge = null;
    }
  }
  function listenOrNot() {
    if (opts().on) listen();
    else if (bridge) {
      try {
        bridge.cancel();
      } catch (e) {}
      bridge = null;
    }
  }
  /* a changed setting takes effect at once */
  function sync() {
    listenOrNot();
    if (on && !opts().on) stop();
    else if (on) {
      clearInterval(timer);
      timer = setInterval(advance, opts().secs * 1000);
      layers().w.className = opts().clock ? 'on' : 'on noclock';
    }
  }
  return {
    sync: sync,
    start: start,
    stop: stop,
    sample: sample,
    active: function () {
      return on;
    },
  };
})();
