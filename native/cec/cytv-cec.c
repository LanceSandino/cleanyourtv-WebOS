/* cytv-cec: listens to the TV's HDMI-CEC line and prints what the soundbar says about its volume (helper/hdmivolume.js reads it).
 *
 * Listen only, by construction: the line is opened in the kernel's monitor mode without taking an address (CEC_MODE_NO_INITIATOR |
 * CEC_MODE_MONITOR), so this program can send nothing and LG's own HDMI control keeps answering every message as before.
 *
 * Output, one line each, to standard output:
 *   ready                 listening
 *   key <hex>             the TV sent the soundbar a remote key (<User Control Pressed>: 41 volume up, 42 volume down, 43 mute)
 *   audio <volume> <mute> the soundbar (the audio system, logical address 5) reported its volume, 0-100, and mute, 0 or 1
 *                         (<Report Audio Status>): it does so by itself right after each volume key, and when LG asks
 * Exit status: 2 when this TV has no CEC line or does not allow listening (nothing to retry), 1 when the line went away.
 * It ends with the service that started it (PR_SET_PDEATHSIG). Usage: cytv-cec [device], /dev/cec0 by default.
 *
 * It uses no C library (the kernel's system calls directly, for 32-bit ARM EABI): one small static program that runs on every webOS
 * version, whatever its C library, with nothing to license but this file. Built by native/build.sh; its checksum is in
 * native/SHA256SUMS. */
#include <asm/unistd.h>
#include <linux/ioctl.h>
#include <linux/cec.h>
#include <linux/errno.h>
#include <linux/fcntl.h>
#include <linux/prctl.h>
#include <linux/signal.h>

#define AUDIO_SYSTEM 5
#define TV 0
#define USER_CONTROL_PRESSED 0x44
#define REPORT_AUDIO_STATUS 0x7a

/* a system call: number in r7, arguments in r0-r3, result in r0 (a negative errno on failure) */
static long sys(long n, long a, long b, long c) {
  register long r0 __asm__("r0") = a;
  register long r1 __asm__("r1") = b;
  register long r2 __asm__("r2") = c;
  register long r7 __asm__("r7") = n;
  __asm__ volatile("svc #0" : "+r"(r0) : "r"(r1), "r"(r2), "r"(r7) : "memory");
  return r0;
}
static void out(int fd, const char *s) {
  long n = 0;
  while (s[n]) n++;
  sys(__NR_write, fd, (long)s, n);
}
/* "audio 22 0\n", "key 41\n": a number up to 999 or two hex digits after a word (counted down: no division, so no libgcc) */
static char *dec(char *p, unsigned v) {
  unsigned h = 0, t = 0;
  while (v >= 100) v -= 100, h++;
  while (v >= 10) v -= 10, t++;
  if (h) *p++ = '0' + h;
  if (h || t) *p++ = '0' + t;
  *p++ = '0' + v;
  return p;
}
static char *word(char *p, const char *w) {
  while (*w) *p++ = *w++;
  return p;
}
static void fail(const char *what, long e, int code) {
  out(2, "cytv-cec: ");
  out(2, what);
  out(2, e == -ENOENT ? ": No such file or directory\n" : e == -EPERM || e == -EACCES ? ": not allowed\n" : ": error\n");
  sys(__NR_exit, code, 0, 0);
}

static int run(const char *dev) {
  sys(__NR_prctl, PR_SET_PDEATHSIG, SIGTERM, 0);
  if (sys(__NR_getppid, 0, 0, 0) == 1) return 1; /* the service ended before this started */
  long fd = sys(__NR_open, (long)dev, O_RDWR, 0);
  if (fd < 0) fail(dev, fd, 2);
  unsigned mode = CEC_MODE_NO_INITIATOR | CEC_MODE_MONITOR;
  long r = sys(__NR_ioctl, fd, CEC_S_MODE, (long)&mode);
  if (r < 0) fail("listening", r, 2);
  out(1, "ready\n");
  for (;;) {
    struct cec_msg m;
    for (unsigned i = 0; i < sizeof m; i++) ((volatile char *)&m)[i] = 0;
    m.timeout = 60000;
    r = sys(__NR_ioctl, fd, CEC_RECEIVE, (long)&m);
    if (r == -ETIMEDOUT || r == -EAGAIN || r == -EINTR) continue;
    if (r < 0) fail(dev, r, 1);
    if (m.len < 3) continue;
    unsigned from = m.msg[0] >> 4, to = m.msg[0] & 15;
    char line[32], *p = line;
    if (from == AUDIO_SYSTEM && m.msg[1] == REPORT_AUDIO_STATUS) {
      unsigned vol = m.msg[2] & 0x7f; /* 0x7f: the soundbar does not know */
      if (vol > 100) continue;
      p = dec(word(p, "audio "), vol);
      p = dec(word(p, " "), m.msg[2] >> 7);
    } else if (from == TV && to == AUDIO_SYSTEM && m.msg[1] == USER_CONTROL_PRESSED) {
      p = word(p, "key ");
      *p++ = "0123456789abcdef"[m.msg[2] >> 4];
      *p++ = "0123456789abcdef"[m.msg[2] & 15];
    } else
      continue;
    *p++ = '\n';
    *p = 0;
    out(1, line);
  }
}

/* the program's entry: the kernel leaves argc at sp, then argv */
__attribute__((used)) static void start(long *sp) {
  const char *dev = sp[0] > 1 ? (const char *)sp[2] : "/dev/cec0";
  sys(__NR_exit, run(dev), 0, 0);
}
__asm__(".text\n.global _start\n_start:\n mov r0, sp\n bl start\n");
