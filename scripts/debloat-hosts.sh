#!/bin/sh
# The debloat's lines in /etc/hosts, for the groups named; the lines of the others are removed (debloat-stop.sh and
# debloat-undo.sh call it with the groups that are on). sh debloat-hosts.sh [ads] [lgservers]; without arguments all lines go.
#   ads        LG's ad servers (resolved and verified as LG ad endpoints), and those of this TV's country: LG names them
#              <country>.ad.lgsmartad.com and <country>.info.lgsmartad.com (own-your-glass saw es. on a Spanish TV), the country from
#              LG's Smart Service setting
#   lgservers  LG's servers for its online services, as LG's sdx names them on this TV (com.webos.service.sdx/getServerUrl): the
#              region's tv.wiselg.com (LG's picks for Home, LG Channels, LG's voice service, LG sign-in, sports, shopping, nudges,
#              quick cards), Live TV's viewing statistics (ibsstat), remote diagnostics (rdx2) and ThinQ (lgtviot), with the region's
#              LG Channels and ThinQ hosts. The app store, LG's sign-in tokens for apps, firmware updates and the internet check
#              (nextlgsdp.com itself, snu.lge.com, lgtvonline.lge.com) are not among them. What sdx named last is kept in
#              lgservers-hosts, for a start at which sdx does not answer yet.
# Every line ends in "# cleanyourtv-debloat" (debloat-undo.sh and older releases remove them by that). Where /etc/hosts is on the
# read-only system partition (issue 11) a copy in RAM (/tmp/cleanyourtv-hosts) is mounted over it until the next restart, and
# unmounted again when no line is left.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
L=/media/developer/cleanyourtv
HOSTS=${CYTV_HOSTS:-/etc/hosts}
M="# cleanyourtv-debloat"
G=" $* "
on() { case "$G" in *" $1 "*) return 0 ;; esac; return 1; }
ask() { luna-send -n 1 -w 4000 -f "$1" "$2" </dev/null 2>/dev/null; }
# only host names of LG's own domains go into the file, whatever an answer or the kept list holds
lg_only() { tr 'A-Z' 'a-z' | tr ' ' '\n' | grep -E '^[a-z0-9][a-z0-9.-]*\.(wiselg|nextlgsdp|lgtviot|lgtvcommon|lgthinq)\.com$' | tr '\n' ' ' | sed 's/ *$//'; }
lines=""
line() { [ -n "$1" ] && lines="${lines}127.0.0.1 $1 $M
::1 $1 $M
"; }
if on ads; then
  CC=$(ask luna://com.webos.settingsservice/getSystemSettings '{"category":"option","keys":["smartServiceCountryCode2"]}' \
    | sed -n 's/.*"smartServiceCountryCode2": *"\([A-Za-z][A-Za-z]\)".*/\1/p' | tr 'A-Z' 'a-z' | head -1)
  names="eic.ads.lgtvcommon.com nl.ad.lgsmartad.com nl.info.lgsmartad.com"
  [ -n "$CC" ] && [ "$CC" != nl ] && names="$names $CC.ad.lgsmartad.com $CC.info.lgsmartad.com"
  line "$names"
fi
if on lgservers; then
  got=$(for s in homeprv_secure ibis_stat_secure rdx_secure iot; do
    ask luna://com.webos.service.sdx/getServerUrl "{\"serviceName\":\"$s\"}" | sed -n 's/.*"baseUrl": *"https:\/\/\([A-Za-z0-9.-]*\)\/.*/\1/p'
  done | lg_only)
  ric=$(echo "$got" | tr ' ' '\n' | sed -n 's/^\([a-z0-9]*\)\.tv\.wiselg\.com$/\1/p' | head -1)
  if [ -n "$ric" ]; then
    got=$(echo "$got $ric.lgchhomeapp.lgtvcommon.com $ric.cdplauncher.lgtvcommon.com $ric.cdpsvc.lgtvcommon.com" \
      "$ric.cdpbeacon.lgtvcommon.com $ric-connect-client.lgthinq.com connect-client.lgthinq.com" | lg_only)
    [ "$(cat $L/lgservers-hosts 2>/dev/null)" = "$got" ] || echo "$got" > $L/lgservers-hosts
  else
    got=""; [ -f $L/lgservers-hosts ] && got=$(lg_only < $L/lgservers-hosts)
    [ -n "$got" ] || echo "hosts: LG's sdx did not name its servers yet; LG's online services are not blocked"
  fi
  line "$got"
fi
want=$(printf '%s' "$lines")
[ "$(grep -F "$M" "$HOSTS")" = "$want" ] && exit 0
# the file without our lines: the TV's own under the copy in RAM, when that is mounted
if [ -e /tmp/cleanyourtv-hosts.mounted ]; then
  umount "$HOSTS" 2>/dev/null && rm -f /tmp/cleanyourtv-hosts /tmp/cleanyourtv-hosts.mounted
fi
grep -vF "$M" "$HOSTS" > /tmp/hosts.new
[ -n "$want" ] && printf '%s\n' "$want" >> /tmp/hosts.new
if cat /tmp/hosts.new > "$HOSTS" 2>/dev/null; then
  rm -f /tmp/hosts.new
elif [ -n "$want" ]; then
  mv /tmp/hosts.new /tmp/cleanyourtv-hosts && mount --bind /tmp/cleanyourtv-hosts "$HOSTS" && touch /tmp/cleanyourtv-hosts.mounted \
    || echo "hosts: /etc/hosts cannot be changed on this TV; the servers are not blocked"
else
  rm -f /tmp/hosts.new
fi
