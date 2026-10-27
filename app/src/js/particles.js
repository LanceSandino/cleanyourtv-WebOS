/* ---------- a theme's particles (effects.particles: snow, leaves, bats, confetti, hearts, stars; the holiday themes use them): a few
   light shapes drifting over the background and the wallpaper, behind the clock, the buttons and the apps. Each is one element moved
   by a CSS animation (transform and opacity only, for the TV's GPU), started at a random place and point of its cycle so they do not
   move together. The service leaves the setting out when the theme's effects.speed is 0. ---------- */
var FX = (function () {
  var kind = '',
    el = null,
    COUNT = { snow: 18, leaves: 9, bats: 4, confetti: 16, hearts: 9, stars: 14 },
    CYCLE = { snow: 16, leaves: 18, bats: 22, confetti: 13, hearts: 17, stars: 5 },
    SVG = {
      leaves:
        '<svg viewBox="0 0 24 24"><path d="M12 2C7 6 4 10 5 15c1 4 4 6 7 7 3-1 6-3 7-7 1-5-2-9-7-13zm0 4v15" fill="currentColor" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>',
      bats: '<svg viewBox="0 0 64 28"><path d="M32 8c-2 0-3 2-3 4l-2-1c-4-5-12-8-20-8 4 3 6 7 5 11-3-2-7-2-10 0 5 1 9 4 11 8 5-3 11-4 16-2 1 2 2 3 3 3s2-1 3-3c5-2 11-1 16 2 2-4 6-7 11-8-3-2-7-2-10 0-1-4 1-8 5-11-8 0-16 3-20 8l-2 1c0-2-1-4-3-4z" fill="currentColor"/></svg>',
      hearts:
        '<svg viewBox="0 0 24 22"><path d="M12 21C5 15 1 11 1 6.5 1 3.4 3.4 1 6.5 1 8.6 1 10.6 2.2 12 4c1.4-1.8 3.4-3 5.5-3C20.6 1 23 3.4 23 6.5 23 11 19 15 12 21z" fill="currentColor"/></svg>',
      stars: '<svg viewBox="0 0 24 24"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor"/></svg>',
    };
  function sync(k) {
    k = COUNT[k] ? k : '';
    if (k === kind) return;
    kind = k;
    if (el) {
      el.remove();
      el = null;
    }
    if (!k) return;
    el = document.createElement('div');
    el.id = 'fx';
    el.className = 'fx-' + k;
    for (var i = 0; i < COUNT[k]; i++) {
      var p = document.createElement('i'),
        d = CYCLE[k] * (0.75 + Math.random() * 0.5);
      /* spread across the screen, each at its own size and point of the cycle */
      p.style.left = Math.round(Math.random() * 1880) + 'px';
      p.style.top =
        k === 'stars' ? Math.round(40 + Math.random() * 980) + 'px' : k === 'bats' ? Math.round(60 + Math.random() * 380) + 'px' : '';
      p.style.animationDuration = d.toFixed(1) + 's';
      p.style.animationDelay = (-Math.random() * d).toFixed(1) + 's';
      p.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
      p.style.setProperty('--x', Math.round(Math.random() * 160 - 80) + 'px');
      if (SVG[k]) p.innerHTML = SVG[k];
      el.appendChild(p);
    }
    document.body.insertBefore(el, $('top'));
  }
  return {
    sync: sync,
    kind: function () {
      return kind;
    },
  };
})();
