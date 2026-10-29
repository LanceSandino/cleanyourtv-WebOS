// Runs the launcher, the manager and the Inputs picker in the browser engine of the oldest TV this fork supports: Chromium 120
// (webOS 25; DECISIONS.md D-20261029-3), headless, against a stand-in for the TV's service on 127.0.0.1:8765. It fails when a page
// throws a script error or does not draw what it should (tiles, rows, inputs). A current Chrome hides such problems: Chromium 120
// lacks features it has.
//   node tools/oldchrome.js                 every engine in ENGINES
//   node tools/oldchrome.js --shots <dir>   also saves a screenshot of each page per engine
//   node tools/oldchrome.js --engine 120    one engine only (the one whose name has that text)
//   node tools/oldchrome.js --page strip    only the pages whose name has that text
// The engine is Chrome for Testing's headless shell (the headless Chromium of that version, without the browser around it) from
// Google's storage, downloaded once (about 90 MB), checked against pinned SHA-256 sums and kept in ~/.cache/cleanyourtv. Linux x64 and
// macOS (x64 and Apple silicon). Needs curl and unzip.
'use strict';
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  http = require('http'),
  cp = require('child_process'),
  crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'cleanyourtv');
// [name, Chrome for Testing version, sha256 of chrome-headless-shell-<platform>.zip per platform]
const ENGINES = [
  [
    'Chromium 120 (webOS 25)',
    '120.0.6099.109',
    {
      'mac-x64': '0fdba0a29032265e38ca080e05908b43a8d630112e686b7844ee47e0ba6a553a',
      'mac-arm64': 'a9a0c985fd0bf2676b2cd956b2c51f37cb6b9c13edde8e732f346fb17c1a59c9',
      linux64: '8c42700890dbb798df2cadcbe4b055f3f08568048ab07d5425f0c4aee963e5cc',
    },
  ],
];
const PLAT =
  process.platform === 'darwin'
    ? process.arch === 'arm64'
      ? 'mac-arm64'
      : 'mac-x64'
    : process.platform === 'linux' && process.arch === 'x64'
      ? 'linux64'
      : '';
const args = process.argv.slice(2);
const shots = args.indexOf('--shots') >= 0 ? path.resolve(args[args.indexOf('--shots') + 1]) : '';
// --engine 120: only the engines whose name has that text
const only = args.indexOf('--engine') >= 0 ? String(args[args.indexOf('--engine') + 1] || '') : '';
// --page strip: only the pages whose name has that text (to look at one check again; check.sh and CI run them all)
const pageOnly = args.indexOf('--page') >= 0 ? String(args[args.indexOf('--page') + 1] || '') : '';

let failed = 0;
const ok = (c, name) => {
  console.log((c ? 'ok   ' : 'FAIL ') + name);
  if (!c) failed++;
};

