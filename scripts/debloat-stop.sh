#!/bin/sh
# Stop LG telemetry/ad daemons and keep the on-demand ones from starting (RAM-only; a reboot restores them unless run from init.d).
# Six groups, each can be switched off in the manager (options.debloatOff in config.json lists the ones that are off):
#   ads          adoverlay-service and the ad servers in /etc/hosts
#   adapps       admanager, LG's ad service for apps: only while ads is on too (a TV that had ads off before keeps it); some apps
#                (HBO Max, issue 47 upstream) do not play without it, so it can be switched off on its own
#   tracking     acr2 (viewing tracking, LivePlus) and livepick-plus (LG's shopping overlays from what acr2 recognises; it follows
#                every app that opens)
#   logs         remotelogger, service-logger, and LG's crash and log reports: rdxd (makes them) and uploadd (sends them to LG)
#   suggestions  contentminer, nudge, sportsalarm
#   lan          LG's network services nobody uses: cups-lpd (an LPD print server on port 515 that takes jobs from anyone on the
#                network; the socket is systemd's) and ninfod (answers IPv6 node information queries with the TV's name and addresses)
# and two that are off unless switched on (options.debloatOn lists them):
#   miner        LG's content miner stopped and kept from starting again until the next restart, so it does not ask LG's servers for
#                its rows
#   lgservers    LG's servers for its online services blocked in /etc/hosts (debloat-hosts.sh): LG's picks, LG Channels, LG's voice
#                service, LG sign-in, ThinQ, sports, shopping, nudges, Live TV's viewing statistics, remote diagnostics
# At boot it runs as soon as the boot scripts start, before LG's activity manager starts the on-demand services, and once more when
# LG's boot is done (15-cleanyourtv-debloat). A program that LG would start later (nudge at the end of LG's boot, the on-demand
# services) finds the stub in its place.
# sh debloat-stop.sh [group...]: only those groups; without arguments every group that is on.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
CFG=$(node -e 'try{var o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).options||{};console.log((o.debloatOff||[]).join(" ")+"|"+(o.debloatOn||[]).join(" "))}catch(e){}' $L/config.json 2>/dev/null)
OFF=${CFG%%|*}; ON=${CFG#*|}
if [ $# -gt 0 ]; then G=" $* "; else G=" ads tracking logs suggestions adapps lan miner lgservers "; fi
off() { case " $OFF " in *" $1 "*) return 0 ;; esac; return 1; }
optin() { case " $ON " in *" $1 "*) return 0 ;; esac; return 1; }
on() { case "$G" in *" $1 "*) off "$1" && return 1; return 0 ;; esac; return 1; }
units=""; bins=""; stubs=""
on logs && { units="$units remotelogger service-logger rdxd"; bins="$bins uploadd"; }
# nudge ignores SIGTERM (systemd's stop waited its 90 s): stubbed and killed instead, and LG starts the stub at the end of its boot
on suggestions && { units="$units contentminer"; bins="$bins sportsalarm nudge"; }
# the miner is a systemd daemon: stopped by systemd (it ends on its own), its program stubbed so that nothing can start it again
on miner && optin miner && { units="$units contentminer"; stubs="$stubs contentminer"; }
on tracking && bins="$bins acr2 livepick-plus"
on ads && bins="$bins adoverlay-service"
{ on ads || on adapps; } && ! off ads && ! off adapps && bins="$bins admanager"
on lan && units="$units cups-lpd.socket ninfod"
# --no-block: contentminer can take a minute to stop, which held up the rest of the script (and the manager waiting for it)
for s in $units; do
  case $s in *.*) u=$s ;; *) u=$s.service ;; esac
  systemctl --no-block stop $u 2>&1 | sed "s/^/$s: /"
done
# luna dynamic services: bind a do-nothing stub over the binary so ls-hubd cannot start them. The stub is written only when it is
# missing or different, beside it and renamed into place: it is mounted over LG's programs and may be running (D-20261029-2)
STUB='#!/bin/sh
exit 0'
if [ "$(cat $L/stub-noop 2>/dev/null)" != "$STUB" ] || [ ! -x $L/stub-noop ]; then
  printf '%s\n' "$STUB" > $L/stub-noop.new && chmod +x $L/stub-noop.new && mv -f $L/stub-noop.new $L/stub-noop
fi
for b in $stubs; do
  [ -e /usr/sbin/$b ] && ! grep -q " /usr/sbin/$b " /proc/mounts && mount --bind $L/stub-noop /usr/sbin/$b
done
for b in $bins; do
  [ -e /usr/sbin/$b ] || continue
  grep -q " /usr/sbin/$b " /proc/mounts || mount --bind $L/stub-noop /usr/sbin/$b
  pkill -9 -f "^/usr/sbin/$b"
done
# the hosts lines (debloat-hosts.sh): written again for every group that is on, whichever was asked for
on ads || on lgservers || exit 0
keep=""; off ads || keep="ads"; optin lgservers && keep="$keep lgservers"
sh $L/debloat-hosts.sh $keep
