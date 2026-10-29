/* ---------- Choosing one wallpaper (Customize > Wallpapers > Choose a photo...): the Wallpapers photos one at a time, full screen and
   whole on black. Left and Right browse (mirrored for a right-to-left language), OK uses the photo on the screen as the only wallpaper
   (cfg.wall.pick; wall.js then keeps it instead of changing photos), Back leaves. With the Magic Remote, the left and right thirds of
   the screen browse and the middle chooses. One photo at a time, the ones on either side loaded ahead: a grid of 4K photos would be
   too much for the TV's GPU. ---------- */
var WALLPICK = (function () {
  var open = false,
    list = [],
    at = 0,
    els = null,
    swallow = false,
    ahead = [];
  function layer() {
    if (els) return els;
    var w = document.createElement('div');
    w.id = 'wpk';
    w.innerHTML = '<div id="wpkp"></div><div id="wpkb"><div id="wpkn"></div><div id="wpkh"></div></div>';
    document.body.appendChild(w);
    els = { w: w, p: w.childNodes[0], n: $('wpkn'), h: $('wpkh') };
    els.w.addEventListener('click', function (e) {
      if (!open) return;
      var x = e.clientX / (window.innerWidth || 1920);
      if (rtl()) x = 1 - x;
      if (x < 1 / 3) step(-1);
      else if (x > 2 / 3) step(1);
      else choose();
    });
    return els;
  }
  function url(id) {
    return API + '/api/wallpapers/photo/' + id;
  }
  function show() {
    var l = layer(),
      id = list[at],
      u = url(id),
      im = new Image();
    l.n.textContent = at + 1 + ' / ' + list.length + (cfg.wall && cfg.wall.pick === id ? ' · ' + t('in use') : '');
    im.onload = function () {
      if (open && list[at] === id) l.p.style.backgroundImage = 'url("' + u + '")';
    };
    im.src = u;
    ahead = [list[(at + 1) % list.length], list[(at + list.length - 1) % list.length]].map(function (x) {
      var i = new Image();
      i.src = url(x);
      return i;
    });
  }
  function step(d) {
    at = (at + d + list.length) % list.length;
    show();
  }
  function close() {
    open = false;
    ahead = [];
    if (els) {
      els.w.className = '';
      els.p.style.backgroundImage = '';
    }
  }
  function choose() {
    cfg.wall = { on: true, secs: wallSecs(), pick: list[at] };
    close();
    saveCfg();
    if (stack.length) refreshMenu();
    toast(t('This photo is your wallpaper now.'));
  }
  function start() {
    api('/api/wallpapers/list').then(
      function (x) {
        list = (x && x.photos) || [];
        if (!list.length) return toast(t('No photos yet: add them in the CleanYourTV app.'), true);
        at = Math.max(0, list.indexOf(cfg.wall && cfg.wall.pick));
        open = true;
        var l = layer();
        l.h.textContent = t('Left and Right: browse · OK: use this photo · Back: cancel');
        l.w.className = 'on';
        show();
      },
      function () {
        toast(t('Could not read the photos.'), true);
      }
    );
  }
  function eat(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  /* while it is open every key is its own and goes no further (the menu under it waits) */
  window.addEventListener(
    'keydown',
    function (e) {
      if (!open) return;
      var k = e.keyCode;
      if (k === 37 || k === 39) step((k === 39) !== rtl() ? 1 : -1);
      else if (k === 13) choose();
      else if (k === 461 || k === 27 || k === 8) close();
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
  return {
    start: start,
    close: close,
    open: function () {
      return open;
    },
  };
})();
