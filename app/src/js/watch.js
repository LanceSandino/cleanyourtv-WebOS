/* ---------- Continue watching (the service's /api/watch/rows: what Telemachus has started and plays next, what Plex, Stremio and Disney+
   have partly watched once linked, and LG's own rows of the other apps: YouTube's videos, Disney+'s films until Disney+ is linked). The cards are shown only where
   they belong: when an app that has some is highlighted on Home, a row of its cards opens under that app's row a moment later; Down goes into it, OK opens one in that app (act
   in config.js), hold OK has its options (watchCardMenu). The row closes when the focus moves on along that row or above it. Read when
   Home is shown and every minute while it is; Customize > Continue watching switches it off. ---------- */
/* where a card comes from, named on it (a card of Telemachus's channel says it plays next), and the apps that show it */
var SOURCE_NAMES = { telemachus: 'Telemachus', plex: 'Plex', stremio: 'Stremio', disney: 'Disney+' },
  SOURCE_APPS = {
    telemachus: ['com.telemachus.screen'],
    plex: ['cdp-30', 'com.beb.plxnative'],
    stremio: ['io.strem.tv'],
    disney: ['com.disney.disneyplus-prod'],
  },
  SOURCE_TINT = { telemachus: '120,150,255', plex: '229,160,13', stremio: '123,91,245', disney: '64,110,230' };
/* a card belongs to the app LG named (its rows), or to the apps of its source */
function cardOf(it, appId) {
  return it.app ? it.app === appId : !!SOURCE_APPS[it.source] && SOURCE_APPS[it.source].indexOf(appId) >= 0;
}
var WATCH = (function () {
  var items = [],
    sig = '',
    owner = null /* the app whose row is open */,
    ownerT = 0,
    fresh = false; /* the row was just opened: its cards come in one after the other */
  function on() {
    return !(cfg.watch && cfg.watch.on === false);
  }
  function lgOn() {
    return !(cfg.watch && cfg.watch.lg === false);
  }
  /* what was removed with hold OK: a show or film (its group), or an app's whole row ('app:<id>') */
  function removed() {
    return (cfg.watch && cfg.watch.hide) || [];
  }
  /* the switches kept with the removed list: on (all rows), lg (LG's rows of the other apps), tm (Telemachus's row) */
  function tmOn() {
    return !(cfg.watch && cfg.watch.tm === false);
  }
  function save(on, hide, lg, tm) {
    cfg.watch = { on: on };
    if (!lg) cfg.watch.lg = false;
    if (tm === undefined ? !tmOn() : !tm) cfg.watch.tm = false;
    if (hide.length) cfg.watch.hide = hide.slice(-100);
    saveCfg();
  }
  /* the cards an app shows */
  function mine(appId) {
    var gone = removed();
    if (!on() || gone.indexOf('app:' + appId) >= 0) return [];
    return items.filter(function (it) {
      return cardOf(it, appId) && gone.indexOf(it.group) < 0 && (it.source !== 'lg' || lgOn()) && (it.source !== 'telemachus' || tmOn());
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
    /* Plex and Stremio open in the app they are under (no deep link); Telemachus, Disney+ and LG's rows open the item itself */
    if (it.source === 'plex' || it.source === 'stremio') w.launch = { id: appId, params: {} };
    d._sig = s;
    d._a = { id: id, title: it.title, sys: true, watch: w };
    d.className = 'tile wcard' + (it.img ? '' : ' wtext');
    d.style.setProperty('--c', SOURCE_TINT[it.source] || '200,200,210');
    d.innerHTML =
      '<div class="wimg"></div><div class="wsrc"></div><div class="wtx"><div class="wt"></div><div class="ws"></div></div>' +
      (it.progress > 0 ? '<div class="wpg"><i></i></div>' : '');
    if (it.img) d.firstChild.style.backgroundImage = 'url("' + API + it.img + '")';
    d.querySelector('.wsrc').textContent = SOURCE_NAMES[it.source]
      ? (it.next ? t('Up next on %s') : '%s').replace('%s', SOURCE_NAMES[it.source])
      : '';
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
          fresh = true;
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
      var f = fresh;
      fresh = false;
      return owner
        ? mine(owner)
            .slice(0, TH.cols)
            .map(function (it, i) {
              var d = card(it, owner);
              d.classList.toggle('win', f);
              d.style.animationDelay = f ? i * 45 + 'ms' : '';
              return d;
            })
        : [];
    },
    focused: focused,
    refresh: refresh,
    on: on,
    removed: removed,
    lgOn: lgOn,
    setOn: function (v) {
      save(v, removed(), lgOn());
      refresh();
    },
    setLg: function (v) {
      save(on(), removed(), v);
    },
    tmOn: tmOn,
    /* Telemachus's row: the service stops reading Telemachus (helper/watch.js) */
    setTm: function (v) {
      save(on(), removed(), lgOn(), v);
      refresh();
    },
    /* a show or film (its group), or an app's whole row ('app:<id>') */
    remove: function (g) {
      if (g) save(on(), removed().concat([g]), lgOn());
    },
    /* the apps LG has a row for (YouTube, Disney+, Netflix...), each switched on or off on its own (an app's whole row, as above) */
    lgApps: function () {
      var seen = [];
      items.forEach(function (it) {
        if (it.source === 'lg' && it.app && seen.indexOf(it.app) < 0) seen.push(it.app);
      });
      return seen;
    },
    appOn: function (appId) {
      return removed().indexOf('app:' + appId) < 0;
    },
    setApp: function (appId, v) {
      var g = 'app:' + appId,
        rest = removed().filter(function (x) {
          return x !== g;
        });
      save(on(), v ? rest : rest.concat([g]), lgOn());
    },
    restore: function () {
      save(on(), [], lgOn());
    },
  };
})();
