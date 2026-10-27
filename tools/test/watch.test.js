// Continue watching (watch.js): Telemachus on the TV (a stand-in here) gives the cards its app shows on Home: what is playing (with how
// far it got), the episode each other show is in the middle of, then what its channel plays next; never app shortcuts.
// Episode titles that are file names are cleaned; pictures only from TMDB, by an id, never by address.
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
        title: 'Show A S02E05 - Five',
        poster: 'https://image.tmdb.org/t/p/original/a.jpg',
        position_seconds: 600,
        length_seconds: 2400,
      },
      shows: [
        { show: 'Show A', in_progress: [{ season: 2, episode: 5, percent: 25 }] },
        {
          show: 'Show C',
          in_progress: [
            { season: 1, episode: 2, percent: 10 },
            { season: 1, episode: 3, percent: 40 },
          ],
        },
        { show: 'Show D', in_progress: [] },
      ],
      plan: [
        { show: 'Show A', season: 2, episode: 6, title: 'Six', poster: 'https://image.tmdb.org/t/p/w500/a6.jpg' },
        { show: 'Show C', season: 1, episode: 3, title: 'Show C S01E03 - Three' },
        { show: 'Show C', season: 1, episode: 4, title: 'Four' },
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
  const W = req('watch');
  const config = memoryConfig({});
  const make = () => W.create({ config, luna: async () => ({ returnValue: true }), feature: () => null });
  const w = make();
  const items = (await call(w, '/api/watch/rows')).j.items;
  const keys = items.map(i => i.key);
  ok(
    keys.join() === 'tm-Show A-2-5,tm-Show C-1-3,tm-Show A-2-6,tm-Show C-1-4,tm-film-tmdb:42,tm-Show B-1-1',
    'what is playing, the episode another show is in the middle of, then the next four in the lineup without those (' + keys.join() + ')'
  );
  const now = items[0];
  ok(
    now.progress === 0.25 && now.sub === 'S2 E5 · Five' && now.launch.params.play.resume === true && !now.next,
    'what is playing shows how far it got, its title without the file name, and resumes'
  );
  ok(
    items[1].sub === 'S1 E3 · Three' &&
      items[1].progress === 0.4 &&
      JSON.stringify(items[1].launch.params) === '{"play":{"show":"Show C","season":1,"episode":3}}',
    "another show's started episode: the latest one, how far it got, it opens in Telemachus there"
  );
  ok(
    items[2].next &&
      JSON.stringify(items[2].launch.params) === '{"play":{"show":"Show A","season":2,"episode":6}}' &&
      items[4].next &&
      items[4].launch.params.play.film === 'A Film' &&
      items[4].launch.params.play.tmdb_id === 'tmdb:42',
    "the channel's next are marked next; an episode opens at that episode, a film by its title and TMDB id"
  );
  ok(
    /^\/api\/watch\/img\/[0-9a-f]{16}$/.test(now.img) && JSON.stringify(items).indexOf('tmdb.org') < 0,
    "a show's picture is its backdrop, named by an id; no address reaches the page"
  );
  ok(
    items.every(i => i.source === 'telemachus' && !i.app),
    'no app shortcuts: the apps are on Home already'
  );
  ok((await call(w, '/api/watch/img/0000000000000000')).code === 404, 'an unknown picture id is not fetched');
  // nothing playing, nothing started: the next on the channel, with a picture from another site left out
  brief.state.now_playing = null;
  brief.state.shows = [];
  brief.state.plan = brief.state.plan.slice(4);
  const next = (await call(make(), '/api/watch/rows')).j.items;
  ok(
    next.length === 1 && next[0].next && next[0].sub === 'S1 E1 · Pilot' && next[0].img === '',
    'only what the channel plays next; a picture from another site is not used'
  );
  up = false;
  ok((await call(make(), '/api/watch/rows')).j.items.length === 0, 'without Telemachus (and nothing linked) the row is empty');
  tm.close();
});
