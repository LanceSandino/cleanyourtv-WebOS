var API = 'http://127.0.0.1:8765',
  CACHE_KEY = 'cytv.cache.v6',
  VERSION = '1.5.32';
var DEFAULTS = {
  dock: ['netflix', 'youtube.leanback.v4', 'amazon', 'com.disney.disneyplus-prod'],
  topbar: [
    { label: 'Search', icon: 'search', action: 'search' },
    { label: 'Inputs', icon: 'inputs', action: 'inputs' },
    { label: 'Live TV', icon: 'tv', action: 'live' },
    { label: 'Settings', icon: 'settings', app: 'com.palm.app.settings' },
  ],
};
var PRESETS = [
  /* "where to watch": a title looked up in the apps on this TV (search.js) */
  { label: 'Search', icon: 'search', action: 'search' },
  { label: 'Inputs', icon: 'inputs', action: 'inputs' },
  { label: 'Settings', icon: 'settings', app: 'com.palm.app.settings' },
  { label: 'Live TV', icon: 'tv', action: 'live' },
  /* LG's own TV (the antenna or cable tuner); "Live TV" above is the playlist player (upstream issue 69) */
  { label: 'LG TV', icon: 'tv', app: 'com.webos.app.livetv' },
];
var ICONS = {
  inputs: '<path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  hdmi: '<path d="M4 8h16v7l-3 3H7l-3-3z"/><path d="M9 11v3M12 11v3M15 11v3"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  /* the sections of Customize (menus.js), shown beside their rows */
  dock: '<rect x="3" y="13" width="18" height="7" rx="2.5"/><path d="M7.5 16.5h.01M12 16.5h.01M16.5 16.5h.01M6 4h12M6 8h8"/>',
  buttons: '<rect x="3" y="4" width="8" height="6" rx="3"/><rect x="13" y="4" width="8" height="6" rx="3"/><path d="M3 15h18M3 19h11"/>',
  hidden:
    '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.4 3M6.4 7.6C4.3 9.2 3 12 3 12s4 6 9 6a8.7 8.7 0 0 0 4-1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>',
  play: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M10.5 7.5v5l4-2.5z"/><path d="M3 20h11"/>',
  sort: '<path d="M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5"/>',
  dot: '<rect x="3" y="3" width="14" height="14" rx="3.5"/><circle cx="19" cy="19" r="2.5"/>',
  theme:
    '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-1.2-.9-1.5-.9-2.6 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.3-4-7.9-9-7.9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  cards:
    '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>',
  accent: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 8"/>',
  frame: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="7" y="7" width="10" height="10"/><path d="M9 15l2.5-2.8L15 15"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
};
/* device icons start: the same in the launcher (core.js) and the picker (tools/test/deviceicons.test.js holds them to it). An input's
   icon, from the name its device gives: the shape of the device, never a company's logo; hdmi when the name says nothing */
var DEVICE_ICONS = {
  tower:
    '<path d="M6 2.5c1.2 3.8 3 7 2.8 10.5-.2 3.3-.8 5.5-.8 8.5h8c0-3-.6-5.2-.8-8.5-.2-3.5 1.6-6.7 2.8-10.5z"/><path d="M10.4 2.5v19M13.6 2.5v19"/>',
  handheld:
    '<rect x="7" y="6" width="10" height="12" rx="1"/><path d="M7 6H5.5A3.5 3.5 0 0 0 2 9.5v5A3.5 3.5 0 0 0 5.5 18H7"/><path d="M17 6h1.5A3.5 3.5 0 0 1 22 9.5v5a3.5 3.5 0 0 1-3.5 3.5H17"/><circle cx="4.6" cy="9.8" r="1.2"/><circle cx="19.4" cy="14.2" r="1.2"/>',
  block: '<rect x="7" y="2.5" width="10" height="19" rx="1.5"/><circle cx="12" cy="6.5" r="2.2"/><path d="M12 17.5h.01"/>',
  soundbar:
    '<rect x="1.5" y="11" width="21" height="6" rx="3"/><path d="M6 14h.01M12 14h.01M18 14h.01"/><path d="M8 7.5c2.5-1.6 5.5-1.6 8 0"/><path d="M10 4.8c1.3-.6 2.7-.6 4 0"/>',
  box: '<rect x="4.5" y="8" width="15" height="8" rx="2.5"/><path d="M8 19h8"/><path d="M15.5 12h.01"/>',
  stick:
    '<rect x="2.5" y="8.5" width="13" height="7" rx="2"/><path d="M15.5 10.5h4.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4.5"/><path d="M6 12h.01"/>',
  pad: '<path d="M7 7.5h10a5 5 0 0 1 5 4.9l.2 3.6a2.9 2.9 0 0 1-5.2 1.9L15.5 16h-7L7 17.9A2.9 2.9 0 0 1 1.8 16l.2-3.6A5 5 0 0 1 7 7.5z"/><path d="M7.5 10.5v3M6 12h3"/><path d="M15.5 11h.01M18 13h.01"/>',
  disc: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19"/>',
  settop: '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6 12h5"/><path d="M15 12h.01M18 12h.01"/>',
};
var DEVICE_NAMES = [
  ['tower', /play ?station|\bps ?[345]\b/i],
  ['handheld', /nintendo|\bswitch\b/i],
  ['block', /xbox/i],
  ['soundbar', /sonos|sound ?bar|\bbose\b|denon|yamaha|marantz|onkyo|receiver|\bavr\b|\bbeam\b/i],
  ['box', /apple ?tv|shield|tivo|roku ultra/i],
  ['stick', /fire ?tv|chromecast|google tv|roku|\bstick\b/i],
  ['pad', /steam|console|\bgame\b|gaming|\bwii\b|sega|retro/i],
  ['disc', /blu-?ray|\bdvd\b|\bbdp?\b/i],
  ['laptop', /\bpc\b|laptop|macbook|\bmac\b|computer|windows/i],
  ['settop', /cable|direct ?tv|xfinity|comcast|spectrum|\bcox\b|\bdish\b|set.?top|\bstb\b|hopper/i],
];
function deviceIcon(label) {
  for (var i = 0; i < DEVICE_NAMES.length; i++) if (DEVICE_NAMES[i][1].test(label || '')) return DEVICE_NAMES[i][0];
  return 'hdmi';
}
/* device icons end */
for (var dvk in DEVICE_ICONS) ICONS[dvk] = DEVICE_ICONS[dvk];
function svg(name) {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[name] || ICONS.grid) +
    '</svg>'
  );
}
