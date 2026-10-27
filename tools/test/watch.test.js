// Continue watching (watch.js): Telemachus on the TV (a stand-in here) and LG's recents list give Home's first grid row: what is
// playing with how far it got, what comes next, the apps opened last; pictures only from TMDB, by an id, never by address.
const http = require('http');
const { ok, call, req, run, memoryConfig } = require('./lib');

run(async () => {
  let up = true;
  const brief = {
    state: {
      now_playing: {
        show: 'Show A',
        season: 2,
        episode: 5,
        title: 'Five',
        poster: 'https://image.tmdb.org/t/p/original/a.jpg',
        position_seconds: 600,
        length_seconds: 2400,
      },
      plan: [
        { show: 'Show A', season: 2, episode: 5, title: 'Five' },
        { show: 'Show A', season: 2, episode: 6, title: 'Six', poster: 'https://image.tmdb.org/t/p/w500/a6.jpg' },
        { film: true, film_title: 'A Film', year: 1999, tmdb_id: 'tmdb:42', poster: 'https://image.tmdb.org/t/p/w500/f.jpg' },
        { show: 'Show B', season: 1, episode: 1, title: 'Pilot', poster: 'http://evil.example/x.jpg' },
      ],
    },
  };
  const tm = http.createServer((q, r) => {
    if (!up) return q.socket.destroy();
    const send = o => (r.writeHead(200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    if (q.headers.origin) return r.writeHead(403), r.end();
    if (q.url === '/api/brief') return send(brief);
    if (q.url === '/api/shows') return send({ shows: [{ show: 'Show A', backdrop: 'https://image.tmdb.org/t/p/original/back.jpg' }] });
    r.writeHead(404);
    r.end();
  });
  await new Promise(res => tm.listen(0, '127.0.0.1', res));
  process.env.CYTV_TELEMACHUS = 'http://127.0.0.1:' + tm.address().port;
  const luna = async uri =>
    /listRecents/.test(uri)
      ? {
          returnValue: true,
          recentsAppList: [
            { appId: 'com.telemachus.screen', title: 'Telemachus' },
            { appId: 'netflix', title: 'Netflix' },
            { appId: 'com.cleanyourtv.manager', title: 'CleanYourTV' },
            { appId: 'hidden.app', title: 'Hidden' },
            { appId: 'com.webos.app.hdmi4', title: 'PS5' },
            { appId: 'gone.app', title: 'Uninstalled' },
          ],
        }
      : { returnValue: true };
  const appsStub = { apps: async () => [{ id: 'netflix' }, { id: 'hidden.app' }] };
  const W = req('watch');
  const config = memoryConfig({ hidden: ['hidden.app'] });
  const w = W.create({ config, luna, feature: n => (n === 'apps' ? appsStub : null) });
  const items = (await call(w, '/api/watch/rows')).j.items;
  const keys = items.map(i => i.key);
  ok(
    keys.join() === 'tm-now,tm-Show A-2-6,app-netflix,app-com.webos.app.hdmi4,tm-film-tmdb:42,tm-Show B-1-1',
    'what is playing, then what comes next, then the apps opened last, then the rest of the plan (' + keys.join() + ')'
  );
  const now = items[0];
  ok(
    now.progress === 0.25 && now.sub === 'S2 E5 · Five' && now.launch.params.play.resume === true,
    'what is playing shows how far it got and resumes'
  );
  ok(
    items[1].launch.id === 'com.telemachus.screen' &&
      JSON.stringify(items[1].launch.params) === '{"play":{"show":"Show A","season":2,"episode":6}}',
    'the next episode opens in Telemachus at that episode'
  );
  ok(
    items[4].launch.params.play.film === 'A Film' && items[4].launch.params.play.tmdb_id === 'tmdb:42',
    'a film opens by its title and TMDB id'
  );
  ok(
    /^\/api\/watch\/img\/[0-9a-f]{16}$/.test(now.img) && now.img === items[1].img && JSON.stringify(items).indexOf('tmdb.org') < 0,
    "a show's picture is its backdrop, named by an id; no address reaches the page"
  );
  ok(
    items[5].img === '' && items[3].img === '' && items[2].img === '/icon/netflix',
    'a picture from another site is not used; an input has none, an app its icon'
  );
  ok((await call(w, '/api/watch/img/0000000000000000')).code === 404, 'an unknown picture id is not fetched');
  up = false;
  const w2 = W.create({ config, luna, feature: () => null });
  const only = (await call(w2, '/api/watch/rows')).j.items.map(i => i.source);
  ok(only.length && only.every(s => s === 'recent'), 'without Telemachus the row shows the apps opened last');
  tm.close();
});
