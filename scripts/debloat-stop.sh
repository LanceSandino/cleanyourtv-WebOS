#!/bin/sh
# Stop LG telemetry/ad daemons and keep the on-demand ones from starting (RAM-only; a reboot restores them unless run from init.d).
# Five groups, each can be switched off in the manager (options.debloatOff in config.json lists the ones that are off):
#   ads          adoverlay-service and the ad servers in /etc/hosts
#   adapps       admanager, LG's ad service for apps: only while ads is on too (a TV that had ads off before keeps it); some apps
#                (HBO Max, issue 47 upstream) do not play without it, so it can be switched off on its own
#   tracking     acr2 (viewing tracking, LivePlus)
#   logs         remotelogger, service-logger
#   suggestions  contentminer, nudge, sportsalarm
# and two that are off unless switched on (options.debloatOn lists them), applied as soon as the boot hook runs (15-cleanyourtv-debloat,
# not a minute later):
#   miner        LG's content miner stopped and kept from starting again until the next restart, so it does not ask LG's servers for
#                its rows
#   lgservers    LG's servers for its online services blocked in /etc/hosts (debloat-hosts.sh): LG's picks, LG Channels, LG's voice
#                service, LG sign-in, ThinQ, sports, shopping, nudges, Live TV's viewing statistics, remote diagnostics
# sh debloat-stop.sh [group...]: only those groups; without arguments every group that is on.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
CFG=$(node -e 'try{var o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).options||{};console.log((o.debloatOff||[]).join(" ")+"|"+(o.debloatOn||[]).join(" "))}catch(e){}' $L/config.json 2>/dev/null)
OFF=${CFG%%|*}; ON=${CFG#*|}
if [ $# -gt 0 ]; then G=" $* "; else G=" ads tracking logs suggestions adapps miner lgservers "; fi
off() { case " $OFF " in *" $1 "*) return 0 ;; esac; return 1; }
optin() { case " $ON " in *" $1 "*) return 0 ;; esac; return 1; }
on() { case "$G" in *" $1 "*) off "$1" && return 1; return 0 ;; esac; return 1; }
units=""; bins=""; stubs=""
on logs && units="$units remotelogger service-logger"
on suggestions && { units="$units contentminer nudge"; bins="$bins sportsalarm"; }
# the miner is a systemd daemon: stopped by systemd (it ends on its own), its program stubbed so that nothing can start it again
on miner && optin miner && { units="$units contentminer"; stubs="$stubs contentminer"; }
on tracking && bins="$bins acr2"
on ads && bins="$bins adoverlay-service"
{ on ads || on adapps; } && ! off ads && ! off adapps && bins="$bins admanager"
# --no-block: contentminer can take a minute to stop, which held up the rest of the script (and the manager waiting for it)
for s in $units; do systemctl --no-block stop $s.service 2>&1 | sed "s/^/$s: /"; done
# luna dynamic services: bind a do-nothing stub over the binary so ls-hubd cannot start them
printf '#!/bin/sh\nexit 0\n' > $L/stub-noop; chmod +x $L/stub-noop
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
