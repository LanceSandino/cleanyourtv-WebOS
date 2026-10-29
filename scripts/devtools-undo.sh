#!/bin/sh
# Undo devtools-close.sh: LG's own start script for WebAppMgr again (the mount removed, the copy in /tmp deleted). WebAppMgr is not
# restarted (that would close every web app, Home and the manager included): LG's web inspector listens on port 9998 again from the
# next start of WebAppMgr, at the latest the next start of the TV. Right away: systemctl restart webapp-mgr.
# The paths can be pointed elsewhere for the tests (tools/test/scripts.test.js); on the TV none of these variables is set.
export PATH=${CYTV_TEST_BIN:+$CYTV_TEST_BIN:}/usr/bin:/usr/sbin:/bin:/sbin:$PATH
S=${CYTV_WAM_SCRIPT:-/etc/systemd/system/scripts/webapp-mgr.sh}
C=${CYTV_WAM_COPY:-/tmp/cleanyourtv-webapp-mgr.sh}
MOUNTS=${CYTV_MOUNTS:-/proc/mounts}
LOG=${CYTV_BOOT_LOG:-/tmp/cleanyourtv-boot.log}
i=0
while grep -q " $S " "$MOUNTS" && [ $i -lt 5 ]; do
  umount "$S" 2>/dev/null
  i=$((i + 1))
done
if grep -q " $S " "$MOUNTS"; then
  echo "$(cut -d' ' -f1 /proc/uptime 2>/dev/null) devtools: the copy of LG's WebAppMgr script could not be unmounted" >> "$LOG"
  exit 1
fi
rm -f "$C" "$C.new"
[ $i -gt 0 ] && echo "$(cut -d' ' -f1 /proc/uptime 2>/dev/null) devtools: LG's own WebAppMgr script again (port 9998 opens at its next start)" >> "$LOG"
exit 0
