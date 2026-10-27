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
  return { set: set };
})();
