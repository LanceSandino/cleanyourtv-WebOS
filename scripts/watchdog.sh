#!/bin/sh
# The service's watchdog, started by 10-cleanyourtv-home (one per boot, also while LG's Home is selected and after an update). Every
# 10 seconds it asks the service; when it does not answer:
#   - if the service is not running at all (it exited, for example on a Node 8 libuv assertion, upstream issue 65) it starts it again,
#     notes that in the boot log and adds the service log of the run that ended to cleanyourtv-helper.crash.log. The crash log keeps
#     the first run of this boot that ended and the latest ones (about 400 lines), so neither the first cause nor the last one is
#     lost; Share log includes it. This happens as long as CleanYourTV is installed, also while LG's Home is back after a fallback, so
#     the launcher, the Input key and the manager keep their service. Not while bootstrap.sh runs (a shell running it, not any command
#     line that mentions it): a setup or an update starts and stops the service itself.
#   - a service that stops again at once is started less often (after 10, 20, ... up to 120 seconds), and after 5 starts within 10
#     minutes the watchdog stops starting it and says so once in the boot log, until the next boot, so a service that cannot start
#     does not use the TV all night.
#   - while our launcher is Home and the service stays unreachable for about a minute, LG's Home comes back until the next reboot
#     (undo-home.sh temp), as before.
#   - nothing on screen (upstream issue 162): while our launcher is Home the stand-in way (LG's native Home, webOS 22 and 23), the TV
#     is on (power state Active) and no app is in front for two checks in a row, Home is set up again: the stand-in and the launcher
#     are closed and the app manager opens Home afresh. LG's app manager can restart when the TV goes to standby; a launcher that
#     stayed open was then no longer known as Home, and the Home key gave a black screen with only the pointer. home-standin.sh
#     handles that at once; this is the safety net. If the screen stays empty after two such tries, LG's Home comes back until the
#     next reboot (undo-home.sh temp). The other form of the same fault: the app manager lists Home as running while no stand-in runs
#     (a restart of the app manager can end it too), so the Home key does nothing; seen for two checks in a row, the launcher is
#     closed (and Home opened again when it was in front). The app in front is the service's own answer to the check above
#     (/api/foreground), so this costs no extra call while all is well; neither check runs in the first 90 seconds, while the boot
#     script still brings Home up and checks it itself.
# The whole script is one block that ends in exit: the shell has read all of it before it runs, so an update that copies a new
# watchdog.sh over this file does not confuse the copy that is running (bootstrap.sh stops it, and the boot script starts the new one).
# The paths can be pointed elsewhere for the tests (tools/test/scripts.test.js); on the TV none of these variables is set.
{
  export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
  L=${CYTV_DIR:-/media/developer/cleanyourtv}
  LOG=${CYTV_BOOT_LOG:-/tmp/cleanyourtv-boot.log}
  SLOG=${CYTV_SERVICE_LOG:-/tmp/cleanyourtv-helper.log}
  CRASH=${SLOG%.log}.crash.log
  URL=${CYTV_SERVICE_URL:-http://127.0.0.1:8765/api/foreground}
  EVERY=${CYTV_WATCH_SECS:-10}
  MAX=${CYTV_WATCH_MAX:-5}
  GRACE=${CYTV_WATCH_GRACE:-9} # checks at the start without the screen checks
  H=/usr/palm/applications/com.webos.app.home
  STANDIN=${CYTV_STANDIN:-/tmp/cleanyourtv-home-standin}
  MOUNTS=${CYTV_MOUNTS:-/proc/mounts}
  LUNA=${CYTV_LUNA:-luna-send}
  up() { cut -d' ' -f1 /proc/uptime 2>/dev/null; }
  replaced() { grep -q " $H " $MOUNTS || { [ -f $STANDIN ] && grep -q " $(cat $STANDIN) " $MOUNTS; }; }
  luna() { "$LUNA" -n 1 -w 3000 "$@" </dev/null 2>/dev/null; }
  appid() { echo "$1" | sed -n 's/.*"appId" *: *"\([^"]*\)".*/\1/p'; }
  standin() { [ -f $STANDIN ] && grep -q " $(cat $STANDIN) " $MOUNTS; }
  # the stand-in way, and the TV on with no app in front (an empty screen); $1: the service's answer (getForegroundAppInfo). An app
  # manager that did not answer is not counted, and an app in front ends a run of tries
  blank() {
    standin || return 1
    echo "$1" | grep -q '"returnValue": *true' || return 1
    [ -z "$(appid "$1")" ] || { tries=0; return 1; }
    luna luna://com.webos.service.tvpower/power/getPowerState '{}' | grep -q '"state": *"Active"'
  }
  # the app manager lists Home as running, but no stand-in runs: the launcher webapp-mgr has open is taken for Home, and the Home key
  # does nothing
  orphan() {
    standin || return 1
    pgrep -f "^/bin/sh $(cat $STANDIN)" >/dev/null && return 1
    luna luna://com.webos.applicationManager/running '{}' | grep -q '"id": *"com.webos.app.home"'
  }
  # Home set up again: the stand-ins and their registrations end, webapp-mgr closes the launcher, and (unless $1 is "closed") the
  # app manager opens Home
  rehome() {
    EXE=$(cat $STANDIN)
    for p in $(pgrep -f "^/bin/sh $EXE"); do kill "$p" 2>/dev/null; done
    pkill -f "[l]una-send -i -a com.webos.app.home" 2>/dev/null
    luna luna://com.palm.webappmanager/killApp '{"appId":"com.webos.app.home"}' >/dev/null
    [ "$1" = closed ] && return 0
    sleep 2
    luna luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' >/dev/null
  }
  # the last 100 lines of the run that ended go to the crash log. Past 400 lines the first entry (its header and 100 lines: the
  # first cause seen this boot) and the latest lines are kept
  keep_log() {
    [ -s "$SLOG" ] || return 0
    { echo "=== the service log of a run that ended (uptime $(up)) ==="; tail -n 100 "$SLOG"; } >>"$CRASH" 2>/dev/null
    n=$(wc -l <"$CRASH" 2>/dev/null)
    if [ "${n:-0}" -gt 400 ]; then
      first=$(awk 'NR > 1 && /^=== the service log of a run that ended/ { print NR - 1; exit }' "$CRASH")
      [ -n "$first" ] && [ "$first" -le 101 ] || first=101
      { head -n "$first" "$CRASH"; echo "=== (runs in between left out) ==="; tail -n $((398 - first)) "$CRASH"; } >"$CRASH.tmp" \
        && mv "$CRASH.tmp" "$CRASH"
    fi
  }

  bad=0       # checks in a row without an answer (the fallback to LG's Home counts them)
  fallback=0  # 1 once LG's Home has been brought back by this watchdog
  fails=0     # starts in a row that did not bring the service back
  hold=0      # checks to wait before the next start
  starts=""   # the uptimes (s) of the starts in the last 10 minutes
  gaveup=0
  empty=0     # checks in a row with nothing on screen
  tries=0     # times Home was set up again while the screen stayed empty
  lost=0      # checks in a row with Home running without its stand-in
  tick=0
  while [ -f "$L/helper.js" ]; do
    sleep "$EVERY"
    tick=$((tick + 1))
    ans=$(curl -s -m 3 "$URL")
    ansd=$?
    if [ $fallback = 0 ] && [ $tick -gt "$GRACE" ] && [ $ansd = 0 ]; then
      if blank "$ans"; then
        empty=$((empty + 1))
        if [ $empty -ge 2 ]; then
          empty=0
          tries=$((tries + 1))
          if [ $tries -le 2 ]; then
            echo "$(up) watchdog: the TV is on with nothing on screen; Home is set up again (try $tries)" >>"$LOG"
            rehome
          else
            echo "$(up) watchdog: still nothing on screen; LG's Home until the next reboot" >>"$LOG"
            sh "$L/undo-home.sh" temp
            fallback=1
          fi
        fi
      else
        empty=0
      fi
      if [ $fallback = 0 ] && orphan; then
        lost=$((lost + 1))
        if [ $lost -ge 2 ]; then
          lost=0
          fg=$(appid "$ans")
          if [ -z "$fg" ] || [ "$fg" = com.webos.app.home ]; then
            echo "$(up) watchdog: Home runs without its stand-in (the app manager restarted); Home is set up again" >>"$LOG"
            rehome
          else
            echo "$(up) watchdog: Home runs without its stand-in (the app manager restarted); the launcher is closed, the Home key opens it afresh" >>"$LOG"
            rehome closed
          fi
        fi
      else
        lost=0
      fi
    fi
    if [ $ansd = 0 ]; then
      bad=0
      fails=0
      hold=0
      continue
    fi
    if ! pgrep -f "$L/helper.js" >/dev/null && ! pgrep -f "^[a-z/]*sh [^ ]*[b]ootstrap.sh" >/dev/null; then
      now=$(up); now=${now%.*}; [ -n "$now" ] || now=0
      recent=""
      for t in $starts; do [ $((now - t)) -lt 600 ] && recent="$recent $t"; done
      starts=$recent
      if [ $hold -gt 0 ]; then
        hold=$((hold - 1))
      elif [ $(echo $starts | wc -w) -ge "$MAX" ]; then
        [ $gaveup = 1 ] || echo "$(up) watchdog: the service stopped $MAX times in 10 minutes; not starting it again until the next boot" >>"$LOG"
        gaveup=1
      else
        fails=$((fails + 1))
        hold=$((fails - 1))
        [ $hold -gt 11 ] && hold=11
        echo "$(up) watchdog: the service had stopped; starting it again (start $fails in a row)" >>"$LOG"
        keep_log
        (cd / && nohup node "$L/helper.js" >"$SLOG" 2>&1 </dev/null &)
        starts="$starts $now"
      fi
    fi
    if [ $fallback = 0 ] && replaced; then
      bad=$((bad + 1))
      if [ $bad -ge 6 ]; then
        echo "$(up) watchdog: the service did not answer for a minute; LG's Home until the next reboot" >>"$LOG"
        sh "$L/undo-home.sh" temp
        fallback=1
      fi
    fi
  done
  exit 0
}
