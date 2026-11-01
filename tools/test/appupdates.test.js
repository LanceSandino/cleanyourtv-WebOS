// LG's app updates from the manager (appupdates.js): the apps LG's update list has an update for, joined with the installed apps
// (removed ones and LG's own left out), an update started as LG's store starts one (pkgInstall/install), one at a time, never the app
// on screen, nothing while LG installs something else, a finished update seen by its new version, and one that takes too long
// cancelled. Against a stand-in for LG's services.
const { ok, call, sleep, req, run } = require('./lib');

const P = 'luna://com.webos.service.pkgUpdate/statusAll',
  A = 'luna://com.webos.appUpdateService/statusAll',
  I = 'luna://com.webos.service.pkgInstall/';

// the stand-in TV: LG's update list, the installed apps, what is on screen, and installs that take a few looks to finish
function tv(o) {
  const t = Object.assign(
    {
      pkgUpdate: true,
      updates: [
        { id: 'com.disney.disneyplus-prod', status: 'Y', nsu: 'N', prohibit: 'N', type: 'W' },
        { id: 'amazon', status: 'F', nsu: 'N', prohibit: 'N', type: 'W' },
        { id: 'netflix', status: 'N', nsu: 'N', prohibit: 'N', type: 'N' },
        { id: 'com.peacock.tv', status: 'Y', nsu: 'N', prohibit: 'N', type: 'W' }, // removed since LG's check
        { id: 'com.webos.app.lifeonscreen', status: 'F', nsu: 'N', prohibit: 'N', type: 'S' }, // LG's own
        { id: 'old.app', status: 'Y', nsu: 'Y', prohibit: 'N', type: 'W' }, // needs newer TV software
      ],
      apps: {
        'com.disney.disneyplus-prod': { title: 'Disney+', version: '24.5.8' },
        amazon: { title: 'Prime Video', version: '7.5.11' },
        netflix: { title: 'Netflix', version: '3.0.1' },
        'com.webos.app.lifeonscreen': { title: 'Life on screen', version: '1.0', systemApp: true },
        'old.app': { title: 'Old', version: '1.0' },
      },
      fg: 'com.webos.app.home',
      looks: 2, // looks at LG's install list while an install runs
      newVersion: id => id + '-new',
      startFails: false,
      other: false, // LG installing an app of its own
    },
    o
  );
  t.calls = [];
  t.installing = null;
  t.luna = async (uri, p) => {
    t.calls.push([uri, p]);
    if (uri === P)
      return t.pkgUpdate ? { returnValue: true, status: { apps: t.updates } } : { returnValue: false, errorText: 'Unknown method' };
    if (uri === A) return { returnValue: true, status: { apps: t.updates } };
    if (/listApps$/.test(uri)) return { returnValue: true, apps: Object.keys(t.apps).map(id => Object.assign({ id }, t.apps[id])) };
    if (/getForegroundAppInfo$/.test(uri)) return { returnValue: true, appId: t.fg };
    if (uri === I + 'install') {
      if (t.startFails) return { returnValue: false, errorText: 'not signed in' };
      t.installing = { id: p.id, left: t.looks };
      return { returnValue: true };
    }
    if (uri === I + 'status') {
      if (t.other) return { returnValue: true, status: { apps: [{ id: 'some.other', details: { state: 'downloading' } }] } };
      const x = t.installing;
      if (!x) return { returnValue: true, status: { apps: [] } };
      if (x.left-- > 0) return { returnValue: true, status: { apps: [{ id: x.id, details: { state: 'downloading', progress: 50 } }] } };
      t.installing = null;
      if (t.newVersion(x.id)) t.apps[x.id].version = t.newVersion(x.id);
      return { returnValue: true, status: { apps: [] } };
    }
    if (uri === I + 'cancel') {
      t.installing = null;
      return { returnValue: true };
    }
    return { returnValue: true };
  };
  return t;
}
const make = (t, o) => req('appupdates').create({ luna: t.luna }, Object.assign({ pollMs: 10, limitMs: 400, startMs: 100 }, o));
async function until(c, ms) {
  for (let i = 0; i < (ms || 2000) / 10 && !c(); i++) await sleep(10);
}

