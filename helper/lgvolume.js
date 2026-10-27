// LG's own volume bar, hidden while the Sonos volume shows (sonos.js, option "Hide LG's volume bar"). On webOS 25 LG's surface manager
// draws its volume view only while the configd setting com.webos.surfacemanager.volumeOSD is not false, and follows that setting as it
// changes (StarfishVolumeView.qml). hide() puts a one-setting file, {"volumeOSD": false}, into configd's runtime layer
// (/var/run/tvconfig/remote: in RAM, LG's highest priority; a layer file overrides only the settings it names) and asks configd to
// read its layers again, as LG itself does at every start; show() removes the file the same way. No mount, no file of LG's is changed,
// and a restart of the TV brings LG's bar back. Volume and mute keep working: only LG's bar on screen goes, and its mute icon with it.
const fs = require('fs'),
  path = require('path');
const P = require('./paths');

const KEY = 'com.webos.surfacemanager.volumeOSD';
const OURS = '{"volumeOSD": false}\n'; // the whole file; a file with anything else in it is not ours and is never removed

// ctx: {luna, profile}; dir: the runtime layer (tests point it elsewhere)
function create(ctx, dir) {
  const d = dir || P.LGVOL_DIR;
  const file = path.join(d, 'com.webos.surfacemanager.json');
  const read = () => {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (_) {
      return null;
    }
  };
  // this TV is one where LG's bar follows that setting, and the layer folder is there (it is LG's: never created here)
  const supported = () => {
    const p = ctx.profile && ctx.profile.get ? ctx.profile.get() : {};
    if (p.lgVolumeBar !== 'configd') return false;
    try {
      return fs.statSync(d).isDirectory();
    } catch (_) {
      return false;
    }
  };
  const hidden = () => read() === OURS;
  const reread = () => ctx.luna('luna://com.webos.service.config/reconfigure', {}, { wait: 15000 });
  async function hide() {
    if (!supported()) return false;
    const now = read();
    if (now === OURS) return true;
    if (now !== null) return false; // someone else's file of that name: leave it alone
    fs.writeFileSync(file + '.tmp', OURS);
    fs.renameSync(file + '.tmp', file);
    await reread();
    console.log("sonos: LG's volume bar hidden (configd " + KEY + ' false, in RAM)');
    return true;
  }
  async function show() {
    if (!hidden()) return false;
    try {
      fs.unlinkSync(file);
    } catch (_) {
      return false;
    }
    await reread();
    console.log("sonos: LG's volume bar back");
    return true;
  }
  return { supported, hidden, hide, show, file };
}

module.exports = { create, KEY, OURS };
