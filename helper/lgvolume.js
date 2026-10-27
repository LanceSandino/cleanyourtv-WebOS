// LG's own volume bar, hidden while the Sonos volume shows (sonos.js, option "Hide LG's volume bar"). On webOS 25 LG's surface manager
// draws its volume view only while the configd setting com.webos.surfacemanager.volumeOSD is not false, and follows that setting as it
// changes (StarfishVolumeView.qml). hide() sets it to false through lgconfig.js (one small file in a configd layer in RAM, then configd
// reads its layers again); show() takes that away the same way. No mount, no file of LG's is changed, and a restart of the TV brings
// LG's bar back. Volume and mute keep working: only LG's bar on screen goes, and its mute icon with it.
const fs = require('fs'),
  path = require('path');
const P = require('./paths');

const NS = 'com.webos.surfacemanager',
  KEY = NS + '.volumeOSD',
  VALUES = { volumeOSD: false };
// 1.6.19 wrote this file into configd's "remote" layer, which configd never reads (it picks that layer at boot, before the folder
// exists); it is removed once, and only when it holds exactly what 1.6.19 wrote
const OLD = '{"volumeOSD": false}\n';

// ctx: {luna, profile}; o: {dir, record, oldDir} (tests)
function create(ctx, opts) {
  const o = opts || {};
  const layer = require('./lgconfig').create(ctx, { dir: o.dir, record: o.record });
  const old = path.join(o.oldDir || P.LGVOL_DIR, NS + '.json');
  try {
    if (fs.readFileSync(old, 'utf8') === OLD) fs.unlinkSync(old);
  } catch (_) {}
  // this TV is one where LG's bar follows that setting (tvprofile.js), and the layer is there
  const supported = () => {
    const p = ctx.profile && ctx.profile.get ? ctx.profile.get() : {};
    return p.lgVolumeBar === 'configd' && layer.supported();
  };
  const hidden = () => layer.isSet(NS, VALUES);
  async function hide() {
    if (!supported()) return false;
    if (hidden()) return true;
    const ok = await layer.set(NS, VALUES);
    if (ok) console.log("sonos: LG's volume bar hidden (configd " + KEY + ' false, in RAM)');
    return ok;
  }
  async function show() {
    const gone = await layer.clear(NS);
    if (gone) console.log("sonos: LG's volume bar back");
    return gone;
  }
  return { supported, hidden, hide, show };
}

module.exports = { create, NS, KEY, VALUES };
