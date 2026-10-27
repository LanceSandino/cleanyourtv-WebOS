/* ---------- Continue watching (the service's /api/watch/rows: Telemachus's now playing and up next, LG's recent apps): the first row of
   the app grid, picture cards with the title, the episode and how far it got; OK opens it where it is (act in config.js). Read when
   Home is shown and every minute while it is; Customise > Continue watching switches it off. ---------- */
var WATCH = (function () {
  var items = [],
    sig = '';
  function on() {
    return !(cfg.watch && cfg.watch.on === false);
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
    d.className = 'tile wcard' + (it.img && it.img.indexOf('/icon/') === 0 ? ' wicon' : '') + (it.img ? '' : ' wtext');
    d.style.setProperty('--c', it.source === 'telemachus' ? '120,150,255' : '200,200,210');
    d.innerHTML =
      '<div class="wimg"></div><div class="wtx"><div class="wt"></div><div class="ws"></div></div>' +
      (it.progress > 0 ? '<div class="wpg"><i></i></div>' : '');
    if (it.img) d.firstChild.style.backgroundImage = 'url("' + API + it.img + '")';
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
      return on() ? items.slice(0, TH.cols).map(card) : [];
    },
    refresh: refresh,
  };
})();
