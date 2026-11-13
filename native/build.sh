#!/bin/sh
# Builds the service's native programs for the TV's 32-bit ARM userland (static and without a C library, so they need nothing from
# the TV) in a Debian container with its ARM cross compiler, and writes their checksums to native/SHA256SUMS (tools/test/
# hdmivolume.test.js checks that the committed binaries match). The C library's headers are only read (linux/cec.h includes
# string.h); nothing of it is linked in. Needs Docker. Usage: sh native/build.sh
set -eu
cd "$(dirname "$0")/.."
docker run --rm --platform linux/amd64 -v "$PWD/native:/native" debian:bookworm-slim sh -c '
  set -e
  apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends gcc-arm-linux-gnueabihf libc6-dev-armhf-cross >/dev/null
  # no C library: -nostdlib, ARM (not Thumb) code so r7 can carry the system call number, nothing else linked
  arm-linux-gnueabihf-gcc -std=gnu99 -Os -marm -ffreestanding -fno-builtin -fno-stack-protector -fomit-frame-pointer -Wall -Wextra -Werror \
    -nostdlib -static -s -Wl,--build-id=none -o /native/cec/cytv-cec /native/cec/cytv-cec.c
'
(cd native && shasum -a 256 cec/cytv-cec > SHA256SUMS)
cat native/SHA256SUMS