function engine(version, sums) {
  const dir = path.join(CACHE, 'chrome-headless-shell-' + version + '-' + PLAT);
  const bin = path.join(dir, 'chrome-headless-shell-' + PLAT, 'chrome-headless-shell');
  if (fs.existsSync(bin)) return bin;
  cp.spawnSync('mkdir', ['-p', dir]);
  const zip = dir + '.zip';
  if (!fs.existsSync(zip)) {
    const url =
      'https://storage.googleapis.com/chrome-for-testing-public/' + version + '/' + PLAT + '/chrome-headless-shell-' + PLAT + '.zip';
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
  if (/^mac/.test(PLAT)) cp.spawnSync('xattr', ['-dr', 'com.apple.quarantine', dir]);
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
  schema.resolve(
    schema.normalize(
      JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', id, 'theme.json'), 'utf8')),
      id,
      null,
      path.join(ROOT, 'themes', id)
    ),
    ''
  );
let pageTheme = null;
// in front of the page's own script: report script errors on <html data-errors>, and the TV's webOSSystem with no launch parameters.
// The page also sends its own copy of itself to the stand-in (/__dom): once its check has an outcome (data-...="ok" or "bad..."), and
// for the pages that only draw, three seconds after the load and then every ten. Headless Chromium (68 and 79 often) now and then cannot hand the page over at
// the end ("Failed to serialize document: Uncaught"), and then this copy is used (or the reason the page could not copy itself is
// shown). One copy at a time: a copy sent every second kept requests open when the browser handed the page over, which made it fail
// more often.
const PROBE =
  '<script>window.onerror=function(m,s,l){var h=document.documentElement;h.setAttribute("data-errors",(h.getAttribute("data-errors")||"")+m+" (line "+l+"); ")};' +
  'window.webOSSystem={launchParams:"{}",locale:"en-GB",hide:function(){},activate:function(){},platformBack:function(){},setInputRegion:function(){},setKeyMask:function(){}};' +
  '(function(){var sent=0;function copy(){var h;try{h="<!DOCTYPE html>\\n"+document.documentElement.outerHTML}catch(e){h="__error__ "+e}' +
  'try{var x=new XMLHttpRequest();x.open("POST","/__dom",true);x.send(h)}catch(e){}}' +
  'function done(){var a=document.body&&document.body.attributes;for(var i=0;a&&i<a.length;i++)if(/^data-/.test(a[i].name)&&/^(ok|bad)/.test(a[i].value))return true;return false}' +
  'document.addEventListener("DOMContentLoaded",function(){new MutationObserver(function(){if(!sent&&done()){sent=1;copy()}}).observe(document.body,{attributes:true})});' +
  'window.addEventListener("load",function(){setTimeout(function(){if(!sent)copy()},3000);setInterval(function(){if(!sent)copy()},10000)})})();</script>';
const page = (f, extra) =>
  fs
    .readFileSync(path.join(ROOT, f), 'utf8')
    .replace('<script>', PROBE + '<script>')
    .replace('</body>', (extra || '') + '</body>');
// the screensaver's remote keys, pressed once it shows its first photo: Right (a new photo), Left (back), Right (forward again, no new
// photo), Right (a new one), then Down, which ends it and goes no further (the focus on Home stays). After each key it waits for the
// photo to change (up to 6 s: the frame loads a photo before it hangs it, slow on a busy machine). The outcome lands in data-keys.
const SAVER_KEYS =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}' +
  'function photo(){var p=document.querySelector("#sv .svp.on");p=p&&(p.querySelector(".svf")||p);return p?(/photo\\/(p\\d+)/.exec(p.style.backgroundImage)||[])[1]||"":""}' +
  'function foc(){var f=document.querySelector(".f");return [].indexOf.call(document.querySelectorAll(".tile,.pill"),f)}' +
  'var seen=[],steps=[39,37,39,39],f0=-1,go=setInterval(function(){if(!SAVER.active()||!photo())return;clearInterval(go);f0=foc();seen.push(photo());' +
  '(function next(){if(!steps.length){key(40);var ok=seen.join()==="p1,p2,p1,p2,p3"&&!SAVER.active()&&foc()===f0;' +
  'document.body.setAttribute("data-keys",ok?"ok":"bad "+seen.join()+" active="+SAVER.active()+" focus="+foc()+"/"+f0);return}' +
  'var was=photo(),t0=Date.now();key(steps.shift());(function wait(){var p=photo();if((p===was||!p)&&Date.now()-t0<6000)return setTimeout(wait,200);seen.push(p);next()})()})()},500)})()</script>';
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
// LG's screensaver while an HDMI input is in front (a console): left to LG (ack true), Home is not brought forward, no photos
const SAVER_HDMI =
  '<script>(function(){var H=false,reg=null,calls=[],launched=[];' +
  'Object.defineProperty(document,"hidden",{configurable:true,get:function(){return H}});' +
  'window.PalmServiceBridge=function(){this.call=function(u,p){calls.push(u+" "+p);if(/registerScreenSaverRequest/.test(u))reg=this}};' +
  'var L=window.launch;window.launch=function(id,pr){launched.push(id);return L(id,pr)};' +
  'var A=window.api;window.api=function(p,b){return p==="/api/foreground"?Promise.resolve({returnValue:true,appId:"com.webos.app.hdmi4"}):A(p,b)};' +
  'var go=setInterval(function(){if(!reg||!document.querySelector(".tile"))return;clearInterval(go);H=true;' +
  'reg.onservicecallback(JSON.stringify({timestamp:43}));setTimeout(function(){' +
  'var allowed=calls.some(function(c){return /responseScreenSaverRequest/.test(c)&&/"ack":true/.test(c)&&/"timestamp":43/.test(c)});' +
  'var ok=allowed&&!launched.length&&!SAVER.active();' +
  'document.body.setAttribute("data-hdmi",ok?"ok":"bad allowed="+allowed+" launched="+launched.join()+" active="+SAVER.active())},1500)},500)})()</script>';
// the frame (Style: Frame, the default): an oak frame of the bevelled profile, four mitred sides 70 px wide around the mat; two
// portrait photos hang side by side in their windows, with the caption and the day pencilled under them; the board (WebP) decodes
const SAVER_FRAME =
  '<script>(function(){var A=window.api,n=0;window.api=function(p,b){return p==="/api/photofeed/next"?Promise.resolve({id:"q"+(++n),date:"2026-10-25",caption:"Pumpkin patch",color:"#c08a5a"}):A(p,b)};' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);cfg.saver={on:true,frame:"oak",profile:"bevel",layout:"two"};SAVER.start(true);var k=0,w=setInterval(function(){' +
  'var p=document.querySelector("#sv .svp.on");if(++k<60&&!(p&&p.querySelectorAll(".svw").length))return;clearInterval(w);' +
  'var pair=!!p&&p.querySelectorAll(".svw").length===2,lab=p&&p.querySelector(".svs"),txt=lab?lab.textContent:"",sides=document.querySelectorAll("#svfr .svside");' +
  'var label=/Pumpkin patch/.test(txt)&&/2026/.test(txt),sv=document.getElementById("sv"),framed=sv.classList.contains("framed")&&/\\bfr\\b/.test(p.className);' +
  'var frame=sides.length===4&&/saver-wood-oak\\.webp/.test(sides[0].style.backgroundImage)&&sides[1].offsetHeight===70&&getComputedStyle(p).left==="70px";' +
  'var im=new Image();im.onload=im.onerror=function(){var wood=im.naturalWidth===2048;' +
  'document.body.setAttribute("data-frame",pair&&label&&framed&&frame&&wood?"ok":"bad pair="+pair+" label="+txt+" framed="+framed+" frame="+frame+" wood="+wood+" sides="+sides.length+" left="+getComputedStyle(p).left+" class="+(p&&p.className))};im.src="saver-wood-oak.webp"},300)},500)})()</script>';
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
// linking Plex (Customize > Continue watching): Down four times to Link Plex... (past the row of the app LG has a row for), OK; the menu
// shows the code for plex.tv/link, then, once the stand-in says the code was entered, the server it is linked to
const WATCH_LINK =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function ov(){var o=document.getElementById("ov");return o?o.textContent:""}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile")||!WATCH.lgApps().length)return;clearInterval(go);watchMenu();setTimeout(function(){key(40);key(40);key(40);key(40);key(13);' +
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
// one app's row from LG switched off (Customize > Continue watching, the row under "Rows from LG for other apps"): it says Off, the
// setting is kept as that app's whole row, and highlighting the app on Home opens no row; OK again switches it back on
const LG_APP_OFF =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function ov(){var o=document.getElementById("ov");return o?o.textContent:""}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile")||!WATCH.lgApps().length)return;clearInterval(go);watchMenu();setTimeout(function(){' +
  'key(40);key(40);key(40);var row=stack[stack.length-1].items[stack[stack.length-1].idx];key(13);setTimeout(function(){' +
  'var off=WATCH.appOn("app.1")===false&&cfg.watch.hide.join()==="app:app.1"&&/Off/.test(ov());closeMenus();setTimeout(function(){key(39);setTimeout(function(){' +
  'var cards=document.querySelectorAll("#grid .wcard").length;watchMenu();setTimeout(function(){key(40);key(40);key(40);key(13);setTimeout(function(){var back=WATCH.appOn("app.1");' +
  'var ok=!!row&&row.label==="Video"&&off&&cards===0&&back;' +
  'document.body.setAttribute("data-lgoff",ok?"ok":"bad row="+(row&&row.label)+" off="+off+" cards="+cards+" back="+back+" menu="+ov().slice(0,200))},400)},600)},1500)},300)},400)},800)},300)})()</script>';
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
// a holiday theme's frame (Halloween): one still picture behind the clock and the apps, not catching the pointer; nothing animates
// the menus (menus.js), all opened the same way: Customize is its own list on the left with the focused section's rows peeking on the
// right; a section opened from it (Dock) keeps Customize's list on the left with that section lit, its rows on the right and a hint;
// the Screensaver shows a large example of its frame on the left (SAVER.sample: the four mitred sides); its Frame list ticks the
// chosen frame, the example shows it and follows the focus (Down: the next wood); Left goes back to Customize. The outcome lands in
// data-two.
const MENU_TWO =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function ov(){return document.getElementById("ov")}' +
  'function pick(l){var m=stack[stack.length-1];for(var i=0;i<m.items.length;i++)if(m.items[i].label===l){m.idx=i;pickMenu();return}}' +
  'function sd(){var x=ov().querySelector("#svdemo .svside");return x?x.style.backgroundImage:""}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);cfg.saver={on:true,frame:"oak"};customizeMenu();' +
  'var root=/\\broot\\b/.test(ov().className)&&!!ov().querySelector(".secs.list")&&!!ov().querySelector(".panel");pick("Dock");' +
  'var lit=ov().querySelector(".secs .sec.on"),nest=/\\bnest\\b/.test(ov().className)&&!!lit&&/Dock/.test(lit.textContent)&&!!ov().querySelector(".hint");key(37);' +
  'pick("Screensaver");var demo=ov().querySelector(".pvbox #svdemo"),pic=/\\bpic\\b/.test(ov().className)&&!!demo&&demo.querySelectorAll(".svside").length===4;' +
  'pick("Frame");var ticked=[].filter.call(ov().querySelectorAll(".panel .row"),function(r){return !!r.querySelector(".ck")}).map(function(r){return r.textContent});' +
  'var tick=ticked.length===1&&/Oak/.test(ticked[0]),oak=/wood-oak/.test(sd());key(40);var teak=/wood-teak/.test(sd());' +
  'key(37);key(37);var back=stack.length===1&&/\\broot\\b/.test(ov().className);' +
  'document.body.setAttribute("data-two",root&&nest&&pic&&tick&&oak&&teak&&back?"ok":"bad root="+root+" nest="+nest+" pic="+pic+" tick="+ticked.join("|")+" oak="+oak+" teak="+teak+" back="+back)},300)})()</script>';
// the Screensaver's Frame list left open (its screenshot shows the menu): the example of the frame fills the menu's picture, scaled
// from the 1920 x 1080 screen, and the mat holds two example pictures. The outcome lands in data-pv.
const SAVER_MENU =
  '<script>(function(){function ov(){return document.getElementById("ov")}' +
  'function pick(l){var m=stack[stack.length-1];for(var i=0;i<m.items.length;i++)if(m.items[i].label===l){m.idx=i;pickMenu();return}}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);cfg.saver={on:true,frame:"walnut",profile:"classic"};customizeMenu();' +
  'pick("Screensaver");pick("Frame");setTimeout(function(){var bx=ov().querySelector(".pvbox"),d=bx&&bx.querySelector("#svdemo"),br=bx&&bx.getBoundingClientRect(),dr=d&&d.getBoundingClientRect();' +
  'var fit=!!dr&&Math.abs(dr.width-br.width)<=2&&Math.abs(dr.height-br.height)<=3,two=!!d&&d.querySelectorAll(".svw").length===2;' +
  'document.body.setAttribute("data-pv",fit&&two?"ok":"bad fit="+fit+" two="+two+" box="+(br&&br.width+"x"+br.height)+" demo="+(dr&&dr.width+"x"+dr.height))},1500)},300)})()</script>';
// Dawn with your own photos as the wallpaper (body.wpon): the scenery's cut-out goes and the clock that stood behind it is back at a
// usual place and size, top left, out of the way of the photo. The outcome lands in data-wpclock.
const WP_CLOCK =
  '<script>(function(){var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);setTimeout(function(){' +
  'var tm=document.getElementById("time"),big=tm.getBoundingClientRect().height;document.body.classList.add("wpon");setTimeout(function(){' +
  'var r=tm.getBoundingClientRect(),fg=document.getElementById("thfg"),gone=!fg||getComputedStyle(fg).display==="none";' +
  'var ok=gone&&r.left>=80&&r.left<=130&&r.top<=160&&r.height<big/2;' +
  'document.body.setAttribute("data-wpclock",ok?"ok":"bad gone="+gone+" left="+r.left+" top="+r.top+" h="+r.height+" was="+big)},300)},800)},300)})()</script>';
// a weather card in Glass's short place over the clock (30 px): one line inside the place (slim), its icon as tall as the place,
// the place and the sky beside the temperature, and all of it above the time. The outcome lands in data-slim.
const SLIM_WX =
  '<script>(function(){var A=window.api;window.api=function(p,b){return p==="/api/cards/weather"?Promise.resolve({now:{temp:18,code:0,day:true},days:[],at:Date.now()}):A(p,b)};' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);cfg.cards={greeting:{type:"weather",place:"Lake",lat:40.1,lon:-75.2}};drawCards();' +
  'setTimeout(function(){tickCards();setTimeout(function(){var c=document.querySelector("#cards .card-weather"),svg=c&&c.querySelector(".wx-i svg"),p=c&&c.querySelector(".wx-p"),' +
  'tm=document.getElementById("time").getBoundingClientRect(),cr=c&&c.getBoundingClientRect(),sr=svg&&svg.getBoundingClientRect();' +
  'var slim=!!c&&/\\bslim\\b/.test(c.className)&&cr.height<=31&&!!sr&&sr.height<=31&&sr.bottom<=cr.bottom+1&&c.scrollHeight<=32;' +
  'var line=!!p&&/Lake/.test(p.textContent)&&p.getBoundingClientRect().top<cr.bottom,above=!!cr&&cr.bottom<=tm.top+2;' +
  'document.body.setAttribute("data-slim",slim&&line&&above?"ok":"bad slim="+slim+" line="+line+" above="+above+" card="+(cr&&cr.top+"-"+cr.bottom)+" time="+tm.top)},600)},400)},300)})()</script>';
// the manager's Check for updates: its "Checking…" banner goes when the answer is in (it stayed before), and the release's day
// shows beside the version. The outcome lands in data-check.
const MANAGER_CHECK =
  '<script>(function(){var go=setInterval(function(){if(typeof rows==="undefined"||!rows.length)return;clearInterval(go);setTimeout(function(){' +
  'for(var i=0;i<rows.length;i++)if(rows[i].label==="Check for updates"){idx=i;act();break}var was=$("banner").textContent;' +
  'setTimeout(function(){var b=$("banner"),gone=b.style.display==="none",day=/2026/.test(document.body.textContent);' +
  'document.body.setAttribute("data-check",gone&&/Checking/.test(was)&&day?"ok":"bad was="+was+" banner="+b.textContent+" day="+day)},1500)},800)},300)})()</script>';
// the manager left in the background: it closes itself after two minutes (it held memory and polled); not before (checked at 100 s
// and 130 s of the page's timers: Date.now does not follow the virtual time). The outcome lands in data-left.
const MANAGER_LEFT =
  '<script>(function(){var closed=0;window.close=function(){closed=Date.now()};var go=setInterval(function(){if(typeof rows==="undefined"||!rows.length)return;clearInterval(go);' +
  'Object.defineProperty(document,"hidden",{get:function(){return true}});var t0=Date.now(),e=document.createEvent("Event");e.initEvent("visibilitychange",true,true);document.dispatchEvent(e);' +
  'setTimeout(function(){var early=closed;setTimeout(function(){var ok=!early&&!!closed;' +
  'document.body.setAttribute("data-left",ok?"ok":"bad early="+early+" closed="+closed)},30000)},100000)},300)})()</script>';
// the Magic Remote's wheel (after upstream PR 68): one notch down moves an open menu one row and, with the menus closed, the focus on
// Home one tile along (lastWheel reset between the two: Date.now does not follow the virtual time here). The outcome lands in data-wheel.
const WHEEL =
  '<script>(function(){function wheel(d){document.dispatchEvent(new WheelEvent("wheel",{deltaY:d,bubbles:true,cancelable:true}))}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);setTimeout(function(){customizeMenu();var i0=stack[0].idx;' +
  'wheel(100);var menuMoved=stack[0].idx>i0;closeMenus();setTimeout(function(){var f0=[r,c].join();lastWheel=0;wheel(100);var homeMoved=[r,c].join()!==f0;' +
  'document.body.setAttribute("data-wheel",menuMoved&&homeMoved?"ok":"bad menu="+menuMoved+" home="+homeMoved)},300)},800)},300)})()</script>';
// Dawn (a dock along the bottom, the apps over the screen): Plex's Continue watching cards stand in a strip just above the dock, as wide
// pictures, not in the grid, which stays shut; Up from Plex goes into them, Down back to Plex, Down again into the apps. The outcome
// lands in data-strip.
const STRIP =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function f(){return document.querySelector(".f")}' +
  'var go=setInterval(function(){if(!document.querySelector(".tile")||!WATCH.refresh)return;clearInterval(go);setTimeout(function(){key(39);key(39);setTimeout(function(){' +
  'var st=document.getElementById("wstrip"),cards=st?st.querySelectorAll(".wcard").length:0,inGrid=document.querySelectorAll("#grid .wcard").length,' +
  'dock=document.getElementById("dock").getBoundingClientRect(),sr=st&&st.getBoundingClientRect(),above=!!sr&&sr.bottom<=dock.top+2,' +
  'wide=!!st&&st.querySelector(".wcard").getBoundingClientRect().width>=250,shut=!document.body.classList.contains("grid-open");' +
  'key(38);var up=!!f()&&f().classList.contains("wcard")&&!document.body.classList.contains("grid-open");key(40);var back=!!f()&&!!f()._a&&f()._a.id==="cdp-30";' +
  'key(40);var apps=document.body.classList.contains("grid-open")&&!!f()&&!f().classList.contains("wcard");' +
  'var ok=cards>=1&&!inGrid&&above&&wide&&shut&&up&&back&&apps;' +
  'document.body.setAttribute("data-strip",ok?"ok":"bad cards="+cards+" inGrid="+inGrid+" above="+above+" wide="+wide+" shut="+shut+" up="+up+" back="+back+" apps="+apps)},1500)},2500)},300)})()</script>';
// Dawn with ten Plex cards, more than the screen holds: the strip stays inside the safe area (96 px each side), centred cards slide so the
// focused one (the eighth) is wholly in view and the edge with more cards fades; Down from the dock then opens the apps under it (push:
// the grid open, the dock moved up). Transitions off: this engine does not run them in virtual time. The outcome lands in data-sfit.
const STRIP_FIT =
  '<script>(function(){function key(c){["keydown","keyup"].forEach(function(t){var e=document.createEvent("Event");e.initEvent(t,true,true);' +
  'Object.defineProperty(e,"keyCode",{value:c});document.dispatchEvent(e)})}function f(){return document.querySelector(".f")}' +
  'function out(v){document.body.setAttribute("data-sfit",v)}' +
  'function until(c,then,what){var n=0,t=setInterval(function(){var ok=false;try{ok=c()}catch(e){}if(ok){clearInterval(t);then()}else if(++n>80){clearInterval(t);out("bad waiting for "+what)}},100)}' +
  'var nt=document.createElement("style");nt.textContent="*{transition:none!important}";document.head.appendChild(nt);' +
  'var A=window.api;window.api=function(p,b){if(p==="/api/watch/rows"){var it=[];for(var i=0;i<10;i++)it.push({key:"plex-"+i,group:"plex:"+i,source:"plex",' +
  'title:"Film "+i,sub:"",img:"/api/watch/img/bbbbbbbbbbbbbbbb",progress:0.5,launch:{id:"cdp-30",params:{}}});return Promise.resolve({items:it})}return A(p,b)};' +
  'function plex(){return f()&&f()._a&&f()._a.id==="cdp-30"}function cards(){var st=document.getElementById("wstrip");return st?st.querySelectorAll(".wcard").length:0}' +
  'until(function(){return document.querySelector(".tile")&&WATCH.refresh},function(){WATCH.refresh();' +
  'until(function(){if(!plex())key(39);return plex()&&cards()===10},function(){key(38);for(var i=0;i<7;i++)key(39);' +
  'until(function(){return f()&&f().classList.contains("wcard")},function(){var st=document.getElementById("wstrip"),sr=st.getBoundingClientRect(),' +
  'fc=f(),fr=fc.getBoundingClientRect(),safe=sr.left>=95&&sr.right<=1825,seen=fr.left>=sr.left-1&&fr.right<=sr.right+1,fade=st.classList.contains("ml");' +
  'key(40);var dockY=document.getElementById("dock").getBoundingClientRect().top;key(40);' +
  'until(function(){return document.body.classList.contains("grid-open")},function(){' +
  'var open=document.body.getAttribute("data-grid")==="push",up=document.getElementById("dock").getBoundingClientRect().top<dockY-200;' +
  'out(safe&&seen&&fade&&open&&up?"ok":"bad safe="+safe+" strip="+sr.left+"-"+sr.right+" seen="+seen+" card="+fr.left+"-"+fr.right+" fade="+fade+" open="+open+" up="+up)},"the grid")},"the strip focus")},"Plex and ten cards")},"the tiles")})()</script>';
// Dawn (effects.foreground): the front of its wallpaper is a layer over the clock (after #top, above it) and under the apps (#view
// comes forward), its picture loads, and the date stands above the time (clock.dateAbove). The outcome lands in data-front.
const FG_CHECK =
  '<script>(function(){var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);setTimeout(function(){' +
  'var fg=document.getElementById("thfg"),top=document.getElementById("top"),view=document.getElementById("view"),cs=fg&&getComputedStyle(fg);' +
  'var over=!!fg&&!!(top.compareDocumentPosition(fg)&Node.DOCUMENT_POSITION_FOLLOWING);' +
  'var pic=!!cs&&/\\/api\\/theme\\/wallpaper\\/dawn\\/dawn-front\\.webp/.test(cs.backgroundImage);' +
  'var z=!!cs&&+cs.zIndex>+getComputedStyle(top).zIndex&&+getComputedStyle(view).zIndex>+cs.zIndex;' +
  'var above=getComputedStyle(document.getElementById("date")).order==="-1";' +
  'var im=new Image();im.onload=im.onerror=function(){var ok=over&&pic&&z&&above&&im.naturalWidth===1920&&cs.pointerEvents==="none";' +
  'document.body.setAttribute("data-front",ok?"ok":"bad fg="+!!fg+" over="+over+" pic="+pic+" z="+z+" above="+above+" w="+im.naturalWidth)};' +
  'im.src=cs?cs.backgroundImage.replace(/^url\\("?|"?\\)$/g,""):""},800)},300)})()</script>';
const FX_CHECK =
  '<script>(function(){var go=setInterval(function(){if(!document.querySelector(".tile"))return;clearInterval(go);setTimeout(function(){' +
  'var fr=document.getElementById("thframe"),top=document.getElementById("top");' +
  'var behind=!!fr&&!!(fr.compareDocumentPosition(top)&Node.DOCUMENT_POSITION_FOLLOWING),cs=fr&&getComputedStyle(fr);' +
  'var pic=!!cs&&/\\/api\\/theme\\/wallpaper\\/halloween\\/frame\\.png/.test(cs.backgroundImage);' +
  'var still=!!cs&&cs.animationName==="none"&&!document.getElementById("fx");' +
  'var ok=!!fr&&behind&&pic&&still&&cs.pointerEvents==="none";' +
  'document.body.setAttribute("data-fx",ok?"ok":"bad frame="+!!fr+" behind="+behind+" pic="+pic+" still="+still)},800)},300)})()</script>';
// [name, file, what it draws, how many at least, milliseconds of page time to wait, a script to run in it, a theme id]
const PAGES = [
  ['launcher', 'app/index.html', /class="tile[ "]/g, 8, 8000],
  ['manager', 'manager/app/index.html', /class="row[ "]/g, 5, 8000],
  ['picker', 'picker/app/index.html', /class="chip[ "]/g, 2, 3000],
  // the launcher left alone for its screensaver's minute (virtual time): the screensaver is up with a photo from the feed drawn
  ['saver', 'app/index.html', /class="svp[^"]* on"/g, 1, 75000],
  // and its keys: Left and Right step through the photos, another key ends it without acting on Home
  ['saver keys', 'app/index.html', /data-keys="ok"/g, 1, 90000, SAVER_KEYS],
  ['wallpaper chooser', 'app/index.html', /data-pick="ok"/g, 1, 20000, WALLPICK_KEYS],
  ['saver over an app', 'app/index.html', /data-over="ok"/g, 1, 30000, SAVER_OVER],
  ['home key', 'app/index.html', /data-home="ok"/g, 1, 15000, HOME_KEY],
  ['saver over hdmi', 'app/index.html', /data-hdmi="ok"/g, 1, 20000, SAVER_HDMI],
  ['saver frame', 'app/index.html', /data-frame="ok"/g, 1, 20000, SAVER_FRAME],
  ['continue watching', 'app/index.html', /data-watch="ok"/g, 1, 15000, WATCH_KEYS],
  ['linking plex', 'app/index.html', /data-link="ok"/g, 1, 20000, WATCH_LINK],
  ['hold ok', 'app/index.html', /data-hold="ok"/g, 1, 20000, HOLD_OK],
  ['lg row', 'app/index.html', /data-lg="ok"/g, 1, 15000, LG_ROW],
  ['lg app off', 'app/index.html', /data-lgoff="ok"/g, 1, 20000, LG_APP_OFF],
  ['wallpaper fit', 'app/index.html', /data-fit="ok"/g, 1, 15000, WALL_FIT],
  ['dock row in glass', 'app/index.html', /data-dock="ok"/g, 1, 15000, DOCK_ROW, 'glass'],
  ['holiday frame', 'app/index.html', /data-fx="ok"/g, 1, 15000, FX_CHECK, 'halloween'],
  ['dawn front', 'app/index.html', /data-front="ok"/g, 1, 15000, FG_CHECK, 'dawn'],
  ['menu sections', 'app/index.html', /data-two="ok"/g, 1, 12000, MENU_TWO],
  ['screensaver menu', 'app/index.html', /data-pv="ok"/g, 1, 12000, SAVER_MENU],
  ['dawn clock with photos', 'app/index.html', /data-wpclock="ok"/g, 1, 15000, WP_CLOCK, 'dawn'],
  ['magic remote wheel', 'app/index.html', /data-wheel="ok"/g, 1, 12000, WHEEL],
  ['watch strip in dawn', 'app/index.html', /data-strip="ok"/g, 1, 15000, STRIP, 'dawn'],
  ['watch strip fits in dawn', 'app/index.html', /data-sfit="ok"/g, 1, 20000, STRIP_FIT, 'dawn'],
  ['manager update check', 'manager/app/index.html', /data-check="ok"/g, 1, 12000, MANAGER_CHECK],
  ['manager closes when left', 'manager/app/index.html', /data-left="ok"/g, 1, 150000, MANAGER_LEFT],
  ['weather in a short place', 'app/index.html', /data-slim="ok"/g, 1, 12000, SLIM_WX, 'glass'],
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
let pageDom = ''; // the page's own last copy of itself (PROBE)
function serve() {
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0];
    r.setHeader('Access-Control-Allow-Origin', '*');
    r.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (q.method === 'OPTIONS') return r.writeHead(204), r.end();
    const json = o => (r.writeHead(200, { 'content-type': 'application/json' }), r.end(JSON.stringify(o)));
    const p = PAGES.filter(x => '/' + x[0].replace(/ /g, '-') + '.html' === u)[0];
    // the API token (apitoken.js): served next to the pages as on the TV, and every API call of a page must carry it
    // the screensaver's materials sit next to the launcher page, as on the TV
    if (/^\/saver-[a-z-]+\.webp$/.test(u) && fs.existsSync(path.join(ROOT, 'app', u)))
      return r.writeHead(200, { 'content-type': 'image/webp' }), r.end(fs.readFileSync(path.join(ROOT, 'app', u)));
    if (u === '/__dom' && q.method === 'POST') {
      const parts = [];
      q.on('data', c => parts.push(c));
      q.on('end', () => {
        pageDom = Buffer.concat(parts).toString('utf8');
        r.writeHead(204);
        r.end();
      });
      return;
    }
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
    // a theme's pictures (wallpaper, frame, foreground), from the repository's themes folder as the TV serves its downloaded copy
    const tp = /^\/api\/theme\/wallpaper\/([a-z0-9-]{1,30})\/([\w-]{1,40}\.(jpg|png|webp))$/.exec(u);
    if (tp && fs.existsSync(path.join(ROOT, 'themes', tp[1], tp[2])))
      return (
        r.writeHead(200, { 'content-type': tp[3] === 'jpg' ? 'image/jpeg' : 'image/' + tp[3] }),
        r.end(fs.readFileSync(path.join(ROOT, 'themes', tp[1], tp[2])))
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
    // Check for updates: the same status, with a release that came out on a known day
    if (u === '/api/manager/check')
      return json(Object.assign({}, golden['manager status'].body, { release: { version: '9.9.9', date: '2026-10-28' }, checking: false }));
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
    if (/^\/api\/photofeed\/photo\/q\d+$/.test(u)) return r.writeHead(200, { 'content-type': 'image/svg+xml' }), r.end(portrait(u));
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
    console.log('skipped: the Chromium builds are fetched for Linux x64 and macOS only');
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
      // a build that cannot start on this computer fails here once instead of on every page: Chrome 120 for macOS stops with SIGTRAP
      // at start on macOS 26 (its helper processes cannot find the browser's Mach rendezvous service), and every start that dies
      // leaves crash reports. (--single-process is no way around it: Chrome 120 stops in it on Linux too.)
      const probe = await run(bin, 'about:blank', ['--dump-dom'], 1000);
      if (probe.status !== 0 || probe.stdout.indexOf('<body') < 0) {
        ok(
          false,
          e[0] +
            ' starts on this computer (' +
            (probe.error || 'exit ' + probe.status) +
            '): run the pages in the Linux container instead, CYTV_CHROMIUM_IMAGE=ubuntu:26.04 sh tools/check.sh --chromium'
        );
        continue;
      }
      for (const p of PAGES.filter(x => !pageOnly || x[0].indexOf(pageOnly) >= 0)) {
        const url = 'http://127.0.0.1:8765/' + p[0].replace(/ /g, '-') + '.html';
        // headless Chromium on Linux now and then fails to hand over the page ("Failed to serialize document"), hangs or hands it over
        // before the page drew its content: try again
        let r = null;
        for (let tries = 0; tries < 5; tries++) {
          pageDom = '';
          r = await run(bin, url, ['--dump-dom'], p[4]);
          const handed = (r.stdout || '').indexOf('<body') >= 0;
          // the browser did not hand the page over: the page's own copy of itself stands in for it
          if (!handed && pageDom.indexOf('<body') >= 0) {
            r.stdout = pageDom;
            r.status = 0;
            r.copy = true;
          } else if (!handed && pageDom) r.stderr += '\n  the page could not copy itself: ' + pageDom.slice(0, 300);
          if (r.status === 0 && (r.stdout || '').indexOf('<body') >= 0 && ((r.stdout || '').match(p[2]) || []).length >= p[3]) break;
        }
        if (r.copy) console.log('     ' + e[0] + ': ' + p[0] + ': checked from the copy the page sent (the browser did not hand it over)');
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
    failed
      ? failed + ' check(s) failed in ' + ENGINES.map(x => x[0]).join(', ')
      : 'the pages work in ' +
          ENGINES.filter(x => !only || x[0].indexOf(only) >= 0)
            .map(x => x[0])
            .join(', ')
  );
  process.exit(failed ? 1 : 0);
})();
