# Internals

## The pieces

| Piece | Runs as | Notes |
|---|---|---|
| The **service** (`helper.js` and modules) | Node.js, root, started by the boot script | Listens on `127.0.0.1:8765`; bridges the web pages to `luna-send` (LG's service bus), serves app icons, runs Live TV, notifications, voice, the manager API and the input hook. |
| The **launcher** (`app/index.html`) | A web app in LG's web runtime, mounted as LG's Home | Reads apps and settings from the service. |
| **Manager**, **picker**, **notify** | Web apps installed from the package | The picker and notify apps are hidden; the service starts them. |
| The **input hook** | Injected into LG's input processes | Runs a command when a bound remote key is pressed. |

## The service

`helper/helper.js` only wires the parts together. Each part is a module with `create(ctx)` that returns its name, the paths it answers
(`paths` or a `prefix`), `handle(req, res, path, body)` and an optional `start()`. A part that fails to load is left out and listed at
`GET /api/service`; the others keep working.

| Module | What it is |
|---|---|
| `paths.js` | Every place on the TV the service reads or writes; the tests move them with environment variables. |
| `config.js` | The settings in `config.json`. `config.update(source, fn)` reads, changes and writes in one step, so two parts never overwrite each other's settings; every change of an option, a learned key or the Input-key mode is logged with its source (`config: options.inputKey true -> false (manager)`), which shows up in Share log. |
| `tvprofile.js` | Everything that differs between TVs: the Input key's default mode, the notification window type, whether the firmware is in `compat.json`, whether LG's Home is a supported kind, how Home is taken over (`homeTakeover`) and which services are restarted after the app manager (`afterSam`). The service saves it in `tv.json` (`GET /api/tv`); the setup script asks the same rules (`node tvprofile.js get notifyWindow --sdk 10.2.2`). |
| `exec.js`, `luna.js`, `fetch.js` | The one way to start a program (time limits without Node's own `timeout` option, which can abort Node 8), to call `luna-send`, and to download (redirects, gzip, size and time limits, dropped connections). |
| `server.js`, `web.js` | The HTTP server with the origin rules, and small reply helpers. |
| `apps.js`, `running.js` | The app list, icons, usage, launching and the launcher's own settings; the running apps to close (Back on Home). |
| `inputkey.js`, `inputhook.js`, `picker.js` | The Input key: the hook in LG's input processes, the key binds, the Inputs picker. |
| `manager.js`, `updates.js`, `debloat.js` | The manager's API, updates from GitHub releases with rollback, switching the debloat. |
| `live.js`, `notify.js`, `notifyapi.js` | One feature each. |
| `sonos.js` | Sonos volume on screen: the SSDP search, the subscription to the speaker's volume events (its own event port while on) and the volume bar through `notify.js`. Read only: `GetVolume` and `GetMute` are the only actions it can send. |
| `lgconfig.js` | The service's overrides of LG's settings: one JSON file per namespace in the country folders of configd's RAM layer `/var/run/tvconfig/rmm`, a record in `/tmp` so only its own files are ever replaced or removed, then `reconfigure`. Used by `lgvolume.js`. |
| `lgvolume.js` | Hides LG's own volume bar while the Sonos volume shows: `volumeOSD` false through `lgconfig.js`. Only where `tvprofile.js` says `lgVolumeBar: 'configd'` (webOS 25). |
| `lgpreload.js` | The debloat group "Stop LG pre-loading apps": the preload manager's own `setPreloadPolicy` (`isEnabled` false) for every app it would pre-load but Home and the Homebrew Channel's, only for apps already allowed (the call marks an app allowed in LG's saved list); held in its memory, done again a few seconds after the service starts, on every change of the debloat (`debloat.onChange`) and every two minutes; switched back for exactly those apps. Only where `tvprofile.js` says `lgPreload: 'api'`. |
| `wallpapers.js` | Wallpapers: the photo library (uploads and Immich, apart on disk, with an index), the phone page on port 8791 and the Immich sync. |
| `cards.js`, `weather.js` | Cards: the shape check of the cards the launcher saves, the phone page on port 8792 where their options are typed, and the weather card's Open-Meteo requests (kept 30 minutes). |
| `theme.js`, `themeschema.js` | Themes: `themeschema.js` holds every setting a theme can make, the checks and how a theme becomes CSS variables; `theme.js` reads themes from GitHub and keeps them on the TV. |
| `voice.js`, `answers.js` | Voice: the microphone, the recogniser, the phone setup page; `answers.js` asks Home Assistant, a language model or your server. |
| `selfupdate.js`, `sharelog.js` | Programs the manager runs when the service is not running. |

## The pages

The launcher and the manager are built from source files: `app/src` and `manager/src` hold `index.html` with `@include` lines and the
CSS and script files they name. `node tools/build-pages.js` writes `app/index.html` and `manager/app/index.html`, the single files
the TV loads; the built files are committed, so an update and the theme preview read them as before. The picker and the notification
card are small and stay single files.

## How the launcher becomes Home

1. `10-cleanyourtv-home` runs at boot and starts the service.
2. `stage-home.sh` builds a directory holding the launcher plus an `appinfo.json` derived from this TV's own stock Home (saved in
   `backup/home-appinfo.orig.json` the first time), switched to the web type.
3. `tvprofile.js` decides the way from the stock Home's kind (`homeTakeover`):
    - `mount` (flutter or web Home, webOS 24 and newer): the script **bind-mounts** that directory over
      `/usr/palm/applications/com.webos.app.home`, restarts the system app manager (`sam`) so it reads the new Home, and launches
      Home again. On webOS before 7 and with a native Home, `after-sam.sh` then restarts the services that keep talking to the old
      app manager (`afterSam`).
    - `standin` (native Home, webOS 5 to 23): `jtool.js exe` finds LG's Home program in the stock `appinfo.json` and the script
      bind-mounts `home-standin.sh` over it, then stops LG's running Home once. `sam` is not restarted and keeps LG's Home manifest,
      so it starts the stand-in for Home. The stand-in sends `wam-launch.json` (written by `stage-home.sh` with `jtool.js wamlaunch`) to
      `com.palm.webappmanager/launchApp`, which opens the directory from step 2 as `com.webos.app.home`, and holds a registration
      with `sam` so the Home key sends it `relaunch`. Without registration, `sam` restarts the stand-in on the Home key, which opens
      the launcher the same way. `/tmp/cleanyourtv-home-standin` holds the program's path while it is mounted; `reload-home.sh`,
      `undo-home.sh`, the debloat hook and the manager's status read it. If `webapp-mgr` does not list the launcher within 30
      seconds, `undo-home.sh temp` brings LG's Home back. `home-method` holding `mount` forces the first way.
4. A **watchdog** (`watchdog.sh`, one per boot) keeps checking that the service answers. When the service has stopped, it starts it
   again (also while LG's Home is back, but not while `bootstrap.sh` runs), notes that in `/tmp/cleanyourtv-boot.log` and keeps the
   log of the run that ended as `/tmp/cleanyourtv-helper.crash.log`. If the service stays unreachable for about a minute while our
   launcher is Home, it restores LG's Home until the next reboot.

Nothing is written under `/usr`: the mount disappears at reboot. `DISABLE` in `/media/developer/cleanyourtv` makes the script skip it.

## Updates and rollback

- **Launcher.** The manager downloads `frontend-<version>.tgz` and its `.sha256`, checks the list of files in the archive (only
  `app/...`), unpacks, checks `version.json`, swaps it in (the old one becomes `app.prev`), reloads Home and waits up to 40 seconds
  for the new launcher to report that it started. If it does not, the previous launcher is swapped back.
- **Service.** The manager downloads the package, installs it with the system's app installer and runs `bootstrap.sh update`,
  which keeps the running files in `backup/service-prev.tgz`, copies the new ones, restarts the service and waits for it to answer
  with the new version. If it does not, the previous files are restored.
- **Dev builds.** Same flows, from the pre-release `dev`; the commit in a `BUILD` file is how two builds with one version number are told apart.

## Supported webOS versions

This fork supports **webOS 25 (SDK 10) and newer** ([DECISIONS.md](https://github.com/LanceSandino/cleanyourtv-WebOS/blob/main/DECISIONS.md),
D-20261029-3). webOS 25 ships Node.js 16.20 and Chromium 120, webOS 26 Node.js 20 and Chromium 132. The floor is `FLOOR` in
`helper/tvprofile.js` (the `supported` and `floor` decisions); `scripts/bootstrap.sh` checks the TV's Node.js and webOS version before
it changes anything, and `install.sh` checks the same numbers before it downloads the package. An update that reaches an older TV is
refused the same way and noted in `last-error.txt`, so the service keeps running its version.

The code still carries what the older versions needed, until it is cleaned up:

- `helper/netcompat.js` supplies `URL`, `URLSearchParams`, `crypto.randomInt`, `mkdir -p` and the `http(s).get(url, options)` form,
  which Node.js 8 lacked; the modules that use it keep working, and new code may use Node 16's own.
- `helper/tvprofile.js` still decides for SDKs below 10 (the picker started on demand, the `overlay` notification window, the stand-in
  for LG's native Home on webOS 5 to 23). Below the floor only a TV whose version could not be read gets that far ("Set up anyway").
- The pages' older scripts are ES5, and flex children are spaced with sibling margins (flex `gap` came in Chromium 84). The focus ring
  of a tile is a `::before` with its own radius, because Chromium before 94 drew an `outline` as a rectangle.
- The service accepts the `file://<appId>-webos` origin that webOS 6 apps send, for our own apps and the Home slot only, and
  `scripts/reload-home.sh` restarts `webapp-mgr` on webOS 6, where a relaunch alone kept the old page.

!!! note "Checked on webOS 25"
    The maintainer's TV runs webOS 25. Every change is checked by the tests on the current Node (with rules for what Node 16 lacks)
    and in Chromium 120 (`sh tools/check.sh --chromium`, Chrome for Testing's headless shell 120.0.6099.109).

## Things that were tried

!!! info "A native launcher"
    A launcher written in C with SDL2 (so it draws on the GPU without the web runtime) was built and run as LG's Home on a
    webOS 25 TV. It worked, started quickly and used about as much memory and CPU as the web launcher, but LG's compositor shows
    "Do you want to exit the app?" when Back is pressed in a native app, and setting a key mask on the window did not stop it. It
    is kept on the `native-launcher` branch for reference and is not part of the project.
