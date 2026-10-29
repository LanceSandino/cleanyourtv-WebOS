// Where to watch (where.js): which installed app a streaming service is, and how that app is opened at a title, from what a catalogue
// says about it. Only text is read here; no address is ever fetched or opened.
//   unwrap(url)            the service's own link inside a catalogue's link. Plex's links are affiliate trackers
//                          (https://disneyplus.bn5x.net/c/...?u=<the real link>): only their u= parameter is kept, the tracker itself
//                          is never asked. A link that is neither a tracker nor the service's own gives ''
//   appsOf(platform, name) the LG app ids a service may be on this TV (Plex's platform names, else the service's name as an app title)
//   launch(app, link, kind) launch parameters that open that title in the app, {params, exact}; exact false: the app opens as it is
// Formats, and what is known of them:
//   Disney+      contentTarget distributionPartner=lg&programType=<series|movie>&contentId=<id>&page=browse&id=entity-<id>&...
//                (LG's format for Disney+'s pages; not yet opened on a TV: unverified)
//   Netflix      contentTarget m=<title id>&source_type=27, as Netflix's own row on the TV writes it (unverified from a catalogue)
//   Prime Video  contentTarget detail?gti=<amzn1.dv.gti...>, as Prime Video's own row writes it (unverified from a catalogue)
//   Apple TV     contentTarget https://tv.apple.com/<country>/<show|movie>/<name>/umc.cmc.<id>, as its own row writes it (unverified)
//   YouTube      contentTarget v=<video id>, as its own row writes it
//   the others (Hulu, Peacock, Max, ...) open as they are
const disney = require('./disney');

// Plex's platform names (Plex Discover's availabilities) and the apps they are on an LG TV. Seen on the owner's TV: disney-plus, hulu,
// apple-itunes; the others are Plex's names as far as known (unverified)
const PLATFORM_APPS = {
  'disney-plus': ['com.disney.disneyplus-prod'],
  netflix: ['netflix'],
  'amazon-prime-video': ['amazon'],
  'amazon-video': ['amazon'],
  'prime-video': ['amazon'],
  hulu: ['hulu'],
  peacock: ['com.peacock.tv'],
  'peacock-premium': ['com.peacock.tv'],
  'apple-tv-plus': ['com.apple.appletv'],
  'apple-itunes': ['com.apple.appletv'],
  'apple-tv': ['com.apple.appletv'],
  youtube: ['youtube.leanback.v4'],
  'youtube-tv': ['youtube.leanback.ytv.v1'],
  'sling-tv': ['com.movenetworks.app.sling-tv-sling-production'],
  plex: ['cdp-30', 'com.beb.plxnative'],
};
// the services' own sites and app links (a link from anywhere else is not used)
const OWN =
  /^(https:\/\/([a-z0-9-]+\.)*(disneyplus\.com|netflix\.com|amazon\.com|primevideo\.com|apple\.com|youtube\.com|hulu\.com|peacocktv\.com|max\.com|paramountplus\.com|sling\.com|fubo\.tv|plex\.tv)(\/|$)|disneyplus:\/\/)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function unwrap(url) {
  const s = String(url || '');
  if (s.length > 4096) return '';
  const m = /[?&]u=([^&#]+)/.exec(s);
  let inner = '';
  if (m)
    try {
      inner = decodeURIComponent(m[1]);
    } catch (_) {
      inner = '';
    }
  const link = inner || s;
  return OWN.test(link) && link.length <= 2048 ? link : '';
}

const plain = s =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, '');
function appsOf(platform, name, installed) {
  const known = PLATFORM_APPS[String(platform || '')];
  if (known) return known;
  // a service Plex names that has no entry above: an installed app with exactly its name ("Hulu", "Peacock")
  const n = plain(name);
  return n ? (installed || []).filter(a => plain(a.title) === n).map(a => a.id) : [];
}

function launch(app, link, kind) {
  const l = String(link || '');
  let m;
  if (app === disney.APP && (m = /\bentity-([0-9a-f-]{36})\b/.exec(l)) && UUID.test(m[1]))
    return { params: { contentTarget: disney.browseTarget(m[1], kind) }, exact: true };
  if (app === 'netflix' && (m = /^https:\/\/(www\.)?netflix\.com\/([a-z-]+\/)?title\/(\d{1,12})(\/|\?|$)/.exec(l)))
    return { params: { contentTarget: 'm=' + m[3] + '&source_type=27' }, exact: true };
  if (app === 'amazon' && (m = /\b(amzn1\.dv\.gti\.[0-9a-f-]{36})\b/.exec(l)))
    return { params: { contentTarget: 'detail?gti=' + m[1] }, exact: true };
  if (
    app === 'com.apple.appletv' &&
    (m = /^(https:\/\/tv\.apple\.com\/[a-z]{2}\/(show|movie)\/[\w%-]{1,200}\/umc\.cmc\.[a-z0-9]{10,40})(\?|$)/.exec(l))
  )
    return { params: { contentTarget: m[1] }, exact: true };
  if (/^youtube\.leanback\./.test(app) && (m = /^https:\/\/(www\.)?youtube\.com\/watch\?(.*&)?v=([\w-]{6,20})(&|$)/.exec(l)))
    return { params: { contentTarget: 'v=' + m[3] }, exact: true };
  return { params: {}, exact: false };
}

module.exports = { unwrap, appsOf, launch, PLATFORM_APPS };
