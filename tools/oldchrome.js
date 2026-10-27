// Runs the launcher, the manager and the Inputs picker in the browser engines of older TVs: Chromium 68 (webOS 5) and Chromium 79
// (webOS 6), headless, against a stand-in for the TV's service on 127.0.0.1:8765. It fails when a page throws a script error or does
// not draw what it should (tiles, rows, inputs). A current Chrome hides such problems: these versions lack features it has.
//   node tools/oldchrome.js                 both engines
//   node tools/oldchrome.js --shots <dir>   also saves a screenshot of each page per engine
//   node tools/oldchrome.js --engine 68     one engine only (the one whose name has that text)
// The engines are Chromium snapshots from Google's storage, downloaded once (about 100 MB each), checked against pinned SHA-256 sums
// and kept in ~/.cache/cleanyourtv. Linux x64 and macOS (x64, or Apple silicon with Rosetta). Needs curl and unzip. Runs on Node 8.
'use strict';
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  http = require('http'),
  cp = require('child_process'),
  crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'cleanyourtv');
// [name, snapshot revision, sha256 of the zip per platform]
const ENGINES = [
  [
    'Chromium 68 (webOS 5)',
    '555668',
    {
      mac: '22374cff2109946143bdabd68b93730d0d09d02fc26e9dc9255008824b8ea13b',
      linux: '4cc31551f7c2d0e6fb37c4678448d2f62fbbf8bd2134f06128f54e21466d4b3c',
    },
  ],
  [
    'Chromium 79 (webOS 6)',
    '706915',
    {
      mac: 'e6b754d211e4ad264c163b5a9e2fda9b2c07ab014402e8ee29e97de620ccefe6',
      linux: '647c9f1a9be953a7bdbcb59ec52fece3ef192945a674443114572e98b56b7e59',
    },
  ],
];
const PLAT = process.platform === 'darwin' ? 'mac' : process.platform === 'linux' && process.arch === 'x64' ? 'linux' : '';
const args = process.argv.slice(2);
const shots = args.indexOf('--shots') >= 0 ? path.resolve(args[args.indexOf('--shots') + 1]) : '';
// --engine 68: only the engines whose name has that text (Chromium 79 crashes at startup on newer macOS; CI runs both)
const only = args.indexOf('--engine') >= 0 ? String(args[args.indexOf('--engine') + 1] || '') : '';

let failed = 0;
const ok = (c, name) => {
  console.log((c ? 'ok   ' : 'FAIL ') + name);
  if (!c) failed++;
};

function engine(rev, sums) {
  const dir = path.join(CACHE, 'chromium-' + PLAT + '-' + rev);
  const bin =
    PLAT === 'mac'
      ? path.join(dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      : path.join(dir, 'chrome-linux', 'chrome');
  if (fs.existsSync(bin)) return bin;
  cp.spawnSync('mkdir', ['-p', dir]);
  const zip = path.join(CACHE, 'chrome-' + PLAT + '-' + rev + '.zip');
  if (!fs.existsSync(zip)) {
    const url =
      'https://storage.googleapis.com/chromium-browser-snapshots/' +
      (PLAT === 'mac' ? 'Mac' : 'Linux_x64') +
      '/' +
      rev +
      '/chrome-' +
      PLAT +
      '.zip';
    console.log('downloading ' + url);
    const r = cp.spawnSync('curl', ['-fsSL', url, '-o', zip + '.part'], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('download failed');
    fs.renameSync(zip + '.part', zip);
  }
  const sum = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  if (sum !== sums[PLAT]) {
    fs.unlinkSync(zip);
    throw new Error('checksum mismatch for ' + zip);
  }
  if (cp.spawnSync('unzip', ['-qo', zip, '-d', dir], { stdio: 'inherit' }).status !== 0) throw new Error('unzip failed');
  if (PLAT === 'mac') cp.spawnSync('xattr', ['-dr', 'com.apple.quarantine', dir]);
  return bin;
}

// ---- the stand-in service: a few made-up apps, two inputs, the replies recorded in tools/test/golden/api.json ----
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'test', 'golden', 'api.json'), 'utf8').replace(/<version>/g, '9.9.9'));
const NAMES = ['Streaming', 'Video', 'Plex', 'Photos', 'Games', 'Browser', 'Telemachus', 'Weather', 'Sports', 'Movies', 'Kids', 'Radio'];
// two of them are apps with Continue watching cards: Plex in the dock, Telemachus in the grid
const apps = NAMES.map((n, i) => ({
  id: i === 2 ? 'cdp-30' : i === 6 ? 'com.telemachus.screen' : 'app.' + i,
  title: n,
  hue: (i * 47) % 360,
}));
const icon = a =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="hsl(' +
  a.hue +
  ',62%,46%)"/><circle cx="128" cy="116" r="54" fill="#fff"/></svg>';
