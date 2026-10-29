var API = 'http://127.0.0.1:8765',
  CACHE_KEY = 'cytv.cache.v6',
  VERSION = '1.5.28';
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
function svg(name) {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[name] || ICONS.grid) +
    '</svg>'
  );
}
