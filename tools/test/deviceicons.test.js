// An input's icon from the name its device gives (core.js and the picker, the same block in both): the shape of the device, drawn here
// and never a company's logo, and the plain HDMI icon when the name says nothing.
const fs = require('fs'),
  path = require('path');
const { root, ok, run } = require('./lib');

const between = f => {
  const m = /\/\* device icons start[\s\S]*?\/\* device icons end \*\//.exec(fs.readFileSync(path.join(root, f), 'utf8'));
  return m ? m[0] : '';
};

run(async () => {
  const launcher = between('app/src/js/core.js'),
    picker = between('picker/app/index.html');
  ok(launcher.length > 500 && launcher === picker, 'the launcher and the picker carry the same icons and names');
  const { DEVICE_ICONS, DEVICE_NAMES, deviceIcon } = new Function(launcher + ';return {DEVICE_ICONS, DEVICE_NAMES, deviceIcon};')();
  const seen = {
    'PS5 Game Console': 'tower',
    'PlayStation 5': 'tower',
    'PS4 Pro': 'tower',
    'Nintendo Switch': 'handheld',
    'NintendoSwitch': 'handheld',
    'Xbox Series X': 'block',
    'Sonos Beam': 'soundbar',
    'Bose Soundbar': 'soundbar',
    'Denon AVR-X': 'soundbar',
    'Apple TV': 'box',
    'SHIELD': 'box',
    'Fire TV Stick': 'stick',
    Chromecast: 'stick',
    Roku: 'stick',
    'Game console': 'pad',
    'Steam Deck': 'pad',
    'Blu-ray Player': 'disc',
    'Gaming PC': 'pad',
    MacBook: 'laptop',
    'Windows PC': 'laptop',
    'Xfinity X1': 'settop',
    'Cable box': 'settop',
    'HDMI 1': 'hdmi',
    '': 'hdmi',
  };
  const wrong = Object.keys(seen).filter(k => deviceIcon(k) !== seen[k]);
  ok(!wrong.length && deviceIcon() === 'hdmi', 'each device name gets its icon: ' + wrong.map(k => k + ' -> ' + deviceIcon(k)).join());
  ok(
    DEVICE_NAMES.every(n => DEVICE_ICONS[n[0]]) &&
      Object.keys(DEVICE_ICONS).every(k => !/<(image|text|use|script)|href|url\(/.test(DEVICE_ICONS[k])),
    'every name has its icon, and the icons are plain drawn shapes'
  );
  const page = fs.readFileSync(path.join(root, 'picker/app/index.html'), 'utf8'),
    menus = fs.readFileSync(path.join(root, 'app/src/js/menus.js'), 'utf8'),
    tiles = fs.readFileSync(path.join(root, 'app/src/js/tiles.js'), 'utf8');
  ok(
    /icon:deviceIcon\(v\.label\)/.test(page) &&
      /ICON\[deviceIcon\(a\.title\)\]/.test(page) &&
      /icon: deviceIcon\(d\.label\)/.test(menus) &&
      /deviceIcon\(a\.title\)/.test(tiles),
    "the picker's inputs and pinned inputs, the launcher's Inputs list and its input tiles use them"
  );
});