const theme = require(path.join(ROOT, 'helper', 'theme.js')).create({
  config: require(path.join(ROOT, 'helper', 'config.js')).memory({}),
  noStartup: true,
});
// a page can ask for one of the repository's themes instead of the default (PAGES' seventh field)
const schema = require(path.join(ROOT, 'helper', 'themeschema.js'));
const themeOf = id =>
  schema.resolve(schema.normalize(JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', id, 'theme.json'), 'utf8')), id, null), '');
let pageTheme = null;
// in front of the page's own script: report script errors on <html data-errors>, and the TV's webOSSystem with no launch parameters
const PROBE =
  '<script>window.onerror=function(m,s,l){var h=document.documentElement;h.setAttribute("data-errors",(h.getAttribute("data-errors")||"")+m+" (line "+l+"); ")};' +
  'window.webOSSystem={launchParams:"{}",locale:"en-GB",hide:function(){},activate:function(){},platformBack:function(){},setInputRegion:function(){},setKeyMask:function(){}};</script>';
const page = (f, extra) =>
  fs
    .readFileSync(path.join(ROOT, f), 'utf8')
    .replace('<script>', PROBE + '<script>')
    .replace('</body>', (extra || '') + '</body>');
// the screensaver's remote keys, pressed once it shows its first photo: Right (a new photo), Left (back), Right (forward again, no new
// photo), Right (a new one), then Down, which ends it and goes no further (the focus on Home stays). The outcome lands in data-keys.
const SAVER_KEYS =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}' +
  'function photo(){var p=document.querySelector("#sv .svp.on");return p?(/photo\\/(p\\d+)/.exec(p.style.backgroundImage)||[])[1]||"":""}' +
  'function foc(){var f=document.querySelector(".f");return [].indexOf.call(document.querySelectorAll(".tile,.pill"),f)}' +
  'var seen=[],steps=[39,37,39,39],f0=-1,go=setInterval(function(){if(!SAVER.active()||!photo())return;clearInterval(go);f0=foc();seen.push(photo());' +
  '(function next(){if(!steps.length){key(40);var ok=seen.join()==="p1,p2,p1,p2,p3"&&!SAVER.active()&&foc()===f0;' +
  'document.body.setAttribute("data-keys",ok?"ok":"bad "+seen.join()+" active="+SAVER.active()+" focus="+foc()+"/"+f0);return}' +
  'key(steps.shift());setTimeout(function(){seen.push(photo());next()},1500)})()},500)})()</script>';
// choosing one wallpaper (wallpick.js): open the chooser, Right to the second photo, OK; that photo is then the wallpaper on Home and
// the chooser is gone. The outcome lands in data-pick.
const WALLPICK_KEYS =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}' +
  'function bg(){return [].map.call(document.querySelectorAll(".wp.on"),function(x){return x.style.getPropertyValue("--wpimg")}).join()}' +
  // the glow's final opacity, without its fade (headless Chromium 68 does not always run a fade on in virtual time)
  'function done(){var glow=[].every.call(document.querySelectorAll(".glow"),function(g){g.style.transition="none";return getComputedStyle(g).opacity==="0"});' +
  'var h=document.querySelector(".halo.on");if(h)h.style.transition="none";var halo=!!h&&getComputedStyle(h).opacity==="1";' +
  'var ok=cfg.wall&&cfg.wall.pick==="u/0000000000000002"&&!WALLPICK.open()&&bg().indexOf("u/0000000000000002")>=0&&glow&&halo;' +
  'document.body.setAttribute("data-pick",ok?"ok":"bad pick="+(cfg.wall&&cfg.wall.pick)+" open="+WALLPICK.open()+" glow-off="+glow+" halo="+halo+" bg="+bg())}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);WALLPICK.start();' +
  'var w=setInterval(function(){if(!WALLPICK.open())return;clearInterval(w);key(39);setTimeout(function(){key(13);var n=0,shown=setInterval(function(){' +
  'if(++n<40&&!(document.body.classList.contains("wpon")&&bg().indexOf("u/0000000000000002")>=0))return;clearInterval(shown);setTimeout(done,1500)},200)},800)},300)},500)})()</script>';
