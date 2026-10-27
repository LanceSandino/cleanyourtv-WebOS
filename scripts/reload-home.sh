#!/bin/sh
# Reload the page of Home. Where the Home renderer can be found (webOS 7 and newer) it is killed and Home is launched
# again. On webOS 6 (Node 8) WebAppMgr keeps the replaced page alive and a relaunch only brings the old page back, so
# there webapp-mgr is restarted. Other versions are never restarted this way.
export PATH=${CYTV_TEST_BIN:+$CYTV_TEST_BIN:}/usr/bin:/usr/sbin:/bin:/sbin:$PATH # CYTV_TEST_BIN: stand-ins, for the tests
# The stand-in way (LG's native Home, scripts/home-standin.sh): webapp-mgr holds the launcher; close it there, and launching Home
# makes the stand-in open it again.
STANDIN=/tmp/cleanyourtv-home-standin
if [ -f $STANDIN ] && grep -q " $(cat $STANDIN) " /proc/mounts; then
  luna-send -n 1 -w 5000 luna://com.palm.webappmanager/killApp '{"appId":"com.webos.app.home"}' </dev/null >/dev/null 2>&1
  sleep 2
  luna-send -n 1 -w 10000 -f luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' </dev/null >/dev/null
  exit 0
fi
old=$(pgrep -f "[a]pp-id=com.webos.app.home" | tr '\n' ' ')
if [ -n "$old" ]; then
  pkill -f "[a]pp-id=com.webos.app.home"
  # webOS starts Home again by itself (webOS 25 within 2 s): a launch on top of that only relaunches the page that just loaded,
  # which showed as a second load after an update. Home is launched only when no new Home process came up by itself.
  for i in $(seq 1 ${CYTV_HOME_WAIT:-8}); do
    sleep 1
    for p in $(pgrep -f "[a]pp-id=com.webos.app.home"); do
      case " $old " in *" $p "*) ;; *) exit 0 ;; esac
    done
  done
else
  nm=$(node -p 'parseInt(process.versions.node, 10)' 2>/dev/null)
  if [ "${nm:-99}" -lt 10 ] && systemctl cat webapp-mgr.service >/dev/null 2>&1; then
    systemctl restart webapp-mgr
    for i in $(seq 1 30); do systemctl is-active webapp-mgr >/dev/null && break; sleep 1; done
    sleep 3
  fi
fi
luna-send -n 1 -w 10000 -f luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' </dev/null >/dev/null
