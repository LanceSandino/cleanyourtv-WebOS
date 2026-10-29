#!/bin/sh
# Every check before a push or a release, in one command:
#   sh tools/check.sh
# 1. the tests (tools/test.js) under the Node.js of this computer. The TV has Node.js 16 (webOS 25, the oldest TV this fork supports:
#    DECISIONS.md D-20261029-3); tools/test/service.test.js catches what a newer Node has and Node 16 does not;
# 2. the pages built from their sources are up to date (tools/build-pages.js --check), and the translations in i18n/ (tools/i18n.js:
#    how complete each language is; it fails only on a broken file);
#    types, lint and formatting (tools/lint.js), when the development tools are installed (npm install);
# 3. with --chromium: the pages in Chromium 120, the engine of webOS 25 (tools/oldchrome.js: Chrome for Testing's headless shell 120,
#    about 90 MB downloaded once); with CYTV_CHROMIUM_IMAGE=ubuntu:26.04 in that Linux container (tools/oldchrome-container.sh, needs Docker).
# Nothing is installed and nothing leaves this machine, apart from the one Chromium download.
set -e
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js is needed for the checks"; exit 1; }
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 16 ] || { echo "Node.js $(node --version) is older than the TV's (16): use Node.js 16 or newer"; exit 1; }
echo "== tests on Node $(node --version)"
node tools/test.js --quiet
if [ -f tools/build-pages.js ]; then
  echo; echo "== pages"
  node tools/build-pages.js --check
fi
if [ -f tools/i18n.js ]; then
  echo; echo "== translations"
  node tools/i18n.js
fi
echo; echo "== types, lint, formatting"
node tools/lint.js
if [ "$1" = "--chromium" ]; then
  echo; echo "== pages in Chromium 120 (webOS 25)"
  # in a Linux container when CYTV_CHROMIUM_IMAGE names one (the CI workflows): tools/oldchrome-container.sh
  if [ -n "$CYTV_CHROMIUM_IMAGE" ]; then sh tools/oldchrome-container.sh "$CYTV_CHROMIUM_IMAGE"
  else node tools/oldchrome.js ${CYTV_SHOTS:+--shots "$CYTV_SHOTS"}
  fi
fi
echo; echo "all checks passed"