// LG's screensaver while another app is in front (photos everywhere): a stand-in for the TV's service bus, Home hidden behind
// com.telemachus.screen; LG asks, the launcher declines, brings Home forward, shows the photos, and a key goes back to that app.
const SAVER_OVER =
  '<script>(function(){var H=false,reg=null,calls=[],launched=[];' +
  'Object.defineProperty(document,"hidden",{configurable:true,get:function(){return H}});' +
  'window.PalmServiceBridge=function(){this.call=function(u,p){calls.push(u+" "+p);if(/registerScreenSaverRequest/.test(u))reg=this}};' +
  'var L=window.launch;window.launch=function(id,pr){launched.push(id);return L(id,pr)};' +
  'function vis(h){H=h;var e=document.createEvent("Event");e.initEvent("visibilitychange",true,true);document.dispatchEvent(e)}' +
  'function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}' +
  'var go=setInterval(function(){if(!reg||!document.querySelector(".tile"))return;clearInterval(go);vis(true);' +
  // Home comes forward only once the launcher asked which app is in front: wait for that launch, then for the photos (a slow runner)
  'reg.onservicecallback(JSON.stringify({timestamp:42}));var n=0,fw=setInterval(function(){if(++n<60&&!launched.length)return;clearInterval(fw);vis(false);' +
  'var m=0,sv=setInterval(function(){if(++m<40&&!SAVER.active())return;clearInterval(sv);var up=SAVER.active();key(40);' +
  'var declined=calls.some(function(c){return /responseScreenSaverRequest/.test(c)&&/"ack":false/.test(c)&&/"timestamp":42/.test(c)});' +
  'var ok=declined&&up&&!SAVER.active()&&launched.join()==="com.webos.app.home,com.telemachus.screen";' +
  'document.body.setAttribute("data-over",ok?"ok":"bad declined="+declined+" up="+up+" launched="+launched.join())},100)},100)},500)})()</script>';
// the remote's Home key over a menu and over the photo chooser: the TV relaunches Home with launchType homeKey (webOS 6 to 24), or
// with plain {keepAlive: true} (webOS 25, over the chooser here); both close
const HOME_KEY =
  '<script>(function(){var n=0;function home(){webOSSystem.launchParams=JSON.stringify(n++?{keepAlive:true}:{activateType:"home",keepAlive:true,launchType:"homeKey"});' +
  'var e=document.createEvent("Event");e.initEvent("webOSRelaunch",true,true);document.dispatchEvent(e)}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);customizeMenu();var menu=!!document.getElementById("ov");home();' +
  'var menuClosed=menu&&!document.getElementById("ov")&&!stack.length;WALLPICK.start();var w=setInterval(function(){if(!WALLPICK.open())return;clearInterval(w);home();' +
  'var ok=menuClosed&&!WALLPICK.open();document.body.setAttribute("data-home",ok?"ok":"bad menu="+menu+" menuClosed="+menuClosed+" chooser="+WALLPICK.open())},300)},500)})()</script>';
