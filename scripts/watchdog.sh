#!/bin/sh
# The service's watchdog, started by 10-cleanyourtv-home when it takes over Home (one per boot). Every 10 seconds it asks the service;
# when it does not answer:
#   - if the service is not running at all (it exited, for example on a Node 8 libuv assertion) it starts it again,
#     notes that in the boot log and keeps the service log of the run that ended as cleanyourtv-helper.crash.log. This happens as
#     long as CleanYourTV is installed, also while LG's Home is back after a fallback, so the launcher, the Input key and the manager
#     keep their service. Not while bootstrap.sh runs: a setup or an update starts and stops the service itself.
#   - while our launcher is Home and the service stays unreachable for about a minute, LG's Home comes back until the next reboot
#     (undo-home.sh temp), as before.
# A service that keeps stopping is not started over and over: after 5 starts within 10 minutes the watchdog stops starting it and
# says so in the boot log (the crash log of the first stop is kept, not overwritten), until the next boot.
# The paths can be pointed elsewhere for the tests (tools/test/scripts.test.js); on the TV none of these variables is set.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=${CYTV_DIR:-/media/developer/cleanyourtv}
LOG=${CYTV_BOOT_LOG:-/tmp/cleanyourtv-boot.log}
SLOG=${CYTV_SERVICE_LOG:-/tmp/cleanyourtv-helper.log}
URL=${CYTV_SERVICE_URL:-http://127.0.0.1:8765/api/foreground}
EVERY=${CYTV_WATCH_SECS:-10}
H=/usr/palm/applications/com.webos.app.home
STANDIN=/tmp/cleanyourtv-home-standin
up() { cut -d' ' -f1 /proc/uptime 2>/dev/null; }
replaced() { grep -q " $H " /proc/mounts || { [ -f $STANDIN ] && grep -q " $(cat $STANDIN) " /proc/mounts; }; }

bad=0
fallback=0
starts=""   # the uptimes (s) of the starts in the last 10 minutes
MAX=${CYTV_WATCH_MAX:-5}
while [ -f "$L/helper.js" ]; do
  sleep "$EVERY"
  if curl -s -m 3 -o /dev/null "$URL"; then
    bad=0
    continue
  fi
  if ! pgrep -f "$L/helper.js" >/dev/null && ! pgrep -f "[b]ootstrap.sh" >/dev/null; then
    now=$(up); now=${now%.*}; [ -n "$now" ] || now=0
    recent=""
    for t in $starts; do [ $((now - t)) -lt 600 ] && recent="$recent $t"; done
    starts=$recent
    if [ $(echo $starts | wc -w) -ge "$MAX" ]; then
      [ "$gaveup" = 1 ] || echo "$(up) watchdog: the service stopped $MAX times in 10 minutes; not starting it again until the next boot" >>"$LOG"
      gaveup=1
    else
      echo "$(up) watchdog: the service had stopped; starting it again" >>"$LOG"
      # the log of the first run that ended is kept: a loop of quick crashes would overwrite the one that shows the cause
      [ -s "$SLOG" ] && [ ! -s "${SLOG%.log}.crash.log" ] && cp "$SLOG" "${SLOG%.log}.crash.log"
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
