// Where to watch (where.js, GET /api/search/where?q=, D-20261029-9): any title, also one that is not on Home, asked of the services
// the owner uses: Plex's catalogue with the linked account (where a title is, in the TV's country), Disney+'s own search when linked,
// Stremio's public catalogue when Stremio is installed, the linked Plex server and Telemachus on the TV. Every one of them is a
// stand-in on this machine here. Plex's affiliate links are never asked (only the service's own link inside them is read), no device
// id is sent, each title lists the apps on this TV first with their deep links, and the switch "Ask services where a title is" off
// asks nothing at all. Also deeplinks.js: the formats it opens a title with.
const http = require('http'),
  https = require('https');
const { ok, call, req, run, memoryConfig, serve } = require('./lib');

const BLUEY = 'fa6973b9-e7cf-49fb-81a2-d4908e4bf694'; // a Disney+ entity id, as Disney's search and Plex's link name it
const KEY = '5d9c090e705e7a001e6e94d8'; // Plex's id for the show

run(async () => {
  // ---- the stand-ins: Plex's catalogue, a tracker (never to be asked), Disney+, Cinemeta, the Plex server, Telemachus
  const seen = []; // [server, method, url, headers]
  const track = name => (q, r) => {
    seen.push([name, q.method, q.url, q.headers]);
    r.setHeader('content-type', 'application/json');
  };
  const trackerSrv = await serve((q, r) => {
    track('tracker')(q, r);
    r.end('{}');
  });
  const link = real => trackerSrv.url + '/c/1?u=' + encodeURIComponent(real);
  let plexDown = false;
  const plexCatalogue = await serve((q, r) => {
    track('discover')(q, r);
    if (plexDown) return q.socket.destroy();
    if (q.headers['x-plex-token'] !== 'PLEX-ACCOUNT') return (r.statusCode = 401), r.end('{}');
    if (/^\/library\/search\?query=bluey&/i.test(q.url))
      return r.end(
        JSON.stringify({
          MediaContainer: {
            SearchResults: [
              {
                SearchResult: [
                  { Metadata: { type: 'show', title: 'Bluey', year: 2018, ratingKey: KEY, guid: 'plex://show/' + KEY } },
                  { Metadata: { type: 'movie', title: 'The Bluey Movie', year: 2027, ratingKey: '0123456789abcdef01234567' } },
                  { Metadata: { type: 'show', title: 'Something Else Entirely', year: 2001, ratingKey: 'aaaaaaaaaaaaaaaaaaaaaaaa' } },
                  { Metadata: { type: 'episode', title: 'Bluey', ratingKey: 'bbbbbbbbbbbbbbbbbbbbbbbb' } },
                ],
              },
            ],
          },
        })
      );
    if (q.url === '/library/metadata/' + KEY + '/availabilities?country=US')
      return r.end(
        JSON.stringify({
          MediaContainer: {
            Availability: [
              {
                platform: 'hulu',
                title: 'Hulu',
                offerType: 'subscription',
                platformUrl: link('https://www.hulu.com/series/bluey-x'),
                platformIsSponsored: true,
              },
              {
                platform: 'apple-itunes',
                title: 'Apple iTunes',
                offerType: 'buy',
                price: 2.99,
                quality: 'HD',
                platformUrl: link('https://tv.apple.com/us/show/bluey/umc.cmc.0123456789abcdef'),
              },
              {
                platform: 'apple-itunes',
                title: 'Apple iTunes',
                offerType: 'buy',
                price: 1.99,
                quality: 'SD',
                platformUrl: link('https://tv.apple.com/us/show/bluey/umc.cmc.0123456789abcdef'),
              },
              {
                platform: 'disney-plus',
                title: 'Disney+',
                offerType: 'subscription',
                platformUrl: link('disneyplus://disneyplus.com/browse/entity-' + BLUEY),
                platformInfo: { web: { url: link('https://www.disneyplus.com/browse/entity-' + BLUEY) } },
              },
              { platform: 'fubotv', title: 'fuboTV', offerType: 'subscription', platformUrl: link('https://www.fubo.tv/x') },
              { platform: 'netflix', title: 'Netflix', offerType: 'subscription', platformUrl: link('https://www.netflix.com/title/1001') },
            ],
          },
        })
      );
    if (/^\/library\/metadata\/0123456789abcdef01234567\/availabilities/.test(q.url))
      return r.end(JSON.stringify({ MediaContainer: { Availability: [] } }));
    r.statusCode = 404;
    r.end('{}');
  });
  const disneyApi = await serve((q, r) => {
    track('disney')(q, r);
    if (q.headers.authorization !== 'Bearer DISNEY-ACCESS') return (r.statusCode = 401), r.end('{}');
    if (q.url.toLowerCase() === '/explore/v1.21/search?query=bluey')
      return r.end(
        JSON.stringify({
          data: {
            page: {
              containers: [
                {
                  items: [
                    {
                      visuals: { title: 'Bluey', metastringParts: { releaseYearRange: { startYear: 2018 } } },
                      actions: [{ type: 'browse', deeplinkId: 'entity-' + BLUEY }],
                    },
                    {
                      visuals: { title: 'Bluey Minisodes' },
                      actions: [{ type: 'browse', deeplinkId: 'entity-11111111-2222-4333-8444-555555555555' }],
                    },
                    { visuals: { title: 'No link' }, actions: [{ type: 'playback' }] },
                  ],
                },
              ],
            },
          },
        })
      );
    r.statusCode = 404;
    r.end('{}');
  });
  const cinemeta = await serve((q, r) => {
    track('cinemeta')(q, r);
    if (q.url.toLowerCase() === '/catalog/series/top/search=bluey.json')
      return r.end(
        JSON.stringify({
          metas: [
            { id: 'tt7678620', name: 'Bluey', releaseInfo: '2018-', type: 'series' },
            { id: 'nott', name: 'Bad id' },
          ],
        })
      );
    if (q.url.toLowerCase() === '/catalog/movie/top/search=bluey.json') return r.end(JSON.stringify({ metas: [] }));
    r.statusCode = 404;
    r.end('{}');
  });
  const plexServer = await serve((q, r) => {
    track('plexserver')(q, r);
    if (/^\/hubs\/search\?query=bluey&/i.test(q.url) && q.headers['x-plex-token'] === 'PLEX-SERVER')
      return r.end(
        JSON.stringify({ MediaContainer: { Hub: [{ type: 'show', Metadata: [{ type: 'show', title: 'Bluey', year: 2018 }] }] } })
      );
    r.statusCode = 404;
    r.end('{}');
  });
  const tm = await serve((q, r) => {
    track('telemachus')(q, r);
    if (q.headers['x-telemachus'] !== 'cli' || q.headers.origin) return (r.statusCode = 403), r.end('{}');
    if (q.url.toLowerCase() === '/api/search?q=bluey')
      return r.end(
        JSON.stringify({
          query: 'bluey',
          results: [
            { title: 'Bluey', year: 2018, kind: 'series', id: 'tmdb:82728', in_catalogue: false },
            { title: 'The Bluey Movie', year: 2027, kind: 'movie', id: 'tmdb:1403836', in_catalogue: true },
            { title: 'Bluey', year: 1976, kind: 'series', id: 'tmdb:13869', in_catalogue: false },
          ],
        })
      );
    r.statusCode = 404;
    r.end('{}');
  });
  process.env.CYTV_PLEX_DISCOVER = plexCatalogue.url;
  process.env.CYTV_DISNEY_API = disneyApi.url;
  process.env.CYTV_DISNEY_WEB = disneyApi.url;
  process.env.CYTV_CINEMETA = cinemeta.url;
  process.env.CYTV_TELEMACHUS = tm.url;
  // anything asked of an address that is not this machine is a failure of the test itself
  const away = [];
  for (const mod of [http, https])
    for (const fn of ['request', 'get']) {
      const was = mod[fn];
      mod[fn] = function (a) {
        const host = typeof a === 'string' ? new URL(a).hostname : a instanceof URL ? a.hostname : (a && (a.hostname || a.host)) || '';
        if (!/^(127\.0\.0\.1|localhost)$/.test(String(host).replace(/:\d+$/, ''))) away.push(String(host));
        return was.apply(this, arguments);
      };
    }

  // ---- deeplinks.js: the service's own link inside an affiliate link, and how each app opens a title (loaded only now: it loads
  // disney.js, which reads where Disney is when it loads)
  const D = req('deeplinks');
  const tracker =
    'https://disneyplus.bn5x.net/c/1/2/3?u=' + encodeURIComponent('https://www.disneyplus.com/browse/entity-' + BLUEY) + '&subId1=x';
  ok(
    D.unwrap(tracker) === 'https://www.disneyplus.com/browse/entity-' + BLUEY,
    "the service's own link is taken out of Plex's affiliate link"
  );
  ok(
    D.unwrap('https://disneyplus.bn5x.net/c/1') === '' &&
      D.unwrap('https://evil.example/c?u=' + encodeURIComponent('https://evil.example/x')) === '' &&
      D.unwrap('javascript:alert(1)') === '',
    'a tracker without a link, or a link to anywhere but the service itself, gives nothing'
  );
  ok(D.unwrap('https://www.netflix.com/title/80057281') === 'https://www.netflix.com/title/80057281', "the service's own link as it is");
  const dl = (app, link, kind) => JSON.stringify(D.launch(app, link, kind));
  ok(
    dl('com.disney.disneyplus-prod', 'disneyplus://disneyplus.com/browse/entity-' + BLUEY, 'series') ===
      JSON.stringify({
        params: {
          contentTarget:
            'distributionPartner=lg&programType=series&contentId=' +
            BLUEY +
            '&page=browse&id=entity-' +
            BLUEY +
            '&type=series&contentType=Full',
        },
        exact: true,
      }),
    "Disney+: the title's page, in LG's format"
  );
  ok(
    /programType=movie&.*type=movie/.test(dl('com.disney.disneyplus-prod', 'https://www.disneyplus.com/browse/entity-' + BLUEY, 'movie')),
    'a Disney+ film as a film'
  );
  ok(
    dl('netflix', 'https://www.netflix.com/title/1001', 'series') === '{"params":{"contentTarget":"m=1001&source_type=27"},"exact":true}',
    'Netflix as its own row opens a title'
  );
  ok(
    dl('amazon', 'https://www.amazon.com/gp/video/detail/amzn1.dv.gti.0a1b2c3d-0000-1111-2222-333344445555/ref=x', 'movie') ===
      '{"params":{"contentTarget":"detail?gti=amzn1.dv.gti.0a1b2c3d-0000-1111-2222-333344445555"},"exact":true}',
    'Prime Video as its own row opens a title'
  );
  ok(
    dl('com.apple.appletv', 'https://tv.apple.com/us/show/a-show/umc.cmc.0123456789abcdef?ctx=1', 'series') ===
      '{"params":{"contentTarget":"https://tv.apple.com/us/show/a-show/umc.cmc.0123456789abcdef"},"exact":true}',
    'Apple TV as its own row opens a title (its link without the query)'
  );
  ok(
    dl('youtube.leanback.v4', 'https://www.youtube.com/watch?v=abcdef123', 'movie') ===
      '{"params":{"contentTarget":"v=abcdef123"},"exact":true}',
    'YouTube by its video id'
  );
  ok(
    dl('hulu', 'https://www.hulu.com/series/x', 'series') === '{"params":{},"exact":false}' &&
      dl('netflix', 'https://www.netflix.com/browse', 'series') === '{"params":{},"exact":false}' &&
      dl('com.disney.disneyplus-prod', 'https://www.disneyplus.com/browse/entity-nope', 'series') === '{"params":{},"exact":false}',
    'an app without a known format, or a link without an id, opens as it is'
  );
  ok(
    D.appsOf('disney-plus', 'Disney+', []).join() === 'com.disney.disneyplus-prod' &&
      D.appsOf('apple-itunes', 'Apple iTunes', []).join() === 'com.apple.appletv' &&
      D.appsOf('some-new-service', 'Paramount+', [{ id: 'com.paramount.app', title: 'Paramount+' }]).join() === 'com.paramount.app' &&
      D.appsOf('fubotv', 'fuboTV', [{ id: 'x', title: 'Hulu' }]).join() === '',
    "Plex's service names as LG apps; an unknown one by an installed app of exactly its name, else none"
  );

  let installed = [
    { id: 'com.disney.disneyplus-prod', title: 'Disney+' },
    { id: 'netflix', title: 'Netflix' },
    { id: 'com.telemachus.screen', title: 'Telemachus' },
    { id: 'io.strem.tv', title: 'Stremio' },
    { id: 'cdp-30', title: 'Plex' },
  ];
  const lunaAsked = [];
  const luna = async (uri, payload) => {
    lunaAsked.push(uri.replace('luna://', '') + ' ' + JSON.stringify(payload));
    if (/listApps$/.test(uri)) return { returnValue: true, apps: installed };
    if (/getSystemSettings$/.test(uri)) return { returnValue: true, settings: { smartServiceCountryCode2: 'US' } };
    return { returnValue: true };
  };
  const config = memoryConfig({
    watch: { on: true },
    watchAccounts: {
      plex: {
        clientId: '0123456789abcdef0123456789abcdef',
        token: 'PLEX-ACCOUNT',
        server: { name: 'Home', uri: plexServer.url, token: 'PLEX-SERVER' },
      },
      disney: { token: 'DISNEY-ACCESS', refreshToken: 'DISNEY-REFRESH', until: Date.now() + 3600 * 1000 },
    },
  });
  const features = {};
  const ctx = { config, luna, feature: name => features[name] || null };
  features.apps = req('apps').create(ctx);
  features.watch = req('watch').create(ctx);
  const search = req('search').create(ctx);
  ok(search.paths.indexOf('/api/search/where') >= 0, 'the search part answers /api/search/where');
  const where = async q => (await call(search, '/api/search/where?q=' + encodeURIComponent(q))).j;

  const r = await where('Bluey');
  const titles = (r.groups[0] || { items: [] }).items;
  const show = titles[0] || { offers: [] };
  ok(
    r.on === true && r.groups.length === 1 && r.groups[0].id === 'where',
    'one group, Where to watch (' + JSON.stringify(r).slice(0, 200) + ')'
  );
  ok(
    titles.map(t => t.title + ' ' + t.year + ' ' + t.kind).join('|') ===
      'Bluey 2018 series|The Bluey Movie 2027 movie|Bluey Minisodes null |Bluey 1976 series',
    "the titles that match the words, each once whoever named it: Plex's and Disney+'s the best first, then one only Telemachus has (" +
      titles.map(t => t.title + ' ' + t.year + ' ' + t.kind).join('|') +
      ')'
  );
  const offers = show.offers.map(o => o.provider + ':' + o.offer + (o.app ? '>' + o.app : '') + (o.price !== null ? ':' + o.price : ''));
  ok(
    offers.join() ===
      'disney-plus:subscription>com.disney.disneyplus-prod,netflix:subscription>netflix,plex-library:library>cdp-30,stremio:catalogue>io.strem.tv,telemachus:catalogue>com.telemachus.screen,fubotv:subscription,hulu:subscription,apple-itunes:buy:1.99',
    "the apps on this TV first, a subscription before a library or a catalogue; then the services not installed, a subscription before buying, the cheapest of each, by name (Plex's sponsored first is not used) (" +
      offers.join() +
      ')'
  );
  const of = p => show.offers.filter(o => o.provider === p)[0] || {};
  ok(
    of('disney-plus').exact === true &&
      of('disney-plus').launch.params.contentTarget ===
        'distributionPartner=lg&programType=series&contentId=' +
          BLUEY +
          '&page=browse&id=entity-' +
          BLUEY +
          '&type=series&contentType=Full',
    "Disney+ opens the show's own page"
  );
  ok(of('netflix').exact === true && of('netflix').launch.params.contentTarget === 'm=1001&source_type=27', 'Netflix opens the title');
  ok(
    of('telemachus').exact === false &&
      JSON.stringify(of('telemachus').launch) === '{"id":"com.telemachus.screen","params":{}}' &&
      of('stremio').exact === false &&
      JSON.stringify(of('stremio').launch) === '{"id":"io.strem.tv","params":{}}',
    'Telemachus (a series) and Stremio open as they are'
  );
  ok(
    !of('hulu').app && !of('hulu').launch && of('fubotv').name === 'fuboTV' && of('apple-itunes').currency === '',
    'a service that is not on this TV is only named, with its offer'
  );
  const film = titles[1] || { offers: [] };
  ok(
    JSON.stringify((film.offers.filter(o => o.provider === 'telemachus')[0] || {}).launch) ===
      '{"id":"com.telemachus.screen","params":{"play":{"film":"The Bluey Movie","year":2027,"tmdb_id":"tmdb:1403836"}}}' &&
      film.offers[0].offer === 'library',
    'a film in Telemachus opens that film (its catalogue has it: in your library)'
  );
  const mini = titles[2] || { offers: [] };
  ok(
    mini.offers.length === 1 &&
      mini.offers[0].provider === 'disney-plus' &&
      mini.offers[0].launch.params.contentTarget.indexOf('11111111-2222-4333-8444-555555555555') > 0,
    "a title only Disney+'s search has: its Disney+ page"
  );
  ok(!titles.some(t => /Something Else/.test(t.title)), 'a title that does not match the words is left out');
  ok(
    JSON.stringify(titles[3] && titles[3].offers.map(o => o.provider + ':' + o.offer)) === '["telemachus:catalogue"]',
    'the other Bluey only Telemachus has, with Telemachus'
  );

  // what was sent where
  const to = name => seen.filter(s => s[0] === name);
  ok(!to('tracker').length, "Plex's affiliate links were never asked");
  ok(
    to('discover').length === 3 &&
      to('discover').every(s => s[1] === 'GET') &&
      /^\/library\/search\?query=Bluey&limit=6&searchTypes=movies,tv&searchProviders=discover&includeMetadata=1$/.test(
        to('discover')[0][2]
      ) &&
      to('discover').some(s => s[2] === '/library/metadata/' + KEY + '/availabilities?country=US'),
    "Plex's catalogue: the words, then where its titles are in the TV's country (" +
      to('discover')
        .map(s => s[2])
        .join(' ') +
      ')'
  );
  const allowed =
    /^(host|connection|accept|accept-encoding|content-length|x-plex-token|x-plex-client-identifier|x-plex-product|x-plex-device|authorization|x-bamsdk-client-id|x-bamsdk-platform|x-bamsdk-version|x-application-version|x-dss-edge-accept|x-telemachus)$/;
  const extra = seen.map(s => Object.keys(s[3]).filter(h => !allowed.test(h))).reduce((a, b) => a.concat(b), []);
  ok(!extra.length, 'no other header is sent: no device id, no cookie, no user agent (' + extra.join() + ')');
  ok(
    to('discover').every(s => s[3]['x-plex-client-identifier'] === '0123456789abcdef0123456789abcdef' && s[3]['x-plex-device'] === 'LG TV'),
    "Plex gets the account's key and this install's own Plex id (made at linking), nothing of the TV's"
  );
  ok(
    to('disney').length === 1 && to('disney')[0][2] === '/explore/v1.21/search?query=Bluey',
    "Disney+'s own search, once, with the account's key"
  );
  ok(
    to('cinemeta').length === 2 && to('cinemeta').every(s => !s[3].authorization && !s[3]['x-plex-token']),
    "Stremio's catalogue, without any key"
  );
  ok(to('plexserver').length === 1 && to('telemachus').length === 1, 'the Plex server and Telemachus, once each');
  ok(
    lunaAsked.some(u => /getSystemSettings .*smartServiceCountryCode2/.test(u)),
    "the TV's country from LG's service country setting"
  );

  // the same words again: from memory, nothing asked
  const before = seen.length;
  const again = await where('bluey');
  ok(seen.length === before && JSON.stringify(again.groups) === JSON.stringify(r.groups), 'the same words again are answered from memory');

  // not installed, not linked: not asked
  installed = installed.filter(a => a.id !== 'io.strem.tv' && a.id !== 'com.telemachus.screen');
  features.apps = req('apps').create(ctx);
  config.update('test', c => {
    delete c.watchAccounts.disney;
  });
  seen.length = 0;
  const fewer = await where('bluey ');
  ok(fewer.groups.length === 1, 'still answered: ' + JSON.stringify(fewer).slice(0, 120));
  ok(
    !to('cinemeta').length && !to('telemachus').length && !to('disney').length,
    'Stremio and Telemachus not installed, Disney+ not linked: none of them is asked'
  );
  ok(
    fewer.groups[0].items[0].offers.every(o => o.provider !== 'stremio' && o.provider !== 'telemachus'),
    'and a library or catalogue of an app that is not on this TV is not named'
  );

  // the switch off: nothing asked at all
  config.update('test', c => {
    c.search = { where: false };
  });
  seen.length = 0;
  lunaAsked.length = 0;
  const off = await where('peppa pig');
  ok(
    JSON.stringify(off) === '{"q":"peppa pig","on":false,"groups":[]}' && !seen.length && !lunaAsked.length,
    '"Ask services where a title is" off: nothing is asked of anyone'
  );
  config.update('test', c => {
    delete c.search;
  });
  seen.length = 0;
  ok(JSON.stringify(await where('b')) === '{"q":"b","on":true,"groups":[]}' && !seen.length, 'fewer than two letters: nothing is asked');

  // a service that fails or does not answer leaves the others
  plexDown = true;
  const fresh = req('search').create(ctx);
  const failing = (await call(fresh, '/api/search/where?q=bluey')).j;
  ok(
    failing.on === true &&
      failing.groups.length === 1 &&
      failing.groups[0].items.every(t => t.offers.every(o => o.provider === 'plex-library')),
    "Plex's catalogue failing: the others still answer, no error (" + JSON.stringify(failing).slice(0, 160) + ')'
  );

  // the setting is kept with the launcher's settings, only when off
  features.apps = req('apps').create(ctx);
  await call(features.apps, '/api/config', 'POST', { search: { where: false, junk: 1 }, dock: [] });
  const kept = JSON.stringify(config.get().search);
  await call(features.apps, '/api/config', 'POST', { search: { where: true }, dock: [] });
  ok(
    kept === '{"where":false}' && config.get().search === undefined,
    'Customize > Search: off is kept as search.where false, on is the default'
  );

  ok(!away.length, 'nothing was asked of an address off this machine (' + away.join() + ')');
  for (const s of [trackerSrv, plexCatalogue, disneyApi, cinemeta, plexServer, tm]) s.server.close();
});