// Continue watching (watch.js): no cards until an app that has some is highlighted. Plex in the dock: its row opens under the dock,
// Down goes into it, OK opens Plex; Right along the dock closes it. Telemachus in the grid: its row opens under its row, OK on the card
// opens Telemachus at that episode.
const WATCH_KEYS =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}var launched=[],L=window.launch;window.launch=function(id,p){launched.push([id,p]);return L(id,p)};' +
  'function n(){return document.querySelectorAll("#grid .wcard").length}function f(){return document.querySelector(".f")}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile")||!WATCH.refresh)return;clearInterval(go);setTimeout(function(){var none=n()===0;' +
  'key(39);key(39);var onPlex=f()&&f()._a&&f()._a.id==="cdp-30";setTimeout(function(){var plexRow=n()===1;key(40);var inRow=f()&&f().classList.contains("wcard");key(13);' +
  'setTimeout(function(){key(38);key(39);setTimeout(function(){var closed=n()===0;var p=posOf(tiles["com.telemachus.screen"]);setFocus(p[0],p[1]);setTimeout(function(){' +
  'var under=posOf(document.querySelector("#grid .wcard"));var tmRow=!!under&&under[0]===p[0]+1;key(40);key(37);key(37);key(37);key(13);setTimeout(function(){' +
  'var l0=launched[0]||[],l1=launched[1]||[];var ok=none&&onPlex&&plexRow&&inRow&&l0[0]==="cdp-30"&&closed&&tmRow&&l1[0]==="com.telemachus.screen"&&l1[1]&&l1[1].play&&l1[1].play.episode===6;' +
  'document.body.setAttribute("data-watch",ok?"ok":"bad none="+none+" onPlex="+onPlex+" plexRow="+plexRow+" inRow="+inRow+" closed="+closed+" tmRow="+tmRow+" launched="+JSON.stringify(launched))},800)},1000)},800)},800)},1000)},2500)},300)})()</script>';
// holding OK: on an app tile in the dock its options (Hide app); on a card under Plex its own (Resume, Open Plex, Remove from this row,
// Hide the row of Plex); Remove takes that show off and keeps it in the settings
const HOLD_OK =
  '<script>(function(){function ev(t,c){var e=document.createEvent("Event");e.initEvent(t,true,true);Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)}' +
  'function key(c){ev("keydown",c);ev("keyup",c)}function ov(){var o=document.getElementById("ov");return o?o.textContent:""}' +
  'function hold(cb){ev("keydown",13);setTimeout(function(){ev("keyup",13);setTimeout(cb,300)},1000)}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);setTimeout(function(){' +
  'hold(function(){var app=/Hide app/.test(ov());key(461);setTimeout(function(){key(39);key(39);setTimeout(function(){key(40);var f=document.querySelector(".f");' +
  'var onCard=!!f&&f.classList.contains("wcard");hold(function(){var m=ov(),card=/Resume/.test(m)&&/Open Plex/.test(m)&&/Remove from this row/.test(m)&&/Hide the row of Plex/.test(m);key(40);key(40);key(13);setTimeout(function(){' +
  'var left=document.querySelectorAll("#grid .wcard").length,saved=cfg.watch&&cfg.watch.hide&&cfg.watch.hide.join();' +
  'var ok=app&&onCard&&card&&left===0&&saved==="plex:7";' +
  'document.body.setAttribute("data-hold",ok?"ok":"bad app="+app+" onCard="+onCard+" card="+card+" left="+left+" saved="+saved+" menu="+ov().slice(0,160))},800)})},1000)},600)})},2500)},300)})()</script>';
