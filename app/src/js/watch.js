/* ---------- Continue watching (the service's /api/watch/rows: what Telemachus has started and plays next, Plex and Stremio once
   linked): the first row of
   the app grid, picture cards with the title, the episode and how far it got; OK opens it where it is (act in config.js). Read when
   Home is shown and every minute while it is; Customise > Continue watching switches it off. ---------- */
/* where a card comes from, named on it (a card of Telemachus's channel says it plays next) */
var SOURCE_NAMES = { telemachus: 'Telemachus', plex: 'Plex', stremio: 'Stremio' },
  SOURCE_APPS = { telemachus: 'com.telemachus.screen', plex: 'cdp-30', stremio: 'io.strem.tv' },
  SOURCE_TINT = { telemachus: '120,150,255', plex: '229,160,13', stremio: '123,91,245' };
var WATCH = (function () {
  var items = [],
    sig = '';
  function on() {
    return !(cfg.watch && cfg.watch.on === false);
  }
  /* the shows and films removed from the row (hold OK > Remove from Continue watching) */
  function removed() {
    return (cfg.watch && cfg.watch.hide) || [];
  }
  function save(on, hide) {
    cfg.watch = { on: on };
    if (hide.length) cfg.watch.hide = hide.slice(-100);
    saveCfg();
  }
  /* a card of its own kind, kept like the app tiles (tiles[], focus, the pointer) and rebuilt only when what it shows changed */
  function card(it) {
    var id = 'watch:' + it.key,
      s = JSON.stringify(it),
      d = tiles[id];
    if (d && d._sig === s) return d;
    if (!d) {
      d = document.createElement('div');
      tiles[id] = d;
      hit(d);
    }
    d._sig = s;
    d._a = { id: id, title: it.title, sys: true, watch: it };
    d.className = 'tile wcard' + (it.img ? '' : ' wtext');
    d.style.setProperty('--c', SOURCE_TINT[it.source] || '200,200,210');
    d.innerHTML =
      '<div class="wimg"></div><div class="wsrc"></div><div class="wtx"><div class="wt"></div><div class="ws"></div></div>' +
      (it.progress > 0 ? '<div class="wpg"><i></i></div>' : '');
    if (it.img) d.firstChild.style.backgroundImage = 'url("' + API + it.img + '")';
    d.querySelector('.wsrc').textContent = (it.next ? t('Up next on %s') : '%s').replace('%s', SOURCE_NAMES[it.source] || '');
    d.querySelector('.wt').textContent = it.title;
    d.querySelector('.ws').textContent = it.sub || '';
    if (it.progress > 0) d.querySelector('.wpg i').style.transform = 'scaleX(' + Math.min(1, it.progress) + ')';
    return d;
  }
  function refresh() {
    if (!on()) {
      if (items.length) {
        items = [];
        sig = '';
        rebuild();
      }
      return;
    }
    api('/api/watch/rows').then(
      function (x) {
        var n = (x && x.items) || [],
          s = JSON.stringify(n);
        if (s === sig) return;
        sig = s;
        items = n;
        rebuild();
      },
      function () {}
    );
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) setTimeout(refresh, 400);
  });
  document.addEventListener('webOSRelaunch', function () {
    setTimeout(refresh, 400);
  });
  setInterval(function () {
    if (!document.hidden && !LIVE.on) refresh();
  }, 60000);
  setTimeout(refresh, 1500);
  return {
    /* the cards for the grid's first row, as many as a row holds */
    cards: function () {
      var gone = removed();
      return on()
        ? items
            .filter(function (it) {
              return gone.indexOf(it.group) < 0 && gone.indexOf('src:' + it.source) < 0;
            })
            .slice(0, TH.cols)
            .map(card)
        : [];
    },
    refresh: refresh,
    on: on,
    removed: removed,
    setOn: function (v) {
      save(v, removed());
      refresh();
    },
    /* a show or film (its group), or every card of a source ('src:plex') */
    remove: function (g) {
      if (g) save(on(), removed().concat([g]));
    },
    restore: function () {
      save(on(), []);
    },
  };
})();
