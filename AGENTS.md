# CleanYourTV for LG webOS: briefing for AI assistants

Read this first when you help someone with this project, either to find out what is wrong on their TV or to fix a bug in the code.
The full documentation is in `docs/` (published at https://lancesandino.github.io/cleanyourtv-WebOS/); the page for you is `docs/ai.md`.

## What it is

A launcher that replaces LG's Home on a **rooted** LG webOS TV, plus a root service on the TV: Live TV from the user's own playlist, an Inputs
list on the remote's Input key, picture notifications, optional voice, themes, a debloat of LG's ads, and a manager app that sets up,
updates and removes everything. Everything is applied at boot with mounts in RAM; nothing under `/usr`, `/etc` or the firmware is changed on
disk, and a reboot without the boot scripts brings LG's Home back.

## Where things are

| Symptom or feature | Look at |
|---|---|
| The launcher page (home screen, menus, Live TV player) | `app/src/` (CSS and script per area; the older scripts are ES5), built into `app/index.html` by `tools/build-pages.js` |
| The root service: how the parts are wired | `helper/helper.js` (port 8765, loopback only), `helper/server.js` (origin, Host and API-token checks, `helper/apitoken.js`); one module per part (`docs/development/internals.md`) |
| Settings (`config.json`) and who changed them | `helper/config.js`: change settings only with `config.update(source, fn)`; changes are logged |
| Anything that differs between TVs (webOS version, firmware) | `helper/tvprofile.js`, also asked by `scripts/bootstrap.sh` |
| Apps, icons, usage, launching, running apps (Back on Home) | `helper/apps.js`, `helper/running.js` |
| Downloads, programs, luna, TV paths | `helper/fetch.js`, `helper/exec.js`, `helper/luna.js`, `helper/paths.js` |
| The manager app and its API (updates, options, keys) | `manager/src/` (built into `manager/app/index.html`), `helper/manager.js`, `helper/updates.js`, `helper/selfupdate.js` |
| The Input key, the Inputs list over the running app | `helper/inputkey.js`, `helper/inputhook.js`, `helper/picker.js`, `picker/app/`, `scripts/inputkey.sh` |
| Home takeover at boot, rollback, undo | `scripts/10-cleanyourtv-home`, `scripts/stage-home.sh`, `scripts/undo-home.sh`, `scripts/bootstrap.sh` |
| Live TV: playlist, guide, favourites | `helper/live.js` and `app/src/js/live.js` |
| Picture notifications | `notify/app/`, `helper/notify.js`, `helper/notifyapi.js` |
| Sonos soundbar volume on screen (read only) | `helper/sonos.js` (SSDP search, UPnP volume events), the volume bar in `notify/app/`, `helper/lgvolume.js` (hides LG's own volume bar meanwhile: configd `volumeOSD` through `helper/lgconfig.js`, in RAM), `manager/src/js/sonos.js`, `docs/sonos.md` |
| Voice (Moonshine, OpenRouter, Home Assistant) | `helper/voice.js` (microphone, recogniser), `helper/answers.js` (Assist, OpenRouter, your server), `voice/` |
| Themes | `helper/themeschema.js` (the schema), `helper/theme.js` (downloads), `themes/` (read from GitHub), `docs/themes.md` |
| Wallpapers | `helper/wallpapers.js` (library, phone page, Immich sync), `app/src/js/wall.js` (rotation on Home), `docs/wallpapers.md` |
| Continue watching (Home's first grid row) | `helper/watch.js` (Telemachus on 127.0.0.1:8770, pictures by id), `helper/plex.js` and `helper/stremio.js` (linked with a code), `helper/lgrows.js` (LG's own app rows from its content miner, no ads), `app/src/js/watch.js`, `docs/launcher.md` |
| Search on Home ("where to watch": a title in the apps' rows, an app's own search with the words, and Where to watch for any title) | `helper/search.js` (`/api/search` on the TV only, `/api/search/where`), `helper/where.js` (Plex's catalogue, Disney+, your Plex server, Cinemeta, Telemachus; the switch `search.where`), `helper/deeplinks.js` (Plex's affiliate links unwrapped, never opened; the apps' deep links), `helper/titles.js` (matching), `app/src/js/search.js`, `docs/launcher.md`, `docs/security.md` |
| Phone remote (a phone on the Wi-Fi as the remote) | `helper/remote.js` (pairing, keys per phone, the LAN server on 8794, LG's network input socket and keyboard service), `helper/remotepage.js` (the phone page), the manager's Phone remote screen, `docs/remote.md` |
| TV health (CPU per core, temperature, memory, ports and how each is guarded, services) | `helper/metrics.js` (`/api/metrics`, on demand, cached 2 s, never `/proc/loadavg`), `helper/exposure.js` (ports, the table of guards, services), `helper/statusdata.js` and `helper/statuspage.js` (the phone remote's TV tab, paired key only), `manager/src/js/health.js`, `docs/security.md` |
| Screensaver, photo feed | `app/src/js/saver.js` (idle, LG's screensaver request, Left/Right), `helper/photofeed.js` (a server's read-only photo feed, small cache, saved round), `docs/screensaver.md` (with the feed contract) |
| LG's settings changed in RAM (configd layer `/var/run/tvconfig/rmm`), LG's app pre-loading stopped | `helper/lgconfig.js`, `helper/lgpreload.js` (a debloat group; the preload manager's own setPreloadPolicy, in its memory), `docs/debloat.md` |
| The report people attach to issues | `helper/sharelog.js` (`node sharelog.js --print` prints it) |
| Node 8 compatibility helpers (from before the webOS 25 floor, still used), diagnostics | `helper/netcompat.js`, `helper/diag.js` |
| Build and checks | `ipk/build.py`, `tools/build-pages.js`, `tools/check.sh`, the tests in `tools/test/` |

## Facts about the TV that matter

- Test TV: LG OLED65G26LA, webOS 25 (SDK 10), Node.js 16.20 and Chromium 120. **webOS 25 is the oldest version this fork supports**
  (DECISIONS.md D-20261029-3; `FLOOR` in `helper/tvprofile.js`): `install.sh` and `bootstrap.sh` refuse an older TV before they change
  anything. webOS 26 (SDK 11) has Node.js 20 and Chromium 132. The userland is 32-bit ARM on a 64-bit kernel.
- The root filesystem, `/usr` and `/etc` are read-only. Writable: `/media/developer`, `/var`, `/tmp`. Use bind mounts, never write into `/usr`.
- Where things are on the TV: `/media/developer/cleanyourtv/` (service files, `config.json`, `app/`, `live/`, `themes/`, `backup/`),
  `/var/lib/webosbrew/init.d/` (boot scripts, run by the Homebrew Channel), `/media/developer/cytv-setup.log` (setup log),
  `/tmp/cleanyourtv-helper.log` (service log), `/tmp/lginput-hook-lginput2.log` (input hook).
- Root SSH works with a key (`ssh root@<tv-ip>`). `luna-send` must have stdin redirected: `luna-send -n 1 -w 5000 -f <uri> '<json>' </dev/null`.
- The service listens on `127.0.0.1:8765` (use `curl` on the TV). Other ports: 8766 Live TV pairing, 8767 network notifications (opt-in),
  8768+ share log, 8769 voice setup, and a port the system picks for the Sonos volume's events (opt-in). These are short-lived or off by
  default.
- Going back to LG's Home: manager app > CleanYourTV as Home off, or `sh /media/developer/cleanyourtv/undo-home.sh`. If a boot crashes,
  the Homebrew Channel's failsafe mode skips the boot scripts.
- A TV's own state can be the problem: a stuck media pipeline (black video, no sound) is cleared by a reboot; check
  `luna://com.webos.media/getActivePipelines` before blaming the code.

## Rules

1. **Do not touch the user's TV without being asked.** Start read-only (`tools/diagnose.sh`, the report, `ps`, `cat`, `luna-send` queries).
   Propose every change (restart, edit, install, delete) and wait for a yes, and name the command that undoes it. Never reboot, uninstall,
   delete files or change boot scripts on your own.
2. **Never put private data in the repository, an issue or a pull request:** no playlist addresses, access keys, tokens, IP addresses,
   user or device names, webhook addresses. Mask them. `tools/diagnose.sh` and Share log already mask what they can; read the output.
3. **The service runs on Node.js 16** (webOS 25 has 16.20.2): nothing newer, such as global `fetch`, `structuredClone`, `findLast`,
   `toSorted` or `Object.groupBy` (`tools/test/service.test.js` lists them). Start programs through `helper/exec.js`. The Node 8
   helpers (`helper/netcompat.js`, `diag.execFile`) still work and stay until they are cleaned up; new code may use Node 16's own.
   **The pages run in Chromium 120** (webOS 25): new code may use what it has (ES2023, flex `gap`, `:has()`, ...); the older ES5 scripts
   are not rewritten for its own sake. Only transform and opacity animate (the GPU is weak).
4. **A fix needs a test** in `tools/test/` (the file of that area) when it can be tested without a TV, and everything must pass:
   `sh tools/check.sh` (the tests on the current Node, the built pages, types and lint; `--chromium` adds the pages in Chromium 120).
   `tools/test/api.test.js` compares every API reply with a recorded one: a reply that changes needs a reason. Say plainly what was
   checked on a real TV and what was not.
5. **Documentation must match the code.** Change the page in `docs/` when behaviour changes, and the README if it is mentioned there.
6. **Licence:** the project is MIT. Do not copy code from GPL projects; describe behaviour and write your own.
7. **Do not release, tag, force-push or change repository settings.** The maintainer does that. Work on a branch and open the pull request
   against `dev`; once merged, every push to `dev` publishes the dev build (the pre-release `dev`), which people can install from the
   manager app (Update channel > Dev builds). In this fork a release goes out from `dev` when the maintainer runs the Release
   workflow by hand (there is no daily schedule).

## Commands

```sh
sh tools/check.sh                  # every check: the tests on the current Node, built pages, types and lint
sh tools/check.sh --chromium       # also the pages in Chromium 120 (webOS 25), Chrome for Testing's headless shell; on macOS in the
                                   # Linux container when Docker runs (Chrome 120 for macOS does not start on macOS 26)
CYTV_CHROMIUM_IMAGE=ubuntu:26.04 sh tools/check.sh --chromium   # the same in a Linux container, as CI does (Docker)
npm install                        # once: TypeScript, ESLint and Prettier for check.sh (development only, nothing is shipped)
npm run format                     # formats the code (Prettier) and rebuilds the pages
node tools/test.js live            # one area of tests (the files in tools/test)
node tools/build-pages.js          # builds app/index.html and manager/app/index.html from app/src and manager/src
python3 ipk/build.py               # writes dist/: the package, the launcher bundle (.sha256 files) and the Homebrew Channel apps.json
node tools/theme-docs.js           # regenerates the settings table in docs/themes.md from helper/themeschema.js
node tools/theme-index.js          # writes themes/index.json
node tools/theme-preview.mjs <id>  # renders a theme in headless Chrome (Node 22+)
node tools/doc-shots.mjs --write   # remakes docs/screenshots of the phone remote, hub, Search, TV health, saver (made-up data)
sh tools/diagnose.sh <tv-ip> > cytv-diagnose.txt   # read-only report from a TV over SSH
sh tools/perf-tv.sh <tv-ip>        # read-only timings from a TV: launcher, Input key, Live TV
```

## Things that have gone wrong before (check these first)

- A hidden overlay app can keep the remote (webOS 6.5); the Input key then starts the picker on demand and closes it. The `running` list of
  the app manager lags by seconds after a start or close: do not make decisions from one reading.
- Closing from the page (`window.close`, `PalmSystem.hide`) does nothing on some builds: the service closes apps with
  `applicationManager/closeByAppId`.
- Node's `timeout` option on child processes is avoided on purpose (a `uv_close` assertion on Node 8); use `diag.execFile`. After an abnormal
  exit the next start logs the last operations (`/tmp/cytv-run.json`); they appear in the report.
- `bootstrap.sh` copies only `helper/*.js` and `scripts/*` to the TV. Anything else the service needs must be copied there too, or be read
  from somewhere else (themes are read from GitHub for that reason).
- Update checks and downloads must always end: a dropped connection emits `aborted` on the response, not an error on the request.
- webOS 5's Chromium can leave old text in the compositor when a list is redrawn: the launcher swaps elements instead of rewriting them.
- Settings were lost when two parts read and rewrote `config.json` around each other (issues 6, 7): use `config.update`, which logs
  every change of an option or key with its source.
- A per-TV rule written in a module or a script drifts from the others: put it in `helper/tvprofile.js`.
- Edit the pages in `app/src` and `manager/src`, then `node tools/build-pages.js`; the built files are what the TV loads.
- Themes are data; a theme must never contain CSS or script. The schema in `helper/themeschema.js` is the only source of what a theme can set.