// linking Plex (Customise > Continue watching): Down twice to Link Plex..., OK; the menu shows the code for plex.tv/link, then, once the
// stand-in says the code was entered, the server it is linked to
const WATCH_LINK =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function ov(){var o=document.getElementById("ov");return o?o.textContent:""}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);watchMenu();setTimeout(function(){key(40);key(40);key(13);' +
  'var n=0,code=false,w=setInterval(function(){if(/plex\\.tv\\/link and enter AB12/.test(ov()))code=true;if(++n<60&&!/Linked to Home server/.test(ov()))return;clearInterval(w);' +
  'var ok=code&&/Linked to Home server/.test(ov());document.body.setAttribute("data-link",ok?"ok":"bad code="+code+" menu="+ov().slice(0,200))},250)},800)},300)})()</script>';
// LG's row of another app (lgrows.js): highlighting the second dock app opens its row; OK opens the video the way LG's Home does
const LG_ROW =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}var launched=[],L=window.launch;window.launch=function(id,p){launched.push([id,p]);return L(id,p)};' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);setTimeout(function(){key(39);setTimeout(function(){' +
  'var cards=document.querySelectorAll("#grid .wcard"),badge=cards[0]&&cards[0].querySelector(".wsrc").textContent;key(40);key(13);setTimeout(function(){var l=launched[0]||[];' +
  'var ok=cards.length===1&&badge===""&&l[0]==="app.1"&&l[1]&&l[1].contentTarget==="v=1";' +
  'document.body.setAttribute("data-lg",ok?"ok":"bad cards="+cards.length+" badge="+badge+" launched="+JSON.stringify(launched))},800)},1000)},2500)},300)})()</script>';
// a theme that keeps the grid under the dock (Glass, grid.mode push): highlighting Plex in the dock opens its row, and the view goes up
// so that row is on the screen; moving on to an app without cards closes it and the view comes back down (the slide itself is
// switched off: headless Chromium does not run it in page time)
const DOCK_ROW =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function sc(){return document.getElementById("scroll").style.transform}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile")||!TH.push)return;clearInterval(go);document.getElementById("scroll").style.transition="none";setTimeout(function(){key(39);key(39);setTimeout(function(){' +
  'var c=document.querySelector("#grid .wcard"),b=c&&c.getBoundingClientRect(),seen=!!b&&b.top>=0&&b.bottom<=window.innerHeight,up=sc();key(39);setTimeout(function(){' +
  'var gone=!document.querySelector("#grid .wcard"),down=sc();var ok=seen&&!!up&&gone&&!down;' +
  'document.body.setAttribute("data-dock",ok?"ok":"bad seen="+seen+" top="+(b&&Math.round(b.top))+" up="+up+" gone="+gone+" down="+down)},1200)},1200)},2500)},300)})()</script>';
// a portrait wallpaper (the third stand-in photo) is shown whole (contain) over a blurred copy; a landscape one fills the screen
const WALL_FIT =
  '<script>(function(){function on(){return document.querySelector(".wp.on")}function after(x){return getComputedStyle(x,"::after").backgroundSize}' +
  'function pick(id,cb){cfg.wall={on:true,secs:0,pick:id};WALL.sync();var n=0,w=setInterval(function(){var x=on();' +
  'if(++n<50&&!(x&&x.style.getPropertyValue("--wpimg").indexOf(id)>=0))return;clearInterval(w);cb(x)},200)}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);pick("u/0000000000000003",function(p){' +
  'var portrait=!!p&&p.classList.contains("fit")&&after(p)==="contain";pick("u/0000000000000002",function(l){' +
  'var landscape=!!l&&!l.classList.contains("fit")&&after(l)==="cover";' +
  'document.body.setAttribute("data-fit",portrait&&landscape?"ok":"bad portrait="+portrait+" landscape="+landscape)})})},500)})()</script>';
// [name, file, what it draws, how many at least, milliseconds of page time to wait, a script to run in it, a theme id]
const PAGES = [
  ['launcher', 'app/index.html', /class="tile[ "]/g, 8, 8000],
  ['manager', 'manager/app/index.html', /class="row[ "]/g, 5, 8000],
  ['picker', 'picker/app/index.html', /class="chip[ "]/g, 2, 3000],
  // the launcher left alone for its screensaver's minute (virtual time): the screensaver is up with a photo from the feed drawn
  ['saver', 'app/index.html', /class="svp on"/g, 1, 75000],
  // and its keys: Left and Right step through the photos, another key ends it without acting on Home
  ['saver keys', 'app/index.html', /data-keys="ok"/g, 1, 90000, SAVER_KEYS],
  ['wallpaper chooser', 'app/index.html', /data-pick="ok"/g, 1, 20000, WALLPICK_KEYS],
  ['saver over an app', 'app/index.html', /data-over="ok"/g, 1, 30000, SAVER_OVER],
  ['home key', 'app/index.html', /data-home="ok"/g, 1, 15000, HOME_KEY],
  ['continue watching', 'app/index.html', /data-watch="ok"/g, 1, 15000, WATCH_KEYS],
  ['linking plex', 'app/index.html', /data-link="ok"/g, 1, 20000, WATCH_LINK],
  ['hold ok', 'app/index.html', /data-hold="ok"/g, 1, 20000, HOLD_OK],
  ['lg row', 'app/index.html', /data-lg="ok"/g, 1, 15000, LG_ROW],
  ['wallpaper fit', 'app/index.html', /data-fit="ok"/g, 1, 15000, WALL_FIT],
  ['dock row in glass', 'app/index.html', /data-dock="ok"/g, 1, 15000, DOCK_ROW, 'glass'],
];
let famN = 0,
  plexState = 'idle',
  plexAsks = 0;
