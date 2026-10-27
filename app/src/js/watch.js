/* ---------- Continue watching (the service's /api/watch/rows: what Telemachus has started and plays next, what Plex and Stremio have
   partly watched once linked). The episodes and films are shown only where they belong: when Telemachus, Plex (or PLX) or Stremio is
   highlighted on Home, a row of its cards opens under that app's row a moment later; Down goes into it, OK opens one in that app (act
   in config.js), hold OK has its options (watchCardMenu). The row closes when the focus moves on along that row or above it. Read when
   Home is shown and every minute while it is; Customise > Continue watching switches it off. ---------- */
/* where a card comes from, named on it (a card of Telemachus's channel says it plays next), and the apps that show it */
var SOURCE_NAMES = { telemachus: 'Telemachus', plex: 'Plex', stremio: 'Stremio' },
  SOURCE_APPS = { telemachus: ['com.telemachus.screen'], plex: ['cdp-30', 'com.beb.plxnative'], stremio: ['io.strem.tv'] },
  SOURCE_TINT = { telemachus: '120,150,255', plex: '229,160,13', stremio: '123,91,245' };
function sourceOf(appId) {
  for (var s in SOURCE_APPS) if (SOURCE_APPS[s].indexOf(appId) >= 0) return s;
  return '';
}
var WATCH = (function () {
  var items = [],
    sig = '',
    owner = null /* the app whose row is open */,
    ownerT = 0;
  function on() {
    return !(cfg.watch && cfg.watch.on === false);
  }
  /* the shows and films removed (hold OK > Remove from Continue watching), and sources hidden whole ('src:plex') */
  function removed() {
    return (cfg.watch && cfg.watch.hide) || [];
  }
  function save(on, hide) {
    cfg.watch = { on: on };
    if (hide.length) cfg.watch.hide = hide.slice(-100);
    saveCfg();
  }
  /* the cards an app shows */
  function mine(appId) {
    var s = sourceOf(appId),
      gone = removed();
    if (!s || !on() || gone.indexOf('src:' + s) >= 0) return [];
    return items.filter(function (it) {
      return it.source === s && gone.indexOf(it.group) < 0;
    });
  }
  /* a card of its own kind, kept like the app tiles (tiles[], focus, the pointer) and rebuilt only when what it shows changed. Plex's
     cards open in the app they are under (Plex or PLX); Telemachus's open at that episode or film. */
  function card(it, appId) {
    var id = 'watch:' + it.key,
      s = JSON.stringify(it) + appId,
      d = tiles[id];
    if (d && d._sig === s) return d;
    if (!d) {
      d = document.createElement('div');
      tiles[id] = d;
      hit(d);
    }
    var w = {};
    for (var k in it) w[k] = it[k];
    w.owner = appId;
    if (it.source !== 'telemachus') w.launch = { id: appId, params: {} };
    d._sig = s;
    d._a = { id: id, title: it.title, sys: true, watch: w };
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
      if (items.length || owner) {
        items = [];
        sig = '';
        owner = null;
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
        if (owner) rebuild();
      },
      function () {}
    );
  }
  /* the focus moved (setFocus): a highlighted app with cards opens its row after a moment (passing over it does not); the focus going
     on along the owner's row or above it closes the row; below it (the row, the apps under it) the row stays */
  function focused(e) {
    clearTimeout(ownerT);
    var a = e && e._a;
    if (a && (a.watch || a.id === owner)) return;
    if (a && mine(a.id).length) {
      ownerT = setTimeout(function () {
        if (rows[r] && rows[r][c] === e) {
          owner = a.id;
          rebuild();
        }
      }, 400);
      return;
    }
    if (!owner) return;
    var p = posOf(e),
      op = tiles[owner] ? posOf(tiles[owner]) : null;
    if (!p || !op || p[0] <= op[0])
      ownerT = setTimeout(function () {
        owner = null;
        rebuild();
      }, 250);
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
    /* the open row: its owner and its cards, as many as a row holds */
    owner: function () {
      return owner;
    },
    cards: function () {
      return owner
        ? mine(owner)
            .slice(0, TH.cols)
            .map(function (it) {
              return card(it, owner);
            })
        : [];
    },
    focused: focused,
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
