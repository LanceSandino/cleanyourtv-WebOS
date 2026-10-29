// Search on Home (search.js, GET /api/search?q=): the words are matched against the titles of the rows Home already has (Telemachus
// on the TV, the rows Netflix writes itself, LG's picks only while they are on), with the same switches and removed cards as Home,
// and each hit opens the way its card opens; the apps that open their own search with words (YouTube's inAppSearchParams) get the
// words; when no app has the title, Telemachus, Plex (or PLX) and Stremio are offered. A search reads nothing anew and calls no
// address at all: the Telemachus and Plex stand-ins here (on this machine) answer only Home's read of the rows before the searches.
const http = require('http'),
  https = require('https'),
  net = require('net'),
  tls = require('tls');
const { ok, call, req, run, memoryConfig, serve } = require('./lib');

run(async () => {
  const S = req('search');
  const n = S.norm;

  // ---- matching: case, punctuation, a leading "The", accents, a year in brackets
  ok(
    n('THE OFFICE') === 'office' && n('The Office (2005)') === 'office' && n('the office') === 'office',
    'case, a leading "The" and a year in brackets do not count'
  );
  ok(
    n("Grey's Garden") === 'greys garden' &&
      n('Grey’s Garden') === 'greys garden' &&
      n('Spider-Cat: No Way Home') === 'spider cat no way home',
    'punctuation is a space, an apostrophe joins (' + n("Grey's Garden") + ', ' + n('Spider-Cat: No Way Home') + ')'
  );
  ok(n('Amélie') === 'amelie' && n('Pokémon') === 'pokemon' && n('Ørsted') === 'orsted', 'accents do not count');
  ok(
    n('Rock & Roll') === 'rock and roll' && n('What If…?') === 'what if' && n('Theodore') === 'theodore',
    '"&" is "and"; "The" only as a word'
  );
  const sc = (title, q) => S.score(n(title), n(q));
  ok(
    sc('The Office', 'office') === 100 && sc('THE OFFICE!', 'The office.') === 100,
    'the same title with other case and punctuation is a full match'
  );
  ok(
    sc('The Office (US)', 'office') > sc('Officer Down', 'office') && sc('Officer Down', 'office') > 0,
    'a whole word first, then a word that begins so'
  );
  ok(sc('Breaking Point', 'point') > 0 && sc('Breaking Point', 'break point') > 0, 'words anywhere in the title, each the start of a word');
  ok(sc('Spider-Cat', 'spidercat') > 0, 'a title written as one word');
  ok(sc('Breaking Point', 'breking point') > 0 && sc('Persistence', 'persistance') > 0, 'one typo is forgiven');
  ok(sc('Breaking Point', 'zzz') === 0 && sc('Persistence', 'per x') === 0 && sc('Cat', 'dog') === 0, 'something else does not match');
  ok(sc('Breaking Point', 'breaking point') > sc('Breaking Point', 'breking point'), 'a typo ranks below the words as written');

  // ---- an app's own search: the words in place of $SEARCH_KEYWORD
  const YT = '{ "contentTarget" : "q=$SEARCH_KEYWORD"}'; // as webOS 25's app manager lists YouTube's and YouTube TV's
  ok(
    JSON.stringify(S.fill(YT, 'star wars')) === '{"contentTarget":"q=star wars"}',
    "YouTube's search gets the words (" + JSON.stringify(S.fill(YT, 'star wars')) + ')'
  );
  ok(
    JSON.stringify(S.fill(YT, 'rock & roll #1 100%+')) === '{"contentTarget":"q=rock %26 roll %231 100%25%2B"}',
    'what would end or split its query (&, #, %, +) is written as %XX'
  );
  ok(
    JSON.stringify(S.fill({ contentTarget: { q: '$SEARCH_KEYWORD', n: 1, on: true, list: [1] } }, 'x')) ===
      '{"contentTarget":{"q":"x","n":1,"on":true}}',
    'an object is filled the same way; numbers and switches stay, lists are dropped'
  );
  ok(
    S.fill('not json', 'x') === null &&
      S.fill('[1]', 'x') === null &&
      S.fill('{"contentTarget":"$CONTENTID"}', 'x') === null &&
      S.fill('{"a":"$SEARCH_KEYWORD","b":"' + 'x'.repeat(1100) + '"}', 'x') === null &&
      S.fill(null, 'x') === null,
    'no search without $SEARCH_KEYWORD, or from something that is not an object (or too long)'
  );

  // ---- the route, with the service's own apps.js and watch.js; the TV's luna and Telemachus are stood in for
  const tmServer = await serve((q, r) => {
    r.setHeader('content-type', 'application/json');
    if (q.url === '/api/continue')
      return r.end(
        JSON.stringify({
          continue: [
            { show: 'The Far Orbit', kind: 'series', resume: { season: 2, episode: 3, title: 'Static', percent: 40 }, next: null },
            { show: 'Sandworld', kind: 'movie', tmdb_id: 'tmdb:4242', year: 2021, resume: { percent: 30 }, next: null },
          ],
        })
      );
    r.statusCode = 404;
    r.end('{}');
  });
  process.env.CYTV_TELEMACHUS = tmServer.url;
  const content = (title, category, contentId, target) => ({
    type: 'content',
    titleText: title,
    category,
    onClick: { contentId, targetAppId: target },
  });
  const lunaAsked = [];
  const luna = async uri => {
    lunaAsked.push(uri.replace('luna://', ''));
    if (/listApps$/.test(uri))
      return {
        returnValue: true,
        apps: [
          { id: 'youtube.leanback.v4', title: 'YouTube', inAppSearchParams: YT },
          { id: 'youtube.leanback.ytv.v1', title: 'YouTube TV', inAppSearchParams: YT },
          {
            id: 'netflix',
            title: 'Netflix',
            inAppVoiceIntent: '{"intent":"$INTENT"}',
            deeplinkingParams: '{"contentTarget":"$CONTENTID"}',
          },
          { id: 'com.telemachus.screen', title: 'Telemachus' },
          { id: 'com.beb.plxnative', title: 'PLX' },
          { id: 'io.strem.tv', title: 'Stremio', deeplinkingParams: '{"contentTarget":"stremio"}' },
          { id: 'hidden.app', title: 'Hidden', inAppSearchParams: YT }, // hidden on Home
          { id: 'invisible.app', title: 'Invisible', visible: false, inAppSearchParams: YT }, // not an app on Home at all
        ],
      };
    if (/listLaunchPoints$/.test(uri))
      return {
        returnValue: true,
        launchPoints: [
          { id: 'netflix', previewMetadata: { sourceEndpoint: '@PREVIEW.ENDPOINT.SOURCE_LOCAL', targetEndpoint: 'TARGET_LOCAL' } },
          { id: 'youtube.leanback.v4' },
        ],
      };
    if (/getAllContents$/.test(uri))
      return {
        returnValue: true,
        allContents: [
          {
            launchPointId: 'netflix_default',
            contents: [
              content('Stranger Rooms', 'Continue Watching for Kids', 'm=1001', 'netflix'),
              content('The Crown', 'Popular', 'm=1002', 'netflix'),
              content('The Crown', 'Popular', 'm=1002', 'netflix'), // the same title twice in the row: one hit
            ],
          },
          // LG's pick for YouTube (no local source): a pick
          {
            launchPointId: 'youtube.leanback.v4_default',
            contents: [content('Cat videos for cats', 'Recommended', 'v=abc', 'youtube.leanback.v4')],
          },
          // an app that is not installed: its row has nowhere to open
          { launchPointId: 'com.apple.appletv_default', contents: [content('Long Hallway', 'Up Next', 'x', 'com.apple.appletv')] },
        ],
      };
    if (/db\/find$/.test(uri)) return { returnValue: true, results: [] };
    return { returnValue: true };
  };
  // a linked Plex server (a stand-in on this machine) with one film partly watched
  const plexServer = await serve((q, r) => {
    r.setHeader('content-type', 'application/json');
    if (q.url === '/hubs/continueWatching/items')
      return r.end(
        JSON.stringify({
          MediaContainer: { Metadata: [{ type: 'movie', ratingKey: '7', title: 'Film B', year: 2001, duration: 100, viewOffset: 50 }] },
        })
      );
    r.statusCode = 404;
    r.end('{}');
  });
  const config = memoryConfig({
    hidden: ['hidden.app'],
    watch: { on: true },
    watchAccounts: { plex: { token: 'T', server: { name: 'Home', uri: plexServer.url, token: 'S' } } },
  });
  const features = {};
  const ctx = { config, luna, feature: name => features[name] || null };
  features.apps = req('apps').create(ctx);
  features.watch = req('watch').create(ctx);
  const search = S.create(ctx);
  ok(search.name === 'search' && search.paths.join() === '/api/search', 'a part of the service with one route, /api/search');
  const ask = async q => (await call(search, '/api/search?q=' + encodeURIComponent(q))).j;
  const groupsOf = r => r.groups.map(g => g.id + ':' + g.items.map(i => i.app + (i.title ? '/' + i.title : '')).join('|')).join(' ');

  // before Home read its rows: nothing to find in them; the apps' own search; the libraries to look in
  const cold = await ask('the far orbit');
  ok(
    groupsOf(cold) === 'search:youtube.leanback.v4|youtube.leanback.ytv.v1 try:com.telemachus.screen|com.beb.plxnative|io.strem.tv',
    'before Home read its rows: no hit; YouTube and YouTube TV search (not the hidden app nor an invisible one); then Telemachus, PLX (for Plex) and Stremio (' +
      groupsOf(cold) +
      ')'
  );
  ok(
    JSON.stringify(cold.groups[0].items[0].launch) === '{"id":"youtube.leanback.v4","params":{"contentTarget":"q=the far orbit"}}' &&
      JSON.stringify(cold.groups[1].items[1].launch) === '{"id":"com.beb.plxnative","params":{}}',
    'YouTube opens its search with the words; a library opens as it is'
  );
  ok(
    JSON.stringify(await features.apps.apps()).indexOf('SEARCH_KEYWORD') < 0,
    "the app list the launcher gets does not carry the apps' search parameters"
  );

  // Home reads its rows (as it does when it is shown): from here on every search makes no call at all
  await call(features.watch, '/api/watch/rows');
  // and its cache is dropped (as a link or unlink does): a search that read the rows again would ask Telemachus now
  await call(features.watch, '/api/watch/unlink', 'POST', { service: 'stremio' });
  let outside = 0;
  const calls = [];
  const spy = (mod, name) => {
    const was = mod[name];
    mod[name] = function () {
      outside++;
      calls.push(name);
      return was.apply(this, arguments);
    };
    return () => (mod[name] = was);
  };
  const fetch = req('fetch');
  const undo = [
    spy(http, 'request'),
    spy(http, 'get'),
    spy(https, 'request'),
    spy(https, 'get'),
    spy(net, 'connect'),
    spy(net, 'createConnection'),
    spy(tls, 'connect'),
    spy(fetch, 'read'),
  ];
  lunaAsked.length = 0;

  const ex = await ask('the far orbit');
  ok(
    ex.q === 'the far orbit' &&
      groupsOf(ex) === 'have:com.telemachus.screen/The Far Orbit search:youtube.leanback.v4|youtube.leanback.ytv.v1',
    'a title in the rows: "In your apps" first, then the apps\' own search; the libraries only when no app has it (' + groupsOf(ex) + ')'
  );
  const hit = ex.groups[0].items[0];
  ok(
    hit.appTitle === 'Telemachus' &&
      hit.sub === 'S2 E3 · Static' &&
      hit.source === 'telemachus' &&
      JSON.stringify(hit.launch) === '{"id":"com.telemachus.screen","params":{"play":{"show":"The Far Orbit","season":2,"episode":3}}}',
    'the hit opens the way its card opens: Telemachus at that episode (' + JSON.stringify(hit) + ')'
  );
  ok(
    groupsOf(await ask('FAR ORBIT!!')) === groupsOf(ex) && groupsOf(await ask('  far orbit ')) === groupsOf(ex),
    'case, punctuation and "The" do not matter'
  );
  const crown = (await ask('crown')).groups[0].items;
  ok(
    crown.length === 1 &&
      crown[0].title === 'The Crown' &&
      JSON.stringify(crown[0].launch) === '{"id":"netflix","params":{"contentTarget":"m=1002"}}',
    "a title in Netflix's own row opens in Netflix, once (" + JSON.stringify(crown) + ')'
  );
  const st = (await ask('strnger rooms')).groups[0].items[0];
  ok(
    st && st.title === 'Stranger Rooms' && st.sub === 'Continue Watching for Kids' && st.appTitle === 'Netflix',
    'with a typo too; the row and the app are named'
  );
  const film = (await ask('sandworld 2021')).groups;
  ok(
    film[0].id === 'have' &&
      film[0].items[0].title === 'Sandworld' &&
      JSON.stringify(film[0].items[0].launch.params) === '{"play":{"film":"Sandworld","year":2021,"tmdb_id":"tmdb:4242"}}',
    'a film in Telemachus opens that film'
  );
  const many = (await ask('c')).groups[0].items.map(i => i.title);
  ok(many.join() === 'The Crown,Cat videos for cats', 'a first letter lists every title that begins so (' + many.join() + ')');
  const order = (await ask('cat')).groups[0].items.map(i => i.title);
  ok(order.join() === 'Cat videos for cats', "LG's pick for YouTube is found while LG's picks are on (" + order.join() + ')');
  ok(
    (await ask('long hallway')).groups.every(g => g.id !== 'have'),
    'a row of an app that is not installed gives no hit'
  );
  ok(
    groupsOf(await ask('nothing like this')) ===
      'search:youtube.leanback.v4|youtube.leanback.ytv.v1 try:com.telemachus.screen|com.beb.plxnative|io.strem.tv',
    "no app has it: the apps' own search and the libraries"
  );
  ok(
    JSON.stringify(await ask('')) === '{"q":"","groups":[]}' && JSON.stringify(await ask('  !!! ')) === '{"q":"!!!","groups":[]}',
    'nothing to look for: no groups'
  );
  ok((await ask('x'.repeat(300))).q.length === 100, 'the words are kept to 100 characters');
  const ctl = await ask('star\u0000wars\n');
  ok(
    ctl.q === 'star wars' &&
      JSON.stringify(ctl.groups.filter(g => g.id === 'search')[0].items[0].launch.params) === '{"contentTarget":"q=star wars"}',
    'control characters are spaces'
  );

  // Home's switches and removed cards count here too
  const as = async (watch, q) => {
    config.update('test', c => {
      c.watch = watch;
    });
    return (await ask(q)).groups
      .filter(g => g.id === 'have')
      .map(g => g.items.map(i => i.title).join('|'))
      .join();
  };
  ok(
    (await as({ on: true, lgPicks: false }, 'cat')) === '' && (await as({ on: true, lgPicks: false }, 'crown')) === 'The Crown',
    "LG's picks off: LG's pick is not found, the app's own row still is"
  );
  ok((await as({ on: true, lg: false }, 'crown')) === '', "LG's rows off: neither");
  ok((await as({ on: true, tm: false }, 'far orbit')) === '', "Telemachus's row off: not from Telemachus");
  ok((await as({ on: true, hide: ['tm:The Far Orbit'] }, 'far orbit')) === '', 'a show removed from its row is not found');
  ok(
    (await as({ on: true, hide: ['app:netflix'] }, 'crown')) === '' &&
      (await as({ on: true, hide: ['app:com.telemachus.screen'] }, 'far orbit')) === '',
    "an app's row hidden: not from that app"
  );
  ok((await as({ on: false }, 'far orbit')) === '', 'Continue watching off: nothing from the rows');
  const offTry = await ask('far orbit');
  ok(offTry.groups.map(g => g.id).join() === 'search,try', 'then the libraries are offered again');
  config.update('test', c => {
    c.watch = { on: true };
    c.hidden = ['hidden.app', 'youtube.leanback.ytv.v1', 'io.strem.tv'];
  });
  ok(
    groupsOf(await ask('nothing like this')) === 'search:youtube.leanback.v4 try:com.telemachus.screen|com.beb.plxnative',
    'an app hidden on Home is not offered'
  );

  ok(!outside, 'the searches called no address: no request, no connection (' + calls.join() + ')');
  ok(
    lunaAsked.every(u => /applicationManager\/listApps$/.test(u)),
    "on the TV only the app manager's list of apps was asked (" + lunaAsked.filter((u, i, a) => a.indexOf(u) === i).join() + ')'
  );
  undo.forEach(u => u());

  // Plex's film from the linked server opens in PLX (Plex itself is not installed); once Plex is unlinked it is not found any more
  const plexHit = (await ask('film b')).groups.filter(g => g.id === 'have')[0];
  ok(
    !!plexHit &&
      plexHit.items[0].title === 'Film B' &&
      plexHit.items[0].source === 'plex' &&
      JSON.stringify(plexHit.items[0].launch) === '{"id":"com.beb.plxnative","params":{}}',
    "a film from the linked Plex server opens in PLX when Plex's own app is not installed"
  );
  await call(features.watch, '/api/watch/unlink', 'POST', { service: 'plex' });
  ok(
    (await ask('film b')).groups.every(g => g.id !== 'have'),
    'unlinked, its cards are not found any more (before the next read)'
  );
  plexServer.server.close();

  // the cards' own apps: Plex's open in PLX when Plex itself is not installed; one hit per show; the best match first
  const known = [
    { key: 'plex-1', group: 'plex:1', source: 'plex', title: 'Film B', sub: '2001', launch: { id: 'cdp-30', params: {} } },
    { key: 'plex-2', group: 'plex:1', source: 'plex', title: 'Film B', sub: 'again', launch: { id: 'cdp-30', params: {} } },
    {
      key: 'tm-x',
      group: 'tm:Film Bee',
      source: 'telemachus',
      title: 'Film Bee',
      sub: '',
      launch: { id: 'com.telemachus.screen', params: { play: { film: 'Film Bee' } } },
    },
    { key: 'lg-x', group: 'lg:x:1', app: 'x', source: 'lg', pick: false, title: 'Film B', launch: { id: 'x.app', params: {} } },
  ];
  features.watch = { known: () => known.slice() };
  const fb = (await ask('film b')).groups[0].items;
  ok(
    fb.map(i => i.key + '>' + i.launch.id).join() === 'have-plex-1>com.beb.plxnative,have-tm-x>com.telemachus.screen',
    "Plex's card opens in PLX; one hit per show; the exact title before a longer one; an app not installed gives none (" +
      fb.map(i => i.key + '>' + i.launch.id).join() +
      ')'
  );
  features.watch = null;
  ok(
    (await ask('film b')).groups.every(g => g.id !== 'have'),
    'without the Continue watching part the rest still works'
  );

  // the route goes through the service's own checks: a web page is refused, a page without the API token too once it is required
  const srv = req('server').create({ features: () => [search], guard: { allow: q => q.headers['x-cytv-token'] === 'T0K' } });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const get = headers =>
    new Promise(resolve =>
      http.get({ host: '127.0.0.1', port: srv.address().port, path: '/api/search?q=film', headers }, r => {
        let b = '';
        r.on('data', d => (b += d));
        r.on('end', () => resolve({ code: r.statusCode, body: b }));
      })
    );
  const page = await get({ Origin: 'null', 'x-cytv-token': 'T0K' }),
    web = await get({ Origin: 'https://evil.example', 'x-cytv-token': 'T0K' }),
    noToken = await get({ Origin: 'null' }),
    rebound = await get({ Origin: 'null', 'x-cytv-token': 'T0K', Host: 'evil.example' });
  ok(
    page.code === 200 && /"groups"/.test(page.body) && web.code === 403 && noToken.code === 403 && rebound.code === 403,
    'our page with the token is answered; a web page, a page without the token and another Host are refused (' +
      [page.code, web.code, noToken.code, rebound.code].join() +
      ')'
  );
  srv.close();
  tmServer.server.close();
});