// a stand-in photo from the feed: a landscape picture with the photo's name on it
const photo = u =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#3a6e8f"/>' +
  '<circle cx="1200" cy="300" r="140" fill="#f4d35e"/><path d="M0 1000 L500 520 L900 820 L1250 600 L1600 1000Z" fill="#2d4a3e"/>' +
  '<text x="80" y="140" font-size="90" fill="#fff" font-family="sans-serif">' +
  u.split('/').pop() +
  '</text></svg>';
// a portrait one (for the wallpaper's whole-photo view)
const portrait = u =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1600"><rect width="1000" height="1600" fill="#8f5a3a"/>' +
  '<circle cx="500" cy="420" r="200" fill="#f4d35e"/><text x="60" y="1500" font-size="80" fill="#fff" font-family="sans-serif">' +
  u.split('/').pop() +
  '</text></svg>';
const TOKEN = 'harness-token-0123456789abcdef',
  noToken = []; // API calls a page made without the token
const marks = []; // what the pages log (perf lines: tools/perf-tv.sh reads the same on a TV)
function serve() {
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0];
    r.setHeader('Access-Control-Allow-Origin', '*');
    r.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (q.method === 'OPTIONS') return r.writeHead(204), r.end();
    const json = o => (r.writeHead(200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    const p = PAGES.filter(x => '/' + x[0].replace(/ /g, '-') + '.html' === u)[0];
    // the API token (apitoken.js): served next to the pages as on the TV, and every API call of a page must carry it
    if (u === '/cytv-token.js')
      return r.writeHead(200, { 'content-type': 'text/javascript' }), r.end("var CYTV_TOKEN = '" + TOKEN + "';\n");
    if (
      /^\/api\/(apps|inputs|manager\/status|photofeed\/next|watch\/(rows|accounts|link)|log)$/.test(u) &&
      q.headers['x-cytv-token'] !== TOKEN
    ) {
      noToken.push(u);
      return r.writeHead(403, { 'content-type': 'application/json' }), r.end('{"error":"token required"}');
    }
    if (p)
      return (
        (famN = 0),
        (plexState = 'idle'),
        (pageTheme = p[6] ? themeOf(p[6]) : null),
        r.writeHead(200, { 'content-type': 'text/html' }),
        r.end(page(p[1], p[5]))
      ); // each page starts at p1
    if (u === '/qrcode.js')
      return (
        r.writeHead(200, { 'content-type': 'text/javascript' }),
        r.end(fs.readFileSync(path.join(ROOT, 'third-party', 'qrcode-generator', 'qrcode.js')))
      );
    if (u.indexOf('/api/theme/') === 0) return theme.handle(q, r, u, async () => ({}));
    if (u === '/api/apps')
      return json({
        apps: apps.map(a => ({ id: a.id, title: a.title })),
        config: {
          dock: apps.slice(0, 4).map(a => a.id),
          theme: pageTheme || theme.resolved(),
          saver: { on: true, after: 60, secs: 15, clock: true },
          photoFeed: { photos: 2 },
        },
        usage: {},
        version: '9.9.9',
      });
    if (u === '/api/inputs')
      return json({
        devices: [
          { id: 'HDMI_1', appId: 'com.webos.app.hdmi1', label: 'Game console', connected: true },
          { id: 'HDMI_2', appId: 'com.webos.app.hdmi2', label: 'HDMI 2', connected: false },
        ],
      });
    if (u === '/api/manager/status') return json(golden['manager status'].body);
    if (u === '/api/watch/rows')
      return json({
        items: [
          {
            key: 'tm-a',
            group: 'tm:Show A',
            source: 'telemachus',
            title: 'Show A',
            sub: 'S2 E6',
            img: '/api/watch/img/aaaaaaaaaaaaaaaa',
            progress: 0.3,
            launch: { id: 'com.telemachus.screen', params: { play: { show: 'Show A', season: 2, episode: 6 } } },
          },
          {
            key: 'lg-app.1-x',
            group: 'lg:app.1:x',
            app: 'app.1',
            source: 'lg',
            title: 'A video',
            sub: '',
            img: '/api/watch/img/cccccccccccccccc',
            progress: null,
            launch: { id: 'app.1', params: { contentTarget: 'v=1' } },
          },
          {
            key: 'plex-7',
            group: 'plex:7',
            source: 'plex',
            title: 'Film B',
            sub: '2001',
            img: '/api/watch/img/bbbbbbbbbbbbbbbb',
            progress: 0.5,
            launch: { id: 'cdp-30', params: {} },
          },
        ],
      });
    // Plex's TV sign-in: a code, entered (says the stand-in) by the second time the menu asks
    if (u === '/api/watch/link') return (plexState = 'waiting'), (plexAsks = 0), json({ code: 'AB12', url: 'plex.tv/link' });
    if (u === '/api/watch/accounts') {
      if (plexState === 'waiting' && ++plexAsks >= 2) plexState = 'linked';
      return json({
        plex: Object.assign(
          { linked: plexState === 'linked', server: plexState === 'linked' ? 'Home server' : '', state: plexState },
          plexState === 'waiting' ? { code: 'AB12', url: 'plex.tv/link' } : {}
        ),
        stremio: { linked: false, state: 'idle' },
      });
    }
    if (/^\/api\/watch\/img\/[0-9a-f]{16}$/.test(u)) return r.writeHead(200, { 'content-type': 'image/svg+xml' }), r.end(photo(u));
    if (u === '/api/foreground') return json({ returnValue: true, appId: 'com.telemachus.screen' }); // another app in front
    // three Wallpapers photos for the chooser (wallpick.js)
    if (u === '/api/wallpapers/list')
      return json({ photos: ['u/0000000000000001', 'u/0000000000000002', 'u/0000000000000003'], stamp: '3:test' });
    if (/^\/api\/wallpapers\/photo\/u\/\d{15}3$/.test(u)) return r.writeHead(200, { 'content-type': 'image/svg+xml' }), r.end(portrait(u));
    if (/^\/api\/wallpapers\/photo\/u\/\d{16}$/.test(u)) return r.writeHead(200, { 'content-type': 'image/svg+xml' }), r.end(photo(u));
    if (u === '/api/photofeed/next') return json({ id: 'p' + ++famN });
    if (/^\/api\/photofeed\/photo\/p\d+$/.test(u)) return r.writeHead(200, { 'content-type': 'image/svg+xml' }), r.end(photo(u));
    if (u === '/api/log') {
      marks.push(decodeURIComponent(q.url.split('m=')[1] || ''));
      return json({});
    }
    const ia = apps.filter(a => '/icon/' + a.id === u)[0];
    if (ia) return r.writeHead(200, { 'content-type': 'image/svg+xml' }), r.end(icon(ia));
    json({ returnValue: true });
  });
  return new Promise((res, rej) => {
    srv.on('error', rej);
    srv.listen(8765, '127.0.0.1', () => res(srv));
  });
}

