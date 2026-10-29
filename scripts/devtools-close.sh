#!/bin/sh
# LG's web inspector closed to the network, in RAM. LG's start script for WebAppMgr (/etc/systemd/system/scripts/webapp-mgr.sh, on
# the read-only system partition) always passes --remote-debugging-port=9998, and WebAppMgr's DevTools then listen on every address
# of the TV with no authentication: anyone on the network can run code inside the TV's web apps, Home included. This writes a copy
# of LG's script without that switch (/tmp/cleanyourtv-webapp-mgr.sh) and mounts it over LG's script until the next start; LG's file
# is never changed. The switch is removed, not narrowed to 127.0.0.1: WebAppMgr's engine (libcbe.so) has no
# --remote-debugging-address.
#   sh devtools-close.sh           the copy mounted, once per start; WebAppMgr keeps the port until it starts again
#   sh devtools-close.sh restart   and WebAppMgr started again once, when the one running has the port (10-cleanyourtv-home at
#                                  boot, before Home is taken over and sam restarted, so that it costs nothing later)
# Off while D/devtools-open exists (the manager's Security switch, helper/security.js); devtools-undo.sh removes the mount.
# Each step is written to /tmp/cleanyourtv-boot.log, which Share log includes.
# The paths can be pointed elsewhere for the tests (tools/test/scripts.test.js); on the TV none of these variables is set.
export PATH=${CYTV_TEST_BIN:+$CYTV_TEST_BIN:}/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=${CYTV_DIR:-/media/developer/cleanyourtv}
S=${CYTV_WAM_SCRIPT:-/etc/systemd/system/scripts/webapp-mgr.sh}
C=${CYTV_WAM_COPY:-/tmp/cleanyourtv-webapp-mgr.sh}
MOUNTS=${CYTV_MOUNTS:-/proc/mounts}
PROC=${CYTV_PROC:-/proc}
LOG=${CYTV_BOOT_LOG:-/tmp/cleanyourtv-boot.log}
UNIT=webapp-mgr.service
up() { cut -d' ' -f1 /proc/uptime 2>/dev/null; }
say() { echo "$(up) devtools: $*" >> "$LOG"; }
[ -e "$L/devtools-open" ] && exit 0
[ -f "$S" ] || exit 0
mounted() { grep -q " $S " "$MOUNTS"; }
# the running WebAppMgr was started with the port
withPort() {
  pid=$(systemctl show -p MainPID --value $UNIT 2>/dev/null)
  [ -n "$pid" ] && [ "$pid" != 0 ] && tr '\0' ' ' < "$PROC/$pid/cmdline" 2>/dev/null | grep -q -- '--remote-debugging-port'
}
if ! mounted; then
  # LG's script without the switch: only when it had it, and only a copy that is still a valid script. Written beside it and renamed
  # into place, never over a file in use (D-20261029-2)
  sed 's/[[:space:]]*--remote-debugging-port=[0-9]*//g' "$S" > "$C.new"
  if cmp -s "$S" "$C.new" || grep -q -- '--remote-debugging-port' "$C.new" || ! sh -n "$C.new" 2>/dev/null; then
    rm -f "$C.new"
    say "LG's WebAppMgr script has no --remote-debugging-port=<port> to remove here; left as it is"
    exit 0
  fi
  chmod 755 "$C.new" && mv -f "$C.new" "$C" || { say "the copy of LG's WebAppMgr script could not be written"; exit 1; }
  mount --bind "$C" "$S" || { say "the mount over LG's WebAppMgr script failed; port 9998 stays open"; exit 1; }
  say "LG's WebAppMgr script is replaced in RAM by a copy without its web inspector (port 9998)"
fi
[ "$1" = restart ] || exit 0
withPort || exit 0
say "restarting WebAppMgr once, without port 9998"
systemctl --no-block restart $UNIT
i=0
while [ $i -lt ${CYTV_WAM_WAIT:-20} ]; do
  sleep 1
  i=$((i + 1))
  st=$(systemctl is-active $UNIT 2>/dev/null)
  if [ "$st" = active ] && ! withPort && [ -n "$pid" ] && [ "$pid" != 0 ]; then
    say "WebAppMgr runs without port 9998 (after ${i} s)"
    exit 0
  fi
  # a WebAppMgr that does not end on SIGTERM would hold the restart for its stop timeout (90 s)
  [ $i = 8 ] && [ "$st" = deactivating ] && { say "WebAppMgr did not stop in 8 s; ending it"; systemctl kill -s KILL $UNIT; }
done
say "WebAppMgr did not come back without port 9998 in ${i} s (state: ${st:-unknown})"
exit 1
