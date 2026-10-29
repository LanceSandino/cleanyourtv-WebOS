/* ---------- a theme's frame (effects.overlay; the holiday themes have one): one still, transparent picture over the background, the
   wallpaper and the photos, under the clock, the buttons and the apps. Nothing in it moves, so it costs the TV nothing once it is
   drawn. ---------- */
var FRAME = (function () {
  var el = null,
    url = '';
  function set(o) {
    var u = o && o.file ? API + '/api/theme/wallpaper/' + o.id + '/' + o.file : '';
    if (u === url) return;
    url = u;
    if (!u) {
      if (el) el.remove();
      el = null;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'thframe';
      document.body.insertBefore(el, $('top'));
    }
    el.style.backgroundImage = 'url("' + u + '")';
  }
  /* the front of the theme's wallpaper (effects.foreground): over the clock, under the apps, the cards and the menus, so the clock
     stands behind the scenery. Not over the user's own photos: it belongs to the theme's picture. */
  var fgEl = null,
    fgUrl = '';
  function fg(o) {
    var u = o && o.file ? API + '/api/theme/wallpaper/' + o.id + '/' + o.file : '';
    if (u === fgUrl) return;
    fgUrl = u;
    if (u) document.body.setAttribute('data-fg', '');
    else document.body.removeAttribute('data-fg');
    if (!u) {
      if (fgEl) fgEl.remove();
      fgEl = null;
      return;
    }
    if (!fgEl) {
      fgEl = document.createElement('div');
      fgEl.id = 'thfg';
      document.body.insertBefore(fgEl, $('shelf'));
    }
    fgEl.style.backgroundImage = 'url("' + u + '")';
  }
  return { set: set, fg: fg };
})();
