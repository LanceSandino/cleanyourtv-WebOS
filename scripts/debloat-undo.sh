#!/bin/sh
# Undo debloat-stop.sh: restart the systemd daemons, remove the stubs and the hosts lines (dynamic services start on demand again).
# sh debloat-undo.sh [group...]: only those groups (ads, adapps, tracking, logs, suggestions, lan, miner, lgservers, see
# debloat-stop.sh); without arguments all. Undoing ads frees admanager too (adapps holds only while ads is on). LG's content miner
# starts again only when no group still holds it: suggestions still on, or the opt-in miner still on.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
CFG=$(node -e 'try{var o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).options||{};console.log((o.debloatOff||[]).join(" ")+"|"+(o.debloatOn||[]).join(" "))}catch(e){}' $L/config.json 2>/dev/null)
OFF=${CFG%%|*}; ON=${CFG#*|}
G=" ${*:-ads tracking logs suggestions adapps lan miner lgservers} "
on() { case "$G" in *" $1 "*) return 0 ;; esac; return 1; }
listed() { case " $2 " in *" $1 "*) return 0 ;; esac; return 1; }
units=""; bins=""
# uploadd is started on demand again (ls-hubd); rdxd only by systemd
on logs && { units="$units remotelogger service-logger rdxd"; bins="$bins uploadd"; }
# nudge is LG's systemd daemon: unstubbed, then started (nothing else would start it before the next restart)
on suggestions && { units="$units nudge"; bins="$bins sportsalarm nudge"; }
on miner && bins="$bins contentminer"
if on suggestions || on miner; then
  { ! on suggestions && ! listed suggestions "$OFF"; } || { ! on miner && listed miner "$ON"; } || units="$units contentminer"
fi
on tracking && bins="$bins acr2 livepick-plus"
on ads && bins="$bins adoverlay-service admanager"
on adapps && bins="$bins admanager"
on lan && units="$units cups-lpd.socket ninfod"
for b in $bins; do
  for m in $(awk -v b="/usr/sbin/$b" 'substr($2,length($2)-length(b)+1)==b {print $2}' /proc/mounts | sort -r); do umount $m 2>/dev/null; done
done
for s in $units; do
  case $s in *.*) u=$s ;; *) u=$s.service ;; esac
  systemctl --no-block start $u
done
# the hosts lines (debloat-hosts.sh): only those of the groups that stay on (ads not switched off, lgservers still switched on)
on ads || on lgservers || exit 0
keep=""
! on ads && ! listed ads "$OFF" && keep="ads"
! on lgservers && listed lgservers "$ON" && keep="$keep lgservers"
sh $L/debloat-hosts.sh $keep
