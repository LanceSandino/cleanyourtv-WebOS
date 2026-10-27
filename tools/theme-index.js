// Builds themes/index.json, the list the TV reads from GitHub: one entry per folder in themes/ (name, author and description from its
// theme.json, and the screenshot, preview.jpg). Run it after adding or changing a theme; the checks fail when the file is out of date.
//   node tools/theme-index.js          writes themes/index.json
const fs = require('fs'),
  path = require('path');
const ROOT = path.join(__dirname, '..', 'themes');
function build() {
  const ids = fs.readdirSync(ROOT).filter(n => /^[a-z0-9-]{1,30}$/.test(n) && fs.existsSync(path.join(ROOT, n, 'theme.json')));
  const items = ids.map(id => {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'theme.json'), 'utf8'));
    const pv = ['jpg', 'png', 'webp'].find(x => fs.existsSync(path.join(ROOT, id, 'preview.' + x)));
    const e = {
      id,
      name: String(t.name || id),
      author: String(t.author || ''),
      description: String(t.description || ''),
      preview: pv ? id + '/preview.' + pv : '',
    };
    // a holiday theme's dates, so a TV with Holiday themes on knows which one to download before the day
    if (t.holiday) e.holiday = { from: String(t.holiday.from), to: String(t.holiday.to) };
    return e;
  });
  items.sort((a, b) => (a.id === 'classic' ? -1 : b.id === 'classic' ? 1 : a.name.localeCompare(b.name)));
  return JSON.stringify({ v: 1, themes: items }, null, 1) + '\n';
}
module.exports = { build, ROOT };
if (require.main === module) {
  fs.writeFileSync(path.join(ROOT, 'index.json'), build());
  console.log('themes/index.json updated');
}
