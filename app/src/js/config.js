/* ---------- config (edited in the launcher, saved through the helper) ---------- */
function saveCfg() {
  api('/api/config', cfg).catch(function () {
    toast(t('Could not save the settings. Try again in a moment.'), true);
  });
  store();
  rebuild();
  WALL.sync(); /* a changed Wallpapers setting (on, off, the interval) takes effect at once, not only the next time Home opens */
  SAVER.sync(); /* the same for the Screensaver */
}
function isHidden(id) {
  return (cfg.hidden || []).indexOf(id) >= 0;
}
function dockIds() {
  var by = {};
  apps.forEach(function (a) {
    by[a.id] = a;
  });
  var ids = (cfg.dock && cfg.dock.length ? cfg.dock : DEFAULTS.dock).filter(function (i) {
    return by[i] && !isHidden(i);
  });
  /* a theme with room for more apps than the saved dock: the most used apps fill the rest (the saved dock is not changed) */
  if (ids.length < TH.dockN)
    apps
      .filter(function (a) {
        return !a.input && a.id.indexOf('__') !== 0 && !isHidden(a.id) && ids.indexOf(a.id) < 0;
      })
      .sort(byOrder)
      .slice(0, TH.dockN - ids.length)
      .forEach(function (a) {
        ids.push(a.id);
      });
  return ids.slice(0, TH.dockN);
}
function setDock(ids) {
  cfg.dock = ids.slice(0, TH.dockN);
  saveCfg();
}
function hideApp(id) {
  cfg.hidden = (cfg.hidden || []).concat(id);
  cfg.dock = dockIds().filter(function (i) {
    return i !== id;
  });
  saveCfg();
}
function unhideApp(id) {
  cfg.hidden = (cfg.hidden || []).filter(function (i) {
    return i !== id;
  });
  saveCfg();
}
function topbar() {
  return cfg.topbar ? cfg.topbar : DEFAULTS.topbar;
}
/* Live TV is optional (manager > Live TV): off hides every entry, the saved layout is kept for when it is switched on again */
function liveOn() {
  return !(cfg.options && cfg.options.liveTv === false);
}
function shownBar() {
  return liveOn()
    ? topbar()
    : topbar().filter(function (o) {
        return o.action !== 'live';
      });
}
function byOrder(a, b) {
  if (cfg.sort !== 'alpha') {
    var d = (usage[b.id] || 0) - (usage[a.id] || 0);
    if (Math.abs(d) > 1e-9) return d > 0 ? 1 : -1;
  }
  return a.title.localeCompare(b.title);
}
function title(id) {
  for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i].title;
  return id;
}

/* ---------- actions ---------- */
function act(e) {
  var a = e._a;
  if (a) {
    if (!a.sys) {
      e.classList.add('launching');
      setTimeout(function () {
        e.classList.remove('launching');
      }, 4000);
    }
    return launch(a.id);
  }
  var o = e._o || {};
  if (o.action === 'customize') return customizeMenu();
  if (o.action === 'live') return LIVE.enter();
  if (o.action === 'inputs') return inputsMenu();
  if (o.app) launch(o.app, o.params);
}
