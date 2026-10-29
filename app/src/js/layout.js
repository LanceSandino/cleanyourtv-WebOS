/* ---------- layout ---------- */
function rebuild() {
  geoReset();
  var by = {};
  apps.forEach(function (a) {
    by[a.id] = a;
  });
  var di = dockIds(),
    dock = di.map(function (i) {
      return by[i];
    });
  var rest = apps
    .filter(function (a) {
      return !isHidden(a.id) && di.indexOf(a.id) < 0;
    })
    .sort(byOrder);
  var oldE = rows[r] && rows[r][c],
    keep = oldE && oldE._a ? oldE._a.id : null;
  if (oldE) oldE.classList.remove('f');
  var dk = $('dock'),
    gd = $('grid'),
    bar = $('bar');
  dk.textContent = '';
  gd.textContent = '';
  bar.textContent = '';
  var d = dock.map(function (a) {
    var t = tile(a);
    dk.appendChild(t);
    fit(t, true);
    return t;
  });
  /* Continue watching (watch.js): the highlighted app's cards, a row of their own under that app's row (the grid's first row when
     the app is in the dock); the apps go on in the row after them */
  var w = WATCH.cards(),
    own = WATCH.owner(),
    oi = own ? rest.indexOf(by[own]) : -1,
    at = !w.length ? -1 : di.indexOf(own) >= 0 ? 0 : oi >= 0 ? Math.floor(oi / TH.cols) + 1 : -1;
  if (at < 0) w = [];
  var put = function () {
    w.forEach(function (t, i) {
      t.style.gridColumnStart = i === 0 ? '1' : '';
      gd.appendChild(t);
    });
  };
  var g = rest.map(function (a, i) {
    if (w.length && i === at * TH.cols) put();
    var t = tile(a);
    t.style.gridColumnStart = w.length && i === at * TH.cols && w.length % TH.cols ? '1' : '';
    gd.appendChild(t);
    fit(t, TH.wide);
    return t;
  });
  if (w.length && at * TH.cols >= rest.length) put();
  var tb = shownBar()
    .concat([{ label: 'Customize', icon: 'edit', action: 'customize', fixed: true }])
    .map(function (o) {
      var p = document.createElement('div');
      p.className = 'pill';
      p._o = o;
      p.innerHTML = svg(o.icon) + '<span></span>';
      p.lastChild.textContent = barLabel(o);
      hit(p);
      bar.appendChild(p);
      return p;
    });
  /* cards come first, so the ones OK can switch (a Home Assistant light) join the top row */
  drawCards();
  var top = tb.concat(cardTargets());
  placeShelf(d.length);
  rows = [top, d.length ? d : top];
  for (var i = 0; i < g.length; i += TH.cols) {
    if (w.length && i === at * TH.cols) rows.push(w);
    rows.push(g.slice(i, i + TH.cols));
  }
  if (w.length && at * TH.cols >= g.length) rows.push(w);
  decoRebuild();
  var nr = Math.min(r, rows.length - 1),
    nc = c;
  if (keep && tiles[keep]) {
    var p = posOf(tiles[keep]);
    if (p) {
      nr = p[0];
      nc = p[1];
    }
  }
  setFocus(nr, nc, true);
  markRunning();
}

/* the apps that are open get a green dot; read each time Home is shown, kept only in memory */
var running = {};
function markRunning() {
  var on = cfg.runDots === true;
  for (var id in tiles) {
    var d = tiles[id],
      dot = d.querySelector('.rd');
    if (on && running[id] && !dot) {
      dot = document.createElement('i');
      dot.className = 'rd';
      d.appendChild(dot);
    } else if ((!on || !running[id]) && dot) dot.remove();
  }
}
function readRunning() {
  api('/api/running').then(
    function (x) {
      running = {};
      (x.apps || []).forEach(function (a) {
        running[a.id] = true;
      });
      markRunning();
    },
    function () {}
  );
}
function load() {
  readRunning();
  api('/api/apps')
    .then(function (x) {
      if (x.version && oldSvc(x.version) && !warned) {
        warned = true;
        toast('The service (' + x.version + ') is older than this launcher needs: update it in the CleanYourTV manager');
      }
      usage = x.usage || {};
      var rank = Object.keys(usage).sort(function (a, b) {
        return usage[b] - usage[a];
      });
      var sig = JSON.stringify([
        x.apps.map(function (a) {
          return a.input ? [a.id, a.title, a.off] : a.id;
        }),
        x.config,
        rank,
      ]);
      if (sig === lastSig) return;
      lastSig = sig;
      apps = x.apps.map(function (a) {
        return a.input ? { id: a.id, title: a.title, input: a.input, off: !!a.off } : { id: a.id, title: a.title, rm: !!a.removable };
      });
      cfg = x.config || {};
      useLang(cfg.lang);
      applyTheme(cfg.theme);
      if (liveOn()) apps.push({ id: '__live', title: t('Live TV') });
      store();
      rebuild();
      WALL.sync();
      if (!perfReady) {
        perfReady = true;
        perfMark('launcher ready ' + Math.round(performance.now()));
      }
    })
    .catch(function () {
      toast(t('Helper not reachable, retrying...'));
      setTimeout(load, 3000);
    });
}
