document.addEventListener('keydown', function (e) {
  var k = e.keyCode;
  if (view === 'zip' && zipKey(e)) return;
  if (k === 38) next(-1);
  else if (k === 40) next(1);
  else if (k === 13) act();
  else if (k === 461 || k === 27 || k === 8 || k === 10009) {
    if (view === 'share') closeShare();
    else if (view === 'keys') closeKeys();
    else if (view === 'zip') closeZip();
    else if (view !== 'main') pop();
    else {
      try {
        window.close();
      } catch (x) {}
    }
  }
  e.preventDefault();
});
document.addEventListener('click', function (e) {
  if (e.target.closest && e.target.closest('#shareclose')) {
    closeShare();
    return;
  }
  var r = e.target.closest && e.target.closest('.row');
  if (r) {
    idx = +r.getAttribute('data-i');
    draw();
    act();
  }
});
document.addEventListener('mousemove', function (e) {
  var r = e.target.closest && e.target.closest('.row');
  if (r && +r.getAttribute('data-i') !== idx) {
    idx = +r.getAttribute('data-i');
    draw();
  }
});
document.addEventListener('wheel', function (e) {
  if (e.deltaY > 0) next(1);
  else if (e.deltaY < 0) next(-1);
}); /* the Magic Remote wheel */
/* opened with {"open":"wallpapers"} (the launcher's Customize > Wallpapers): straight to that screen; {"open":"photofeed"} (Customize >
   Screensaver > Photo feed...): straight to the QR code that opens the phone page on its Photo feed tab */
/* opened with {"open":"wallpapers"} or {"open":"cards"} (the launcher's Customize menu): straight to that screen */
var cardsFromHome = false;
function wantView() {
  var p = {};
  try {
    p = JSON.parse(window.webOSSystem.launchParams || '{}');
  } catch (e) {}
  if (p && p.open === 'wallpapers') openWallpapers();
  if (p && p.open === 'photofeed') openWallPair('feed');
  if (p && p.open === 'cards') {
    cardsFromHome = true;
    openCards();
  }
  if (p && p.open === 'remote') {
    remoteFromHome = true;
    openRemote();
  }
}
/* left in the background (another app or Home in front) for two minutes: the manager closes, so its memory and its status checks
   stop (own-your-glass saw a hidden control app hold about 37 MB on webOS 25); not while an update or another job is running, and
   not while a phone page it opened is still in use (its screen is open). Opening it again starts it afresh. */
var hiddenT = 0;
document.addEventListener('visibilitychange', function () {
  clearTimeout(hiddenT);
  if (!document.hidden) return;
  hiddenT = setTimeout(function closeIfIdle() {
    if (!document.hidden) return;
    if ((st && st.job && st.job.state === 'working') || view === 'share') {
      hiddenT = setTimeout(closeIfIdle, 60000);
      return;
    }
    try {
      window.close();
    } catch (x) {}
  }, 120000);
});
document.addEventListener('webOSRelaunch', function () {
  view = 'main';
  idx = 0;
  idxStack = [];
  listY = 0;
  load();
  wantView();
});
$('shareclose').textContent = tr('Close');
banner('Reading status…', 'work');
load();
wantView();
