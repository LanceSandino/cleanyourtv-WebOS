// LG's app rows (watch.js): the row LG's own Home shows under a highlighted app (YouTube's videos, Disney+'s films, Netflix's and Prime
// Video's Continue watching), read only from the two places LG keeps it on the TV:
// - LG's content miner's own record (com.webos.service.contentminer, its db8 kind, which only that service may read: it is read as
//   that service): what the miner fetched from LG for an app;
// - for an app the miner has nothing of, the app manager's copy of that app's row (com.webos.applicationManager/getAllContents): the
//   rows apps write themselves through their own service (Netflix, Prime Video: their Continue watching and suggestions).
// LG's Home puts its advertisements in these rows separately (com.webos.service.admanager), which is never called here; an item that
// carries a promotion is dropped too, and the apps' own "shown" calls (onShow) are never made. Nothing is sent anywhere.
//   items(pic)  cards for watch.js: {key, group, app, source: 'lg', title, sub, img, progress: null, launch: {id, params: {contentTarget}}},
//               an app's Continue watching first
const crypto = require('crypto');

const MINER = 'com.webos.service.contentminer',
  KIND = MINER + '.contents:1',
  SAM = 'luna://com.webos.applicationManager/getAllContents',
  PER_APP = 12;
const AD = /sponsor|advert|\bads?\b|promot/i,
  CONTINUE = /continue watching|watch next|resume/i;

// what stays the same when an app's row is written again: the item's own id (YouTube v, Netflix m, Prime Video gti, Disney+ contentId),
// else an address without its query (Apple TV's carries the place in the row), else all of it
function stable(id) {
  const s = String(id || ''),
    m = /(?:^|[?&])(v|m|gti|contentId)=([^&]+)/.exec(s);
  return m ? m[1] + '=' + m[2] : /^https?:\/\//.test(s) ? s.split('?')[0] : s;
}

function create(ctx) {
  const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
  const ask = (uri, payload, opts) => Promise.resolve(ctx.luna(uri, payload, opts)).catch(() => null);
  // an item someone is in the middle of: its shelf says so, or the app gave its watch state (Prime Video)
  const going = c => CONTINUE.test(String(c.category || '')) || !!(c.watch_state && typeof c.watch_state === 'object');
  function card(appId, c, pic) {
    const click = c.onClick && typeof c.onClick === 'object' ? c.onClick : {};
    const target = typeof click.targetAppId === 'string' && click.targetAppId ? click.targetAppId : appId;
    const params = {};
    if (click.launchParam && typeof click.launchParam === 'object') for (const k in click.launchParam) params[k] = click.launchParam[k];
    if (click.contentId) params.contentTarget = String(click.contentId); // how LG's Home opens it
    // Prime Video names the series and the episode apart ("<series> - Season 2" with season 2, episode 1)
    const cat = c.catalog && typeof c.catalog === 'object' ? c.catalog : {},
      s = Number(cat.season_number),
      e = Number(cat.episode_number),
      ep = typeof cat.title === 'string' && cat.title && s > 0 && e > 0 && String(c.titleText).indexOf(cat.title) === 0;
    const id = hash(click.contentId ? stable(click.contentId) : c.titleText);
    return {
      key: 'lg-' + appId + '-' + id,
      group: 'lg:' + appId + ':' + id, // what Remove from this row keeps
      app: appId,
      source: 'lg',
      title: ep ? cat.title : String(c.titleText),
      sub: ep ? 'S' + s + ' E' + e : c.category ? String(c.category) : '',
      img: pic((c.image && c.image.url) || '', (c.image_4k && c.image_4k.url) || ''),
      progress: null,
      launch: { id: target, params },
    };
  }
  async function items(pic) {
    const [sam, miner] = await Promise.all([
      ask(SAM, {}),
      ask('luna://com.webos.service.db/find', { query: { from: KIND } }, { as: MINER }),
    ]);
    const rows = [],
      seen = {};
    for (const rec of miner && miner.returnValue && Array.isArray(miner.results) ? miner.results : []) {
      if (rec && typeof rec.appId === 'string' && rec.appId && !seen[rec.appId] && Array.isArray(rec.contents))
        rows.push(rec), (seen[rec.appId] = 1);
    }
    for (const lp of sam && sam.returnValue && Array.isArray(sam.allContents) ? sam.allContents : []) {
      const m = lp && typeof lp.launchPointId === 'string' ? /^(.+)_default$/.exec(lp.launchPointId) : null; // an app's own launch point
      if (m && !seen[m[1]] && Array.isArray(lp.contents)) rows.push({ appId: m[1], contents: lp.contents }), (seen[m[1]] = 1);
    }
    const out = [];
    for (const rec of rows) {
      // the row's own title entry, empty items and anything promoted are left out
      const list = rec.contents.filter(
        c => c && c.type === 'content' && c.titleText && !c.promotionId && !AD.test(String(c.category || ''))
      );
      const first = list.filter(going).concat(list.filter(c => !going(c)));
      for (const c of first.slice(0, PER_APP)) out.push(card(rec.appId, c, pic));
    }
    return out;
  }
  return { items };
}

module.exports = { create, MINER };
