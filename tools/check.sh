#!/bin/sh
# Every check before a push or a release, in one command:
#   sh tools/check.sh
# 1. the tests (tools/test.js) under Node.js 12.21.0, the version on webOS 22, the oldest TV this fork supports (DECISIONS.md
#    D-20261101-1; downloaded once from nodejs.org, checksum verified, cached in ~/.cache/cleanyourtv; on an Apple-silicon Mac the x64
#    build runs through Rosetta). A test of something that does not run on the TV (the hub, on Node 22) is skipped there;
# 2. the same tests under the Node.js of this computer (16 or newer), when it is a different version;
# 3. the pages built from their sources are up to date (tools/build-pages.js --check), and the translations in i18n/ (tools/i18n.js:
#    how complete each language is; it fails only on a broken file);
#    types, lint and formatting (tools/lint.js), when the development tools are installed (npm install);
# 4. with --chromium: the pages in Chromium 87 and 120, the engines of webOS 22 and 25 (tools/oldchrome.js: a Chromium snapshot build
#    and Chrome for Testing's headless shell, about 230 MB downloaded once); with CYTV_CHROMIUM_IMAGE=ubuntu:26.04 in that Linux
#    container (tools/oldchrome-container.sh, needs Docker), which is also the default on macOS when Docker runs (Chrome 120 for macOS
#    does not start on macOS 26; Chromium 87 for macOS does, node tools/oldchrome.js --engine 87).
# Nothing is installed and nothing leaves this machine, apart from the downloads of Node.js 12.21.0 and the Chromium builds.
set -e
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js is needed for the checks"; exit 1; }
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 16 ] || { echo "Node.js $(node --version) is too old for the development tools: use Node.js 16 or newer"; exit 1; }
case "$(uname -s)-$(uname -m)" in
  Darwin-*)               P=darwin-x64;   H=4d0b5d07d41a16909fdeb41c3158c27bcdccf16231cccf76d5eb6835e2076e90 ;;
  Linux-x86_64)           P=linux-x64;    H=ab121de3c472d76ec425480b0594e43109ee607bd57c3d5314bdb65fa816bf1c ;;
  Linux-aarch64|Linux-arm64) P=linux-arm64; H=5748bfc5bbf7d9c1c8e79bd4f71d8f049c7fc7bc5b52e04685633319843c4f93 ;;
  Linux-armv7l)           P=linux-armv7l; H=6edc31a210e47eb72b0a2a150f7fe604539c1b2a45e8c81d378ac9315053a54f ;;
  *) echo "no Node.js 12.21.0 build known for $(uname -sm)"; exit 1 ;;
esac
C="${XDG_CACHE_HOME:-$HOME/.cache}/cleanyourtv"; N12="$C/node-v12.21.0-$P/bin/node"
if [ ! -x "$N12" ]; then
  mkdir -p "$C"; T=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/v12.21.0/node-v12.21.0-$P.tar.gz" -o "$T/n.tgz"
  G=$( (sha256sum "$T/n.tgz" 2>/dev/null || shasum -a 256 "$T/n.tgz") | cut -d' ' -f1)
  [ "$G" = "$H" ] || { echo "checksum mismatch for the Node.js 12.21.0 download"; rm -rf "$T"; exit 1; }
  tar -xzf "$T/n.tgz" -C "$C"; rm -rf "$T"
fi
echo "== tests on Node $("$N12" --version) (webOS 22)"
"$N12" tools/test.js --quiet
if [ "$(node --version)" != "$("$N12" --version)" ]; then
  echo; echo "== tests on Node $(node --version)"
  node tools/test.js --quiet
fi
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
  echo; echo "== pages in Chromium 87 and 120 (webOS 22 and 25)"
  # in a Linux container when CYTV_CHROMIUM_IMAGE names one (the CI workflows): tools/oldchrome-container.sh. On macOS that is the
  # default when Docker runs: Chrome 120 for macOS stops at start on macOS 26 (node tools/oldchrome.js still tries it on its own)
  if [ -z "$CYTV_CHROMIUM_IMAGE" ] && [ "$(uname -s)" = Darwin ] && command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    CYTV_CHROMIUM_IMAGE=ubuntu:26.04; echo "macOS: the pages run in the Linux container $CYTV_CHROMIUM_IMAGE (Docker)"
  fi
  if [ -n "$CYTV_CHROMIUM_IMAGE" ]; then sh tools/oldchrome-container.sh "$CYTV_CHROMIUM_IMAGE"
  else node tools/oldchrome.js ${CYTV_SHOTS:+--shots "$CYTV_SHOTS"}
  fi
fi
echo; echo "all checks passed"
