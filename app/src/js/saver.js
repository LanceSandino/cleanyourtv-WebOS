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
    var s = cfg.saver || {};
    return {
      on: s.on === true,
      after: s.after || 300,
      secs: s.secs || 15,
      clock: s.clock !== false,
      /* Style: Frame (the default) shows each photo like a print on a wall; Photos fits it whole on black */
      style: s.style === 'photos' ? 'photos' : 'frame',
      frame: FRAMES[s.frame] ? s.frame : 'wood',
      mat: s.mat === 'white' || s.mat === 'cream' || s.mat === 'charcoal' ? s.mat : 'auto',
      label: s.label !== false,
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
    w.innerHTML =
      '<div class="svp"></div><div class="svp"></div><div id="svn"></div><div id="svc"><div id="svt"></div><div id="svd"></div></div>';
    document.body.appendChild(w);
    els = { w: w, p: [w.childNodes[0], w.childNodes[1]], n: w.childNodes[2] };
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
  /* ---- the frame (Style: Frame): the photo in a mat behind a frame, like a print on a wall, with the day it was taken and its
     caption on a small label; two portrait photos of the same day side by side; a photo near the screen's shape fills it inside
     the frame. Still: only the cross-fade moves. The mat takes a little of the photo's colour when the feed says it. ---- */
  var FRAMES = { wood: 1, black: 1, gold: 1, white: 1, none: 1 },
    MATS = { white: '#f4f1ea', cream: '#ece2cc', charcoal: '#2c2b28' },
    spare = null;
  function shape(im) {
    var r = im && im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1.5;
    return Math.abs(r - 16 / 9) / (16 / 9) < 0.12 ? 'bleed' : r < 0.9 ? 'port' : 'land';
  }
  function matOf(meta) {
    var m = opts().mat;
    if (MATS[m]) return MATS[m];
    var c = meta && /^#[0-9a-f]{6}$/i.test(meta.color || '') ? meta.color : '';
    if (!c) return '#efe9df';
    var n = parseInt(c.slice(1), 16),
      rgb = [n >> 16, (n >> 8) & 255, n & 255];
    if (rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11 < 60) return MATS.charcoal; /* a dark photo: a dark mat */
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
  function darkMat(col) {
    var m = /(\d+),(\d+),(\d+)/.exec(col),
      v = m ? [+m[1], +m[2], +m[3]] : [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
    return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 < 128;
  }
  /* a photo's box inside the mat, by its shape and how many hang side by side */
  function box(im, maxW, maxH) {
    var r = im.naturalWidth / im.naturalHeight,
      w = maxW,
      h = w / r;
    if (h > maxH) {
      h = maxH;
      w = h * r;
    }
    var d = document.createElement('div');
    d.className = 'svf';
    d.style.width = Math.round(w) + 'px';
    d.style.height = Math.round(h) + 'px';
    d.style.backgroundImage = 'url("' + im.src + '")';
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
  function paintFrame(a, it, im, im2) {
    var o = opts(),
      sh = shape(im),
      mat = sh === 'bleed' ? '#111' : matOf(it.meta);
    a.style.backgroundImage = '';
    a.style.backgroundColor = mat;
    a.className = 'svp fr fr-' + o.frame + ' fr-' + (im2 ? 'pair' : sh) + (darkMat(mat) ? ' fr-dark' : '');
    a.textContent = '';
    var row = document.createElement('div');
    row.className = 'svrow';
    if (sh === 'bleed') {
      /* near the screen's shape: it fills the inside of the frame (cut by a few percent at most) */
      var full = box(im, 1, 1);
      full.style.width = full.style.height = '100%';
      row.style.width = row.style.height = '100%';
      row.appendChild(full);
    } else if (im2) {
      row.appendChild(box(im, 600, 760));
      row.appendChild(box(im2, 600, 760));
    } else if (sh === 'port') row.appendChild(box(im, 780, 800));
    else row.appendChild(box(im, 1190, 720));
    a.appendChild(row);
    var day = dayText(it.meta),
      cap = it.meta && it.meta.caption;
    if (o.label && (day || cap)) {
      var lb = document.createElement('div');
      lb.className = 'svl';
      if (cap) {
        var c = document.createElement('div');
        c.className = 'svl1';
        c.textContent = cap;
        lb.appendChild(c);
      }
      if (day) {
        var dd = document.createElement('div');
        dd.className = 'svl2';
        dd.textContent = day;
        lb.appendChild(dd);
      }
      a.appendChild(lb);
    }
    layers().w.classList.toggle('framed', true);
    layers().w.classList.toggle('inkdark', !darkMat(mat) && sh !== 'bleed');
  }
  /* loaded first, then swapped in, so the cross-fade never shows a half-drawn photo */
  function show(it) {
    load(it.url, function (im) {
      if (!im || !on || hist[at] !== it) return; /* failed, or stepped on meanwhile */
      var paint = function (im2) {
        if (!on || hist[at] !== it) return;
        var l = layers(),
          a = l.p[side],
          b = l.p[side ^ 1];
        side ^= 1;
        if (opts().style === 'frame') paintFrame(a, it, im, im2);
        else {
          a.textContent = '';
          a.style.backgroundColor = '';
          a.style.backgroundImage = 'url("' + it.url + '")';
          l.w.classList.remove('framed');
          l.w.classList.remove('inkdark');
        }
        a.classList.add('on');
        b.classList.remove('on');
        cur = it.url;
      };
      if (it.with) load(it.with.url, paint);
      else paint(null);
    });
  }
  /* the same day (or no day known for either): two portraits that belong together */
  function sameDay(a, b) {
    var x = a.meta && a.meta.date,
      y = b.meta && b.meta.date;
    return !x || !y || x === y;
  }
  /* a new photo, remembered so Left can go back to it. In the frame, a portrait looks for a second one of the same day to hang
     beside it (a photo that does not fit is kept for the next turn) */
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
      if (!it || opts().style !== 'frame') return keep(it);
      load(it.url, function (im) {
        if (!im || shape(im) !== 'port') return keep(it);
        nextUrl(function (it2) {
          if (!it2) return keep(it);
          load(it2.url, function (im2) {
            if (im2 && shape(im2) === 'port' && sameDay(it, it2)) it.with = it2;
            else spare = it2;
            keep(it);
          });
        });
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
    function () {
      idle = 0;
      if (on) wake();
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
    active: function () {
      return on;
    },
  };
})();
