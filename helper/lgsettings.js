// LG's own ad, promotion and suggestion settings, switched off while the debloat group "lgads" is on (on with the debloat unless
// switched off), and HbbTV's red-button pages off with Do Not Track on and the device ID off while the group "hbbtv" is on (opt-in:
// options.debloatOn). They are LG's own switches (com.webos.settingsservice, the ones LG's Settings menus change), kept by the TV:
// so the value each had is saved first (D/lgsettings-saved.json) and put back when its group is switched off, and a key this firmware
// does not have is left alone. The keys are the ones own-your-glass found on webOS 25 (home promotions, screensaver ads, the ad
// cookie, Smart Tips, sports alerts, limit ad tracking, content recommendations, Live TV promotions, LivePlus, the promotion video).
// Looked at shortly after the service starts, every ten minutes (LG or someone may switch them back), when the TV wakes, and when the
// manager switches a group. Not while LG's Home is chosen (DISABLE), like the rest of the debloat.
const fs = require('fs');
const P = require('./paths');

const SVC = 'luna://com.webos.settingsservice/';
const GROUPS = {
  lgads: [
    ['general', 'homePromotion', 'off'],
    ['general', 'screenSaverAd', 'off'],
    ['general', 'adCookie', 'off'],
    ['general', 'aiNudge', 'off'],
    ['general', 'sportsAlarm', 'off'],
    ['general', 'lmt', 'on'],
    ['other', 'contentRecommendation', 'off'],
    ['option', 'livePromotion', 'off'],
    ['option', 'livePlus', 'off'],
    ['option', 'webOSPromotionVideo', 'off'],
  ],
  hbbtv: [
    ['option', 'hbbTV', 'off'],
    ['option', 'hbbTvDnt', 'on'],
    ['option', 'hbbTvDeviceId', 'off'],
  ],
};
const OPT_IN = ['hbbtv']; // on only when listed in options.debloatOn
const SAVED = () => process.env.CYTV_LGSETTINGS_SAVED || P.D + '/lgsettings-saved.json';

// the value to send: LG's switch is "on"/"off" text on some keys and true/false on others; the same kind as it has now
const asKind = (want, cur) => (typeof cur === 'boolean' ? want === 'on' : want);
const same = (want, cur) => String(asKind(want, cur)) === String(cur);

function create(ctx, opts) {
  const o = Object.assign({ startMs: 20000, checkMs: 10 * 60 * 1000, tickMs: 10000, wakeGapMs: 60000 }, opts);
  const luna = ctx.luna;
  const on = group => {
    const op = ctx.config.options();
    if (op.debloat === false || fs.existsSync(P.DISABLE)) return false;
    return OPT_IN.indexOf(group) >= 0 ? (op.debloatOn || []).indexOf(group) >= 0 : (op.debloatOff || []).indexOf(group) < 0;
  };
  const readSaved = () => {
    try {
      const s = JSON.parse(fs.readFileSync(SAVED(), 'utf8'));
      return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    } catch (_) {
      return {};
    }
  };
  const writeSaved = s => {
    if (!Object.keys(s).length) {
      try {
        fs.unlinkSync(SAVED());
      } catch (_) {}
      return;
    }
    fs.writeFileSync(SAVED() + '.tmp', JSON.stringify(s), { mode: 0o600 });
    fs.renameSync(SAVED() + '.tmp', SAVED());
  };
  const get = async (cat, key) => {
    const r = await luna(SVC + 'getSystemSettings', { category: cat, keys: [key] });
    return r && r.settings && Object.prototype.hasOwnProperty.call(r.settings, key) ? r.settings[key] : undefined;
  };
  const set = (cat, key, v) => {
    const settings = {};
    settings[key] = v;
    return luna(SVC + 'setSystemSettings', { category: cat, settings });
  };
  let busy = false,
    again = false,
    last = '';
  const note = m => {
    last = m;
    console.log('lgsettings: ' + m);
  };

  // a group on: each key it has here to its value, LG's own value saved first; a group off: what it saved, back
  async function apply(group) {
    const saved = readSaved(),
      changed = [];
    for (const [cat, key, want] of GROUPS[group]) {
      const id = cat + '.' + key,
        cur = await get(cat, key);
      if (cur === undefined || same(want, cur)) continue;
      if (!Object.prototype.hasOwnProperty.call(saved, id)) saved[id] = cur;
      const r = await set(cat, key, asKind(want, cur));
      if (r && r.returnValue !== false) changed.push(key);
      else delete saved[id];
    }
    writeSaved(saved);
    if (changed.length) note(group + ': ' + changed.join(', ') + ' switched');
  }
  async function restore(group) {
    const saved = readSaved(),
      back = [];
    for (const [cat, key] of GROUPS[group]) {
      const id = cat + '.' + key;
      if (!Object.prototype.hasOwnProperty.call(saved, id)) continue;
      const r = await set(cat, key, saved[id]);
      if (r && r.returnValue !== false) {
        back.push(key);
        delete saved[id];
      }
    }
    writeSaved(saved);
    if (back.length) note(group + ': ' + back.join(', ') + ' back as they were');
  }
  async function sync() {
    if (busy) return void (again = true);
    busy = true;
    try {
      do {
        again = false;
        for (const g of Object.keys(GROUPS)) await (on(g) ? apply(g) : restore(g));
      } while (again);
    } catch (e) {
      note('failed: ' + ((e && e.message) || e));
    }
    busy = false;
  }
  // for the debloat check: the keys of the groups that are on, and whether each has the value it should (undefined: not on this TV)
  async function check() {
    const out = [];
    for (const g of Object.keys(GROUPS)) {
      if (!on(g)) continue;
      for (const [cat, key, want] of GROUPS[g]) {
        const cur = await get(cat, key);
        if (cur !== undefined) out.push({ group: g, key, ok: same(want, cur) });
      }
    }
    return out;
  }
  function start() {
    setTimeout(sync, o.startMs);
    setInterval(sync, o.checkMs);
    let tick = Date.now();
    setInterval(() => {
      const now = Date.now();
      if (now - tick > o.wakeGapMs) sync(); // the TV woke from standby (the service slept with it)
      tick = now;
    }, o.tickMs);
    require('./debloat').onChange(sync);
  }
  return { name: 'lgsettings', start, sync, check, status: () => ({ saved: Object.keys(readSaved()), last }) };
}

module.exports = { create, GROUPS, OPT_IN };