run(async () => {
  // the list: updates only, joined with the installed apps; removed apps and LG's own left out; one needing new TV software marked
  let t = tv();
  let U = make(t);
  let r = await call(U, '/api/appupdates', 'GET');
  const ids = r.j.apps.map(a => a.id).join();
  ok(
    r.code === 200 &&
      r.j.ok === true &&
      ids === 'com.disney.disneyplus-prod,old.app,amazon' &&
      r.j.apps[0].title === 'Disney+' &&
      r.j.apps[0].version === '24.5.8' &&
      r.j.apps[0].required === false &&
      r.j.apps[2].required === true &&
      r.j.apps[1].firmware === true,
    'the updates LG found, by name, with their versions; required ones and those needing newer TV software marked: ' +
      JSON.stringify(r.j.apps)
  );
  ok(!t.calls.some(c => /pkgInstall\/install/.test(c[0])), 'reading the list installs nothing');
  // webOS without pkgUpdate's list: the app update service's own
  t = tv({ pkgUpdate: false });
  r = await call(make(t), '/api/appupdates', 'GET');
  ok(
    r.j.ok && r.j.apps.length === 3 && t.calls.some(c => c[0] === A),
    "without pkgUpdate's list, the app update service's: " + r.j.apps.length
  );

  // one update: started as LG's store starts it, watched until LG's install list lets it go and the version changed
  t = tv();
  U = make(t);
  r = await call(U, '/api/appupdates/update', 'POST', { id: 'com.disney.disneyplus-prod' });
  ok(r.code === 200 && r.j.ok === true, 'an update is taken: ' + JSON.stringify(r.j));
  await until(() => U.status().last.length);
  const inst = t.calls.filter(c => c[0] === I + 'install');
  ok(
    inst.length === 1 &&
      JSON.stringify(inst[0][1]) ===
        JSON.stringify({ id: 'com.disney.disneyplus-prod', subscribe: false, silence: false, target: { deviceId: 'INTERNAL_STORAGE' } }),
    "started with LG's store's own call: " + JSON.stringify(inst)
  );
  let L = U.status().last[0];
  ok(
    L.ok === true && /updated to com\.disney\.disneyplus-prod-new/.test(L.why),
    'done when the new version is installed: ' + JSON.stringify(L)
  );
  // the progress the manager reads while updates run: from the service alone, LG's list not asked
  const asked = t.calls.length;
  r = await call(U, '/api/appupdates/state', 'GET');
  ok(
    r.code === 200 && r.j.last.length === 1 && r.j.updating === null && t.calls.length === asked,
    'the progress without asking LG: ' + JSON.stringify(r.j)
  );

  // all of them: one at a time, the one that needs newer TV software left out
  t = tv();
  U = make(t);
  let most = 0;
  const luna0 = t.luna;
  t.luna = async (uri, p) => {
    const x = await luna0(uri, p);
    most = Math.max(most, t.installing ? 1 : 0);
    return x;
  };
  U = make(t);
  r = await call(U, '/api/appupdates/update', 'POST', { all: true });
  await until(() => U.status().last.length === 2);
  const order = t.calls.filter(c => c[0] === I + 'install').map(c => c[1].id);
  ok(
    r.j.ok &&
      order.join() === 'com.disney.disneyplus-prod,amazon' &&
      U.status().last.every(x => x.ok) &&
      !U.status().updating &&
      !U.status().queued.length,
    'Update all: each app with an update, one after the other, not the one needing newer TV software: ' + order.join()
  );

  // never the app on screen; nothing while LG installs something else
  t = tv({ fg: 'com.disney.disneyplus-prod' });
  U = make(t);
  await call(U, '/api/appupdates/update', 'POST', { id: 'com.disney.disneyplus-prod' });
  await until(() => U.status().last.length);
  L = U.status().last[0];
  ok(!L.ok && /open on the TV/.test(L.why) && !t.calls.some(c => c[0] === I + 'install'), 'the app on screen is not updated: ' + L.why);
  t = tv({ other: true });
  U = make(t);
  await call(U, '/api/appupdates/update', 'POST', { id: 'amazon' });
  await until(() => U.status().last.length);
  L = U.status().last[0];
  ok(
    !L.ok && /installing an app already/.test(L.why) && !t.calls.some(c => c[0] === I + 'install'),
    'not while LG installs another: ' + L.why
  );

  // LG refuses to start; LG ends without a new version; it takes too long and is cancelled
  t = tv({ startFails: true });
  U = make(t);
  await call(U, '/api/appupdates/update', 'POST', { id: 'amazon' });
  await until(() => U.status().last.length);
  ok(!U.status().last[0].ok && U.status().last[0].why === 'not signed in', "LG's refusal is kept: " + U.status().last[0].why);
  t = tv({ newVersion: () => '' });
  U = make(t);
  await call(U, '/api/appupdates/update', 'POST', { id: 'amazon' });
  await until(() => U.status().last.length);
  ok(!U.status().last[0].ok && /still 7\.5\.11/.test(U.status().last[0].why), 'ended without a new version: ' + U.status().last[0].why);
  t = tv({ looks: 1000 });
  U = make(t);
  await call(U, '/api/appupdates/update', 'POST', { id: 'amazon' });
  await until(() => U.status().last.length, 3000);
  ok(
    !U.status().last[0].ok && /cancelled/.test(U.status().last[0].why) && t.calls.some(c => c[0] === I + 'cancel' && c[1].id === 'amazon'),
    'too long: cancelled: ' + U.status().last[0].why
  );

  // refused: no app, a name that is not an app id, an app LG has no update for, one needing newer TV software, a GET
  t = tv();
  U = make(t);
  const bad = [
    await call(U, '/api/appupdates/update', 'POST', {}),
    await call(U, '/api/appupdates/update', 'POST', { id: '../x; rm' }),
    await call(U, '/api/appupdates/update', 'POST', { id: 'netflix' }),
    await call(U, '/api/appupdates/update', 'POST', { id: 'old.app' }),
    await call(U, '/api/appupdates/update', 'POST', { id: 'com.peacock.tv' }),
  ].map(x => x.code);
  ok(bad.join() === '400,400,409,409,409' && !t.calls.some(c => c[0] === I + 'install'), 'refused, nothing installed: ' + bad.join());
  // LG's list cannot be read
  t = tv({ pkgUpdate: false });
  t.updates = null;
  r = await call(make(t), '/api/appupdates', 'GET');
  ok(r.j.ok === false && /could not be read/.test(r.j.error) && !r.j.apps.length, "LG's list unread: said so: " + r.j.error);
});