// asynchronous on purpose: the stand-in service runs in this process and must keep answering while the browser loads the page
function run(bin, url, extra, budget) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytv-chromium-'));
  const argv = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--user-data-dir=' + dir,
    '--window-size=1920,1080',
    '--virtual-time-budget=' + (budget || 8000),
  ];
  return new Promise(resolve => {
    cp.execFile(bin, argv.concat(extra, [url]), { encoding: 'utf8', timeout: 45000, maxBuffer: 32 << 20 }, (e, stdout, stderr) => {
      cp.spawnSync('rm', ['-rf', dir]);
      resolve({ status: e ? e.code || 1 : 0, error: e && e.killed ? 'timed out' : '', stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

(async () => {
  if (!PLAT) {
    console.log('skipped: old Chromium builds are fetched for Linux x64 and macOS only');
    return;
  }
  const srv = await serve().catch(e => {
    console.error('port 8765 is in use: ' + e.message);
    process.exit(2);
  });
  if (shots) cp.spawnSync('mkdir', ['-p', shots]);
  try {
    for (const e of ENGINES.filter(x => !only || x[0].indexOf(only) >= 0)) {
      const bin = engine(e[1], e[2]);
      for (const p of PAGES) {
        const url = 'http://127.0.0.1:8765/' + p[0].replace(/ /g, '-') + '.html';
        // headless Chromium on Linux now and then fails to hand over the page ("Failed to serialize document"), hangs or hands it over
        // before the page drew its content: try again
        let r = null;
        for (let tries = 0; tries < 5; tries++) {
          r = await run(bin, url, ['--dump-dom'], p[4]);
          if (r.status === 0 && (r.stdout || '').indexOf('<body') >= 0 && ((r.stdout || '').match(p[2]) || []).length >= p[3]) break;
        }
        const dom = r.stdout || '';
        const errs = (/data-errors="([^"]*)"/.exec(dom) || [])[1] || '';
        const n = (dom.match(p[2]) || []).length;
        ok(
          r.status === 0 && dom.indexOf('<body') >= 0,
          e[0] + ': ' + p[0] + ' loads' + (r.status ? ' (' + (r.error || r.stderr.slice(-300)) + ')' : '')
        );
        ok(!errs, e[0] + ': ' + p[0] + ' runs without script errors' + (errs ? ': ' + errs : ''));
        ok(
          n >= p[3],
          e[0] +
            ': ' +
            p[0] +
            ' draws its content (' +
            n +
            ' found, ' +
            p[3] +
            ' expected)' +
            (n >= p[3]
              ? ''
              : '\n  check: ' +
                ((/data-[a-z]+="(bad[^"]*)"/.exec(dom) || [])[1] || '(no outcome)') +
                '\n  page: ' +
                dom.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').slice(0, 600) +
                '\n  browser: ' +
                (r.stderr || '').slice(-600))
        );
        ok(
          !noToken.length,
          e[0] + ': ' + p[0] + ' sends the API token with every call' + (noToken.length ? ': ' + noToken.join(', ') : '')
        );
        noToken.length = 0;
        const ready = marks.filter(m => /^perf launcher ready /.test(m)).pop();
        if (p[0] === 'launcher' && ready)
          console.log('     ' + e[0] + ': launcher ready ' + ready.split(' ').pop() + ' ms after the page load (this computer, not a TV)');
        marks.length = 0;
        if (shots) await run(bin, url, ['--screenshot=' + path.join(shots, e[1] + '-' + p[0] + '.png')], p[4]);
      }
    }
  } catch (err) {
    ok(false, String(err.message || err));
  }
  srv.close();
  console.log(
    failed ? failed + ' check(s) failed in old Chromium' : only ? 'the pages work in ' + only : 'the pages work in Chromium 68 and 79'
  );
  process.exit(failed ? 1 : 0);
})();
