// Cards (cards.js): the phone page opens with a code, lists the theme's slots and the card types with their options, saves the cards
// (checked for shape) where the launcher reads them, and the launcher page draws the greeting and a text card. The manager sets a
// weather card's place by a ZIP code in the TV's country, and its choices.
const http = require('http');
const { ok, call, sleep, serve, req, memoryConfig, run } = require('./lib');

function phone(method, p, body, code) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host: '127.0.0.1', port: +process.env.CYTV_CARDS_PORT, path: p, method, headers: { 'x-code': code || '' } },
      res => {
        const b = [];
        res.on('data', c => b.push(c));
        res.on('end', () => {
          const t = Buffer.concat(b).toString();
          let j = null;
          try {
            j = JSON.parse(t);
          } catch (_) {}
          resolve({ code: res.statusCode, text: t, j });
        });
      }
    );
    r.on('error', reject);
    r.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

run(async () => {
  // Open-Meteo stand-ins: the forecast and the place search
  let asked = 0;
  const geo = [];
  const om = await serve((rq, rs) => {
    rs.writeHead(200, { 'content-type': 'application/json' });
    if (/\/search/.test(rq.url)) geo.push(rq.url);
    if (/\/search.*name=90210/.test(rq.url))
      return rs.end(
        JSON.stringify({
          results: [
            {
              name: 'Beverly Hills',
              admin1: 'California',
              country: 'United States',
              country_code: 'US',
              latitude: 34.0736,
              longitude: -118.4004,
            },
          ],
        })
      );
    if (/\/search.*name=00000/.test(rq.url)) return rs.end(JSON.stringify({}));
    if (/\/search/.test(rq.url))
      return rs.end(
        JSON.stringify({ results: [{ name: 'Utrecht', admin1: 'Utrecht', country: 'Nederland', latitude: 52.0908, longitude: 5.1222 }] })
      );
    asked++;
    rs.end(
      JSON.stringify({
        current: { temperature_2m: 11.6, weather_code: 3, is_day: 1 },
        daily: {
          time: ['2026-10-27', '2026-10-28'],
          weather_code: [3, 61],
          temperature_2m_max: [13.2, 12],
          temperature_2m_min: [7.9, 6.1],
        },
      })
    );
  });
  process.env.CYTV_WEATHER_URL = om.url + '/v1/forecast';
  process.env.CYTV_GEO_URL = om.url + '/v1/search';
  const C = req('cards');
  const config = memoryConfig({ lang: 'nl', cards: { greeting: { type: 'greeting', name: 'Sam' } } });
  const theme = {
    name: 'theme',
    resolved: () => ({
      slots: [
        { id: 'greeting', card: 'greeting' },
        { id: 'side', card: '' },
        { id: 'odd-one', card: '' },
      ],
    }),
  };
  const luna = async (uri, p) =>
    /getSystemSettings/.test(uri) && p.keys[0] === 'smartServiceCountryCode2' ? { settings: { smartServiceCountryCode2: 'US' } } : {};
  const cards = C.create({ config, luna, feature: n => (n === 'theme' ? theme : null) });
  let r = await call(cards, '/api/cards/pair', 'POST', {});
  const code = r.j.code;
  ok(
    /^\d{6}$/.test(code) && new RegExp(':' + process.env.CYTV_CARDS_PORT + '/#\\d{6}$').test(r.j.qr),
    'the cards page opens with a 6-digit code, which the QR code carries'
  );
  await sleep(100);
  let p = await phone('GET', '/');
  ok(
    p.code === 200 && /<title>Kaarten<\/title>/.test(p.text) && /JSON/.test(p.text),
    'the page is in the chosen language and has a JSON editor'
  );
  p = await phone('GET', '/api/state', undefined, '000000');
  ok(p.code === 403, 'the API needs the code');
  p = await phone('GET', '/api/state', undefined, code);
  ok(
    p.j.slots.length === 3 &&
      p.j.slots[0].name === 'Boven de klok' &&
      p.j.slots[2].name === 'odd-one' &&
      p.j.cards.greeting.name === 'Sam' &&
      p.j.types.some(t => t.type === 'template' && t.fields.some(f => f.key === 'text')),
    'the state lists the slots (named in the language), the saved cards and the card types with their options'
  );
  p = await phone(
    'POST',
    '/api/save',
    { cards: { side: { type: 'template', text: 'Hi {{greeting}}', size: 'large' }, 'B A D': { type: 'x' } } },
    code
  );
  ok(
    p.j.ok && JSON.stringify(config.get().cards) === JSON.stringify({ side: { type: 'template', text: 'Hi {{greeting}}', size: 'large' } }),
    'saving replaces the cards with what the page sent, checked for shape'
  );
  await phone('POST', '/api/save', { cards: {} }, code);
  ok(config.get().cards === undefined, 'saving no cards removes them');
  // the manager's Cards screen: the places and a card type for one of them
  r = await call(cards, '/api/cards/status', 'POST', {});
  ok(r.j.slots.length === 3 && r.j.types.some(t => t.type === 'ha-camera'), 'the manager gets the places and the card types');
  ok(
    typeof r.j.savedAt === 'number' && Date.now() - r.j.savedAt < 60000,
    "the status says when the phone page last saved (the manager's QR screen goes then)"
  );
  r = await call(cards, '/api/cards/set', 'POST', { slot: 'side', type: 'ha-camera' });
  ok(r.j.ok && config.get().cards.side.type === 'ha-camera', 'the manager picks a card for a place');
  config.update('test', c => {
    c.cards.side.entity = 'camera.door';
  });
  await call(cards, '/api/cards/set', 'POST', { slot: 'side', type: 'ha-camera' });
  ok(config.get().cards.side.entity === 'camera.door', 'picking the same type again keeps its options');
  await call(cards, '/api/cards/set', 'POST', { slot: 'greeting', type: 'none' });
  ok(config.get().cards.greeting.type === 'none', 'a place the theme fills can be left empty');
  r = await call(cards, '/api/cards/set', 'POST', { slot: 'nowhere', type: 'greeting' });
  const bad = await call(cards, '/api/cards/set', 'POST', { slot: 'side', type: 'rocket' });
  ok(r.j.error && bad.j.error && config.get().cards.side.type === 'ha-camera', 'an unknown place or card type is refused');
  await phone('POST', '/api/save', { cards: {} }, code);
  p = await phone('POST', '/api/places', { q: 'Utrecht' }, code);
  ok(
    p.j.places.length === 1 && p.j.places[0].lat === 52.09 && p.j.places[0].area === 'Utrecht, Nederland',
    'the phone page finds a place by name'
  );
  r = await call(cards, '/api/cards/weather', 'POST', { lat: 52.09, lon: 5.12 });
  const r2 = await call(cards, '/api/cards/weather', 'POST', { lat: 52.09, lon: 5.12 });
  ok(
    r.j.now.temp === 12 && r.j.now.code === 3 && r.j.days.length === 2 && r.j.days[1].max === 12 && r2.j.at === r.j.at && asked === 1,
    'the weather of a place is asked once and then kept (at most every 30 minutes)'
  );
  r = await call(cards, '/api/cards/weather', 'POST', { lat: 'x' });
  ok(r.j.error === 'no place chosen', 'no weather without a place');
  // the manager: a weather card's place by its ZIP code, and its choices, without the phone
  r = await call(cards, '/api/cards/place', 'POST', { slot: 'side', zip: '90210' });
  ok(/choose the weather card/.test(r.j.error || ''), 'a ZIP code needs a weather card in that place');
  await call(cards, '/api/cards/set', 'POST', { slot: 'side', type: 'weather' });
  geo.length = 0;
  r = await call(cards, '/api/cards/place', 'POST', { slot: 'side', zip: ' 90210 ' });
  let side = config.get().cards.side;
  ok(
    r.j.ok &&
      r.j.place.name === 'Beverly Hills' &&
      side.place === 'Beverly Hills' &&
      side.lat === 34.07 &&
      side.lon === -118.4 &&
      side.unit === 'f' &&
      /countryCode=US/.test(geo[0]),
    "a ZIP code is searched in the TV's country and sets the place; a first place in the US sets °F"
  );
  geo.length = 0;
  r = await call(cards, '/api/cards/place', 'POST', { slot: 'side', zip: '00000' });
  ok(
    /no place/.test(r.j.error || '') &&
      geo.length === 2 &&
      !/countryCode/.test(geo[1]) &&
      config.get().cards.side.place === 'Beverly Hills',
    'a code not found in the country is tried in any country, and the place stays when nothing is found'
  );
  r = await call(cards, '/api/cards/place', 'POST', { slot: 'side', zip: '<x>' });
  ok(/type a ZIP/.test(r.j.error || ''), 'only a code is searched');
  await call(cards, '/api/cards/option', 'POST', { slot: 'side', key: 'unit', value: '' });
  await call(cards, '/api/cards/option', 'POST', { slot: 'side', key: 'show', value: 'days' });
  const o1 = await call(cards, '/api/cards/option', 'POST', { slot: 'side', key: 'unit', value: 'kelvin' });
  const o2 = await call(cards, '/api/cards/option', 'POST', { slot: 'side', key: 'place', value: 'x' });
  side = config.get().cards.side;
  ok(
    side.unit === undefined && side.show === 'days' && o1.j.error && o2.j.error && side.place === 'Beverly Hills',
    "the manager sets a card's choices, only to values its type offers"
  );
  await phone('POST', '/api/save', { cards: {} }, code);
  // Home Assistant cards, with the address and token set for Voice
  const calls = [];
  const has = await serve((rq, rs) => {
    calls.push(rq.method + ' ' + rq.url + ' ' + rq.headers.authorization);
    if (rq.url === '/api/states') {
      rs.writeHead(200, { 'content-type': 'application/json' });
      return rs.end(
        JSON.stringify([
          { entity_id: 'light.living', state: 'on', attributes: { friendly_name: 'Living room' } },
          { entity_id: 'sensor.temp', state: '8.4', attributes: { friendly_name: 'Outside', unit_of_measurement: '°C' } },
          { entity_id: 'lock.door', state: 'locked', attributes: {} },
        ])
      );
    }
    if (rq.url === '/api/camera_proxy/camera.door') {
      rs.writeHead(200, { 'content-type': 'image/jpeg' });
      return rs.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    }
    if (/^\/api\/services\//.test(rq.url)) {
      rs.writeHead(200, { 'content-type': 'application/json' });
      return rs.end('[]');
    }
    rs.writeHead(404);
    rs.end();
  });
  r = await call(cards, '/api/cards/ha', 'POST', { ids: ['light.living'] });
  ok(r.j.error === 'Home Assistant is not set up', 'Home Assistant cards need the address and token from Voice');
  config.update('test', c => {
    c.voice = { ha: { url: has.url, token: 'tok' } };
  });
  r = await call(cards, '/api/cards/ha', 'POST', { ids: ['light.living', 'sensor.temp', 'switch.gone', 'bad id'] });
  const st = r.j.states || [];
  ok(
    st.length === 3 &&
      st[0].name === 'Living room' &&
      st[0].state === 'on' &&
      st[0].can === true &&
      st[1].unit === '°C' &&
      st[1].can === false &&
      st[2].state === 'unavailable' &&
      calls.filter(c => /states/.test(c)).length === 1 &&
      /Bearer tok/.test(calls[0]),
    'the states come from one request with the Voice token; a missing entity is unavailable and a bad id is left out'
  );
  await call(cards, '/api/cards/ha', 'POST', { ids: ['sensor.temp'] });
  ok(calls.filter(c => /states/.test(c)).length === 1, 'the states are kept for a while, however many cards ask');
  r = await call(cards, '/api/cards/ha/toggle', 'POST', { id: 'light.living' });
  const r3 = await call(cards, '/api/cards/ha/toggle', 'POST', { id: 'lock.door' });
  ok(
    r.j.ok && calls.some(c => /POST \/api\/services\/light\/toggle/.test(c)) && /cannot be switched/.test(r3.j.error),
    'OK switches a light, but never a lock'
  );
  r = await call(cards, '/api/cards/ha/camera/camera.door');
  const r4 = await call(cards, '/api/cards/ha/camera/light.living');
  ok(r.code === 200 && r4.code === 404, "a camera's picture is passed on, and only for camera entities");
  p = await phone('GET', '/api/entities', undefined, code);
  ok(p.j.entities.length === 3 && p.j.entities[0].id === 'light.living', 'the phone page lists the entities to choose from');
  has.server.close();
  await call(cards, '/api/cards/pair', 'POST', { stop: true });
  await sleep(50);
  p = await phone('GET', '/').catch(() => ({ code: 0 }));
  ok(p.code === 0, 'the page is closed after stop');
  om.server.close();
});
