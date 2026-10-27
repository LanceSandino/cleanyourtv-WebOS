/* More > Sonos volume on screen (helper/sonos.js): on or off, the speaker (found automatically or chosen from a search), the place
   on screen and what it reads now. The speaker is only ever read: nothing here can change its volume. */
var so = null, // the service's /api/sonos/status
  spk = [], // the speakers the last search found
  soT = 0;
var SONOS_PLACES = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-right', label: 'Bottom right' },
];
function sonosState(s) {
  if (!s || !s.enabled) return 'Off';
  if (s.state === 'searching') return 'Looking for the speaker…';
  if (s.state === 'listening')
    return (s.muted ? 'Muted · ' : '') + 'Volume ' + s.volume + (s.mode === 'polling' ? ' · read every second' : '');
  return s.error || 'No Sonos speaker found';
}
/* for the On or Off of its row on the More screen */
function sonosLoad() {
  api('/api/sonos/status').then(
    function (s) {
      so = s;
      if (view === 'more') {
        build();
        draw();
      }
    },
    function () {}
  );
}
function openSonos() {
  api('/api/sonos/status').then(
    function (s) {
      so = s;
      push('sonos');
      sonosRefresh(0);
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
/* while it looks for the speaker, the screen follows what it finds */
function sonosRefresh(n) {
  clearTimeout(soT);
  if (view !== 'sonos' || !so || !so.enabled || n > 15) return;
  soT = setTimeout(function () {
    api('/api/sonos/status').then(
      function (s) {
        if (view !== 'sonos') return;
        so = s;
        build();
        draw();
        if (s.state === 'searching') sonosRefresh(n + 1);
      },
      function () {}
    );
  }, 1000);
}
function sonosSet(b) {
  api('/api/sonos/set', b).then(
    function (s) {
      if (s.error) return banner(s.error, 'err');
      so = s;
      build();
      draw();
      sonosRefresh(0);
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function sonosFind() {
  banner('Searching the network…', 'work');
  api('/api/sonos/find', {}, 15000).then(
    function (r) {
      banner('');
      spk = r.speakers || [];
      if (view === 'sonospick') {
        build();
        draw();
      } else push('sonospick');
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function sonosRows() {
  var s = so || { enabled: false },
    place = SONOS_PLACES[0];
  SONOS_PLACES.forEach(function (x) {
    if (x.id === s.position) place = x;
  });
  if (view === 'sonospick') {
    var cur = s.speaker ? s.speaker.id : '';
    rows.push({
      label: 'Automatic',
      sub: (cur ? '' : 'selected · ') + 'the soundbar on the network',
      fn: function () {
        sonosSet({ speaker: '' });
        pop();
      },
    });
    spk.forEach(function (x) {
      rows.push({
        label: x.name,
        sub: (x.id === cur ? 'selected · ' : '') + x.model,
        fn: function () {
          sonosSet({ speaker: x.id });
          pop();
        },
      });
    });
    if (!spk.length) rows.push({ label: 'No Sonos speaker found', sub: 'on the same network as the TV', fn: null });
    rows.push({ sep: true });
    rows.push({ label: 'Search again', fn: sonosFind });
    rows.push({ label: 'Back', fn: pop });
    return;
  }
  rows.push({
    label: 'Show the Sonos volume',
    sub: onoff(s.enabled),
    fn: function () {
      sonosSet({ enabled: !s.enabled });
    },
  });
  rows.push({
    label: 'Speaker',
    sub: s.speaker ? s.speaker.name + ' · ' + s.speaker.model : 'Automatic' + (s.using ? ' · ' + s.using.name : ''),
    fn: sonosFind,
  });
  rows.push({
    label: 'Place on screen',
    sub: place.label,
    fn: function () {
      sonosSet({ position: SONOS_PLACES[(SONOS_PLACES.indexOf(place) + 1) % SONOS_PLACES.length].id });
    },
  });
  rows.push({ label: 'Now', sub: sonosState(s), fn: null });
  rows.push({ sep: true });
  rows.push({ label: 'Back', fn: pop });
}
