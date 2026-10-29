#!/bin/sh
# The page checks in old Chromium (tools/oldchrome.js) inside a Linux container with only what those builds need: their libraries and
# one family of fonts. GitHub's newer runner images crash the old Chromium builds now and then (pages that never draw), and Chromium 79
# for macOS crashes on new macOS; in a plain Ubuntu container both engines run as they do for webOS 5 and 6. check.sh --chromium runs
# this when CYTV_CHROMIUM_IMAGE names the image (for example ubuntu:26.04); the old Chromium builds are kept in the same cache as
# without a container (~/.cache/cleanyourtv), and screenshots go to CYTV_SHOTS when it is set.
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
docker run --rm --platform linux/amd64 -v "$PWD":/w -v "$cache":/cache/cleanyourtv -e XDG_CACHE_HOME=/cache $shots -w /w "$img" sh -c '
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends curl unzip ca-certificates nodejs >/dev/null
for p in libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 libpangocairo-1.0-0 libgtk-3-0t64 libxss1 libxtst6 fonts-liberation; do
  apt-get install -y -qq --no-install-recommends $p >/dev/null 2>&1 || echo "not installed: $p"
done
echo "old Chromium in $(. /etc/os-release; echo "$PRETTY_NAME"), Node $(node --version)"
node tools/oldchrome.js ${SHOTS:+--shots "$SHOTS"} "$@"
' sh "$@"
