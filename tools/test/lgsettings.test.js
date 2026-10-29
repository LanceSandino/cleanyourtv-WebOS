// LG's ad and promotion settings (lgsettings.js), against a stand-in for LG's settings service: with the debloat on, each key this
// TV has is switched (text or true/false, as the TV keeps it) after its own value is saved; a key the firmware lacks is left alone;
// switched off, the saved values come back; HbbTV only when it is switched on (opt-in).
const fs = require('fs'),
  path = require('path');
const { ok, tmp, req, memoryConfig, run } = require('./lib');

run(async () => {
  process.env.CYTV_LGSETTINGS_SAVED = path.join(tmp, 'lgsettings-saved.json');
  const tv = {
    general: { homePromotion: 'on', screenSaverAd: 'on', aiNudge: true, lmt: 'off', sportsAlarm: 'off' },
    other: { contentRecommendation: 'on' },
    option: { livePlus: 'on', hbbTV: 'on', hbbTvDnt: 'off' },
  };
  const sets = [];
  const luna = async (uri, p) => {
    if (/getSystemSettings$/.test(uri)) {
      const settings = {};
      for (const k of p.keys)
        if (tv[p.category] && Object.prototype.hasOwnProperty.call(tv[p.category], k)) settings[k] = tv[p.category][k];
      return { returnValue: true, settings };
    }
    if (/setSystemSettings$/.test(uri)) {
      for (const k of Object.keys(p.settings)) {
        tv[p.category][k] = p.settings[k];
        sets.push(p.category + '.' + k + '=' + p.settings[k]);
      }
      return { returnValue: true };
    }
    return { returnValue: true };
  };
  const conf = memoryConfig({ options: { debloat: true } });
  const S = req('lgsettings').create({ config: conf, luna }, { startMs: 1e6, checkMs: 1e6 });
  await S.sync();
  ok(
    sets.join() ===
      'general.homePromotion=off,general.screenSaverAd=off,general.aiNudge=false,general.lmt=on,other.contentRecommendation=off,option.livePlus=off',
    'with the debloat on: the ad and promotion settings this TV has are switched (true/false where the TV keeps it so), HbbTV left as it is: ' +
      sets.join()
  );
  const saved = JSON.parse(fs.readFileSync(process.env.CYTV_LGSETTINGS_SAVED, 'utf8'));
  ok(
    saved['general.homePromotion'] === 'on' &&
      saved['general.aiNudge'] === true &&
      saved['general.lmt'] === 'off' &&
      !('general.sportsAlarm' in saved),
    "LG's own values are saved first (only of the keys it switched)"
  );
  sets.length = 0;
  await S.sync();
  const checks = await S.check();
  ok(
    sets.length === 0 && checks.length === 7 && checks.every(c => c.ok),
    'nothing more while they stay so, and the check sees each one right'
  );
  conf.update('test', c => {
    c.options.debloatOn = ['hbbtv'];
  });
  await S.sync();
  ok(
    sets.join() === 'option.hbbTV=off,option.hbbTvDnt=on',
    'HbbTV switched on: its red-button pages off and Do Not Track on: ' + sets.join()
  );
  sets.length = 0;
  conf.update('test', c => {
    c.options = { debloat: true, debloatOff: ['lgads'] };
  });
  await S.sync();
  ok(
    tv.general.homePromotion === 'on' &&
      tv.general.aiNudge === true &&
      tv.general.lmt === 'off' &&
      tv.option.hbbTV === 'on' &&
      tv.option.hbbTvDnt === 'off' &&
      !fs.existsSync(process.env.CYTV_LGSETTINGS_SAVED),
    'switched off: every setting is back as LG had it, and the saved file is gone: ' + sets.join()
  );
  ok(
    req('debloat').cleanOn(['hbbtv', 'ads']).join() === 'hbbtv' && req('debloat').cleanOff(['lgads', 'hbbtv']).join() === 'lgads',
    'lgads is a group switched off by name, hbbtv an opt-in switched on by name'
  );
});
