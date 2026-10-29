#!/bin/sh
# The page checks in Chromium 120 (tools/oldchrome.js) inside a Linux container with only what that build needs: its libraries and one
# family of fonts, so CI and a Mac get the same engine on the same system (GitHub's runner images change under it, and they once crashed
# the older Chromium builds now and then). check.sh --chromium runs this when CYTV_CHROMIUM_IMAGE names the image (for example
# ubuntu:26.04); the Chromium build is kept in the same cache as without a container (~/.cache/cleanyourtv), and screenshots go to
# CYTV_SHOTS when it is set.
#   CYTV_CHROMIUM_IMAGE=ubuntu:26.04 sh tools/check.sh --chromium        or        sh tools/oldchrome-container.sh ubuntu:26.04 [args]
# Needs Docker.
set -e
cd "$(dirname "$0")/.."
img=${1:-${CYTV_CHROMIUM_IMAGE:-ubuntu:26.04}}
[ $# -gt 0 ] && shift
cache="${XDG_CACHE_HOME:-$HOME/.cache}/cleanyourtv"
mkdir -p "$cache"
shots=""
if [ -n "$CYTV_SHOTS" ]; then
  mkdir -p "$CYTV_SHOTS"
  shots="-v $CYTV_SHOTS:/shots -e SHOTS=/shots"
fi
# shellcheck disable=SC2086
# the files it writes (the Chromium build in the cache, the screenshots) are handed back to this user afterwards: as root's they could not be
# read by the CI's upload or cache steps
docker run --rm --platform linux/amd64 -v "$PWD":/w -v "$cache":/cache/cleanyourtv -e XDG_CACHE_HOME=/cache -e OWNER="$(id -u):$(id -g)" $shots -w /w "$img" sh -c '
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends curl unzip ca-certificates nodejs >/dev/null
for p in libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 libdrm2 libdbus-1-3 libgbm1 libasound2t64 libpangocairo-1.0-0 libgtk-3-0t64 libxss1 libxtst6 fonts-liberation; do
  apt-get install -y -qq --no-install-recommends $p >/dev/null 2>&1 || echo "not installed: $p"
done
echo "Chromium 120 in $(. /etc/os-release; echo "$PRETTY_NAME"), Node $(node --version)"
s=0
node tools/oldchrome.js ${SHOTS:+--shots "$SHOTS"} "$@" || s=$?
chown -R "$OWNER" /cache/cleanyourtv ${SHOTS:+"$SHOTS"} 2>/dev/null || true
exit $s
' sh "$@"
