#!/bin/sh
# Undo debloat-stop.sh: restart the systemd daemons, remove the stubs and the hosts lines (dynamic services start on demand again).
# sh debloat-undo.sh [group...]: only those groups (ads, adapps, tracking, logs, suggestions, miner, see debloat-stop.sh); without
# arguments all. Undoing ads frees admanager too (adapps holds only while ads is on). LG's content miner starts again only when no
# group still holds it: suggestions still on, or the opt-in miner still on.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
CFG=$(node -e 'try{var o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).options||{};console.log((o.debloatOff||[]).join(" ")+"|"+(o.debloatOn||[]).join(" "))}catch(e){}' $L/config.json 2>/dev/null)
OFF=${CFG%%|*}; ON=${CFG#*|}
G=" ${*:-ads tracking logs suggestions adapps miner} "
on() { case "$G" in *" $1 "*) return 0 ;; esac; return 1; }
listed() { case " $2 " in *" $1 "*) return 0 ;; esac; return 1; }
units=""; bins=""
on logs && units="$units remotelogger service-logger"
on suggestions && { units="$units nudge"; bins="$bins sportsalarm"; }
on miner && bins="$bins contentminer"
if on suggestions || on miner; then
  { ! on suggestions && ! listed suggestions "$OFF"; } || { ! on miner && listed miner "$ON"; } || units="$units contentminer"
fi
on tracking && bins="$bins acr2"
on ads && bins="$bins adoverlay-service admanager"
on adapps && bins="$bins admanager"
for b in $bins; do
  for m in $(awk -v b="/usr/sbin/$b" 'substr($2,length($2)-length(b)+1)==b {print $2}' /proc/mounts | sort -r); do umount $m 2>/dev/null; done
done
for s in $units; do systemctl --no-block start $s.service; done
on ads || exit 0
# the copy in RAM that debloat-stop.sh mounts where /etc/hosts is read-only; otherwise the marked lines in /etc/hosts itself
HOSTS=${CYTV_HOSTS:-/etc/hosts}
if [ -e /tmp/cleanyourtv-hosts.mounted ]; then umount "$HOSTS" 2>/dev/null && rm -f /tmp/cleanyourtv-hosts /tmp/cleanyourtv-hosts.mounted; fi
if grep -q "# cleanyourtv-debloat" "$HOSTS"; then
  grep -v "# cleanyourtv-debloat" "$HOSTS" > /tmp/hosts.new && cat /tmp/hosts.new > "$HOSTS"; rm -f /tmp/hosts.new
fi
