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
  H=/usr/palm/applications/com.webos.app.home
  STANDIN=/tmp/cleanyourtv-home-standin
  up() { cut -d' ' -f1 /proc/uptime 2>/dev/null; }
  replaced() { grep -q " $H " /proc/mounts || { [ -f $STANDIN ] && grep -q " $(cat $STANDIN) " /proc/mounts; }; }
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
  while [ -f "$L/helper.js" ]; do
    sleep "$EVERY"
    if curl -s -m 3 -o /dev/null "$URL"; then
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
