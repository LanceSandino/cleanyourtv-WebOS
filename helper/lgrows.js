// LG's app rows (watch.js): the row LG's own Home shows under a highlighted app (YouTube's videos, Disney+'s films, Apple TV's shows),
// as LG's content miner keeps it on the TV (com.webos.service.contentminer, its db8 kind, which only that service may read: it is read
// as that service, read only). LG's Home puts its advertisements in these rows separately (com.webos.service.admanager), which is never
// called here; an item that carries a promotion is dropped too. Nothing is sent anywhere: the miner fills its data on its own.
//   items(pic)  cards for watch.js: {key, group, app, source: 'lg', title, sub, img, progress: null, launch: {id, params: {contentTarget}}}
const crypto = require('crypto');

const MINER = 'com.webos.service.contentminer',
  KIND = MINER + '.contents:1',
  PER_APP = 12;
const AD = /sponsor|advert|\bads?\b|promot/i;

function create(ctx) {
  const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
  async function items(pic) {
    const r = await ctx.luna('luna://com.webos.service.db/find', { query: { from: KIND } }, { as: MINER });
    const out = [];
    for (const rec of r && r.returnValue && Array.isArray(r.results) ? r.results : []) {
      if (!rec || typeof rec.appId !== 'string' || !rec.appId) continue;
      let n = 0;
      for (const c of Array.isArray(rec.contents) ? rec.contents : []) {
        if (n >= PER_APP) break;
        // the row's own title entry, empty items and anything promoted are left out
        if (!c || c.type !== 'content' || !c.titleText || c.promotionId || AD.test(String(c.category || ''))) continue;
        const click = c.onClick && typeof c.onClick === 'object' ? c.onClick : {};
        const target = typeof click.targetAppId === 'string' && click.targetAppId ? click.targetAppId : rec.appId;
        const params = {};
        if (click.launchParam && typeof click.launchParam === 'object') for (const k in click.launchParam) params[k] = click.launchParam[k];
        if (click.contentId) params.contentTarget = String(click.contentId); // how LG's Home opens it
        out.push({
          key: 'lg-' + rec.appId + '-' + hash(click.contentId || c.titleText),
          group: 'lg:' + rec.appId + ':' + hash(click.contentId || c.titleText),
          app: rec.appId,
          source: 'lg',
          title: String(c.titleText),
          sub: c.category ? String(c.category) : '',
          img: pic((c.image && c.image.url) || '', (c.image_4k && c.image_4k.url) || ''),
          progress: null,
          launch: { id: target, params },
        });
        n++;
      }
    }
    return out;
  }
  return { items };
}

module.exports = { create, MINER };
