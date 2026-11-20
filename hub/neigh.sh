#!/bin/sh
# Keeps each TV of the hub reachable by its MAC while it sleeps: a permanent neighbour entry on this host for every TV address in .env
# (TV_HOSTS, or TV_HOST), with the MAC the hub learned (data/tv-mac for the first TV, data/tv-mac-<address> for the others; TV_MAC in
# .env for the first, when set). A TV asleep on Wi-Fi for a while stops answering ARP, and the hub's wake packets sent to the TV's own
# address (server.js) then never leave this host. Run as root by cleanyourtv-hub-neigh.timer (at boot and every 30 minutes); running it
# again changes nothing. It prints the addresses it kept, never a MAC.
#   sh neigh.sh [<hub folder>]   (default: the folder this script is in)
set -u
D=${1:-$(dirname "$0")}
envval() { sed -n "s/^$1=//p" "$D/.env" 2>/dev/null | tail -1 | tr -d "\"' \r"; }
hosts=$(envval TV_HOSTS)
[ -n "$hosts" ] || hosts=$(envval TV_HOST)
first_mac=$(envval TV_MAC | tr 'A-F' 'a-f')
i=0
for ip in $(echo "$hosts" | tr ',' ' '); do
  if [ $i -eq 0 ]; then f="$D/data/tv-mac"; else f="$D/data/tv-mac-$(echo "$ip" | tr -c '0-9a-fA-F.\n' '_')"; fi
  mac=''
  [ $i -eq 0 ] && mac=$first_mac
  [ -n "$mac" ] || { [ -r "$f" ] && mac=$(tr -d ' \r\n' <"$f"); }
  i=$((i + 1))
  echo "$mac" | grep -Eq '^([0-9a-f]{2}:){5}[0-9a-f]{2}$' || { echo "neigh: $ip: no MAC learned yet (switch the TV on once while the hub runs)"; continue; }
  dev=$(ip -o route get "$ip" 2>/dev/null | sed -n 's/.* dev \([^ ]*\).*/\1/p' | head -1)
  [ -n "$dev" ] || { echo "neigh: $ip: no route"; continue; }
  if ip neigh replace "$ip" lladdr "$mac" dev "$dev" nud permanent; then echo "neigh: $ip kept by its MAC on $dev"; else echo "neigh: $ip: could not set it"; fi
done
