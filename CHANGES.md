# Changes in this fork

Change log for LanceSandino/cleanyourtv-WebOS (a fork of lasharor/cleanyourtv-WebOS). Upstream's own history is in its commits
and release notes; this file records what the fork changes on top of it.

```yaml
id: CU-20261027-1
type: fix
title: "Updates, themes and the compatibility list come from the fork"
description: "The service's default update repository (helper/updates.js DEFAULT_REPO), so also the theme source (helper/theme.js
  follows updates.repo()), the compatibility list fetched by scripts/bootstrap.sh, install.sh's default repository and ipk/build.py's
  Homebrew Channel listing name LanceSandino/cleanyourtv-WebOS instead of lasharor/cleanyourtv-WebOS. Before, a package built from
  the fork still checked upstream for updates and installed upstream's releases as root. D/source can still name another repository."
impact: high
affected_modules: ["helper/updates.js", "scripts/bootstrap.sh", "install.sh", "ipk/build.py", "tools/test/golden/api.json"]
related_tests: ["tools/test/forksource.test.js", "tools/test/updates.test.js", "tools/test/api.test.js"]
commit_ref: "feature/fork-release-source (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T04:37:17Z"
```

```yaml
id: CU-20261027-2
type: fix
title: "No scheduled release in the fork"
description: "release.yml loses its daily schedule (workflow_dispatch only). Upstream's cron would bump the version, move main to dev
  and publish a release every night once Actions are enabled on the fork, which would ship whatever is on dev without review."
impact: low
affected_modules: [".github/workflows/release.yml"]
related_tests: ["tools/test/forksource.test.js"]
commit_ref: "feature/fork-release-source (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T04:45:47Z"
```

```yaml
id: CU-20261027-5
type: fix
title: "The root API answers only requests addressed to 127.0.0.1 or localhost"
description: "helper/server.js refuses (403) a request whose Host header names anything else, so a web page that rebinds its own
  DNS name to 127.0.0.1 can no longer read the API (for example the notification token or playlist addresses). Audit finding F1,
  rebinding half; a sandboxed frame's origin null is still accepted like our own apps (needs a per-install token, not done yet)."
impact: medium
affected_modules: ["helper/server.js", "docs/security.md"]
related_tests: ["tools/test/server.test.js", "tools/test/api.test.js"]
commit_ref: "feature/api-host-check (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:05:32Z"
```

```yaml
id: CU-20261027-10
type: fix
title: "A centred app grid (Bloom) has its gaps on webOS 5 and 6"
description: "grid.align center makes the app grid a flex box, and it kept the gap of the normal grid; Chromium before 84 (webOS 5 and
  6) ignores gap in a flex box, so Bloom's tiles touched there (seen in Chromium 68 with tools/theme-preview.mjs). The gap now applies
  only to the normal grid (body:not([data-galign=center]) #grid), and a centred grid spaces its tiles with half a gap of margin on each
  side, its box reaching half a gap further out, so the tiles sit where they sat in a current Chrome (pixel-identical there)."
impact: low
affected_modules: ["app/src/css/home.css", "app/index.html"]
related_tests: ["tools/test/pages.test.js"]
commit_ref: "feature/ui-polish (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T04:55:45Z"
```

```yaml
id: CU-20261027-11
type: feature
title: "Up and Down land on what is above or below, and straight back where they came from"
description: "Up and Down between the top buttons, the dock and the grid spread the columns proportionally (mapCol), so a round trip
  drifted (grid column 8, Up, Down: column 9) and Up from the second tile of a short last row jumped to column 5. They now land on the
  item whose centre is nearest on the screen (centres read once per rebuild with getBoundingClientRect, so a centred dock and a
  right-to-left layout are measured as drawn), and the opposite key pressed right after goes back to the exact item the focus came
  from. Back from an overlay or push grid uses the same rule. A row that is not drawn (no top buttons) keeps the proportional columns."
impact: medium
affected_modules: ["app/src/js/focus.js", "app/src/js/input.js", "app/src/js/layout.js", "app/src/index.html", "app/index.html", "docs/launcher.md"]
related_tests: ["tools/test/launcher.test.js"]
commit_ref: "feature/ui-polish (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:02:00Z"
```

```yaml
id: CU-20261027-12
type: feature
title: "Theme settings for the focus and the app name: a gliding glass plate, the name under a grid tile, a name that slides, a header that steps aside"
description: "New theme settings, all off by default: tile.focus glass (a lit plate behind the focused tile that glides between tiles
  with transform only; one plate in the dock and one in the grid so each moves with its row; positions read once per rebuild),
  grid.label focus (the focused app's name under its grid tile, also when a push grid hides the large name), shelf.motion fade or
  slide and shelf.weight (two name layers that take turns, mirrored in right-to-left languages), and grid.header fade (the clock,
  buttons and cards step aside while the grid has the focus). Grid tiles 1.5 times as wide as tall or more keep a padded icon at its
  size, as the dock does, instead of stretching it. Everything follows effects.speed and stands still while an arrow is held. A theme
  that does not set them resolves to the same reply as before (only themes that use a setting send it)."
impact: medium
affected_modules: ["helper/themeschema.js", "app/src/js/focus.js", "app/src/js/theme.js", "app/src/js/layout.js", "app/src/js/tiles.js", "app/src/css/focus.css", "app/src/css/home.css", "app/src/css/rtl.css", "app/src/index.html", "app/index.html", "docs/themes.md", "docs/credits.md"]
related_tests: ["tools/test/theme.test.js", "tools/test/launcher.test.js"]
commit_ref: "feature/ui-polish (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:24:50Z"
```

```yaml
id: CU-20261027-13
type: feature
title: "Clock typography settings, and Good night as a greeting"
description: "clock.weight, clock.dateCaps (capitals with wider spacing), clock.divider (a thin line between time and date) and
  clock.ampm small (AM/PM set smaller beside the time, split with Intl formatToParts; Chromium 68 names that part dayperiod, which is
  handled; without formatToParts the time stays one text). The greeting (clock.greeting and the greeting card) says Good night from
  22:00 to 4:59 instead of Good evening or Good morning, translated in all eight languages."
impact: low
affected_modules: ["helper/themeschema.js", "app/src/js/clock.js", "app/src/js/input.js", "app/src/js/cards.js", "app/src/css/home.css", "app/src/css/focus.css", "app/src/css/rtl.css", "i18n/*.json", "app/index.html", "manager/app/index.html"]
related_tests: ["tools/test/launcher.test.js", "tools/test/theme.test.js", "tools/test/i18n.test.js"]
commit_ref: "feature/ui-polish (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:24:50Z"
```

```yaml
id: CU-20261027-14
type: feature
title: "Theme settings for a centred glow, a sheen on the top buttons and a coloured dock panel"
description: "effects.glowShape center (the glow as a large circle around the dock over the whole screen, still opacity only),
  surface.pillGloss (a sheen of the button colour from the top edge) and colors.dockPanel (the panel behind the dock in its own colour
  with a faint light rim; dock.panel now goes up to 1 so the panel can be opaque). The default declarations are untouched; a theme
  that sets one of these gets an override rule through a body attribute or a variable."
impact: low
affected_modules: ["helper/themeschema.js", "app/src/css/home.css", "app/src/css/focus.css", "app/src/js/theme.js", "app/index.html"]
related_tests: ["tools/test/theme.test.js"]
commit_ref: "feature/ui-polish (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:24:50Z"
```

```yaml
id: CU-20261027-15
type: feature
title: "Glass theme: wide cards, a dark dock band, a light clock and a gliding glass focus"
description: "A data-only theme built from the new settings: five columns of 16:9 cards, the dock on a dark band with the focused
  app's name sliding above it, a light clock with AM/PM set small, a divider and the date in capitals, the greeting card above it, a
  centred glow of the app's colour, pills with a sheen, and the glass plate that glides between apps. Down moves the dock up (push), the
  header steps aside and the name shows under the focused card. The idea follows the launcher of Razdva122/clean-your-tv-lg-webos
  (MIT, credited in docs/credits.md); no file of it is used. Preview rendered with tools/theme-preview.mjs; docs/themes.md has its row
  and a screenshot (docs/screenshots/themes-6.jpg)."
impact: low
affected_modules: ["themes/glass/theme.json", "themes/glass/preview.jpg", "themes/index.json", "docs/themes.md", "docs/screenshots/themes-6.jpg"]
related_tests: ["tools/test/theme.test.js"]
commit_ref: "feature/ui-polish (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:25:45Z"
```

```yaml
id: CU-20261027-3
type: feature
title: "Family photos for the screensaver from a family-calendar photo feed"
description: "helper/familyphotos.js reads a family-calendar server's read-only photo feed (setup code cyfp1.: https address, a
  photos:read token, the server's root certificate, which becomes the only one trusted). The ids are read hourly with an ETag; photos
  are fetched one at a time at 1920 px into a cache of at most 30 photos / 40 MB, hidden or deleted photos leave the TV at the next read,
  and the cache keeps the screensaver going with the server away. The token stays in config.json and is removed from what the
  launcher gets (apps.js gives only family.photos). helper/fetch.js gains a ca option. The Wallpapers phone page gets a Family photos
  tab for the setup code."
impact: medium
affected_modules: ["helper/familyphotos.js", "helper/fetch.js", "helper/apps.js", "helper/config.js", "helper/helper.js", "helper/wallpapers.js"]
related_tests: ["tools/test/family.test.js", "tools/test/api.test.js", "tools/test/wallpapers.test.js"]
commit_ref: "feature/family-saver (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:02:29Z"
```

```yaml
id: CU-20261027-4
type: feature
title: "Screensaver on Home instead of LG's clock"
description: "app/src/js/saver.js: after Customise > Screensaver > Starts after (1-30 min, counted in its own 5 s ticks, not the
  clock) without a key or pointer move on Home, or when the TV asks before starting LG's screensaver (tvpower
  registerScreenSaverRequest, declined only while ours has photos), the family photos (else the Wallpapers photos) full screen with
  the time and date, cross-faded with opacity, darker at night. The first key or a pointer move ends it and goes no further."
impact: medium
affected_modules: ["app/src/js/saver.js", "app/src/css/saver.css", "app/src/js/menus.js", "app/src/js/config.js", "app/src/index.html"]
related_tests: ["tools/oldchrome.js (saver page in Chromium 68 and 79)", "tools/test/pages.test.js", "tools/test/api.test.js"]
commit_ref: "feature/family-saver (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:02:29Z"
```

```yaml
id: CU-20261027-6
type: fix
title: "Family photos offline: never the same photo twice in a row"
description: "Found by the end-to-end run against the real family-calendar feed (token revoked, part of the library cached): a photo
  that could not be fetched replaced the one on screen as 'last', so the offline pick could repeat it, and after an offline pick the
  shuffled order could bring the same photo straight back. next() now keeps the shown photo on a failure, excludes it from the
  offline pick, and pick() moves it off the front of the order."
impact: low
affected_modules: ["helper/familyphotos.js"]
related_tests: ["tools/test/family.test.js"]
commit_ref: "feature/family-saver (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:15:44Z"
```

```yaml
id: CU-20261027-7
type: feature
title: "Screensaver: Left and Right step through the photos"
description: "app/src/js/saver.js keeps the last 50 photos shown. Left goes back, Right goes forward (and past the last one fetches a
  new photo); the photo timer restarts after a step and, after stepping back, moves forward through the history before fetching new
  photos. Mirrored for right-to-left languages. Every other key still ends the screensaver and is swallowed. The Wallpapers fallback
  is now a shuffled deck too (each photo once before any repeats) instead of a random pick."
impact: low
affected_modules: ["app/src/js/saver.js", "docs/screensaver.md"]
related_tests: ["tools/oldchrome.js ('saver keys': Right, Left, Right, Right, then Down, in Chromium 68 and 79)"]
commit_ref: "feature/saver-arrows (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:20:43Z"
```

```yaml
id: CU-20261027-8
type: refactor
title: "Family photos become the Photo feed: a documented contract any server can offer; the round survives a restart"
description: "Renamed for other people's servers: helper/familyphotos.js -> helper/photofeed.js, /api/family/* -> /api/photofeed/*,
  config key family -> photoFeed (the launcher gets photoFeed.photos), the phone page tab and texts say Photo feed, and
  docs/screensaver.md documents the two feed calls and the setup code as a contract (family-calendar and its Frameo import are one
  server). The shuffled round is saved with the photo list (at once on a new round or a list change, else at most every 10 minutes
  to spare the flash), so a restart goes on where it was; new photos join the current round, removed ones leave it."
impact: medium
affected_modules: ["helper/photofeed.js", "helper/apps.js", "helper/helper.js", "helper/wallpapers.js", "app/src/js/saver.js", "app/src/js/menus.js", "docs/screensaver.md"]
related_tests: ["tools/test/photofeed.test.js", "tools/test/api.test.js", "tools/test/wallpapers.test.js", "tools/oldchrome.js"]
commit_ref: "feature/fork-next (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:37:40Z"
```

```yaml
id: CU-20261027-9
type: fix
title: "Audit fixes: an API token for our apps, local addresses checked after the lookup, safer update command, pinned actions"
description: "F1 (rest): helper/apitoken.js keeps a random token (D/api-token, root only) and writes cytv-token.js into the launcher,
  the manager and the picker (at each start, and into a new launcher before it is swapped in); the pages send it as x-cytv-token and
  server.js refuses a request with origin null and no token once every app has it and one sent it back (never before, so a TV where it
  cannot be handed out keeps working). OUR_APPS no longer trusts the unused com.cleanyourtv.live. F2: refuseLocal also refuses an
  IPv6-written loopback and, through the connection's lookup, a name that resolves to the TV itself or link-local. The version put into
  the bootstrap command must be digits and dots. The OpenRouter attribution names the fork. Every GitHub Action is pinned to a commit."
impact: high
affected_modules: ["helper/apitoken.js", "helper/server.js", "helper/helper.js", "helper/updates.js", "helper/fetch.js", "helper/paths.js", "helper/answers.js", "app/src/js/clock.js", "app/src/index.html", "manager/src/js/core.js", "manager/src/index.html", "picker/app/index.html", ".github/workflows"]
related_tests: ["tools/test/apitoken.test.js", "tools/test/server.test.js", "tools/test/fetch.test.js", "tools/oldchrome.js (every page sends the token, Chromium 68 and 79)"]
commit_ref: "feature/fork-next (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:46:47Z"
```

```yaml
id: CU-20261027-16
type: doc
title: "The documentation and the README are this fork's, with the credit to upstream"
description: "zensical.toml, the README badges and every self-link (documentation site, releases, install.sh, files in the repository)
  name LanceSandino/cleanyourtv-WebOS and lancesandino.github.io; links to upstream's numbered issues and pull requests stay upstream.
  A fork notice in the README and the documentation home, a new About this fork page (docs/fork.md, in the navigation) and a line in
  Credits say it is a fork of lasharor/cleanyourtv-WebOS, credit lasharor and its contributors, Gathin23's design and Razdva122's
  ideas, and list what the fork adds."
impact: none
affected_modules: ["README.md", "zensical.toml", "docs/fork.md", "docs/index.md", "docs/credits.md", "docs/development/index.md", "docs/homebrew-channel.html"]
related_tests: []
commit_ref: "feature/fork-next (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T05:55:09Z"
```

```yaml
id: CU-20261027-17
type: feature
title: "Choose one wallpaper on the TV; the photo feed is set up straight from the screensaver"
description: "Customise > Wallpapers > Choose a photo... (app/src/js/wallpick.js) shows the Wallpapers photos one at a time, full
  screen and whole: Left/Right browse (mirrored right-to-left; the Magic Remote's left and right thirds too), OK keeps that photo as the
  only wallpaper (cfg.wall.pick, accepted by apps.js only as a photo id; wall.js stops changing photos while it exists), Back leaves;
  Photo switches between one chosen photo and all photos shuffled. Customise > Screensaver > Photo feed... now opens the CleanYourTV
  app straight on a QR code whose phone page opens on its Photo feed tab (/api/wallpapers/pair {tab: 'feed'}); before, it opened the
  Wallpapers screen, which did not mention the feed. That screen now has a Photo feed row (status) and Disconnect the photo feed."
impact: medium
affected_modules: ["app/src/js/wallpick.js", "app/src/css/wallpick.css", "app/src/js/wall.js", "app/src/js/menus.js", "helper/apps.js", "helper/wallpapers.js", "manager/src/js/menu.js", "manager/src/js/screens.js", "manager/src/js/input.js", "manager/src/js/core.js", "docs/wallpapers.md", "docs/screensaver.md"]
related_tests: ["tools/oldchrome.js (wallpaper chooser: Right, OK in Chromium 68 and 79)", "tools/test/apps.test.js", "tools/test/wallpapers.test.js"]
commit_ref: "feature/wallpaper-chooser (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T06:40:17Z"
```

```yaml
id: CU-20261027-18
type: fix
title: "Photos instead of LG's clock over other apps too; the launcher can send its API token"
description: "Seen on the owner's TV (webOS 25): LG asked the launcher before its screensaver, but another app (Telemachus) was in
  front, so the launcher let LG's clock come. Now, while the screensaver is on and has photos, LG's screensaver is always declined:
  on Home ours starts, over another app the launcher notes it (/api/foreground), brings Home forward with the photos, and a key or the
  pointer goes back to that app (the Home key ends them and stays on Home). Also seen there: the API token never reached the launcher,
  because stage-home.sh mounts a copy of app/ (D/home-overlay) over LG's Home; apitoken.js now writes the token there too when it
  exists, so the token can be required once the launcher has loaded it."
impact: medium
affected_modules: ["app/src/js/saver.js", "helper/apitoken.js", "helper/paths.js"]
related_tests: ["tools/oldchrome.js (saver over an app, Chromium 68 and 79)", "tools/test/apitoken.test.js"]
commit_ref: "fix/token-home-overlay (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T06:53:30Z"
```

```yaml
id: CU-20261027-19
type: fix
title: "The photo feed's photos are Wallpapers photos too; shown from memory, with only a small offline set on the flash storage"
description: "Seen on the owner's TV: Wallpapers said 0 photos while the screensaver showed 290 from the feed. wallpapers.js now lists
  the feed's photos as f/<id> (served through photofeed.js), so Customise > Wallpapers counts them, rotates them and Choose a photo
  browses them; apps.js accepts f/<id> as the chosen photo. On the owner's concern about caching and disk space: photofeed.js kept
  every shown photo on the flash storage (30 photos, rewritten as the screensaver went on, hundreds of MB of writes on a long evening).
  Photos are now shown from memory (the last 8); the storage holds an offline set of at most 20 photos / 24 MB, the first 5 at once,
  then at most one new photo every 30 minutes, nothing while df reports under 300 MB free, and the chosen wallpaper always. Also: a
  list change before a round has started no longer leaves the existing photos out of that round."
impact: medium
affected_modules: ["helper/photofeed.js", "helper/wallpapers.js", "helper/apps.js", "docs/screensaver.md", "docs/wallpapers.md"]
related_tests: ["tools/test/photofeed.test.js", "tools/test/wallpapers.test.js", "tools/test/apps.test.js"]
commit_ref: "fix/token-home-overlay (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T06:57:23Z"
```

```yaml
id: CU-20261027-20
type: fix
title: "No app-coloured glow over a wallpaper photo"
description: "Seen on the owner's TV: with a photo as the wallpaper, moving the focus across apps tinted the photo red and blue. The
  themes' glow (a radial wash in the focused app's colour, up to 45 %, over the top of Home) sits above the wallpaper layers; it was
  made for a plain background. home.css: body.wpon .glow.on has opacity 0, so the photo is the backdrop."
impact: low
affected_modules: ["app/src/css/home.css", "docs/wallpapers.md"]
related_tests: ["tools/oldchrome.js (wallpaper chooser: the glow's final opacity is 0 over the chosen photo, Chromium 68 and 79)"]
commit_ref: "fix/glow-over-wallpaper (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T07:10:00Z"
```

```yaml
id: CU-20261027-21
type: feature
title: "Five apps in a five-app dock, the glow on the focused app, menus as a side panel, and the Home key closes what is open"
description: "From the owner's notes on his TV (Glass theme, four saved dock apps): dockIds() fills a theme's free dock places with the
  most used other apps (not hidden, inputs or Live TV) without changing the saved dock, so the dock band lines up with the grid. The
  focused app gets a halo in its own colour under its tile (focus.js, one in the dock and one in the grid, transform and opacity only),
  shown over a wallpaper photo where the screen glow is off. Menus are a panel on the right (mirrored right-to-left) over a lighter
  shade, so Home stays in view, sliding in when the first opens (not on webOS 5's GPU); Customise is grouped under Home, Look, Photos
  and More (menu heading rows the focus skips), 10 rows a page. The remote's Home key (relaunch with launchType homeKey) closes menus
  and the photo chooser; before, Home only reloaded the apps under an open Customise, Inputs list or Wallpapers menu."
impact: medium
affected_modules: ["app/src/js/config.js", "app/src/js/focus.js", "app/src/css/focus.css", "app/src/js/menus.js", "app/src/css/menus.css", "app/src/css/rtl.css", "app/src/js/input.js", "app/src/js/wallpick.js", "docs/launcher.md", "docs/wallpapers.md"]
related_tests: ["tools/test/launcher.test.js (the dock fills to the theme's count)", "tools/oldchrome.js (home key; wallpaper chooser: the halo shows over the photo; Chromium 68 and 79)"]
commit_ref: "feature/ui-round-2 (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T07:27:51Z"
```

```yaml
id: CU-20261027-22
type: feature
title: "Uninstall apps from Home, not only hide them"
description: "The owner asked to remove apps, not only hide them. apps.js passes the app manager's removable flag to the launcher
  (false for this project's apps, the Homebrew Channel, the input hook and com.webos./com.lge. apps whatever the app manager says) and
  POST /api/uninstall {id} removes a removable app through com.webos.appInstallService/remove (store apps) or dev/remove (developer
  apps), then takes it out of the dock and the hidden list. On the owner's TV, LG Movies & TV and LG Gaming Portal are removable store
  apps; Home Hub, LG Channels, Sports, Multi View, LG Gallery+, Amazon Alexa, Apps, Web Browser and Camera are system apps (hide
  only). The launcher offers Uninstall... (with a confirmation) when holding OK on an app, and on hold in Customise > Hidden apps."
impact: medium
affected_modules: ["helper/apps.js", "app/src/js/menus.js", "app/src/js/layout.js", "docs/launcher.md"]
related_tests: ["tools/test/apps.test.js", "tools/test/api.test.js"]
commit_ref: "feature/uninstall-apps (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T07:30:55Z"
```

```yaml
id: CU-20261027-23
type: feature
title: "Continue watching on Home: Telemachus's now playing and up next, and LG's recent apps"
description: "The owner asked for LG-style continue-watching rows without ads. Investigation on his TV (read-only): LG's recents list
  (com.webos.service.recent/listRecents) holds only the apps opened last, with no show names or pictures, and LG's per-show rows
  come from its cloud (sdx); Telemachus runs on the TV (127.0.0.1:8770) with /api/brief (now playing, the plan) and /api/shows
  (posters, backdrops). helper/watch.js reads both from the root service (Telemachus refuses web pages) and fetches TMDB pictures
  itself (image.tmdb.org only, HTTPS, no redirects, 1 MB, 40 in memory), giving the page ids only. app/src/js/watch.js puts the cards
  in the grid's first row (the apps begin on the next one; the scrolling maths is unchanged), with the title, the episode and a
  progress bar; OK launches Telemachus with {play: {show, season, episode}} / {play: {film, year, tmdb_id}} / {play: {resume: true}}
  (the Telemachus app gains these in its PR #2) or the app as it is. Customise > Continue watching switches it off."
impact: medium
affected_modules: ["helper/watch.js", "helper/helper.js", "helper/apps.js", "helper/config.js", "app/src/js/watch.js", "app/src/css/watch.css", "app/src/js/layout.js", "app/src/js/config.js", "app/src/js/menus.js", "docs/launcher.md", "docs/security.md"]
related_tests: ["tools/test/watch.test.js", "tools/oldchrome.js (continue watching: cards in the first row, Left to the first, OK opens Telemachus at the episode; Chromium 68 and 79)"]
commit_ref: "feature/continue-watching (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T08:07:02Z"
```

```yaml
id: CU-20261027-24
type: feature
title: "Continue watching: Plex and Stremio, linked with their own TV sign-in"
description: "The owner asked for Plex and Stremio in Continue watching, linked with codes (the apps' stored logins are not read,
  D-20261027-8). helper/plex.js: a 4-character code from plex.tv/api/v2/pins (strong=false) for plex.tv/link, polled every 3 s for
  ten minutes; then the owner's server from /api/v2/resources (owned, local address first) and its /hubs/continueWatching/items
  (/library/onDeck on older servers), pictures through the server's photo transcoder with its key added by the service. helper/
  stremio.js: a link from link.stremio.com (create/read), then the library from api.strem.io datastoreGet, filtered like Stremio's
  own Continue Watching (started, not removed), newest first, pictures from images.metahub.space. The keys stay in config.json
  (watchAccounts): never in /api/apps, /api/watch/accounts, the cards or the settings log. watch.js adds GET /api/watch/accounts and
  POST /api/watch/link|unlink {service}, and a fresh link clears the row cache. Customise > Continue watching is now a menu: Show on
  Home, Link Plex... (shows the code), Link Stremio... (shows the link), and Unlink (with a confirmation) on a linked one."
impact: medium
affected_modules: ["helper/plex.js", "helper/stremio.js", "helper/watch.js", "helper/apps.js", "app/src/js/menus.js", "app/src/js/watch.js", "i18n/en.json", "docs/launcher.md", "docs/security.md", "AGENTS.md"]
related_tests: ["tools/test/watchlinks.test.js", "tools/test/apps.test.js", "tools/oldchrome.js (linking plex: the code, then the linked server; Chromium 68 and 79)"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T11:35:32Z"
```

```yaml
id: CU-20261027-25
type: fix
title: "Continue watching: no duplicate app cards, one card per show with its source, hold OK to remove"
description: "The owner's photo of v1.6.16 showed LG's recent apps (PS5, YouTube TV, Stremio) as cards that repeat Home's tiles, two
  Vampire Diaries cards from Telemachus's channel lineup (S8E16, then E10-E15) with file-name titles, no hint where they came from, and
  hold OK doing nothing on a card (cards are sys tiles, so options() ignored them). watch.js no longer reads LG's recents list
  (D-20261027-9); Telemachus gives what the player has, or each show's latest in_progress episode (state.shows, with its percent),
  and one next card from the plan for a show not already shown; '<show> S08E09 - ' prefixes are cut from titles. Every card carries a
  group (a show or film) and the launcher a corner label on the focused card (Telemachus, Plex, Stremio, Up next on Telemachus).
  Hold OK on a card: Resume (Play), Open <app>, Remove from Continue watching (the group), Hide everything from <app> (src:<source>),
  the settings; the removed list is cfg.watch.hide (at most 100, checked by apps.js); Customise > Continue watching > Show removed
  cards again. The focus caption no longer repeats a card's title under it."
impact: medium
affected_modules: ["helper/watch.js", "helper/plex.js", "helper/stremio.js", "helper/apps.js", "app/src/js/watch.js", "app/src/js/menus.js", "app/src/js/input.js", "app/src/js/focus.js", "app/src/css/watch.css", "tools/oldchrome.js", "docs/launcher.md", "docs/security.md", "DECISIONS.md", "AGENTS.md"]
related_tests: ["tools/test/watch.test.js", "tools/test/apps.test.js", "tools/oldchrome.js (hold ok: Hide app on a dock app, Remove from Continue watching on a card; Chromium 68 and 79)"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T11:46:39Z"
```

```yaml
id: CU-20261027-26
type: feature
title: "Continue watching opens under the highlighted app instead of a standing row"
description: "The owner asked for the episodes only when their app is highlighted, with several to choose from. app/src/js/watch.js
  keeps the cards and an owner: setFocus calls WATCH.focused, which opens the owner's row 400 ms after an app with cards is
  highlighted (Telemachus; Plex for cdp-30 and com.beb.plxnative; Stremio), and closes it when the focus moves along the owner's
  row or above it (below keeps it). layout.js puts that row under the owner's row (the grid's first row for a dock app) and starts
  the next app on a new row. Plex and Stremio cards open the app they are under; hold OK's Open names that app. watch.js (service)
  returns up to four of Telemachus's next (its lineup, without the episodes already shown). The page checks use Plex in the dock and
  Telemachus in the grid of the stand-in."
impact: medium
affected_modules: ["app/src/js/watch.js", "app/src/js/layout.js", "app/src/js/theme.js", "app/src/js/menus.js", "helper/watch.js", "tools/oldchrome.js", "docs/launcher.md", "DECISIONS.md"]
related_tests: ["tools/test/watch.test.js", "tools/oldchrome.js (continue watching: no row until Plex is highlighted, Down and OK open Plex, Right closes it, Telemachus's row under its row opens the episode; hold ok; Chromium 68 and 79)"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T11:58:41Z"
```

```yaml
id: CU-20261027-27
type: feature
title: "Rows under the other apps from LG's own data, without ads"
description: "The owner asked for LG's per-app rows too, without ads (acting as LG allowed). Investigation on the TV (read-only): LG's
  Flutter Home (seen through another process's root, /proc/<pid>/root, since ours is mounted over it) builds per-app shelves from
  com.webos.service.contentminer, whose db8 kind contents:1 holds per app {type, titleText, category, promotionId, image, image_4k,
  onClick {contentId, launchParam, targetAppId}} (on the owner's TV: YouTube, Disney+, Apple TV, LG Channels); its ads come from
  com.webos.service.admanager. helper/lgrows.js reads that kind with luna-send -a com.webos.service.contentminer (luna.js gains
  opts.as, name-checked, passed as an argument), keeps up to 12 content items per app without promotionId or ad categories, and
  launches {contentTarget: contentId}. watch.js adds them (cfg.watch.lg false switches them off), pictures over HTTPS from the app's
  host or LG's image hosts, image types only, 12 MB in memory all together (was 40 pictures). The page shows an app's cards when it
  has any (item.app), hides an app's row with 'app:<id>', and brings a newly opened row's cards in one after the other; the cards got
  a tinted background, a stronger fade and a closer picture on focus."
impact: medium
affected_modules: ["helper/lgrows.js", "helper/luna.js", "helper/watch.js", "helper/apps.js", "app/src/js/watch.js", "app/src/js/menus.js", "app/src/css/watch.css", "tools/oldchrome.js", "docs/launcher.md", "docs/security.md", "DECISIONS.md", "AGENTS.md"]
related_tests: ["tools/test/watch.test.js", "tools/oldchrome.js (lg row: the second dock app's row opens, OK opens it with contentTarget; hold ok; continue watching; Chromium 68 and 79)"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T12:13:55Z"
```

```yaml
id: CU-20261027-28
type: fix
title: "Telemachus film cards send only the launch keys it takes"
description: "The Telemachus session confirmed its launch option (deployed on the TV, PR #2 commit 89c59c5): {play: {film, year,
  tmdb_id}} takes year as an integer 1870-2100 and tmdb_id as tmdb:<n>, either may be left out, and anything else opens the app
  normally. watch.js sent year: null / tmdb_id: null for a film without them, so such a card only opened Telemachus; filmPlay() now
  leaves out what is missing or malformed."
impact: low
affected_modules: ["helper/watch.js", "docs/launcher.md"]
related_tests: ["tools/test/watch.test.js"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T12:17:40Z"
```

```yaml
id: CU-20261027-29
type: fix
title: "A dock app's row shows in themes that keep the grid under the dock"
description: "On the owner's TV (Glass theme, grid.mode push) highlighting a dock app opened its row as the grid's first row, which
  stays below the screen until the focus goes into the grid, so nothing seemed to happen. setFocus now treats the dock with that row
  open like the first grid row (rr): the push, plain and overlay layouts move as they would for that row (Glass: the view goes up
  554 px, the header fades), and come back when the row closes. tools/oldchrome.js gains a seventh PAGES field (a repository theme
  for that page), a Glass check for this, and --engine <text> to run one engine (Chromium 79 crashes at startup on macOS 26)."
impact: low
affected_modules: ["app/src/js/theme.js", "tools/oldchrome.js", "docs/launcher.md"]
related_tests: ["tools/oldchrome.js (dock row in glass: Plex's row on the screen with the view pushed up, gone and back down after Right)"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T12:38:42Z"
```

```yaml
id: CU-20261027-30
type: fix
title: "Service and launcher update together; rollback names the release"
description: "The owner updated the service row and the launcher stayed behind (they were two rows, and an update from the Homebrew
  Channel installs only the package), so Go back to launcher offered 1.5.8 instead of the release before. updates.js pairLauncher():
  a service whose version (and dev build) is the release on offer installs that release's launcher when it differs, once per pair
  (D/paired), only with Home or the manager in front (installing reloads Home, which comes forward), asked 60 s after start and
  with the 2-minute package check until it has an answer. POST /api/manager/update-all updates the service (whose new copy pairs
  the launcher) or else the launcher; the manager shows one CleanYourTV row. A launcher installed by the manager gets a RELEASE
  file; status.frontend.previousRelease names it, and the rollback row says Go back to the previous launcher with the launcher and
  release. The recorded API replies gain frontend.previousRelease (null there)."
impact: medium
affected_modules: ["helper/updates.js", "helper/manager.js", "manager/src/js/menu.js", "manager/src/js/help.js", "docs/managing.md", "docs/manager.md", "docs/troubleshooting.md", "DECISIONS.md", "tools/test/golden/api.json"]
related_tests: ["tools/test/updates.test.js", "tools/test/api.test.js"]
commit_ref: "feature/plex-stremio (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T12:49:33Z"
```

```yaml
id: CU-20261027-40
type: feature
title: "Sonos soundbar volume on screen (read only, off by default)"
description: "The owner's TV sends its sound to a Sonos soundbar over HDMI ARC, so LG's volume display shows no number. New
  helper/sonos.js (Node 8 compatible) finds Sonos players with SSDP, reads each description (id, room, model), and follows the
  chosen speaker (automatic: the only soundbar, or the only player) with UPnP RenderingControl: GetVolume/GetMute for the current
  state, then SUBSCRIBE to its volume events on a port the system picks, open only while the option is on, answering only NOTIFY
  from that speaker's address on a 96-bit random path with the subscription id; renewed at half its time, subscribed again when
  refused, read once a second when no event arrives in 8 s. GetVolume and GetMute are the only actions it can send (READ_ONLY,
  anything else refused before sending). A change (not the first reading) launches the notify app with kind volume while the TV's
  power state is Active and its sound output is not the TV's speakers, one launch at a time with the latest value. notify.js accepts
  kind volume from the service only; notify/app (1.0.5) draws a pill with a bar and the number beside the card, its own timer, the
  fill moved with transform, and closes the window only when neither shows. Manager > More > Sonos volume on screen: on/off,
  Speaker (automatic or from a search), Place on screen, Now (the More row reads /api/sonos/status itself, so /api/manager/status is
  unchanged). API: GET /api/sonos/status, POST /api/sonos/find, /set. Read-only checks with the owner's real speaker (masked): the module found it from the Mac
  and from the TV, got live events on the TV, and unsubscribed on stop; the bar itself was not yet shown on the TV."
impact: medium
affected_modules: ["helper/sonos.js", "helper/notify.js", "helper/helper.js", "notify/app/index.html", "notify/app/appinfo.json", "manager/src/js/sonos.js", "manager/src/js/menu.js", "manager/src/js/list.js", "manager/src/index.html", "manager/app/index.html", "i18n/en.json", "tools/test/api.test.js", "tools/test/golden/api.json", "docs/sonos.md", "docs/security.md", "docs/api.md", "docs/manager.md", "docs/index.md", "docs/development/internals.md", "zensical.toml", "README.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/sonos.test.js (stand-in players over HTTP and SSDP: off by default, search and its guards, events, no bar for the first reading, screen and sound-output gating, event-port guards, burst, chosen speaker, polling fallback, moved speaker, renewal, unsubscribe on off, only reads reach a speaker; notify.js kind volume; the notify page's bar and window closing)", "tools/test/api.test.js"]
commit_ref: "feature/sonos-volume (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T12:59:01Z"
```

```yaml
id: CU-20261027-31
type: fix
title: "Telemachus's one-off episodes are not offered as up next"
description: "The Telemachus session reported that {play: {show, season, episode}} goes through skip --to, which only takes shows in
  its catalogue; a plan entry with one_off: true (an episode queued without its show) is refused and the app only opens. watch.js
  leaves such episodes out of the next cards (what is playing still resumes with {play: {resume: true}})."
impact: low
affected_modules: ["helper/watch.js"]
related_tests: ["tools/test/watch.test.js"]
commit_ref: "feature/telemachus-oneoff (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T13:34:47Z"
```

```yaml
id: CU-20261027-41
type: feature
title: "Hide LG's own volume bar while the Sonos volume shows"
description: "With 1.6.18 on the owner's TV both bars showed: ours with the number and LG's, which has none for a soundbar. Read on
  the TV (webOS 25, read only): LG's surface manager draws its volume view (StarfishVolumeView.qml) only while the configd setting
  com.webos.surfacemanager.volumeOSD is not false, and follows it (Settings.subscribe); configd layer files override per key, and its
  highest layer, /var/run/tvconfig/remote, is in RAM. New helper/lgvolume.js writes the one-setting file {\"volumeOSD\": false} there
  as com.webos.surfacemanager.json and calls com.webos.service.config/reconfigure (LG runs one at every start); show() removes only
  that exact file, never one it did not write, and never creates the folder. sonos.js gains hideLg (default true): LG's bar is hidden
  while Sonos volume and hideLg are on, tvprofile.lgVolumeBar is 'configd' (webOS 25 only) and the sound output is external_arc or
  external_optical; looked at on every settings change and every 20 s (getSoundOutput), so the TV's speakers, headphones or Bluetooth
  get LG's bar back. Status gains hideLg and lgBar (shown, hidden, unsupported). Manager: Sonos volume on screen > Hide LG's volume bar.
  Volume and mute are never called."
impact: medium
affected_modules: ["helper/lgvolume.js", "helper/sonos.js", "helper/tvprofile.js", "helper/paths.js", "manager/src/js/sonos.js", "manager/app/index.html", "app/index.html", "picker/app/index.html", "i18n/en.json", "tools/test/golden/api.json", "docs/sonos.md", "docs/security.md", "docs/tv-changes.md", "docs/api.md", "docs/manager.md", "docs/development/internals.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/sonos.test.js (LG's own volume bar: off leaves it, on with ARC hides it by one setting and a configd re-read, TV speakers and Bluetooth bring it back, optical hides, a lost file is put back, hideLg off and Sonos off show it, a foreign file is neither replaced nor removed, unsupported TV and missing folder write nothing, only sound output, power state and reconfigure are asked of the TV)", "tools/test/tvprofile.test.js", "tools/test/api.test.js"]
commit_ref: "feature/hide-lg-volume (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T13:39:23Z"
```

```yaml
id: CU-20261027-32
type: fix
title: "Home key closes menus on webOS 25; Running apps leaves out apps LG pre-started"
description: "Two reports from the owner (v1.6.19). (1) Home did nothing over Customise and other menus: with handleScreenRemoteKey
  the TV relaunches Home with plain {keepAlive: true} on webOS 25 (one such relaunch in the log, no homeKey), and input.js closed
  menus only for launchType homeKey / activateType home. homeKey(p) now also takes a relaunch whose only parameter is keepAlive:
  true, except right after a Live TV launch (guarded() and liveBlip, as before). (2) Back listed LG Channels, Netflix and YouTube
  as open after a visit to the manager: LG's preload manager starts them in the background (getPreloadPolicy: preloadType
  periodic; their processes started seconds before). apps.js now records, from its 4-second foreground poll, the process an app
  had when it was on the screen (getForegroundAppInfo has no processId, so it is read from applicationManager/running), kept in
  /tmp/cytv-onscreen.json; running.js lists an app only when its running process is the one that was on the screen."
impact: medium
affected_modules: ["app/src/js/input.js", "helper/apps.js", "helper/running.js", "helper/paths.js", "tools/oldchrome.js", "tools/test/lib.js", "docs/launcher.md"]
related_tests: ["tools/oldchrome.js (home key: homeKey over a menu, plain keepAlive over the photo chooser; fails without the fix)", "tools/test/running.test.js"]
commit_ref: "feature/home-key-rows (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T14:22:12Z"
```

```yaml
id: CU-20261027-42
type: fix
title: "The Sonos volume bar shows at once after the first change"
description: "Lance found the bar slow to appear. LG's log on the TV (read only) showed the notify app's launch taking 0.9 to 1.9 s
  until its window was visible when the app had to start, and 0.07 s when it was still open; the luna checks of power state and
  sound output take 30 to 50 ms. The app closed itself about 3.5 s after each bar, so nearly every press waited for a cold start.
  Volume launches now carry stay (sonos.js: 600 s; notify.js clamps 0 to 1800): the page (notify app 1.0.6) keeps its window open,
  empty, until the stay has passed since the last volume launch, and only then closes; a card shown meanwhile does not close it.
  Notifications without stay close as before. Not yet measured on the TV."
impact: low
affected_modules: ["helper/sonos.js", "helper/notify.js", "notify/app/index.html", "notify/app/appinfo.json", "docs/sonos.md"]
related_tests: ["tools/test/sonos.test.js (the bar's launch carries stay 600; notify.js clamps stay; the page keeps the window open after the bar and a card, a change shows in it, it closes once the stay has passed)"]
commit_ref: "feature/sonos-fast (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T14:15:25Z"
```

```yaml
id: CU-20261027-43
type: fix
title: "LG's settings changed through a configd layer that configd reads; LG's app pre-loading stopped"
description: "1.6.19 hid LG's volume bar with a file in /var/run/tvconfig/remote, which never worked: configd's log on the TV shows it
  selects that ReadOnly layer only in its constructor (~2.7 s after boot), when the folder does not exist yet, and skips it on every
  reconfigure; a test with Lance's yes left volumeOSD true. New helper/lgconfig.js writes <namespace>.json into every country folder of
  the layer TV Region Manager Options (/var/run/tvconfig/rmm, RAM, priority 154, above base and distro, re-selected on reconfigure),
  records what it wrote in /tmp/cleanyourtv-lgconfig.json, replaces or removes only files holding exactly that, never creates LG's
  folders, and calls reconfigure. lgvolume.js uses it (and removes 1.6.19's file once). New helper/lgpreload.js (Lance asked for
  pre-loading to be blocked): a debloat group 'preload' (on with the debloat unless switched off; Manager > Debloat > Stop LG
  pre-loading apps) sets com.webos.service.preloadmanager.supportAppList to configd's current list with every app off except
  com.webos.app.home and org.webosbrew.*, checks configd gives it back, and restarts preload-manager.service (it reads configd only at
  start: a one-shot getConfigs and a static maxPreloadApp in its binary); 60 s after the service starts, on every debloat change
  (debloat.onChange), every 10 min when lost; switched off it is removed with one more restart; if configd does not take the list it
  is taken away again without a restart and not retried until the settings change; not while LG's Home is chosen; webOS 25 only
  (tvprofile lgPreload). Not yet verified on the TV: the rmm test write and the first restart wait for Lance's explicit yes."
impact: medium
affected_modules: ["helper/lgconfig.js", "helper/lgvolume.js", "helper/lgpreload.js", "helper/sonos.js", "helper/debloat.js", "helper/tvprofile.js", "helper/helper.js", "manager/src/js/menu.js", "manager/src/js/help.js", "manager/app/index.html", "app/index.html", "picker/app/index.html", "i18n/en.json", "tools/test/api.test.js", "docs/debloat.md", "docs/security.md", "docs/tv-changes.md", "docs/sonos.md", "docs/manager.md", "docs/development/internals.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/lgconfig.test.js (a stand-in configd: set/clear per namespace in every country folder, own files only, no folder made, bad names refused; pre-loading: only Home and the Homebrew Channel on, restart after configd confirms, nothing more while in place, put back when lost, back with a restart when switched off, nothing with the debloat off, on an untried TV or with LG's Home, rolled back without a restart when configd ignores it, applied at once on a debloat change)", "tools/test/sonos.test.js (LG's own volume bar on the rmm layer; 1.6.19's file removed)", "tools/test/tvprofile.test.js", "tools/test/api.test.js"]
commit_ref: "feature/lg-config (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T14:32:42Z"
```

```yaml
id: CU-20261027-44
type: fix
title: "Stop LG pre-loading checks that the preload manager follows the list"
description: "Deployed on the owner's TV (with Lance's go-ahead): the rmm layer works, configd gives volumeOSD false and the new
  supportAppList (only com.webos.app.home on, also to the preload manager's own identity), and preload-manager.service was restarted
  once (stable, NRestarts 0). But its getPreloadPolicy after the restart still listed LG's own 20 apps as enabled and it pre-started
  com.webos.app.browser 7 s later: it does not take isEnabled from configd at runtime; its gate is isAllowed from allowedApps in
  /var/preferences/webos-preload-manager-conf.json. lgpreload.js now asks getPreloadPolicy after the restart (and at every check while
  set): when the preload manager keeps apps on that the list switches off, the setting is taken away again and nothing more is
  restarted until the group is switched; docs say the group does not stop pre-loading there yet."
impact: low
affected_modules: ["helper/lgpreload.js", "docs/debloat.md", "docs/security.md"]
related_tests: ["tools/test/lgconfig.test.js (a preload manager that keeps its own list: one restart, then taken away, nothing more, not retried by itself; one that follows: its policy confirms)"]
commit_ref: "feature/lg-config (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T14:47:45Z"
```

```yaml
id: CU-20261027-45
type: fix
title: "Stop LG pre-loading apps with the preload manager's own call"
description: "Tried on the owner's TV with Lance's go-ahead: setPreloadPolicy {application: {id, isAllowed: false}} switched
  com.webos.app.browser's isEnabled off (the earlier try looked at isAllowed, which it never clears). On an app that is not installed
  (vudu) every call set isAllowed true, and the preload manager saved that in /var/preferences/webos-preload-manager-conf.json (restored
  from a backup with a restart of preload-manager); isEnabled takes the value passed (false when left out) and is not saved.
  lgpreload.js now calls setPreloadPolicy isEnabled false for every app getPreloadPolicy lists as enabled and allowed, except
  com.webos.app.home and org.webosbrew.*, records them in /tmp/cleanyourtv-lgpreload.json, checks the result, and switches exactly
  those on again when the group or the debloat goes off; 5 s after the service starts, on every debloat change, every 2 min. No
  configd file, no restart; a leftover configd preload file of the previous way is removed once. tvprofile lgPreload is 'api'."
impact: medium
affected_modules: ["helper/lgpreload.js", "helper/tvprofile.js", "docs/debloat.md", "docs/security.md", "docs/tv-changes.md", "docs/development/internals.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/lgpreload.test.js (a stand-in preload manager as on webOS 25: only enabled and allowed apps but Home and the Homebrew Channel switched off, LG's saved allowed list unchanged, recorded, nothing more while off, off again after it restarts, back for exactly those apps when switched off, nothing with the debloat off, on an untried TV or with LG's Home, a preload manager that ignores it is reported, applied at once on a debloat change, only get/setPreloadPolicy called)", "tools/test/lgconfig.test.js", "tools/test/tvprofile.test.js"]
commit_ref: "feature/lg-config (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T15:15:43Z"
```

```yaml
id: CU-20261027-46
type: fix
title: "Changing the bar's place or LG's bar no longer restarts the Sonos subscription"
description: "Seen on the TV while testing: switching Hide LG's volume bar off called sync(), which subscribed to the speaker again
  and cleared the volume, so a change in the next second showed no bar. set() now starts again only when Sonos volume is switched on
  or off or another speaker is chosen; the place and hideLg only save and look at LG's bar again (lgPlan)."
impact: low
affected_modules: ["helper/sonos.js"]
related_tests: ["tools/test/sonos.test.js (a new place or LG's bar keeps the subscription, and the next change shows in the new place)"]
commit_ref: "feature/lg-config (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T15:22:20Z"
```

```yaml
id: CU-20261027-33
type: fix
title: "Home loads once after an update"
description: "The owner saw Home load twice after updating. reload-home.sh stopped Home's page and launched Home 2 s later, but webOS
  starts Home again by itself: on the owner's TV after the 1.6.20 update the log shows the new launcher ready, then a relaunch 1.7 s
  later from that launch. reload-home.sh now waits up to 8 s for a new Home process (one that was not running before the stop) and
  launches Home only when none came up. CYTV_TEST_BIN and CYTV_HOME_WAIT let the test run it with stand-ins. Not yet tried on the
  TV: running it there was not allowed in this session."
impact: low
affected_modules: ["scripts/reload-home.sh"]
related_tests: ["tools/test/scripts.test.js"]
commit_ref: "feature/one-home-load (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T16:31:41Z"
```

```yaml
id: CU-20261027-34
type: fix
title: "Wallpapers show a portrait photo whole instead of cropping it"
description: "The owner's photo of Home showed a portrait wallpaper cut to the middle (background-size: cover), heads off; the
  screensaver shows photos whole (contain on black). wall.js now reads the photo's shape when it has loaded: more than 12 % away from
  16:9, the layer gets .fit, which draws the photo whole (::after, contain) over a blurred (40 px), darkened copy that fills the
  screen (::before, cover, 80 px over each edge so the blur has no light rim). A photo near 16:9 fills the screen as before. The photo
  is now a CSS variable (--wpimg) on the layer; only the layer's opacity animates, so the blur is drawn once."
impact: low
affected_modules: ["app/src/js/wall.js", "app/src/css/home.css", "tools/oldchrome.js", "docs/wallpapers.md"]
related_tests: ["tools/oldchrome.js (wallpaper fit: a portrait stand-in photo gets contain, a landscape one cover; wallpaper chooser)"]
commit_ref: "feature/wallpaper-fit (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T19:36:23Z"
```

```yaml
id: CU-20261027-35
type: feature
title: "Holiday themes, applied by themselves over the chosen theme, with light seasonal effects"
description: "The owner asked for holiday themes. themeschema.js: a theme may name its dates (holiday {from, to}, MM-DD, over the new
  year too; holidayOf) and an effect, effects.particles (none, snow, leaves, bats, confetti, hearts, stars; sent as attrs.particles
  unless effects.speed is 0); a wallpaper remembers the theme folder that holds it (v.wallTheme), so a theme built on another keeps
  its base's wallpaper (also for extends). theme.js: with theme.holidays on (POST /api/theme/holidays {on}, off by default), the
  installed theme whose dates hold today (the shortest range first) is normalized over the chosen theme's values and resolved with its
  own accent; list() reports holidays {on, active, name}; ensureHoliday() downloads the catalogue's holiday theme for today or the
  next 3 days, at start, every 6 hours and when switched on; saving a theme keeps the switch. tools/theme-index.js adds the dates to
  index.json. Six themes: Halloween (bats), Harvest (leaves), Winter holidays (snow), New Year (confetti), Valentine's (hearts),
  Fourth of July (stars), with screenshots. Launcher: particles.js and particles.css draw 4 to 18 elements per effect between the
  background and the clock (transform and opacity only); Customise > Theme > Holiday themes switches them."
impact: medium
affected_modules: ["helper/themeschema.js", "helper/theme.js", "tools/theme-index.js", "themes/", "app/src/js/particles.js", "app/src/css/particles.css", "app/src/js/theme.js", "app/src/js/menus.js", "docs/themes.md", "themes/README.md", "DECISIONS.md"]
related_tests: ["tools/test/theme.test.js", "tools/oldchrome.js (holiday effect: the Halloween theme's bats layer behind the clock, not catching the pointer)"]
commit_ref: "feature/wallpaper-fit (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T19:49:01Z"
```

```yaml
id: CU-20261027-36
type: change
title: "Holiday themes get still frames instead of moving shapes"
description: "The owner asked for a spooky overlay like a Disney Halloween banner or the family calendar's seasonal decorations, and
  for nothing that moves unless it is sure not to slow the TV. effects.particles (and particles.js/css) is removed; a theme may have
  a frame instead, effects.overlay: a png or webp with transparency (at most 1.5 MB) in its folder, downloaded with the theme, served
  by the wallpaper route, kept with the folder that holds it (v.overlayTheme), sent as frame {id, file} only when set (overlay is already the grid mode's flag), and drawn by
  frame.js as one element between the background and the clock. tools/holiday-art.mjs draws the six frames as SVG (our own work:
  vignette in the holiday colour, soft blurred shapes, a few sharper ones in the corners) and renders them with Chrome at 960 x 540
  (300-400 KB each). Halloween's colours become teal and slime green (#021316, #4dff9a)."
impact: low
affected_modules: ["helper/themeschema.js", "helper/theme.js", "app/src/js/frame.js", "app/src/css/frame.css", "app/src/js/theme.js", "app/src/js/menus.js", "themes/", "tools/holiday-art.mjs", "tools/oldchrome.js", "docs/themes.md", "themes/README.md", "DECISIONS.md"]
related_tests: ["tools/test/theme.test.js", "tools/oldchrome.js (holiday frame: Halloween's frame behind the clock, no animation, not catching the pointer)"]
commit_ref: "feature/holiday-frames (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-27T23:00:16Z"
```

```yaml
id: CU-20261027-37
type: fix
title: "No screensaver over an HDMI input, and the volume bar's window does not stay over one"
description: "The owner found Warzone on the PS5 (HDMI 4, HDR Game, HDR with ALLM) darker than before. Read on the TV: the picture
  settings are at their brightest for HDR Game (backlight and contrast 100, peak brightness high, dynamic tone mapping on), nothing
  of ours writes picture settings, and the debloat stops no picture service; but the service log showed 'LG asked over
  com.webos.app.hdmi4, ours shown on Home' 7 minutes before: LG's idle screensaver request (a controller is not remote activity)
  brought Home with photos over the game. saver.js now asks which app is in front before it answers LG: an HDMI input is left to LG
  (ack true), as before this launcher; the answer is sent after that lookup, and LG decides when the service does not answer. Also,
  since 1.6.20 the volume bar's notify window stayed open, empty, for 10 minutes after a change; an open window over the picture may
  make the TV lower its HDR brightness, so sonos.js sends stay 0 when an HDMI input is in front (getForegroundAppInfo, a read)."
impact: medium
affected_modules: ["app/src/js/saver.js", "helper/sonos.js", "tools/oldchrome.js", "docs/screensaver.md", "docs/sonos.md"]
related_tests: ["tools/oldchrome.js (saver over hdmi: LG's request answered yes, Home not brought forward; saver over an app)", "tools/test/sonos.test.js"]
commit_ref: "feature/no-takeover-hdmi (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-28T02:18:33Z"
```

```yaml
id: CU-20261028-1
type: fix
title: "Telemachus: one card per show, the latest it watched, and a switch for it"
description: "The owner: the Telemachus row should show only the latest episode watched, one per show; it showed many (the plan loop
  added up to four of the channel's next, e.g. S8E10-E13 of one show). watch.js now reads Telemachus's GET /api/continue (its PR #4:
  a row per show, newest first, with resume or next): the episode in the middle (progress percent/100; {play: {resume: true}} when it
  is what plays now, else {show, season, episode}), else the next one when it has aired (marked next); a film by filmPlay; a show
  caught up is left out; 6 at most. An older Telemachus (no /api/continue, 404) gives what is playing and each show's latest started
  episode from /api/brief, never the plan. cfg.watch.tm false (Customise > Continue watching > Telemachus, checked by apps.js)
  stops reading it."
impact: low
affected_modules: ["helper/watch.js", "helper/apps.js", "app/src/js/watch.js", "app/src/js/menus.js", "tools/oldchrome.js", "docs/launcher.md"]
related_tests: ["tools/test/watch.test.js"]
commit_ref: "feature/telemachus-continue (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-28T22:52:21Z"
```

```yaml
id: CU-20261028-2
type: feature
title: "Merge upstream's work since the fork (to their 1.6.10 and dev): cards, icon colours, webOS 4, themes"
description: "The owner asked to review what lasharor/cleanyourtv-WebOS changed since the fork and take what is useful. Taken, by
  cherry-pick with the authors kept (-x names each source commit): Cards steps 2 to 6 and their manager screens (a phone page for
  card options on port 8792, Text, Weather from Open-Meteo only when a weather card is chosen, Home Assistant entity, entities and
  camera cards using Voice's Home Assistant address and token, OLED care, cards that OK can switch in the top row), the Lock Screen
  dock and name alignment (dock.tileFrost, shelf.dockAlign), launcher icon colours (a picture on a flat background, a dark logo),
  the Inputs picker's Magic Remote wheel, the bare file:// origin of webOS 4's Chromium 53 (kept to our app list: no live app; the
  API token still applies), the Lake Dock theme and tested-TV notes. Skipped: their app uninstalling (we have ours), their particle
  animation (the owner wants nothing that moves) and their 1.6.10 version commit. Merged by hand: cards in the top row with our
  Continue watching row, our Good night greeting in their cards, both phone pages in the manager's open handler, docs and test lists;
  Customise > Cards opens the manager's Cards screen. The phone pages' ports can be changed for the tests (CYTV_WALL_PORT,
  CYTV_CARDS_PORT; tools/test/lib.js uses 38791 and 38792), since a development machine may have something else on 8791/8792."
impact: medium
affected_modules: ["helper/cards.js", "helper/weather.js", "helper/hacards.js", "helper/server.js", "helper/themeschema.js", "helper/wallpapers.js", "app/src/js/cards.js", "app/src/js/layout.js", "app/src/js/theme.js", "app/src/js/menus.js", "app/src/js/core.js", "manager/src/", "picker/app/index.html", "themes/", "docs/", "tools/test/lib.js"]
related_tests: ["tools/test/cards.test.js", "tools/test/theme.test.js", "tools/test/server.test.js", "tools/test/wallpapers.test.js", "tools/test/api.test.js", "tools/oldchrome.js"]
commit_ref: "feature/upstream-1.6.10 (the commits named in their (cherry picked from ...) lines and the one that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-28T23:19:23Z"
```

```yaml
id: CU-20261028-3
type: feature
title: "Screensaver Style: Frame, each photo like a print on a wall"
description: "The owner asked to reimagine the screensaver as a photo frame (like Samsung's The Frame) and approved the defaults and
  labels. saver.js gains Style (Frame by default, or Photos), Frame (wood, black, gold, white, none), Mat (from the photo, white,
  cream, charcoal) and Label (on): a photo is laid out by its shape (near 16:9 fills the inside of the frame; a landscape one large in
  the mat; a portrait one tall; two portraits of the same day side by side, a photo that does not pair kept for the next turn), the
  mat takes a little of the photo's average colour when the feed gives it (a dark photo gets charcoal; no colour, warm white: the page
  cannot read a photo's pixels, since a cross-origin read would need the API token), the clock is smaller in the mat's corner and the
  label shows the day taken (else added) and the caption. Only the cross-fade moves. photofeed.js keeps each photo's takenAt (else
  createdAt), caption (control characters and runs of spaces collapsed, 80 characters), width, height and color from the feed list,
  saved with the ids, and /api/photofeed/next returns them. New photo also takes 5 and 15 minutes. apps.js checks the new settings."
impact: medium
affected_modules: ["app/src/js/saver.js", "app/src/css/saver.css", "app/src/js/menus.js", "helper/photofeed.js", "helper/apps.js", "tools/oldchrome.js", "docs/screensaver.md"]
related_tests: ["tools/test/photofeed.test.js", "tools/test/apps.test.js", "tools/oldchrome.js (saver frame: two portraits of one day side by side with their label in a wood frame; saver; saver keys; saver over an app)"]
commit_ref: "feature/frame-saver (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T01:42:20Z"
```

```yaml
id: CU-20261028-4
type: feature
title: "Screensaver frame rebuilt like a frame TV: real-looking woods, paints and metals, profiles, bevel-cut mats, more options"
description: "The owner found the first frames (flat CSS borders, then ornate SVG mouldings) fake and asked for realistic frames like any
  frame TV, with wood looks, plain black or colours, more options, one photo filling the frame unless it is portrait, or several, and
  painting-like finishes. tools/saver-art.mjs now makes the materials pixel by pixel in Chrome (seeded noise) as small WebP files in
  app/: seven boards (walnut, oak, teak, ash, cherry, grey oak, black ash: rings that drift, fibres, pores), brushed brass and silver,
  the tooth of mat board, a canvas weave and linen (about 300 KB together). saver.js builds the frame from four mitred sides (clip-path
  trapezoids turned into place by a matrix), each a different length of the board, and lights each side from its profile (Modern,
  Thin, Bevelled, Classic: the height across the side gives the normal; diffuse and a satin, paint or metal shine from one light above
  and to the left, written as a CSS gradient of shade and light over the material); seven paints need no picture. The frame is its own
  layer under the two photo layers and is drawn again only when its material, profile or the screen size change. The photos hang in
  bevel-cut windows (the core lit from above), the frame throws its shadow on the mat, a faint room light lies over it all. Photos at
  a time: up to two (default), up to three portraits, or One (a landscape photo fills the inside, cut to fit; a portrait hangs in the
  mat). Finish: Canvas (a weave over the photo) or Painting (also a varnish and a darker edge). Label: pencilled under each window,
  a brass plaque on the frame, or off. Mats: also Grey, Black (black core) and Linen. The clock sits small in the mat's top corner.
  Frame and Mat are lists with a tick in the menu. apps.js keeps each choice only when it is one of the list and not the default. The
  harness serves the app's saver-*.webp to the pages as the TV does, and the frame check proves the board decodes in Chromium 68. The
  ornate frames and the gilded/wood/gold/white set of CU-20261028-3 are gone (unreleased)."
impact: medium
affected_modules: ["app/src/js/saver.js", "app/src/css/saver.css", "app/src/js/menus.js", "helper/apps.js", "tools/saver-art.mjs", "app/saver-*.webp", "tools/oldchrome.js", "docs/screensaver.md", "docs/fork.md", "README.md"]
related_tests: ["tools/test/apps.test.js (the screensaver keeps its Style, Frame, Profile, Mat, Photos at a time, Finish and Label only when they are one of the choices)", "tools/oldchrome.js (saver frame: an oak bevelled frame of four 70 px sides around the mat, two portraits in windows with pencilled labels, the board decodes; saver; saver keys)"]
commit_ref: "feature/frame-saver (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T02:16:13Z"
```

```yaml
id: CU-20261028-5
type: fix
title: "Old-Chromium page checks: the page's own copy when Chromium 79 cannot hand it over; saver keys waits for the photo"
description: "The v1.6.26 release run failed twice in its checks: on GitHub's Linux runner, headless Chromium 79 (webOS 6's engine, which
  the checks must keep) failed to hand over the manager, saver and hold-ok pages five times each ('Failed to serialize document:
  Uncaught'), and the dev build's saver-keys check read the photo 1.5 s after Right, before the frame (now the default, it loads a
  photo before hanging it) had shown it. The same checks pass in Chromium 79 in an Ubuntu 26.04 container on the owner's Mac. The probe
  in each test page now sends the page's own copy of itself to the stand-in each second it changed, and the harness uses that copy when
  the browser hands nothing over (or shows why the page could not copy itself); saver keys waits up to 6 s for the photo to change.
  The runners stay on ubuntu-latest (the owner's choice)."
impact: none
affected_modules: ["tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (every page also passes when the browser's hand-over is ignored and only the page's own copy is read: checked once by hand)"]
commit_ref: "fix/ci-runner (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T02:40:12Z"
```

```yaml
id: CU-20261028-6
type: feature
title: "Dawn theme, with the clock behind the scenery (effects.foreground), the date above the time and a larger clock"
description: "The owner liked couch-tv's Dawn home and asked for it in our own way. Themes gain effects.foreground: a png or webp in the
  theme folder, the wallpaper with its sky cut away, downloaded with the theme (theme.js) and served like the wallpaper, drawn by
  frame.js as a layer over the clock (#thfg, z 6 over #top's 5) while the apps, the cards and the name come forward over it (z 7 when
  a theme has one); hidden while the user's own photos are the wallpaper, since the cut-out belongs to the theme's picture (cut-outs
  for the user's photos would have to come with each photo from its server). clock.scale now goes to 5, clock.dateAbove puts the date
  over the time in the stack layout, and clock.alpha lets the picture show through the digits; all three reach the page only when a
  theme sets them. Over a holiday theme the cut-out is left out and the clock stands in front as usual (the owner's choice). themes/dawn uses couch-tv's 'Rainforest dawn' scene and its cut-out (MIT, credited in themes/dawn/CREDITS.md; made
  there with an image model and free to use) with our own layout: the time 4.6 times as large and light, behind the hills, the date
  above, round top buttons, eight tiles in a dark glass dock at the foot, all apps over the picture. The page checks now serve a
  theme's pictures from the repository as the TV serves its downloaded copy."
impact: low
affected_modules: ["helper/themeschema.js", "helper/theme.js", "app/src/js/frame.js", "app/src/js/theme.js", "app/src/css/frame.css", "app/src/css/home.css", "themes/dawn", "themes/index.json", "themes/README.md", "docs/themes.md", "tools/oldchrome.js"]
related_tests: ["tools/test/theme.test.js (effects.foreground names a png or webp in the theme folder, with clock.dateAbove, clock.alpha and a larger time; a theme's foreground is downloaded with it and served; a holiday theme over Dawn keeps its clock but not the cut-out; the themes that do not use the new settings resolve without them)", "tools/oldchrome.js (dawn front: the foreground is a layer over the clock and under the apps, its picture loads, the date stands above the time)"]
commit_ref: "feature/dawn-theme (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T02:47:48Z"
```

```yaml
id: CU-20261028-7
type: feature
title: "Menus in two panes inside a section (after couch-tv's settings), section icons; Customise spelled Customize"
description: "The owner asked for our settings menu to look like couch-tv's and for Customise to read Customize. drawMenu: a menu opened
  from another shows the list it came from in a column on the left (icons in rounded squares, the open section lit, the pointer on
  another section opens that one) and its own rows on the right (lighter cards, a picture in the row where the row has one: the theme
  list, a green tick for the chosen one of a list, 'OK to change, Back to go back' at the foot), on a solid background; Left goes
  back to the sections (Right in right-to-left languages); a menu on its own stays one panel with Home in view, so a change shows at
  once. The large picture beside the theme list is used only when the theme list is on its own. Customize's rows have icons
  (core.js: dock, top buttons, hidden, continue watching, order, running dot, theme, cards, accent, clock, wallpapers, screensaver,
  more). Customise, customise and customisation become Customize, customize and customization in the pages, the service's texts,
  every translation file's keys, the docs and the screenshot's name (docs/screenshots/customize.jpg); the change history keeps its
  words."
impact: low
affected_modules: ["app/src/js/menus.js", "app/src/css/menus.css", "app/src/js/core.js", "i18n/*.json", "docs/*.md", "README.md", "themes/README.md", "helper/*.js (texts)", "manager/src/js/*.js (texts)", "scripts/bootstrap.sh (a message)", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (menu sections: Customize alone is one panel; Screensaver opened from it shows Customize's list with Screensaver lit and a hint; the Frame list ticks the chosen frame; Left goes back)"]
commit_ref: "feature/dawn-theme (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T02:57:11Z"
```

```yaml
id: CU-20261028-8
type: feature
title: "Customize > Clock: format, position, size and Behind the picture, kept across themes"
description: "The owner asked for the clock behind the scenery to be optional and for a way to move the clock, or keep it normal as with
  photos and the Halloween theme. Customize > Clock is now a section: Format (as before), Position (the theme's, top left, top centre),
  Size (the theme's, smaller x0.7, larger x1.4, held to 0.6-5) and, only on a theme with a cut-out (effects.foreground), Behind the
  picture on or off. theme.js keeps them in config.theme.clock ({pos, size, front}, defaults not kept, kept when the theme changes), lays
  them over the resolved theme (also under a holiday theme) and answers /api/theme/clock; /api/theme/list carries clock and hasFront.
  Over a holiday theme and over the user's photos the clock is always in front (CU-20261028-6)."
impact: low
affected_modules: ["helper/theme.js", "app/src/js/menus.js", "helper/themeschema.js (text)", "docs/launcher.md", "docs/themes.md", "tools/test/golden/api.json"]
related_tests: ["tools/test/theme.test.js (Customize > Clock moves the clock, sizes it and puts it in front of a theme's cut-out; it stays when the theme changes)", "tools/test/api.test.js (themes: the list carries clock and hasFront)"]
commit_ref: "feature/clock-options (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T03:35:49Z"
```

```yaml
id: CU-20261028-9
type: fix
title: "Weather card as one line in a short place; the Cards QR screen goes after the phone saves; the update check's banner goes; release day shown"
description: "Three faults the owner met on the TV. (1) On Glass the only card place is a 30 px line above the clock; a weather card
  (64 px icon and temperature) was cut off at the time and looked as if it were behind it: in a place under 72 px it is now one line as
  tall as the place (icon, temperature, place and sky; no next days), mirrored for right-to-left. (2) The manager's Cards QR screen
  stayed after the phone saved: cards.js keeps savedAt and /api/cards/status returns it; the screen watches it and goes back to Home
  when it was opened from Customize > Cards, else to the Cards list (the phone page stays for more changes). (3) Check for updates kept
  its 'Checking…' banner for good (load(true) keeps a banner): the banner is cleared when the answer is in, or says Cannot check.
  Also asked: the manager's CleanYourTV row shows the day the latest release came out (parseRelease reads published_at)."
impact: low
affected_modules: ["app/src/js/cards.js", "app/src/css/home.css", "app/src/css/rtl.css", "helper/cards.js", "manager/src/js/screens.js", "manager/src/js/menu.js", "helper/updates.js", "docs/launcher.md", "docs/manager.md", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (weather in a short place: one line inside Glass's place, above the time; manager update check: the banner goes and the release day shows)", "tools/test/cards.test.js (the status says when the phone page last saved)", "tools/test/updates.test.js (a release carries the day it was published)"]
commit_ref: "feature/clock-options (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T03:35:49Z"
```

```yaml
id: CU-20261028-10
type: fix
title: "CI runs the old-Chromium page checks in an Ubuntu 26.04 container on the latest runner"
description: "The 1.6.27 release run failed twice: on GitHub's ubuntu-latest image (now Ubuntu 26), Chromium 79 crashed on four pages
  before they could even send their own copy (CU-20261028-5). The owner wants the latest runner and the engines kept (they are webOS 5
  and 6's). tools/oldchrome-container.sh runs tools/oldchrome.js in a plain Linux container with only the old builds' libraries and
  Liberation fonts, the engines in the same cache; check.sh --chromium uses it when CYTV_CHROMIUM_IMAGE is set, as checks.yml,
  dev-build.yml and release.yml now do (ubuntu:26.04); the runner's own library step is gone. The same container also runs both engines
  on the owner's Mac, where Chromium 79 for macOS crashes."
impact: none
affected_modules: ["tools/oldchrome-container.sh", "tools/check.sh", ".github/workflows/checks.yml", ".github/workflows/dev-build.yml", ".github/workflows/release.yml", "AGENTS.md"]
related_tests: ["tools/oldchrome-container.sh ubuntu:26.04 (both engines, every page, on the owner's Mac)"]
commit_ref: "feature/clock-options (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T03:35:49Z"
```

```yaml
id: CU-20261029-2
type: fix
title: "The old-Chromium container hands its files back, so CI can upload the screenshots"
description: "The first dev build with the old-Chromium checks in the Ubuntu 26.04 container (CU-20261028-10) passed every page in both
  engines (five through the page's own copy) but failed its last step: the screenshots, written by root in the container, could not be
  zipped by the upload step. tools/oldchrome-container.sh now gives the screenshots and the engine cache back to the calling user
  (chown to its uid:gid) when the run ends, keeping the run's exit status."
impact: none
affected_modules: ["tools/oldchrome-container.sh"]
related_tests: ["tools/oldchrome-container.sh ubuntu:26.04 --engine 68 with CYTV_SHOTS (the screenshots and the cache come back owned by the calling user)"]
commit_ref: "fix/ci-shots (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T04:18:32Z"
```

```yaml
id: CU-20261029-1
type: feature
title: "Phone remote: a paired phone on the Wi-Fi as the TV's remote (keys, touchpad, typing, apps)"
description: "The owner asked to use a phone as a remote, like LG's or Telemachus's, securely with a QR code or a code. remote.js:
  pairing opens for two minutes with a six-digit code on the TV and in the QR code (#p=<code>), five wrong codes close it; a phone that
  gives it gets its own 32-byte key, the TV keeps only its SHA-256 (config.remote.devices, at most ten), compared in constant time; the
  LAN server (port 8794) runs only while a phone is paired or pairing is open, answers only private and link-local addresses, refuses
  requests whose Origin is another site, sends no CORS headers, may not be framed (CSP, x-frame-options), and ends the phones' open
  connections when switched off or when a phone is removed. Presses go to LG's network input as its own messages on the socket
  getPointerInputSocket gives (/tmp/netinput.pointer.sock on the owner's TV: button name, move dx/dy held to 300, click, scroll), text
  to com.webos.service.ime (insertText, deleteCharacters, sendEnterKey), power to networkinput controls/power, apps (the dock's order,
  no hidden apps or inputs) to the app manager. remotepage.js: the phone page (Remote, Touchpad, Type and Apps tabs; holds repeat;
  installs to the Home Screen with a manifest). The manager's Phone remote screen pairs (QR, closes when the phone has paired), lists
  the phones (OK removes one) and switches it on or off; the launcher's Customize > Phone remote... opens it. Read-only checks on the
  owner's TV (with his OK) found the network input service, its socket, /dev/uinput, LG's ports 3000/3001 and wake on Wi-Fi on; no key
  has been pressed on the TV yet, so the message form is LG's documented one, not yet seen working on it."
impact: medium
affected_modules: ["helper/remote.js", "helper/remotepage.js", "helper/helper.js", "manager/src/js/menu.js", "manager/src/js/screens.js", "manager/src/js/share.js", "manager/src/js/input.js", "app/src/js/menus.js", "app/src/js/core.js", "docs/remote.md", "docs/security.md", "zensical.toml", "AGENTS.md", "tools/test/lib.js", "tools/test/api.test.js"]
related_tests: ["tools/test/remote.test.js (pairing with the code, five wrong codes, a key per phone kept as its hash, presses in LG's message form on a stand-in socket, unknown keys / no key / wrong key / another site refused, typing through the keyboard service, the apps in dock order, off stops the server, a removed phone loses access)", "tools/test/api.test.js (the service lists the remote part)"]
commit_ref: "feature/phone-remote (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T04:04:02Z"
```

```yaml
id: CU-20261029-3
type: fix
title: "Phone remote keys go through LG's sendSpecialKey and sendKeyCodes (the pointer socket ignored button messages)"
description: "First test on the owner's TV with 1.6.27 (his OK; the TV woken with a Wake-on-LAN packet from the Mac, whose ARP cache
  held the TV's MAC in standby): a paired test client's presses were accepted by the pointer socket but did nothing (Home and the
  gear key, foreground and screen captures unchanged). Read-only, the network input binary names its special keys (HOME, BACK, ENTER,
  EXIT, MUTE, VOLUMEUP/DOWN, CHANNELUP/DOWN, PAUSE, REWIND, FASTFORWARD, RED, GREEN, YELLOW, DASH, QMENU, no arrows and no MENU);
  sendSpecialKey {key: 'HOME'} took the TV from HDMI 4 to Home, sendKeyCodes {keyCode1: 106/105} moved the focus right and left,
  {key: 'QMENU'} opened the quick settings and EXIT closed them (screen captures compared by checksum only: the owner's photos were
  on Home). remote.js now presses the named keys with sendSpecialKey (the gear key MENU as QMENU) and the others as Linux key codes
  with sendKeyCodes (arrows 103/108/105/106, play 207, info 358, blue 401, digits 2-11); the pointer stays on the socket, unconfirmed."
impact: medium
affected_modules: ["helper/remote.js", "docs/remote.md", "tools/test/remote.test.js"]
related_tests: ["tools/test/remote.test.js (keys LG names go through sendSpecialKey, the gear key as QMENU, the others as Linux key codes; the pointer on its socket)"]
commit_ref: "fix/remote-keys (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T04:57:21Z"
```

```yaml
id: CU-20261029-4
type: fix
title: "Security: icons without the token, the bare file:// origin only on webOS 4, the update source and telnet shown"
description: "From the owner-approved review of upstream's PRs (S14, S1, S3) and own-your-glass (telnet). server.js answered GET /icon/<id> only with the API token once it was required, but the pages load icons as images (crossOrigin), which cannot carry it: a newly installed app would have lost its icon; icons (GET of /icon/<id> only) are now answered without it. The bare file:// origin (webOS 4's Chromium 53) counts as one of our apps only when tvprofile says webOS 4 or the version is not known yet (helper.js passes bareFile). security.js: the update source (D/source can name another repository; ours or not), whether the token is required, and whether the Homebrew Channel's telnet server is off (its file /var/luna/preferences/webosbrew_telnet_disabled); in the manager status (security), the manager (Update source, Telnet with a switch that writes or removes that file, API token) and the Share log (Security section). Telnet changes only when the user switches it."
impact: medium
affected_modules: ["helper/server.js", "helper/helper.js", "helper/security.js", "helper/manager.js", "helper/sharelog.js", "helper/paths.js", "helper/updates.js", "manager/src/js/menu.js", "docs/security.md", "docs/manager.md", "tools/test/golden/api.json"]
related_tests: ["tools/test/server.test.js (an app's icon is answered without the token, only as a GET of /icon/<id>; a bare file:// origin is our app on webOS 4, refused on webOS 10)", "tools/test/manager.test.js (the status says where updates come from, whether the token is required, and telnet's switch works both ways)", "tools/test/api.test.js (a bare file:// origin on webOS 10 is refused)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T13:03:49Z"
```

```yaml
id: CU-20261029-5
type: feature
title: "Debloat: admanager its own group, the TV's country ad servers, LG's ad and promotion settings, HbbTV opt-in, pre-loaded copies closed, a check that it works with a repair"
description: "From own-your-glass (the owner's yes table) and upstream issues 47 and 29. debloat-stop.sh/undo.sh: admanager is the group adapps (on by default; off with ads too, so a TV that had ads off keeps it; the owner says Disney+ works, HBO Max may need it off); the hosts block adds <country>.ad/.info.lgsmartad.com from LG's smartServiceCountryCode2 and writes out-of-date marked lines again (CYTV_HOSTS for the tests). lgsettings.js: the group lgads switches LG's own home promotion, screensaver ad, ad cookie, Smart Tips, sports alert, limit ad tracking, content recommendation, Live TV promotion, LivePlus and promotion-video settings (keys own-your-glass found on webOS 25; missing keys skipped; text or true/false as the TV keeps them), saving LG's values in D/lgsettings-saved.json and putting them back when switched off; the opt-in group hbbtv (options.debloatOn) switches HbbTV off, Do Not Track on and the device ID off. lgpreload.js closes the copies LG already pre-loaded (running, never on the screen in that process; closeByAppId, then killApp) and looks again when the TV wakes (the service's clock jumps). debloatcheck.js: GET /api/debloat/check per group (stubs mounted and not running, daemons inactive, hosts lines, pre-loading, LG's settings), shown in the manager (Debloat > Check that it works); 90 s after the start and 30 s after a wake a script group not in place runs debloat-stop.sh again and logs it. A test pins that the debloat never touches sdx or ss.gateway (own-your-glass F42, F48)."
impact: medium
affected_modules: ["scripts/debloat-stop.sh", "scripts/debloat-undo.sh", "helper/debloat.js", "helper/lgsettings.js", "helper/lgpreload.js", "helper/debloatcheck.js", "helper/manager.js", "helper/helper.js", "helper/paths.js", "manager/src/js/menu.js", "docs/debloat.md", "docs/manager.md"]
related_tests: ["tools/test/scripts.test.js (admanager is its own group, off with ads, undone with ads; the country's ad servers, written again, nothing twice, all undone; never sdx or ss.gateway)", "tools/test/lgsettings.test.js", "tools/test/lgpreload.test.js (the pre-loaded copies are closed, the one someone opened stays)", "tools/test/debloatcheck.test.js"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T13:03:49Z"
```

```yaml
id: CU-20261029-6
type: feature
title: "Upstream PRs 59, 66, 51 taken; watchdog restart limit; LG TV button; pushed placeholder apps hidden; the manager closes when left"
description: "Reviewed cherry-picks with their authors kept and the AI co-author lines removed (D-20261028-1): PR 59 (JohnnyTax: the Inputs picker's tile colours like the launcher's), PR 66 (Lars: scripts/watchdog.sh starts a stopped service again, also after the fallback to LG's Home, keeps the crash log; upstream issue 65), PR 51 (Reveal80: docs on LG's two power-offs and network ad blocking; our troubleshooting wording kept). Ours on top: the watchdog starts the service at most five times in ten minutes, then notes it once, and keeps the first crash log (S7). core.js offers an LG TV top button (com.webos.app.livetv, upstream issue 69). apps.js leaves out LG's stub apps and the promotions it pushes as apps (ui30, webos.day, com.miniclip.eightballpool; own-your-glass). The manager closes itself after two minutes in the background, not while a job runs or a phone page it opened is in use (own-your-glass F51). docs/debloat.md says what an on-TV block cannot do (DNS over HTTPS)."
impact: low
affected_modules: ["picker/app/index.html", "scripts/watchdog.sh", "scripts/10-cleanyourtv-home", "scripts/uninstall.sh", "app/src/js/core.js", "app/src/js/clock.js", "helper/apps.js", "manager/src/js/input.js", "docs/troubleshooting.md", "docs/debloat.md", "docs/launcher.md"]
related_tests: ["tools/test/scripts.test.js (the watchdog starts a stopped service, ends when uninstalled, and stops after the limit with one note)", "tools/test/pages.test.js (the picker's tile colours, from PR 59)", "tools/test/apps.test.js (placeholder and promotion apps left out)", "tools/oldchrome.js (manager closes when left)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T13:03:49Z"
```

```yaml
id: CU-20261029-7
type: feature
title: "Magic Remote wheel and hover (upstream PR 68), and Continue watching in a strip above a bottom dock (Dawn)"
description: "The owner asked for PR 68 and, on Dawn, found the Continue watching row small, far from the dock, with Spotify and YouTube tiles beside it. PR 68 (JohnnyTax) taken: its Live TV pointer commit and its test as cherry-picks (authors kept, AI lines removed); its menu and Home part rewritten for our two-pane menus: hovering a row selects it (real movement only), the first or last row on show scrolls one row at most about three times a second, the wheel moves a menu one row and Home one tile in reading order; not while Live TV, the screensaver or the photo chooser is open, and the wheel that ends the photos does nothing else (saver.js stops it). Dawn: with the dock along the bottom and the apps over the screen, a dock app's row opened the overlay grid near the top, its cards at the grid's small tile size, and the grid's first apps (Spotify, YouTube) showed beside them. Now (theme.js TH.strip, layout.js) the cards stand in a strip (#wstrip) just above the dock as 264 x 148 pictures centred over it, the grid stays shut, Up from the dock goes into them, Down back, Down from the dock into the apps, Up from the cards to the top buttons."
impact: medium
affected_modules: ["app/src/js/menus.js", "app/src/js/saver.js", "app/src/js/live.js", "app/src/css/live.css", "app/src/js/theme.js", "app/src/js/layout.js", "app/src/js/input.js", "app/src/css/watch.css", "docs/launcher.md", "docs/live-tv.md", "tools/oldchrome.js"]
related_tests: ["tools/test/pointer.test.js (hoverDir, homeStep)", "tools/oldchrome.js (magic remote wheel: a menu row and a Home tile per notch; watch strip in dawn: Plex's cards above the dock, wide, not in the grid, the grid shut, Up into them, Down back, Down again into the apps)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T13:51:05Z"
```

```yaml
id: CU-20261029-8
type: feature
title: "Every menu opens the same way, the Screensaver shows an example of its frame, Show it now comes back to the menu, Dawn's clock moves aside over your photos"
description: "The owner found the menus opening differently (Theme unlike Customize), the frame names hard to picture, Show it now leaving the menu, and Dawn's large clock in the way of his photos. menus.js draws three layouts the same way: Customize (root) is its own list on the left with the focused section's rows peeking on the right (Right or OK goes in); a section (nest) keeps Customize's list on the left with that section lit; a list with pictures (pic: the themes, or a menu with a preview) shows the focused one large on the left. saver.js SAVER.sample(box, settings) draws a still example of the screen, frame (the same mitred sides, shared with the saver as buildSides), mat, made-up pictures, finish and label, scaled into the menu's picture; the Screensaver menu and its Frame and Mat lists use it with the focused row's choice in place, and a list opens on the chosen row. Show it now keeps the menu open under the photos, so the key that ends them lands back on it. frame.css: over your own photos (body.wpon) on a theme with a cut-out (Dawn), the clock goes top left at scale 1.5."
impact: medium
affected_modules: ["app/src/js/menus.js", "app/src/css/menus.css", "app/src/js/saver.js", "app/src/css/saver.css", "app/src/css/frame.css", "docs/launcher.md", "docs/screensaver.md", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (menu sections: Customize root with peeking rows, a section nested with Customize lit, the Screensaver's example with four sides, its Frame list ticked and the example following the focus, Left back to Customize; screensaver menu: the example fills the menu's picture with two example windows; dawn clock with photos: the cut-out gone and the time top left at under half its size)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T14:30:34Z"
```

```yaml
id: CU-20261029-9
type: feature
title: "The weather card's place by ZIP code on the TV, and its options without the phone"
description: "The owner asked to type a ZIP code on the TV instead of using the phone page. cards.js: POST /api/cards/place {slot, zip} searches the code with Open-Meteo's geocoding in the TV's country (LG's smartServiceCountryCode2; any country when nothing is found there), sets the weather card's place, latitude and longitude, and °F for a first place in the US; POST /api/cards/option {slot, key, value} sets one of a card's choices, only to a value its type offers. weather.js search() takes a country and returns each place's country code. The manager: choosing Weather for a place without one opens a ZIP code screen (a text field for LG's keyboard, the remote's number keys or the phone remote's Type; Look it up), and the card type list shows Place, Temperature and Show rows for a weather card."
impact: low
affected_modules: ["helper/cards.js", "helper/weather.js", "manager/src/index.html", "manager/src/js/screens.js", "manager/src/js/menu.js", "manager/src/js/list.js", "manager/src/js/input.js", "manager/src/css/manager.css", "docs/launcher.md", "docs/api.md"]
related_tests: ["tools/test/cards.test.js (a ZIP code needs a weather card there; it is searched in the TV's country and sets the place, °F in the US; a code not found there is tried in any country and the place stays when nothing is found; only a code is searched; the manager sets a card's choices only to offered values)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T14:30:34Z"
```

```yaml
id: CU-20261029-10
type: fix
title: "Phone remote: laid out like LG's remote, the volume and Mute reach a soundbar, a smoother touchpad, five minutes to pair"
description: "The owner's phone remote did not change the sound of his Sonos on eARC (Dawn's volume bar did not show either), the touchpad's tap did nothing, and pairing took several tries. On the TV, network input's VOLUMEUP did not reach the soundbar while com.webos.service.audio/master/volumeUp and volumeDown did (6 to 7 and back, seen); the remote now sends the volume there, and Mute reads the mute state (getVolume) and sets the opposite (mute). A tap on the touchpad is OK (sendSpecialKey ENTER), which clicks where the pointer is while it shows: the pointer socket's click message did nothing. Pairing stays open five minutes instead of two. The pairing screen and docs say that an iPhone's Home Screen icon keeps its own storage and pairs again with a new code (the owner's icon opened unpaired). Safari's HTTPS-Only setting blocks the plain http page; the owner got past it on his phone, HTTPS on a LAN name is left for later. The owner asked for a page like a real remote: remotepage.js is a dark remote body sized from one unit (fits an iPhone without scrolling): power top left (confirm, then /power), the status, a 123 number pad (1-9, 0, DASH, OK), VOL and CH rockers with Mute and Home between, the D-pad with Settings, Info, Back and Exit at its corners, playback and the four colour keys, inline SVG icons, pressed states, a haptic tap on iOS 18 (a hidden switch toggled), errors as a toast. The touchpad adds up the finger's movement and keeps one /move on its way at a time (at least 28 ms apart, a move without an answer after 1.5 s stops blocking), with acceleration (1.15 + 1.9 x speed, at most about 3x); a tap is one finger, under 10 px and 400 ms; two fingers scroll the same way. Every API path, the pairing and the stored key are as before."
impact: low
affected_modules: ["helper/remote.js", "helper/remotepage.js", "manager/src/js/screens.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (the volume goes to LG's audio service and Mute switches the state it reads; the pointer moves and scrolls through the socket and a tap is OK; pairing opens for five minutes)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T14:30:34Z"
```

```yaml
id: CU-20261029-11
type: feature
title: "The screensaver frame's woods are photographed wood"
description: "The owner found the frames drawn-looking ('make them realistic, like Samsung or Hisense') and approved downloading CC0 textures. tools/saver-wood.mjs cuts each wood board (2048 x 96, the grain along it, WebP) from Poly Haven's 2K colour maps (CC0, not kept in the repository): Walnut and Cherry from Dark Wood (toned brown, and calmer red), Oak, Teak (warmer, darker), Ash (paler) and Black ash (near black, the grain kept) from Oak Veneer 01, Grey oak from Kitchen Wood; a texture whose grain runs up and down is turned. saver.js MATERIAL takes each board's average colour as the colour under it. tools/saver-art.mjs no longer draws woods (it would have overwritten the photographed boards); it keeps the metals, mat board, canvas and linen. docs/screensaver.md credits Poly Haven."
impact: low
affected_modules: ["tools/saver-wood.mjs", "tools/saver-art.mjs", "app/saver-wood-walnut.webp", "app/saver-wood-cherry.webp", "app/saver-wood-oak.webp", "app/saver-wood-teak.webp", "app/saver-wood-ash.webp", "app/saver-wood-grey.webp", "app/saver-wood-black.webp", "app/src/js/saver.js", "docs/screensaver.md"]
related_tests: ["tools/oldchrome.js (saver frame: the four sides with their wood; screensaver menu: the example frame in the menu's picture; menu sections: the Frame list's example follows the focus from oak to teak)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:05:00Z"
```

```yaml
id: CU-20261029-12
type: fix
title: "Plex: linking works again (plex.tv answers a new code with 201), a busy or expired code, the server's address that answers"
description: "The owner could not link Plex: the TV's /api/watch/accounts said 'HTTP 201'. plex.tv answers POST /api/v2/pins with 201 Created, and plex.js read it through fetch.read, which refuses every status but 200, so link() gave an error before any code was shown; the test's stand-in plex.tv answered 200. plex.js now takes any 2xx as an answer and Plex's {errors: [{message}]} as the error. While waiting, a code plex.tv no longer knows (404) is expired, not an error; a dropped connection or a busy plex.tv is asked again; the wait ends with the code's own expiresIn when shorter than ten minutes. A new code or Unlink ends the asking for the code before, also an answer still on its way (two presses no longer left two loops, and an answer after Unlink no longer linked the TV). Once linked, the server is kept at the first of its addresses that answers as that server (/identity, no key sent, machineIdentifier checked): those on the network, then (unless the server requires secure connections) the same over plain http for a router that blocks plex.direct names of local addresses, then those from outside; never the relay; the first when none answers just now."
impact: medium
affected_modules: ["helper/plex.js", "docs/launcher.md", "docs/security.md"]
related_tests: ["tools/test/watchlinks.test.js (plex.tv's 201 for a new code; a busy answer asked again; an expired code; an answer after unlinking links nothing; the server's first address that answers as that server, the plain-http fallback, another server skipped, /identity asked without a key)"]
commit_ref: "feature/plex-link (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T14:38:29Z"
```

```yaml
id: CU-20261029-13
type: feature
title: "LG's rows: Netflix and Prime Video's own rows, their Continue watching first"
description: "Read on the owner's TV (read only): LG's content miner keeps rows only for the apps LG's server fills (YouTube, Disney+, Apple TV, LG Channels: LG's picks, nothing personal, no progress); Netflix and Prime Video write their own rows through their in-app services (NFService, amazon.service) into LG's app manager with applicationManager/setContents, where getAllContents shows them: Netflix 'Continue Watching for <profile>' and 'Everyone's Watching', Prime Video 'Continue watching' (with catalog {title, season_number, episode_number} and watch_state {episodeNumber, watchNextType, totalTimeSeconds, lastEngagementTime}), 'You might like' and 'Must watch'. lgrows.js now also reads getAllContents (read only, as ourselves) and adds the row of an app's own launch point (<appId>_default) for each app the miner has nothing of; the miner's rows stay as they were. Within an app the Continue watching shelf comes first (its category, or a watch_state); a Prime Video episode shows the series as its title and 'S2 E1' under it. Bookmarks and pinned copies are left out, and the apps' onShow calls (Netflix 'impression', Prime Video 'invoke') are never made. A TV whose app manager does not answer keeps the miner's rows. A card is now keyed on the item's own id (YouTube v, Netflix m, Prime Video gti, Disney+ contentId; else an address without its query, as Apple TV's carries the place in the row), so a row written again (Netflix renews expireAt and iid) keeps its cards and Remove from this row keeps them removed; a card removed before this may come back once."
impact: low
affected_modules: ["helper/lgrows.js", "docs/launcher.md", "docs/security.md", "DECISIONS.md"]
related_tests: ["tools/test/watch.test.js (the app manager's rows read as ourselves; Prime Video's and Netflix's Continue watching first, the series and episode apart; the miner's row kept for an app it has; no bookmarks or pinned copies; contentTarget; no onShow passed on; a row written again keeps its cards; a TV without getAllContents keeps the miner's rows)"]
commit_ref: "feature/plex-link (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T14:49:13Z"
```

```yaml
id: CU-20261029-14
type: fix
title: "Phone remote: the touchpad moves, clicks and scrolls; held keys are LG's long press; colour keys can open an app"
description: "The owner found the touchpad did nothing and holding a key did not work like the remote, and asked what the colour keys do. Read on the TV: network input's pointer socket reads each message after its length as 4 bytes, big-endian; the unframed text we sent made it close the socket, so no move ever arrived. Framed, its TouchPad device (registered when the socket is used) gives REL_X/REL_Y for type:move, BTN_LEFT down and up for type:click and the wheel for type:scroll (seen on its event device). remote.js frames every message, and /click is the pointer's click again (not OK). The service also has sendLongKeyEvent {key}: POST /hold {key} sends it for OK, Back, Home and Settings, and the phone page holds those keys after 550 ms (on Home, a held OK changed the screen and Back changed it again, as the app menu does). The colour keys send LG's own keys (Live TV uses them: green a favourite, yellow the menu, blue the stats; HbbTV and teletext too); held on the phone, one offers the TV's apps and keeps the choice on that phone (localStorage), and a tap then opens that app; LG's own key is the first choice."
impact: low
affected_modules: ["helper/remote.js", "helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (the pointer moves, clicks and scrolls through the socket, each message after its length; holding OK is sendLongKeyEvent and a key it does not hold is refused)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:41:01Z"
```

```yaml
id: CU-20261029-15
type: fix
title: "Dawn: Continue watching stays on screen, Down brings the apps in under the dock, a large clock moves aside over your photos"
description: "On the owner's TV the Plex cards above Dawn's dock ran off both sides of the screen, Down from the dock jumped to a grid over the top of the screen, and the large time stood over his photo during the Halloween theme. watch.css/layout.js/theme.js: the strip is a window over the safe area (96 px each side) with room for the focused card's scale; its track is centred when the cards fit, else slides (transform) so the focused card is in the middle without going past either end, fading the edge where more cards wait (stripScroll, the centres read again after a slide). themes/dawn: grid.mode push (dockUp 150, clipTop 0): Down slides the dock up and the apps come in under it over a dimmed screen, as in Glass; the strip works with push as with overlay. theme.js marks a time as large as a lock screen's (clock.scale 2.5 or more) data-bigclock, and frame.css moves it top left at scale 1.5 while your photos are the wallpaper, also when a holiday theme leaves Dawn's cut-out out (the earlier rule needed the cut-out)."
impact: low
affected_modules: ["app/src/js/layout.js", "app/src/js/theme.js", "app/src/css/watch.css", "app/src/css/frame.css", "themes/dawn/theme.json", "docs/launcher.md", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (watch strip fits in dawn: ten cards, the strip within the safe area, the eighth wholly in view, the edge faded, Down opens the apps under the dock and the dock moves up; watch strip in dawn; dawn clock with photos)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:41:01Z"
```

```yaml
id: CU-20261029-16
type: fix
title: "Updates no longer crash LG's input service, which made the TV reboot instead of standing by (LG's Home first after a wake)"
description: "The owner saw LG's Home for about a minute before ours after switching the TV on, and Quick Start+ was on. The TV's boot log gave the power-on reason rebootByFault; LG's fault manager records (four today) all showed lginput2 crashing (SIGSEGV at the same address) one second after each of today's updates (1.6.27, 1.6.28, 1.6.29, 1.6.30), with 'fault recovery: rebootToSuspend': at the next standby LG reboots fully, and such a boot does not start Home at once (bootd: 'Reason(rebootByFault) doesn't support full home booting'). The crash was in our input hook (InputHook::watchConfigFile, its jump table holding the file's raw bytes): bootstrap.sh copied libinputhookpp.so with cp onto the copy lginput2 has loaded; cp truncates it, which drops lginput2's relocated pages. copy_files now leaves an unchanged hook alone and renames a changed one in (written beside it first), so lginput2 keeps its loaded copy until it restarts, and the rollback archive leaves the hook out. An update runs the new package's bootstrap.sh, so this one already installs safely (D-20261029-2)."
impact: high
affected_modules: ["scripts/bootstrap.sh", "DECISIONS.md"]
related_tests: ["tools/test/scripts.test.js (an update never writes over the loaded input hook: unchanged it keeps its inode, changed it is renamed in while a held-open copy keeps its bytes, no .new is left, the rollback archive leaves it out)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:51:19Z"
```

```yaml
id: CU-20261029-17
type: feature
title: "A mute badge stays on screen while the soundbar is muted"
description: "The owner noticed there was no mute icon any more: with the Sonos volume on screen, LG's own volume view (and its mute icon) is hidden (D-20261027-22). notify/app: when the volume bar's reading says muted, a small struck-through speaker shows in the top corner the bar does not use and stays, keeping the overlay window open (it never takes the remote: empty input region and key mask), until a reading says the sound is back. Notify app 1.0.7."
impact: low
affected_modules: ["notify/app/index.html", "notify/app/appinfo.json", "docs/sonos.md"]
related_tests: ["tools/test/sonos.test.js (muted: a mute badge stays in the top corner the bar does not use and keeps the window open; the sound back, it goes and the window closes)", "tools/test/pages.test.js (the notify page as ES5)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:51:19Z"
```

```yaml
id: CU-20261029-18
type: feature
title: "Continue watching: each app's row from LG switched on or off in the menu (YouTube's random videos off)"
description: "The owner wants YouTube's row gone: it is LG's pick of videos, not what he watched. Customize > Continue watching lists, under Rows from LG for other apps (while it is on), every app LG has a row for (YouTube, Disney+, Netflix, Prime Video...) with On or Off; OK switches it. It is kept as that app's whole row ('app:<id>' in watch.hide), the same as holding OK on a card and choosing Hide the row of that app, so either way shows Off in the menu; Show removed cards again still brings everything back. watch.js gains lgApps(), appOn(id) and setApp(id, on)."
impact: low
affected_modules: ["app/src/js/watch.js", "app/src/js/menus.js", "app/index.html", "docs/launcher.md", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (lg app off: the app's row in the menu, OK switches it off, kept as app:<id>, highlighting the app opens no row, OK switches it on again; linking plex: one Down more past the app's row; Chromium 68)"]
commit_ref: "feature/plex-link (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:33:47Z"
```

```yaml
id: CU-20261029-21
type: feature
title: "Continue watching: Disney+ linked with its TV code (disneyplus.com/begin), its Continue Watching under Disney+ on Home"
description: "Lance asked for Disney+'s Continue watching; LG has nothing personal of it (its Disney+ row is LG's seasonal picks). helper/disney.js signs the TV in the way Disney's web player does. It reads the web player's public key from www.disneyplus.com/begin at run time (never in the repo), registers the TV as a device (registerDevice), opens Disney's socket (wss://disney.connections.edge.bamgrid.com, authentication frame with the device key) and asks for an 8-digit code (requestLicensePlate). Once the code is entered at disneyplus.com/begin, Disney sends urn:dss:event:offDeviceLogin:refresh(:v2) on the socket, traded with exchangeAccountDelegationRefreshToken for the account's keys. Those are kept in config.json watchAccounts.disney (refresh key and a 4-hour access key, renewed with refreshToken). Cards come from explore/v1.21 (else v1.4)/partner/continueWatching: series, episode, progress, Disney's next episode marked next, the wide tile through watch.js's image ids (disney.images.edge.bamgrid.com only). A film opens playing and an episode opens its series' page, with LG's own contentTarget deep links. Once linked, LG's Disney+ row is left out. helper/wsclient.js is a small RFC 6455 client (Node 8 has none): text, continued messages, ping/pong, close codes. The menu gains Link Disney+... with the code note and Signed out: link again when Disney refuses the refresh key. Checked against Disney itself from the Mac (Node 8.12) on 2026-10-29. A probe making the same calls did the full sign-in, with the owner entering the code, and read 30 items. This module itself got its code from Disney: the key read from the page, the device registered, the socket authenticated, then the code expired unused after 10 minutes. Not yet checked live: the module's own trade and read once a code is entered, and the 4-hour renewal (refreshToken)."
impact: medium
affected_modules: ["helper/disney.js", "helper/wsclient.js", "helper/watch.js", "app/src/js/watch.js", "app/src/js/menus.js", "app/index.html", "i18n/en.json", "docs/launcher.md", "docs/security.md"]
related_tests: ["tools/test/disney.test.js (stand-ins for disneyplus.com/begin, Disney's API and socket: code, socket authentication, ping, continued message, a dropped socket taken up again, one trade for Disney's two messages, keys kept and never handed out, linking again while linked shows the new code, renewal of an expired key, cards and deep links, LG's Disney+ row left out once linked, refused refresh key, unlink, expired code, wsclient close codes and a refused upgrade)"]
commit_ref: "feature/disney-link (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T16:36:58Z"
id: CU-20261029-22
type: removal
title: "webOS 25 is the oldest supported TV: webOS 5 and 6 (Node.js 8.12, Chromium 68/79) are dropped, and older TVs are refused"
description: "The owner's only TV is webOS 25, and the old engines forced Node 8 rules, ES5 pages and flaky Chromium 68/79 checks in CI (D-20261029-3). helper/tvprofile.js has FLOOR (webOS 25: SDK 10, Node.js 16) and two decisions, supported and floor. scripts/bootstrap.sh checks the TV's Node.js (16 or newer, before tvprofile.js runs) and then the floor, before anything is changed and whatever --force says; only a TV whose version could not be read is set up with --force, and an update there goes on. A refused update leaves the running service's files and writes last-error.txt, so updates.js does not apply the same package again. install.sh checks the same numbers before it downloads the package. tools/check.sh no longer downloads or runs Node 8.12.0: the tests run once on the current Node (16 or newer). tools/oldchrome.js runs every page check in Chrome for Testing's headless shell 120.0.6099.109 (pinned SHA-256 for mac-x64, mac-arm64 and linux64) instead of the Chromium 68 and 79 snapshots; the container script, the three workflows and their cache keys follow. Chrome 120 for macOS stops with SIGTRAP at start on macOS 26 (its helper processes cannot find the browser's Mach rendezvous service): check.sh --chromium on macOS runs the pages in the ubuntu:26.04 container when Docker runs, and oldchrome.js first starts the engine once on a blank page and stops with that hint when it cannot, instead of crashing (and leaving crash reports) on every page. service.test.js checks for what Node 16 lacks (global fetch, structuredClone, findLast, toSorted, Object.groupBy, Set methods, ...) instead of what Node 8 lacked; pages.test.js parses the scripts as ES2023 and checks for what Chromium 120 lacks, and its flex-gap checks (Chromium before 84) are retired; ESLint takes the service as ES2022 and the pages as ES2023, tsc targets ES2022. AGENTS.md rule 3, the README and the docs say webOS 25 and newer. Existing ES5 code and the Node 8 helpers are left as they are."
impact: medium
affected_modules: ["helper/tvprofile.js", "scripts/bootstrap.sh", "install.sh", "tools/check.sh", "tools/oldchrome.js", "tools/oldchrome-container.sh", ".github/workflows/checks.yml", ".github/workflows/dev-build.yml", ".github/workflows/release.yml", "eslint.config.js", "tsconfig.json", "tools/lint.js", "tools/test/service.test.js", "tools/test/pages.test.js", "AGENTS.md", "README.md", "docs/install.md", "docs/index.md", "docs/tested-tvs.md", "docs/ai.md", "docs/homebrew-channel.html", "docs/development/index.md", "docs/development/internals.md", "docs/development/testing.md"]
related_tests: ["tools/test/tvprofile.test.js (the floor: webOS 24, webOS 6.5 and 5, an unknown SDK and an SDK 10 report with Node.js 12 are not supported; webOS 25 and 26 are; from the shell too)", "tools/test/scripts.test.js (bootstrap.sh refuses SDK 5.4.3, 6.5.3 and 9.2.4 with or without --force and Node.js 8.12 before it changes anything; an unread version needs --force; a refused update keeps the service files and writes last-error.txt; install.sh's too_old; the same numbers in tvprofile.js, bootstrap.sh and install.sh)", "tools/test/service.test.js (nothing needs a Node newer than 16)", "tools/test/pages.test.js (the pages use nothing newer than Chromium 120; the scripts parse as ES2023)", "tools/oldchrome.js (every page check in Chromium 120)"]
commit_ref: "feature/webos25-floor (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T15:33:15Z"
```

```yaml
id: CU-20261029-23
type: feature
title: "Continue watching: a Disney+ episode card plays that episode, no longer the show's page"
description: "Checked on the owner's TV on 2026-10-29: launching com.disney.disneyplus-prod with contentTarget distributionPartner=lg&programType=episode&contentId=<episode>&page=play&id=<episode>&type=episode&contentType=Full plays that episode from where it stopped. This is LG's film link with the episode's id; the owner saw it play, and Disney's own record moved from 11% to 14%, last watched seconds before. When Disney+ was not running it first asks Who's watching?, then plays. Episode cards, Disney's next episode included, now use that link instead of the series' page. Also checked live from the Mac (Node 8.12) with the owner entering a code: helper/disney.js linked, read 12 cards, and renewed its keys twice (refreshToken: new access and refresh keys, 4 hours each); unlinking forgot them."
impact: low
affected_modules: ["helper/disney.js", "docs/launcher.md"]
related_tests: ["tools/test/disney.test.js (an episode card and Disney's next episode open that episode playing; a film card opens the film playing)"]
commit_ref: "feature/disney-link (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T17:06:36Z"
id: CU-20261029-24
type: feature
title: "Continue watching: LG's picks can be switched off, leaving only the rows the apps write themselves (no LG data)"
description: "The owner asked for Home's rows without what LG's servers send. Read only on the TV: LG's content miner asks LG (com.webos.service.sdx, homeprv on <region>.tv.wiselg.com, sdx adding the TV's identity) for the rows of apps whose launch point names no local source (YouTube, Disney+, Apple TV, LG Channels: LG's picks, no personal key on the TV) and writes them to its database and to the app manager; apps whose launch point names a local source (previewMetadata SOURCE_LOCAL*: Netflix, Prime Video) write their own rows from their own servers. lgrows.js now reads listLaunchPoints with the rows and marks each LG card pick: true (LG's pick, or a row of unknown kind) or false (the app's own). Customize > Continue watching > LG's picks (under Rows from LG for other apps, kept as watch.lgPicks false): off, the miner's database is not read and only the apps' own rows are shown, their Continue watching first; the page hides picks at once, before the service's next read. The page's save() also keeps the switches it is not given: it read Telemachus's switch after writing cfg.watch again, so any other change switched Telemachus back on."
impact: medium
affected_modules: ["helper/lgrows.js", "helper/watch.js", "helper/apps.js", "app/src/js/watch.js", "app/src/js/menus.js", "app/index.html", "i18n/en.json", "docs/launcher.md", "docs/security.md", "DECISIONS.md"]
related_tests: ["tools/test/apps.test.js (watch.lgPicks false is kept, any other value dropped)", "tools/test/watch.test.js (a row is the app's own only for a local source; with picks on the miner's rows are picks and Netflix/Prime Video's are not; with picks off the miner is not read and only the apps' own rows stay, Continue watching first; launch points unreadable: nothing from LG)", "tools/oldchrome.js (lg's picks off: the menu row, OK keeps watch.lgPicks false and Telemachus off, the app whose row is a pick is no longer listed and opens no row, OK switches it back; lg app off and linking plex one Down more; Chromium 68 and 79)"]
commit_ref: "feature/own-miner (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T16:25:07Z"
```

```yaml
id: CU-20261029-25
type: feature
title: "Debloat: LG's content miner can be stopped from the start (opt-in), so it no longer runs for a minute at every start"
description: "Read only on the TV (webOS 25): contentminer starts about 26 s after the start, before the boot scripts (the Homebrew Channel ran them at about 39 s, from its own boot task), began its round at 52 s and was stopped by Suggestions and nudges at 109 s, so it can ask LG's servers at every start. A host block cannot single it out (homeprv shares <region>.tv.wiselg.com with LG Channels, LG's voice service and sign-in), and stopping it before it starts needs LG's files changed. The new opt-in group miner (options.debloatOn, off by default; the manager's Debloat screen, LG's content miner, from the start): 15-cleanyourtv-debloat runs debloat-stop.sh miner at once in the background, which has systemd stop contentminer and mounts the do-nothing stub over its program (never kill -9) so nothing starts it again until the next restart; debloat-undo.sh unstubs it and starts it again only when neither Suggestions and nudges nor the miner group still holds it; debloat.change applies and undoes the scripts' opt-in groups when debloatOn changes; Check that it works looks at it while it is on. The manager's opt-in handling is no longer HbbTV only. Not yet seen at a TV start (needs a restart with the group on)."
impact: medium
affected_modules: ["scripts/debloat-stop.sh", "scripts/debloat-undo.sh", "scripts/15-cleanyourtv-debloat", "helper/debloat.js", "helper/manager.js", "helper/debloatcheck.js", "manager/src/js/menu.js", "manager/app/index.html", "docs/debloat.md", "docs/manager.md", "docs/security.md", "DECISIONS.md"]
related_tests: ["tools/test/scripts.test.js (the miner is stopped and stubbed, never killed, only when switched on, alone at boot; the undo starts it only when neither group holds it; the boot hook runs it at once in the background before the minute's wait)", "tools/test/manager.test.js (the miner switched on and off is applied and undone alone; HbbTV runs no script)", "tools/test/debloatcheck.test.js (the miner group is looked at only when switched on: not stubbed or running is not in place)"]
commit_ref: "feature/own-miner (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T16:25:07Z"
```

```yaml
id: CU-20261029-26
type: feature
title: "Debloat: LG's online services can be blocked (opt-in): LG Channels, LG voice, LG account, ThinQ, viewing statistics"
description: "The owner does not use LG voice, LG Channels or LG's other online services and wants them gone. Read only on the TV: sdx/getServerUrl names each service's host; LG's picks, LG Channels (cmp, beacons), voice, account, sports, shop, nudges and quick cards share <region>.tv.wiselg.com, Live TV's viewing statistics go to <country>.ibsstat.nextlgsdp.com, remote diagnostics to <country>.rdx2.nextlgsdp.com, ThinQ to <region>.api.lgtviot.com and connect-client.lgthinq.com; LG Channels' pages and beacons also to <region>.{lgchhomeapp,cdplauncher,cdpsvc,cdpbeacon}.lgtvcommon.com. New opt-in group lgservers: scripts/debloat-hosts.sh writes exactly the marked hosts lines of the groups that are on (ads as before, lgservers from sdx's answers, LG's domains only, the last list kept in lgservers-hosts for a start at which sdx is silent); debloat-stop.sh and debloat-undo.sh call it with the groups that stay on; the boot hook applies it at once with the miner group. The app store (nextlgsdp.com itself), firmware updates and the internet check are not blocked. Check that it works looks for its line. Not yet seen on the TV."
impact: medium
affected_modules: ["scripts/debloat-hosts.sh", "scripts/debloat-stop.sh", "scripts/debloat-undo.sh", "scripts/15-cleanyourtv-debloat", "helper/debloat.js", "helper/debloatcheck.js", "manager/src/js/menu.js", "manager/app/index.html", "docs/debloat.md", "docs/manager.md"]
related_tests: ["tools/test/scripts.test.js (LG's online servers as sdx names them, LG's domains only, never the app store's host, with the ads, the list kept; sdx silent: the kept list; undoing ads keeps the servers and back; the full undo leaves the file as it was; only asks sdx, never stops it; the boot hook applies the opt-in groups at once)", "tools/test/debloatcheck.test.js (looked at only when switched on, by its own line)", "tools/test/manager.test.js (switched on and off with the miner)"]
commit_ref: "feature/own-miner (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T17:12:17Z"
```

```yaml
id: CU-20261029-27
type: feature
title: "Turn the TV on from the phone: the hub on a home server (Wake-on-LAN), the phone remote through it"
description: "The owner asked for the phone remote to turn the TV on, from a helper on his Ubuntu server, and to keep the TV's resources in mind (D-20261029-6). hub/server.js (Node built-ins, Docker: hub/compose.yml with the host network, nobody, no capabilities, read-only root, 96 MB) passes everything for the phone remote to the TV's LAN server unchanged (Host header and the phone's key: the TV's checks decide), over one kept-alive connection; keeps the last phone page and the manifest; learns the TV's MAC from the host's ARP table (a complete entry) into data/tv-mac (mode 600, never logged or answered); with the TV gone it serves the kept page, answers {off: true}, and POST /wake (only from its own page, at most one every 10 s) sends magic packets by UDP broadcast to ports 9 and 7. It answers only home-network addresses and forwards only to the TV. remote.js: POST /api/remote/helper {url} sets the hub's address (http://<home address>:<port> only); the QR code, the address shown and the status then point there. remotepage.js: {off: true} puts the page in an asleep state (the keys dimmed, the power key and a Turn the TV on button wake the TV, then it waits for the TV and carries on)."
impact: medium
affected_modules: ["hub/server.js", "hub/compose.yml", "helper/remote.js", "helper/remotepage.js", "docs/remote.md", "DECISIONS.md"]
related_tests: ["tools/test/hub.test.js (the page and a press pass through with the Host header and the key; the page kept and the MAC learned from a complete ARP entry, mode 600, never in its status; with the TV gone the kept page and off; a magic packet of six 0xff and the MAC sixteen times; one wake per interval, only from its own page)", "tools/test/remote.test.js (a hub on the home network is where the QR code and the address point; any other address is refused; clearing it points back at the TV)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T18:48:30Z"
```

```yaml
id: CU-20261029-28
type: feature
title: "Phone remote through the hub with the TV listening on nothing, and feedback on each press"
description: "The owner asked whether the hub could carry the remote so the TV need not listen, as an easy setting, and for feedback on presses (vibration, or a sound when chosen). remote.js: via 'hub' (POST /api/remote/via; the manager's Phone remote > Through the hub, shown once a hub is set): the LAN server on 8794 closes; the TV keeps one connection out to the hub (GET /link with its own link key, made once and kept in its settings), runs each request the hub writes down it through the same lan() handler on a stand-in request and answer (the phone's key, the home network, the page's origin checked as before), and posts the answer back (POST /link/reply); it links again with a growing wait (1 to 15 s) when the link drops. hub/server.js: the link only from TV_HOST and with the key pinned on first use (SHA-256 in data/link-key; another key refused for the link and the answers); with the link up, phones' requests (their key, origin, host, content type and language, 64 KB at most) go down it and wait 8 s at most; the link gone means off at once; without a link it passes requests to the TV's server as before. remotepage.js: a gear beside the status sets vibration (on) and a click sound (off; a few milliseconds of WebAudio) per phone; a key lights green when the TV took the press, red when not."
impact: medium
affected_modules: ["helper/remote.js", "helper/remotepage.js", "hub/server.js", "manager/src/js/menu.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (through the hub the TV listens on nothing, links out with its own key and answers the hub's requests with the same checks, an address off the home network refused; back to the TV the LAN server answers again)", "tools/test/hub.test.js (the link's key pinned as a hash; a phone's request goes down it with its key and body and the TV's answer comes back; a link or an answer with another key is refused; the link gone means off at once)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T19:03:21Z"
```

```yaml
id: CU-20261029-29
type: feature
title: "TV health: CPU per core, temperature, memory, storage, Wi-Fi, open ports with how each is guarded, and services, on the TV and on a paired phone"
description: "Lance asked for TV metrics modelled on glasshouse (rorygallagher2024, MIT) but faster and more secure, and for every service and open port with how it is secured. helper/metrics.js (GET /api/metrics, /api/metrics/processes) reads in the service from /proc and /sys only when asked: per-core CPU from /proc/stat deltas 2 to 30 s apart (an offline core counts idle), the temperature and clock where tvprofile.js sensors() says (LG's /proc/lg/pm/temperature, else the thermal zones; the 86UR8000 has rtk-thermal and no /proc/lg), meminfo, swaps, eMMC life_time and pre_eol_info, wlan0 traffic and dBm (level 216 is -40), free space (fs.statfs on Node 18.15+, else one df -Pk a minute), uptime and the service's own CPU and memory; never /proc/loadavg (about 32 on that idle TV). One reading per 2 s shared by every viewer, no timer, no history. Processes: two sweeps of /proc/<pid>/stat 2 s apart (the previous reused when 2 to 30 s old), in chunks of 64 between turns of the event loop. helper/exposure.js (GET /api/metrics/exposure, /services): listening TCP and unconnected UDP sockets from /proc/net/*, their programs from one sweep of /proc/<pid>/fd, loopback or LAN only (never an address), a table PORTS of how each known port is guarded (green, amber, red; 9998 WebAppMgr DevTools red; anything else unknown), SSH judged from dropbear's flags or sshd_config; our parts (ctx.parts), boot scripts, watchdog, Telemachus and LG's daemons from the debloat check (debloatcheck.recent, at most every 5 min); systemctl list-units on request (kept a minute). Off the TV only through the phone remote's existing LAN server and paired keys: GET /status-data, /status-exposure, /status-services (helper/statusdata.js: a whitelist summary of versions, update channel, Home takeover, debloat groups and their check, remote, Plex/Stremio/Disney+ linked, telnet, API token; nothing secret) and a TV tab on the phone page (helper/statuspage.js, every 3 s only while shown). The manager's TV health screen (manager/src/js/health.js) reads every 2.5 s while shown, Top processes every 5 s, ports and LG's services on OK; rows can carry a meter (scaleX) and a coloured dot. Measured on the 86UR8000 (webOS 25) with the same code piped to node, read only: a reading 3.5 ms CPU, df 15 ms, a process sweep about 75 ms of 330 processes (event loop held at most 14 ms), the ports report 0.2 to 0.4 s (about 5 000 open files), systemctl 50 to 100 ms; about 1 MB more heap. Not yet installed on the TV: the screens were checked in Chromium 120 and the phone page in a current browser against the service run on this computer with fake /proc and /sys trees."
impact: medium
affected_modules: ["helper/metrics.js", "helper/exposure.js", "helper/statusdata.js", "helper/statuspage.js", "helper/helper.js", "helper/paths.js", "helper/tvprofile.js", "helper/debloatcheck.js", "helper/sonos.js", "helper/remote.js", "helper/remotepage.js", "manager/src/js/health.js", "manager/src/js/list.js", "manager/src/js/menu.js", "manager/src/css/manager.css", "manager/src/index.html", "manager/app/index.html", "tools/test/golden/api.json", "docs/manager.md", "docs/remote.md", "docs/api.md", "docs/security.md", "docs/credits.md", "docs/fork.md", "docs/development/internals.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/metrics.test.js (fake /proc and /sys: CPU per core with a core going offline and counters going backwards, measuring on the first reading and after a 30 s pause, one shared reading for 2 s and for callers at once, temperature in millidegrees, LG's sensor chosen in tvprofile.sensors, memory, swap, Wi-Fi -40 dBm, eMMC, df and statfs, processes from two sweeps 2 s apart; /proc/loadavg never opened nor named; listening ports from fake /proc/net with fake /proc/<pid>/fd links: loopback/LAN, IPv4-mapped, the table's colours, 9998 red, Telemachus not taken for the share log, Sonos port, UDP reply ports counted, SSH flags, services and debloat daemons, cached 30 s, no address or MAC; systemctl once a minute; /status-data and the others refused without a paired key, a wrong key or from another site, and none of the tokens, keys, hash, addresses, playlist, phone name or repository in them; the phone page's TV tab; the docs table matches PORTS)", "tools/test/api.test.js (re-recorded: five new replies only, /api/service lists metrics)", "tools/oldchrome.js (tv health: the meter scaled to the total, four cores, read again while shown, the red DevTools port, the readings stop after Back; Chromium 120)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T19:12:37Z"
```

```yaml
id: CU-20261029-30
type: fix
title: "Phone remote: the iPhone vibrates on every press, not only the first"
description: "The owner felt no vibration on his iPhone. Safari has no navigator.vibrate; the page taps through a hidden switch toggled by its label (iOS 18 and later), but clicking the label left that switch focused, and buzz() skipped whenever an input had the focus (so typing is not disturbed): every press after the first was silent. Now a fresh hidden switch is made, clicked and removed each time (display none, in the head, never focused), the skip is only for text boxes, and a key that repeats while held (pressed at touch down, which iOS may not count as a tap) taps again as it is let go on a phone without vibrate."
impact: low
affected_modules: ["helper/remotepage.js"]
related_tests: ["tools/test/remote.test.js (the phone page builds and its keys answer; the haptic itself needs a real iPhone)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T19:40:00Z"
```

```yaml
id: CU-20261029-31
type: fix
title: "Phone remote: Mute mutes (LG's master/muteVolume)"
description: "The owner found the phone's Mute did nothing while the remote's did. remote.js sent com.webos.service.audio/master/mute, which does not exist (the audio service's methods, read with ls-monitor -i: /master/muteVolume, /UMI/mute); the schema in audiod wants {mute: boolean}. Mute now reads muteStatus (getVolume) and sends master/muteVolume {mute: !muted}. Seen on the owner's TV: muted, the Sonos on eARC reported muted too and the notify app opened for the mute badge; unmuted, both back."
impact: low
affected_modules: ["helper/remote.js"]
related_tests: ["tools/test/remote.test.js (the volume goes to LG's audio service, and Mute switches the mute it reads through master/muteVolume)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T19:51:09Z"
```

```yaml
id: CU-20261029-32
type: feature
title: "The TV's health over time and alerts, on the hub"
description: "The owner asked for history graphs and alerts on the hub rather than the TV (D-20261029-6). hub/history.js: while the TV is linked, the hub asks it (its own request down the link, marked self) for /status-data every 25 s and keeps one small line per sample in data/history/<day>.ndjson (kept 30 days, HISTORY_DAYS), and /status-exposure every hour; alerts raised once and cleared when they pass (the TV at 75 °C for 5 minutes, under 150 MB free memory, swap 90% full, /var under 50 MB, the service at 250 MB, flash wear not normal, a debloat group not in place, a port newly open to the network, a port open with no check), kept in data/alerts.json and posted to ALERT_WEBHOOK when set. hub/dashboard.html (GET /hub/dashboard): graphs over 6 h to 30 days with gaps while the TV was off, the alerts and the open ports; its data (GET /hub/history) needs a phone's paired key, which the TV vouches for once over the link (/ping), then kept as a SHA-256 for a week (data/keys.json), so it opens while the TV sleeps. remote.js: a request the hub marks self may only GET the three status paths, without a phone's key; anything else is refused. statuspage.js: History and alerts in the phone's TV tab when the page came through a hub."
impact: medium
affected_modules: ["hub/history.js", "hub/server.js", "hub/dashboard.html", "hub/compose.yml", "helper/remote.js", "helper/statuspage.js", "docs/remote.md"]
related_tests: ["tools/test/hub.test.js (a sample: the hub's own question down the link, one line in the day's file, the alerts it crosses; the history opens for a phone the TV vouched for once over the link, not without a key, and still while the TV sleeps but not for another key; the dashboard is served)", "tools/test/remote.test.js (the hub's own request may read the status without a phone's key, and do nothing else)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T19:51:09Z"
```

```yaml
id: CU-20261029-33
type: fix
title: "TV health: SSH judged by root's locked password too (the owner's SSH is key-only)"
description: "The health check showed the owner's SSH amber because dropbear runs without -s. But root's password is locked on his TV (! in /etc/shadow), so no password can log in and only his keys work, as he said. exposure.js reads root's password as a state only, never its hash (paths.js SHADOW): locked is green whatever dropbear's flags, empty is red (anyone could log in), set without -s stays amber."
impact: low
affected_modules: ["helper/exposure.js", "helper/paths.js"]
related_tests: ["tools/test/metrics.test.js (SSH by root's password state, never its hash: locked green, empty red, set without -s amber)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T20:10:00Z"
```

```yaml
id: CU-20261029-34
type: feature
title: "Search on Home: a title found in the apps on this TV and opened there, or searched in YouTube; nothing leaves the TV"
description: "The owner asked for a cross-app \"where to watch\" search (D-20261029-8). helper/search.js answers GET /api/search?q=
  from what the service already has in memory: the titles of the rows it last read for Continue watching (watch.js known(), the
  items of the last rows() read; no read of its own), with Home's switches and removed cards (Continue watching off: none; LG's
  picks only while they are on; Telemachus off; removed shows and hidden rows), each opened the way its card opens (Plex's in PLX
  when only PLX is installed); and the installed apps whose app manager entry has inAppSearchParams (read only on the owner's TV,
  webOS 25: listApps returns it, YouTube and YouTube TV '{ \"contentTarget\" : \"q=$SEARCH_KEYWORD\"}'), launched with the words in
  place of $SEARCH_KEYWORD (spaces as typed, as LG's own search passes them through the app manager's replaceParams; %, &, # and +
  as %XX). When no app has the title, Telemachus, Plex (or PLX) and Stremio are offered, opened plainly. Matching ignores case,
  punctuation, accents, a leading The and a year in brackets, ranks a year typed at the end a little lower, and forgives one typo.
  apps.js keeps the apps' inAppSearchParams apart from /api/apps; unlinking Plex, Stremio or Disney+ also drops their cards from
  what a search finds. The launcher: a Search top button (action search; in the default
  bar and in Customize > Top buttons > Add a button), a search screen (app/src/js/search.js) with a field that brings up the TV's
  keyboard, results in groups (In your apps, Search in, Look in), OK opening a result when it is let go, Back closing it; the Home
  key and leaving Home close it. Netflix's and Prime Video's inAppVoiceIntent, Telemachus's, Plex's and Stremio's libraries are left
  for later. Not yet seen on the TV: the screen with LG's keyboard, and YouTube opened with q=<words> (launching apps on the TV needs
  the owner's OK)."
impact: medium
affected_modules: ["helper/search.js", "helper/helper.js", "helper/watch.js", "helper/apps.js", "app/src/js/search.js", "app/src/css/search.css", "app/src/js/core.js", "app/src/js/clock.js", "app/src/js/config.js", "app/src/js/input.js", "app/src/index.html", "app/index.html", "i18n/en.json", "docs/launcher.md", "docs/security.md", "docs/api.md", "README.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/search.test.js (matching: case, punctuation, a leading The, accents, a year, a typo; the in-app search parameters filled and refused; the route with the service's own watch.js and apps.js: hits open as their cards, Home's switches and removed cards, hidden and invisible apps left out, the libraries only without a hit; a linked Plex server's film opens in PLX and is not found once Plex is unlinked; no request or connection and no luna call but listApps during searches, even with the rows' cache dropped; the origin, Host and API-token checks)", "tools/test/api.test.js (the search part runs; YouTube's search with the words; a web page refused; /api/apps without the search parameters)", "tools/oldchrome.js (search: the Search button, the field focused, Left stays in the text, the groups, Down and Up, OK opens on release, Back closes without reaching Home; Chromium 120)"]
commit_ref: "feature/search (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T19:31:47Z"
```

```yaml
id: CU-20261029-35
type: fix
title: "LG's screensaver question answered by the service at once, not by the page (a late answer made LG reboot the TV)"
description: "The owner's TV again came up with LG's Home first; its boot reason was rebootByFault, and LG's fault manager had a general fault record at 15:28 whose timeout.log named the condition 'Request Screen Saver' and the client 'cleanyourtv': the launcher page had registered for LG's screensaver question (tvpower registerScreenSaverRequest) and answered too late (a page can be in the background or reloading), and LG answers a late client with a full reboot at the next standby. helper/lgscreensaver.js now holds the subscription in the service (one waiting luna-send -i, asked again with a growing wait when it ends) and answers at once: no when the screensaver is on with photos and the TV is not on an HDMI input, then Home is opened with {saver: 'start', from: the app in front}; yes otherwise. saver.js no longer registers; it shows the photos on that note (not over Live TV) and a key goes back to the app; input.js leaves such a relaunch alone (it used to end Live TV on any relaunch). D-20261029-9."
impact: high
affected_modules: ["helper/lgscreensaver.js", "helper/helper.js", "app/src/js/saver.js", "app/src/js/input.js", "docs/screensaver.md", "DECISIONS.md", "tools/oldchrome.js"]
related_tests: ["tools/test/lgscreensaver.test.js (ours: no at once and Home opened with the photos and the app in front; off or without photos: yes; over HDMI: yes; an ended subscription asked again)", "tools/oldchrome.js (saver over an app: the note shows the photos and a key goes back to the app; saver question in the service: the page never registers)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T20:33:41Z"
```

```yaml
id: CU-20261029-36
type: docs
title: "Debloat docs: what LG's content miner and LG's online services groups do at a real start of the owner's TV"
description: "Tried on the owner's TV (webOS 25, release 1.6.31 with this branch's service files and pages, both opt-in groups on and LG's picks off, one restart with Lance's OK). The miner started at 34 s and asked LG once (homeprv getdata) at 50.6 s; the Homebrew Channel started the boot scripts at 48.6 s (39 s at the start before), and the miner was stopped and stubbed at 53.3 s. After that every request to LG's online servers failed (sports 76 s, LG Channels' dmost 100 s, LG's dev-log upload 100 s, Netflix's voice intents 118 s, nudge log 121 s); their hosts resolve to ::1, the app store's (us.nextlgsdp.com) and the internet check's do not; ThinQ's iot-client retries and fails. Check that it works: all nine groups working. Home's rows: Telemachus, Stremio, Netflix's and Prime Video's own rows only (pick false). Disney+ opened. docs/debloat.md now says the group cannot always stop the miner's first request at a cold start."
impact: none
affected_modules: ["docs/debloat.md"]
related_tests: []
commit_ref: "feature/own-miner (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T18:24:25Z"
```

```yaml
id: CU-20261029-37
type: feature
title: "Continue watching: Disney+'s cards name the profile whose row it is"
description: "Lance asked for profile labels on the cards. Disney+'s Continue Watching is the account's active profile's; disney.js now asks Disney for that profile's name with the same key (/v1/public/graphql {me{account{activeProfile{id name}}}}), once per key and at most every 30 minutes, control characters taken out, 40 characters at most; a failed question gives no name and the cards come as before. Each Disney+ card carries who: <name>, and the launcher's badge says 'Disney+ · <name>' (any source that gives who). Netflix's cards already say 'Continue Watching for <name>' (its own row's title); Prime Video's row has no profile name. Opening a card cannot choose the profile: Disney+ asks Who's watching? when it was not running. Not yet seen against Disney's real API (the TV has no Disney+ link yet)."
impact: low
affected_modules: ["helper/disney.js", "app/src/js/watch.js", "app/index.html", "docs/launcher.md", "docs/security.md"]
related_tests: ["tools/test/disney.test.js (each card names the profile, asked once, cleaned; no profile from Disney: no name, not asked again at once)", "tools/oldchrome.js (continue watching: the Plex card's badge reads 'Plex · Robin' from the fixture's who)"]
commit_ref: "feature/profile-labels (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T18:53:48Z"
```

```yaml
id: CU-20261029-38
type: fix
title: "LG's screensaver question: a subscription left by an earlier run of the service is ended"
description: "After the update to 1.6.37 the owner's TV had two subscriptions to LG's screensaver question: the luna-send -i of the service before the update had outlived it (a restarted service does not take its children with it; its parent was init). It could no longer answer, and an unanswered question is the fault lgscreensaver.js exists to prevent; it was ended by hand on the TV. lgscreensaver.js now ends any such subscription of ours (registerScreenSaverRequest with cleanyourtv in /proc/<pid>/cmdline) before it starts its own, and ends its own when the service exits."
impact: medium
affected_modules: ["helper/lgscreensaver.js"]
related_tests: ["tools/test/lgscreensaver.test.js (a subscription of ours left by an earlier run is ended at start, nothing else)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T21:00:00Z"
```

```yaml
id: CU-20261029-39
type: feature
title: "Debloat: LG's crash and log reports, LivePick, nudge held by the stub, and LG's unused network services"
description: "Read only on the owner's 86UR8000 (webOS 25, webOS TV 10.3.2): rdxd (LG's remote diagnostics daemon, systemd, started at 22 s, makes crash and fault reports) and uploadd (sends them and other logs to rdl.lgtvcommon.com; a luna dynamic service started by ls-hubd at 27 s, so its systemd unit fails five times at boot-done on the taken bus name) are added to the logs group: rdxd stopped by systemd, uploadd stubbed and killed. LG's consent for log upload (configd system.collectDevLogs) was false and the Homebrew Channel already makes their spools read-only, so this is a second lock. livepick-plus (LG Shoptime overlays from ACR, launched by the activity manager at 59 s, follows every app's life cycle and downloads its lists from LG) joins tracking, stubbed. nudge is stubbed and killed instead of stopped by systemd: it ignores SIGTERM, and systemd's stop waited its 90 s (113 s to 204 s on that boot); the undo unstubs and starts it. A new default-on group lan stops cups-lpd.socket (systemd's LPD listener on [::]:515, open to the network with no check) and ninfod (answers IPv6 node information queries with the TV's name and addresses); units are stopped and started by their own type (cups-lpd.socket) or as .service. Not stopped, with the reasons in docs/debloat.md: dmost (LG Channels' manager; its beacon with the TV's identity leaves before the boot scripts and lgservers blocks its server), crashd, faultmanager, the system log daemons, sdp-server-notice, Google Cast's log service. debloat-stop.sh no longer rewrites the stub in place on every run (it is mounted over LG's programs and may be running): only when it differs, beside it and renamed (D-20261029-2). debloatcheck.js checks the new programs and units; exposure.js lists 515 (LPD) and 18181/36866 (DIAL through xinetd, seen as unknown before). Not yet seen at a TV start."
impact: medium
affected_modules: ["scripts/debloat-stop.sh", "scripts/debloat-undo.sh", "helper/debloat.js", "helper/debloatcheck.js", "helper/exposure.js", "manager/src/js/menu.js", "manager/app/index.html", "docs/debloat.md", "docs/manager.md", "docs/security.md", "DECISIONS.md"]
related_tests: ["tools/test/scripts.test.js (the new daemons per group, stop and undo; a unit named with its type kept as it is; the stub never written over in place)", "tools/test/debloatcheck.test.js (seven groups in place; cups-lpd.socket, ninfod.service and rdxd.service asked of systemctl; the print server back is not in place)", "tools/test/metrics.test.js (the daemons the debloat stops, per group; docs/security.md has every port of the table)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T21:00:00Z"
```

```yaml
id: CU-20261029-40
type: fix
title: "The debloat at boot runs as the boot scripts start, not a minute later"
description: "Measured read only on the owner's 86UR8000 (bootd.log, the debug log's ls-hubd launches, initctl.log, process start times; that boot was a rebootByFault one): the Homebrew Channel's boot scripts start at 44 s; 10-cleanyourtv-home took until 53 s (stage-home, sam restart), then 15-cleanyourtv-debloat waited 60 s, so the debloat ran at about 113 s. Meanwhile LG's activity manager (started at rest-boot-done, 53.8 s) launched sportsalarm at 57.7 s, livepick-plus at 59.4 s, adoverlay-service and acr2 at 61.1 s; nudge started at boot-done (85.8 s). acr2 and the ad overlay so ran about 50 s at every start, remotelogger from 1.6 s and service-logger from 17.9 s until 113 s, nudge until 204 s. Now 10-cleanyourtv-home, at boot only (no argument; the setup passes setup, an update keep), runs 15-cleanyourtv-debloat early before it stages Home: debloat-stop.sh in the background at about 45 s, so the stubs are in place before the activity manager starts anything. The Homebrew Channel's own run of the hook then lifts it if Home was not taken over (only when the early run applied it), applies it when the early run did not happen, and once more when LG's boot is done (/tmp/boot-done, at most 180 s of waiting). Each step goes to /tmp/cleanyourtv-boot.log. No systemd masks: a runtime mask in /run/systemd/system ranks below LG's units in /etc/systemd/system and needs a daemon-reload during LG's boot; the stub covers the late starters. Expected at the next start: the early debloat at about 45 s; acr2, adoverlay-service, admanager, sportsalarm, livepick-plus and nudge never running; remotelogger, service-logger, contentminer, rdxd stopped at about 45 s. Not yet seen at a TV start."
impact: medium
affected_modules: ["scripts/15-cleanyourtv-debloat", "scripts/10-cleanyourtv-home", "scripts/bootstrap.sh", "helper/debloat.js", "helper/debloatcheck.js", "docs/debloat.md", "docs/tv-changes.md", "DECISIONS.md"]
related_tests: ["tools/test/scripts.test.js (the boot hook run with stand-ins: early applies at once; the second run waits for boot-done and applies again; a Home not taken over lifts it only after an early run; without the early run it applies at once and again; DISABLE-DEBLOAT does nothing; 10-cleanyourtv-home runs the early debloat before staging Home, at boot only)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T21:00:00Z"
```

```yaml
id: CU-20261029-41
type: feature
title: "Security: LG's web inspector (port 9998) closed in RAM, on by default"
description: "LG's /etc/systemd/system/scripts/webapp-mgr.sh always passes --remote-debugging-port=9998, and WebAppMgr's DevTools listen on 0.0.0.0:9998 with no authentication (read on the owner's TV: /proc/net/tcp 00000000:270E LISTEN, uid wam). --remote-debugging-address cannot narrow it: the string is not in WebAppMgr's engine (/usr/lib/libcbe.so has remote-debugging-port and remote-debugging-pipe only) nor in its libraries, so the switch is removed. scripts/devtools-close.sh writes a copy of LG's script without it (sed, only when it had the switch, only a copy that still parses; checked read only on the TV in a pipe: busybox sh -n passes, no switch left, 341 lines kept), renames it into /tmp/cleanyourtv-webapp-mgr.sh and bind-mounts it over LG's script once per start; with restart it restarts webapp-mgr.service once, only when the running WebAppMgr's command line has the port, waits for it (at most 20 s, SIGKILL through systemd if it does not stop in 8 s) and logs to the boot log. 10-cleanyourtv-home calls it with restart at boot only, in the background right after the service starts, and waits for it before Home is taken over (sam restarted or the stand-in mounted), so it costs one WebAppMgr restart at boot and nothing later; the setup and an update only mount. scripts/devtools-undo.sh unmounts and deletes the copy (uninstall.sh runs it). helper/security.js: devtools {closed, listening} (closed unless D/devtools-open; listening from /proc/net/tcp and tcp6), setDevtools; the manager's API POST /api/manager/devtools {closed}; the manager's row LG's web inspector (port 9998), from the next start; the Share log and the phone's TV tab say whether it is closed. exposure.js: 9998 while the option is on but WebAppMgr still has the port says it closes at the next start; closed, one green row with bind closed (the manager and the phone page show closed). The golden API replies change by security.devtools and 9998's line, as intended. Not yet seen at a TV start."
impact: high
affected_modules: ["scripts/devtools-close.sh", "scripts/devtools-undo.sh", "scripts/10-cleanyourtv-home", "scripts/bootstrap.sh", "uninstall.sh", "helper/security.js", "helper/manager.js", "helper/exposure.js", "helper/statusdata.js", "helper/statuspage.js", "manager/src/js/menu.js", "manager/src/js/health.js", "manager/app/index.html", "tools/test/golden/api.json", "docs/security.md", "docs/manager.md", "docs/remote.md", "docs/tv-changes.md", "DECISIONS.md"]
related_tests: ["tools/test/scripts.test.js (devtools-close.sh and devtools-undo.sh run with stand-ins for LG's script, /proc/mounts, /proc/<pid>/cmdline, mount, umount and systemctl: the copy has no --remote-debugging-port and parses, mounted once, WebAppMgr restarted once and then without the port, a second run changes nothing, the undo removes the mount and the copy; no restart unless asked and the port is there; nothing while switched off or when LG's script has no port; 10-cleanyourtv-home's order)", "tools/test/manager.test.js (closed by default; the switch works both ways and never restarts WebAppMgr)", "tools/test/metrics.test.js (9998 open with the option on, switched off, and closed; the phone's summary says closed)", "tools/test/api.test.js (the golden replies with security.devtools)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T21:00:00Z"
```

```yaml
id: CU-20261029-42
type: fix
title: "The light on open apps is small"
description: "The green dot on open apps (Customize > mark running apps) was 14 px on the grid and 18 px on the dock, with a 3 px dark ring, set 14 to 20 px into the tile: big over the icons (the owner, on Dawn). It is now a 9 px light on the grid and 11 px on the dock, 9 to 11 px from the corner, with a thin dark edge and a soft glow; the Inputs list's light on open apps and the active input matches it (11 px). Picker 1.2.1."
impact: low
affected_modules: ["app/src/css/home.css", "app/index.html", "picker/app/index.html", "picker/app/appinfo.json"]
related_tests: ["tools/test/pages.test.js (the light on open apps is at most 12 px, on Home, the dock and the Inputs list)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T22:10:00Z"
```

```yaml
id: CU-20261029-43
type: feature
title: "Search: Where to watch, for any title, from Plex's catalogue, Disney+, your Plex server, Stremio's catalogue and Telemachus"
description: "Lance asked for Search to say where any title is, not only titles already on Home (D-20261029-13, superseding
  D-20261029-8). GET /api/search/where?q= (helper/where.js, in the search part) asks, each on its own with a time limit: Plex
  Discover with the linked Plex account (search, then the availabilities of up to four matching titles in LG's service country,
  smartServiceCountryCode2), Disney+'s explore search when linked (disney.js search), the linked Plex server's /hubs/search,
  Cinemeta when Stremio is installed (stremio.js catalog) and Telemachus's /api/search on the TV (X-Telemachus: cli). Titles from
  every source are merged by their normalized title, year and kind (helper/titles.js, moved out of search.js); Plex's and Disney+'s
  titles come first, the best match first, at most six. Each offer is mapped to an installed app (helper/deeplinks.js: Plex's
  platform names, else an app of exactly the service's name) and opened at the title where the format is known: Disney+ by the
  entity id in LG's page format (browse; not yet opened on a TV), Netflix m=<id>&source_type=27, Prime Video detail?gti=..., Apple TV
  its tv.apple.com link (the formats their own rows on the TV use; unverified from a catalogue), YouTube v=<id>; a Telemachus film
  with its play parameters; everything else opens as it is. Plex's affiliate links are never opened: only the service's own link in
  their u= parameter is read. Installed apps first, then subscription and free, library and catalogue, rent and buy, the cheapest
  of each, by name (Plex's sponsored flag and order ignored). Answers are kept 10 minutes per words, country and sources. The page:
  a Where to watch group after In your apps, asked 900 ms after the typing stops, a row per title with its apps as chips (Left and
  Right choose, OK opens, the hint says whether the app opens the title itself) and the other services named with their offer; a
  title with no app here is dimmed and skipped. Customize > Search > Ask services where a title is (search.where false when off,
  kept by apps.js; on by default): off asks no one. Read on the TV (read only, keys kept on the TV, nothing written there): Plex's
  availabilities give price as a number without a currency, links that are trackers (Disney+) or the services' own (Hulu, Fubo,
  Apple TV); the Plex server's /hubs/search answers Hub[] with Metadata of type show and movie."
impact: medium
affected_modules: ["helper/where.js", "helper/deeplinks.js", "helper/titles.js", "helper/search.js", "helper/plex.js", "helper/disney.js", "helper/stremio.js", "helper/watch.js", "helper/apps.js", "helper/config.js", "app/src/js/search.js", "app/src/js/menus.js", "app/src/css/search.css", "app/index.html", "i18n/en.json", "docs/launcher.md", "docs/security.md", "docs/api.md", "README.md", "AGENTS.md", "DECISIONS.md"]
related_tests: ["tools/test/where.test.js (deeplinks: the link inside an affiliate link, nothing from anywhere else, each app's format, Plex's names as apps; the route with stand-ins for Plex's catalogue, Disney+, Cinemeta, the Plex server and Telemachus: titles merged and ranked, offers ordered and the cheapest kept, deep links, a Telemachus film, Disney+-only titles; the tracker never asked, only the expected headers (no device id, cookie or user agent), the TV's country; the same words from memory; services not linked or not installed not asked; the switch off and fewer than two letters ask no one; a failing service leaves the others; the setting kept; nothing asked off this machine)", "tools/test/search.test.js (the search part answers both routes)", "tools/test/api.test.js (/api/search/where with nothing linked asks no one; a web page refused)", "tools/oldchrome.js (where to watch: the group before Search in, chips, Left and Right, a dimmed title skipped, the hint, OK opens the chosen app's link, Customize > Search off brings no Where to watch; search: checked with Where to watch off; Chromium 120)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T21:01:39Z"
```

```yaml
id: CU-20261029-44
type: fix
title: "Phone remote: a vibration test, and a second way to make an iPhone tap"
description: "The owner's iPhone did not vibrate on presses (System Haptics on). Safari has no navigator.vibrate; the page flips a switch input (iOS 18) through its label, hidden (display none, in head) and removed at once; normal keys do it from the click, so a third guess at the trigger would not be evidence. helper/remotepage.js: buzz(way) has a second way, the switch drawn out of sight in the body (fixed, opacity .01, no pointer events) and removed 400 ms later, for an iPhone that taps only for a switch with a renderer or still in the page. Feedback (the gear) has a Vibration test: Way 1 and Way 2 each tap once and the chosen one is kept on the phone (cytv-remote-feedback.way, 1 by default), and a real switch (The iPhone's own switch) shows whether the iPhone taps for a page at all. Checked in Chrome at phone size: the sheet's rows, Way 2 adds the label to the body and removes it, the choice is saved and used by the next press, no page errors. Not checked: the tap itself (an iPhone only; the iOS Simulator has none)."
impact: low
affected_modules: ["helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (the vibration test offers both ways and the iPhone switch, and the chosen way is kept)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T22:40:00Z"
```

```yaml
id: CU-20261029-45
type: fix
title: "Search: a Where to watch row fits its frame (the title on its own line, the apps that fit as chips, one per app)"
description: "On the owner's real answers (films and series with five or more services) a Where to watch row ran past the search box: its chips stayed on one line beside the title, which was cut to a few letters ('The Va...'). The owner found it ugly. A row now has three lines: the title with its year and kind (cut with an ellipsis), the chips, and the other services. One chip per app is shown, with its best offer, so a rent and a buy in YouTube are one chip. They are ordered: your library, subscription and free, rent, buy, a catalogue last. At most five are shown, and only those that fit on the line, measured once the row is drawn. The rest are named on the Also line, and Left and Right do not reach them. search.js counts the row's real height (74 + 66 + 38), so the rows that fit under the field are the ones shown."
impact: low
affected_modules: ["app/src/js/search.js", "app/src/css/search.css", "app/index.html"]
related_tests: ["tools/oldchrome.js (where to watch fits: a long title with seven offers in six apps stays inside its row, the title cut, one chip per app with the library first, the chips past the line on the Also line, Right stops at the last chip; Chromium 120; fails on the layout before this fix)", "tools/oldchrome.js (where to watch)", "tools/test/search.test.js", "tools/test/where.test.js"]
commit_ref: "feature/search-fit (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T21:24:16Z"
```

```yaml
id: CU-20261029-46
type: fix
title: "LG's screensaver question: every answer kept on the TV with its time and LG's reply"
description: "After 1.6.39 LG's fault manager again recorded \"Request Screen Saver\" timed out for cleanyourtv (general_fault_logs.tar.gz, timeout.log, at 6425 s of uptime), with one subscription running; the service log in /tmp was gone after the next reboot, so the cause could not be read. Read on the owner's TV since: luna-send hands each reply on at once through a pipe; one luna call takes 29 to 40 ms; tvpowerd knows the client by clientName and takes the timestamp only as a string (a number: \"'timestamp' is needed, invalid param\"; an answer to no question: \"The response is too late\"). helper/lgscreensaver.js keeps every answer in D/screensaver-answers.log (the last 40, written whole and renamed into place): the time, uptime, ack, the app in front, the milliseconds from LG's question to LG's reply, and LG's reply (ok or its errorText; the timestamp's type when it is not a string), and logs a refused answer; status() has the last five. The next timeout says whether the answer was late, refused or missing."
impact: low
affected_modules: ["helper/lgscreensaver.js", "docs/screensaver.md"]
related_tests: ["tools/test/lgscreensaver.test.js (the answer is kept in the record with the app in front, how long it took and LG reply; LG's refusal is kept; only the last answers are kept; the string timestamp is answered unchanged)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T23:10:00Z"
```

```yaml
id: CU-20261029-47
type: docs
title: "Documentation screenshots: the phone remote, the hub's history, Where to watch, TV health and the framed screensaver"
description: "Eight screenshots for pages that had none, made on a computer in headless Chrome from the repository's own pages with made-up data only (no TV or hub asked, no address, MAC, device id, name or account title, no photo of people): docs/remote.md the Remote and Touchpad tabs, the TV tab and the Feedback sheet with its Vibration test (390 x 844 at twice the pixels), and the hub's History and alerts page (1280 wide: 24 hours of samples with two gaps, one alert, one that passed, the open ports classified by helper/exposure.js's own table); docs/launcher.md Search with Where to watch (made-up titles, one long title with more offers than its row holds); docs/manager.md TV health; docs/screensaver.md the frame (Walnut, Modern) with two landscape pictures from themes/dawn and themes/lake-dock. The TV pages are 1920 x 1080 saved at 1280 x 720, JPEG quality 80, each under 180 kB. tools/doc-shots.mjs makes them again (stand-ins on 127.0.0.1:8765, 8911 and 8912, a fixed made-up clock, seeded curves; two runs give the same files), named in AGENTS.md and docs/development/index.md. The site in site/ is not rebuilt here: it is ignored by git and built by the docs workflow (zensical)."
impact: none
affected_modules: ["docs/remote.md", "docs/launcher.md", "docs/manager.md", "docs/screensaver.md", "docs/development/index.md", "docs/screenshots/remote-keys.jpg", "docs/screenshots/remote-touchpad.jpg", "docs/screenshots/remote-feedback.jpg", "docs/screenshots/remote-tv.jpg", "docs/screenshots/hub-dashboard.jpg", "docs/screenshots/search-where.jpg", "docs/screenshots/tv-health.jpg", "docs/screenshots/saver-frame.jpg", "tools/doc-shots.mjs", "AGENTS.md"]
related_tests: []
commit_ref: "feature/doc-screenshots (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T22:41:13Z"
```

```yaml
id: CU-20261029-48
type: fix
title: "LG pre-loading: AirPlay never closed, and an app closed once is left alone (Home pulled over the app in use every two minutes)"
description: "On the owner's TV Home came to the front every two minutes, over the app in use (Stremio) and over Search and the menus, which closed (the launcher logged a relaunch with {keepAlive: true} every 120 s, the same as the Home key on webOS 25). LG's log: lgpreload's closeByAppId on airplay at 3465.17 s; AirPlay, paused, calls launchDefaultApp {category: LastInputApp}; SAM launches com.webos.app.home (caller airplay, keep_alive); the foreground changes io.strem.tv -> com.webos.app.home. Something other than the preload manager starts AirPlay again at once, so the two-minute look closed it every time. helper/lgpreload.js: airplay is in KEEP (its pre-loading never switched off, never closed, also when an earlier version recorded it); every other app is closed at most once per run of the service, and one that is back is left running and noted. Mitigated on the TV before the release by switching the preload group off (options.debloatOff [\"preload\"]), switched on again after the update."
impact: high
affected_modules: ["helper/lgpreload.js", "docs/debloat.md"]
related_tests: ["tools/test/lgpreload.test.js (a copy back after being closed is left running; AirPlay is neither switched off nor closed, even when an earlier version switched it off)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T23:35:00Z"
```

```yaml
id: CU-20261029-49
type: fix
title: "Search: an empty field with the recent searches, Back to the results first, and Look in only without Where to watch"
description: "The owner: search closed by itself (CU-20261029-48: Home's relaunch every two minutes), the last words stayed in the field with no history, and Telemachus or Stremio under Look in did not search (they open the app at its Home: Telemachus takes only {play}, Stremio's app is encrypted and takes nothing known). app/src/js/search.js: the field is cleared at every open and shows Recent searches (the last six, newest first, in the page's localStorage search.recent; saved when a result is opened or Search closes with results; OK fills the field and asks again, without the keyboard); Back from the field goes to the first result when there is one and the field has the focus (a Back meant for the TV's keyboard no longer closes Search), Back from a result closes; the try group (Look in) is left out while Where to watch is on, which asks Telemachus, Plex and Stremio's catalogue itself. docs/launcher.md says so."
impact: medium
affected_modules: ["app/src/js/search.js", "app/index.html", "i18n/en.json", "docs/launcher.md", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js (Chromium 120 search: reopened, the field is empty with Recent searches and the last words; Back from the field goes to the results, a second Back closes)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T23:35:00Z"
```

```yaml
id: CU-20261029-50
type: feature
title: "Search: Telemachus and Stremio get the words (Search in), and Where to watch's Stremio opens the title's page"
description: "The owner: Telemachus and Stremio under Look in only opened the app. helper/search.js OWN_SEARCH: Telemachus is launched with {play: {search: <words>}} (the search launch added to Telemachus's tvlaunch.ts; an older Telemachus rejects the shape and opens as it is) and Stremio with {contentTarget: 'stremio:///search?search=<words>'} (its appinfo declares contentTarget 'stremio'; the link format is Stremio's documented deep link, stremio-addon-sdk docs/deep-links.md); both now in Search in, and Look in keeps only Plex. helper/where.js: a Stremio offer from Cinemeta carries its IMDb id, and its chip launches stremio:///detail/series/<id> or stremio:///detail/movie/<id>/<id> (exact stays false until seen on a TV). Read on the owner's TV: Stremio, already open and playing, gets the launchParams (WAM PALMSYSTEM Update launchParams, SEND_RELAUNCHEVENT) and stays on what it plays; a cold start was not tried, as it would have stopped the show on screen. Static: stremio-web (the open web app) has no webOS launch code, the LG app's own files are encrypted (NCG)."
impact: medium
affected_modules: ["helper/search.js", "helper/where.js", "docs/launcher.md"]
related_tests: ["tools/test/search.test.js (YouTube opens its search with the words, Telemachus its search page, Stremio its search link; groups with Telemachus and Stremio under Search in, Plex under Look in)", "tools/test/where.test.js (Stremio gets the series' page link)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-29T23:58:00Z"
```

```yaml
id: CU-20261029-51
type: fix
title: "The photo screensaver again instead of LG's: the service reads the photos from the wallpapers and the feed"
description: "Since 1.6.36 the service answers LG's screensaver question, and its check for photos read config keys that do not exist (photoFeed.photos, wallpapers.stamp), so it always told LG yes and LG's own screensaver showed (the owner saw it; the answer record on the TV: ack true at 00:23:55 with 290 photos in the feed). helper/lgscreensaver.js ours(): the screensaver switched on and photos in the wallpapers part's list (uploads, Immich, the feed) or the photo feed's count, as the page's own check (photos()) did. Also: CU-20261029-50's launch parameters for Telemachus ({play: {search}}) and Stremio (stremio:///search, stremio:///detail in contentTarget) are taken out. Telemachus does not take a search and is not changed for it; Stremio's LG app, tried on the TV cold and while open, opened its own Home every time. Both are under Look in again (opened as they are, only while Where to watch is off), and Where to watch's Stremio opens the app as it is."
impact: high
affected_modules: ["helper/lgscreensaver.js", "helper/search.js", "helper/where.js", "docs/launcher.md"]
related_tests: ["tools/test/lgscreensaver.test.js (ours: LG is told no and Home opens with the photos, with the photos from the wallpapers part; no photos: LG decides)", "tools/test/search.test.js (groups: Telemachus, PLX and Stremio under Look in)", "tools/test/where.test.js (Telemachus and Stremio open as they are)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-30T00:30:00Z"
```

```yaml
id: CU-20261029-52
type: feature
title: "Search in Disney+ and Sling with the words; Plex, Hulu, Sling and more YouTube links open the title"
description: "From a read-only study of the apps on the owner's TV (docs/development/app-deeplinks.md: their appinfo.json, LG's logs, the scripts their web apps load, public sources) and launches tried on the TV on 2026-10-30. helper/search.js KNOWN_SEARCH: Disney+ {contentTarget: page=search&searchText=<words, & = # % ? as spaces>} and Sling {contentTarget: https://watch.sling.com/1/category/search?q=<words>}, both seen opening the app's search with the words; under Search in like YouTube, never for a hidden app. helper/deeplinks.js: YouTube also from youtu.be, a playlist (list=, with v=) and a channel (c=UC...); Hulu by george_dl_url=<its hulu.com link> (no contentTarget, as its code reads); Sling by its watch.sling.com link; these two exact false. helper/where.js: a title from Plex's catalogue keeps Plex's id (not in the answer), and an offer in Plex opens plex://show/<id> or plex://movie/<id> (exact false: on the owner's TV Plex first asks for a profile with a PIN). Stremio takes nothing (its TV app's code, read from relvhgchz5.strem.io/hello-world/1.14.1, never reads launch parameters). D-20261029-14."
impact: medium
affected_modules: ["helper/search.js", "helper/deeplinks.js", "helper/where.js", "docs/launcher.md", "docs/development/app-deeplinks.md", "zensical.toml", "DECISIONS.md"]
related_tests: ["tools/test/search.test.js (Disney+ opens its own search; groups with Disney+ under Search in)", "tools/test/where.test.js (YouTube's other links; Hulu george_dl_url and Sling's link; Plex opens the show's page by Plex's own id, not in the answer)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-30T01:20:00Z"
```

```yaml
id: CU-20261029-53
type: fix
title: "LG's screensaver question answered on the connection that registered (the full reboot to LG's screen at power-on)"
description: "The owner's TV started fully twice on 2026-10-30, with LG's screen first. LG's fault log (general_fault_logs.tar.gz, written at the start): Request Screen Saver timed out for cleanyourtv at 1340 s. Its own dbg-log of those seconds: the question at 1337.016 with a 3000 ms timer; our answer at 1337.17 from a second luna-send; tvpowerd '[setNack] clientID: OWUzakvf / clientName: cleanyourtv is not exist' (the answer came from another connection; luna-send still printed returnValue true, so screensaver-answers.log said ok); at 1340.018 'cleanyourtv is no response', the timeout saved, LG's screensaver launched, and the fault reboot at the next standby. tvpowerd keys a client by its connection (clientID), so the answer must use the connection that registered; luna-send cannot (one call per process). helper/lgscreensaver.js: one palmbus Handle (LG's module for its JavaScript services, /usr/lib/nodejs/palmbus.js, loads in the service's Node on webOS 25; an anonymous handle registered on the owner's TV) holds the subscription and sends every answer (2.5 s at most, under LG's 3 s); a subscription that ends is asked again on the same handle; stop cancels it; without the module nothing is registered and LG decides. The luna-send subscription is gone; ones left by earlier versions are still ended at start. Not seen yet: an answer taken by tvpowerd (the next question over an app will show setAck in LG's log)."
impact: high
affected_modules: ["helper/lgscreensaver.js", "tools/test/service.test.js", "docs/screensaver.md"]
related_tests: ["tools/test/lgscreensaver.test.js (one connection registers; the answer goes out on the connection that registered, never through another luna-send; without the bus module nothing is registered; an ended subscription is asked again on the same connection)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-30T14:15:00Z"
```

```yaml
id: CU-20261029-54
type: fix
title: "Phone remote through the hub: the link is made again after standby, and when it goes quiet"
description: "The owner turned the TV on from the phone remote (the hub's Wake-on-LAN worked) but the phone page kept saying the TV was off, also after reopening it. Read on the TV and the hub: the TV said link 'linked' while the hub had no link (tv off, link false) and served its kept page. While the TV slept the hub closed the link; the TV only reads from it, so nothing told it, and its connection looked open after waking. helper/remote.js: the hub's empty line every 20 s is watched (any data counts); a link quiet for 50 s is dropped and made again, and one is made again at once when the service's clock jumps by more than 60 s (the TV slept); linkDrop now drops only the link in use, so the end and error events of a link already destroyed no longer drop the next one or double the wait before it (they did: a dropped link came back after 4 s instead of 1). create(ctx, opts) takes linkQuietMs, watchMs and wakeGapMs. Fixed on the TV at once before the release by switching the route to the TV and back to the hub (it linked again). docs/remote.md says so."
impact: medium
affected_modules: ["helper/remote.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (a quiet link is made again; one with a heartbeat is kept)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-30T19:55:00Z"
```

```yaml
id: CU-20261029-55
type: feature
title: "Phone remote: what is on the TV beside the green light (the app, the input and its device, Telemachus's show)"
description: "The owner asked for what is playing and which input is on. helper/apps.js current(): the app in front from its own 4 s foreground poll (no extra call), its name from the app list (Home, Live TV and the screensaver by name), and for com.webos.app.hdmiN the port and the label the TV gives the device on it (eim getAllInputStatus, cached as for the Inputs list). helper/remote.js: /ping answers {ok, now: {app, title, input, playing}}, kept 2 s; with Telemachus in front, playing is read from Telemachus's own /api/brief (state.now_playing: show, season, episode, title, paused or playing; 1.5 s at most, X-Telemachus: cli, as where.js asks it), and Telemachus is not changed. helper/remotepage.js: the status line beside the light shows it ('Telemachus · The Far Orbit S2 E3 · Paused', 'HDMI 2 · Game console', 'Netflix'), from every ping (15 s, on showing the page) and 4.5 s after a key, a colour key's app or an app opened from the phone. Not yet: what a streaming app plays (LG's media session services were not read: the TV was off), and Live TV's channel (only the Home page knows it). docs/remote.md says so."
impact: low
affected_modules: ["helper/apps.js", "helper/remote.js", "helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/running.test.js (what is on the screen: an app by its name, an input with its port and device, Home)", "tools/test/remote.test.js (the ping says what is on: Telemachus with its show, an input with what is on it)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-31T12:30:00Z"
```

```yaml
id: CU-20261029-56
type: feature
title: "Phone remote: what plays for every app that can say (Plex's now playing, the newest Continue watching of the others)"
description: "The owner: it should show what plays in any app and any input, at least the app. The app or input was already named for all (CU-20261029-55); now also the title where it can be known. helper/plex.js now(): the linked server's /status/sessions (1.5 s at most), the session whose player is an LG TV (platform, product or device webOS/LG) first, else the first; {show, season, episode, title, state}. helper/remote.js: Telemachus as before, Plex (cdp-30, PLX) from now(), any other app (not an input) the newest item of its own Continue watching (watch.known(), the rows Home last read: Disney+, Netflix, Prime Video, Stremio), marked last: true. helper/remotepage.js shows a title's sub (S2 E3, minutes left) when there is no season and episode. Read on the owner's TV: webOS 25 has no com.webos.service.mediacontroller or mediasession, so YouTube and a game show only the app or input; LG's ACR (what is on any input) stays stubbed, it is tracking."
impact: low
affected_modules: ["helper/plex.js", "helper/remote.js", "helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/watchlinks.test.js (Plex: what plays now, the session on an LG TV first)", "tools/test/remote.test.js (any app: its newest Continue watching; Plex: its server's own now playing)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-31T14:30:00Z"
```

```yaml
id: CU-20261029-57
type: fix
title: "Phone remote: the iPhone vibrates on every key (a switch under the finger), and Feedback closes"
description: "The owner's iPhone: the real switch in the vibration test vibrates, ways 1 and 2 (the page flipping a hidden switch, in head or drawn out of sight) do nothing, and Feedback did not close after choosing a way. helper/remotepage.js: way 3, the default: every key (button.key and every button[data-k]: the rockers, the arrows, the colour keys) carries an invisible checkbox switch over all of it (opacity .011, z-index 3); the tap lands on it, iOS taps as for its own switch, and the click goes on to the key (exactly one press, checked in Chromium on OK, Home, Up, Volume up, Channel up and Red); the held keys no longer cancel the touch when they carry a switch (body touch-action: manipulation keeps zoom away), so it reaches the switch. Off (vibration off, way 1 or 2, a phone with navigator.vibrate) the switches go. The Way 3 button in the test carries its own switch, so the tap on it is the test. The sheet's redraw after choosing a way runs only while the sheet is still open, so Cancel right after keeps it closed (it opened again 450 ms later). Not checked on an iPhone: the tap itself."
impact: low
affected_modules: ["helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (way 3 by default: every key carries a switch the finger flips; the test offers ways 3, 1 and 2; Cancel right after choosing keeps the sheet closed)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-31T15:30:00Z"
```

```yaml
id: CU-20261029-58
type: feature
title: "Phone remote: the volume in the rocker and the Mute key lit while muted"
description: "The owner: show the volume and whether the sound is muted, the Mute key showing it, the number where it is not in the way. helper/remote.js soundNow(), with every /ping (not kept): the Sonos part's own volume and mute while it follows a soundbar (its events, in memory: no call), else LG's master getVolume (volume, muteStatus; no number for an external output at 0, as LG reports for a soundbar on ARC it does not know). helper/remotepage.js showSound(): the number in the volume rocker in place of VOL (aria-label 'Volume N'), the Mute key's class muted (a red ring and glow) and aria-pressed; after Volume or Mute the page asks again 700 ms later (the soundbar follows the TV within a moment), other keys 4.5 s later as before. Checked in Chromium at phone size: 24 in the rocker, the Mute key red while muted and plain when not."
impact: low
affected_modules: ["helper/remote.js", "helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (the ping says the sound: the soundbar's volume and mute, else LG's own; the page shows it)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-31T16:00:00Z"
```

```yaml
id: CU-20261029-59
type: fix
title: "Screensaver: the day of an import is not shown as the photos' day (every Frameo photo said October 3)"
description: "The owner: the photos from Frameo all say October 3. On the TV 290 of the feed's 291 photos had the day 2026-10-03: the owner's server (family-calendar's photo feed) sends only {id, createdAt} (photoStore.feed), createdAt is when it took the photos in (its Frameo import, D-20261003-25), and its display copies carry no EXIF (checked: no Exif block in 20 cached photos), so no real day can be had on the TV. helper/photofeed.js metaOf(list): a takenAt day is always kept; a createdAt day only when fewer than max(10, a fifth of the photos) share it; the rest show no day. A list saved before (no metaV 2) is thinned the same way when read and its ETag dropped, so the next look reads the list whole; fresh lists are marked metaV 2 so this runs once. Gap: the real days need the server to send takenAt (from Frameo's own list or the originals' EXIF)."
impact: low
affected_modules: ["helper/photofeed.js", "docs/screensaver.md"]
related_tests: ["tools/test/photofeed.test.js (the day a whole batch was added is left out; a day taken, or added alone, is shown)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-10-31T16:40:00Z"
```

```yaml
id: CU-20261101-02
type: feature
title: "Phone remote: several TVs through one hub, a switcher on the phone"
description: "The owner has a second TV and wants the phone remote to switch between them. hub/server.js: TV_HOSTS (comma-separated; TV_HOST still works) gives one entry per TV with its own link, pinned link key, learned MAC, Wake-on-LAN and name (asked of the TV over its link, kept in data/tvs.json for a TV that sleeps); the first TV keeps the files it had (link-key, tv-mac), so a one-TV hub needs nothing moved; a phone's request goes to the TV its x-tv header names (else the first); a TV may answer only requests that went to it; the page itself comes from any linked TV; GET /hub/tvs lists {id, name, on, link, mac} (never a MAC), /hub/status adds tvs; the history and alerts follow the first TV. helper/remote.js: the hub's self request /tv-info answers the TV's name (remote.name, set with POST /api/remote/name, else LG's deviceName without '[LG] '); through a hub the pairing QR names this TV (&tv=<its address>). helper/remotepage.js (and statuspage.js): one key per TV on the phone (the first TV keeps cytv-remote-key, the others cytv-remote-keys), x-tv on every request, the TV's name first in the status line and a tap on it lists the TVs to switch (a TV not paired asks for its code); the QR's tv switches to that TV. Checked in Chromium with a stand-in two-TV hub: the first TV with the key it had and no x-tv, the second listed not paired, paired with x-tv, its own volume, and back."
impact: medium
affected_modules: ["hub/server.js", "helper/remote.js", "helper/remotepage.js", "helper/statuspage.js", "docs/remote.md"]
related_tests: ["tools/test/hub.test.js (two TVs: a phone reaches the one it names, each pinned with its own key and named by itself, a TV cannot answer for the other nor link as it; the second asleep: listed off and woken at its own MAC)", "tools/test/remote.test.js (the hub may ask the TV's name; the TV's own name is set, cleaned and cleared; the QR names this TV; the page has the TV list and x-tv)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T11:30:00Z"
```

```yaml
id: CU-20261101-01
type: feature
title: "webOS 22 and newer again: the service on Node.js 12.21, the pages in Chromium 87 (the owner's second TV)"
description: "The owner's second TV, an LG 86UQ8000AUB on webOS 22 (SDK 7.6.0, firmware 04.60.91, Node.js 12.21.0, Chromium 87.0.4280.88, 1.7 GB of RAM), was refused by bootstrap.sh (Node.js v12.21.0 too old, needs webOS 25); a firmware update would remove root, so the fork supports it (DECISIONS.md D-20261101-1, which supersedes D-20261029-3). helper/tvprofile.js FLOOR is webOS 22 (SDK 7, Node.js 12); install.sh (MIN_SDK 7, MIN_NODE 12) and bootstrap.sh (MIN_NODE 12, the messages) follow; webOS 5 and 6 stay refused. Firmware 04.60.91 is already in compat.json (issue 31), so with LG's native Home the setup goes on without --force, through the stand-in, with the overlay notification window. Two parts tried only on webOS 25 are off below it, fail safe: tvprofile.js lgScreensaver ('bus' from SDK 10: helper/lgscreensaver.js registers for LG's screensaver question only then, and waits while the version is not known yet; a registered client that answers wrong is the fault that reboots the TV at standby, D-20261029-9) and devtoolsRestart (scripts/devtools-close.sh restart starts WebAppMgr again at boot only from SDK 10; below it the copy of LG's script is mounted and the boot log says the port stays open until WebAppMgr starts again). The service itself needed no change for Node 12: its tests pass under Node.js 12.21.0. tools/check.sh downloads Node.js 12.21.0 (pinned SHA-256, as it once did Node 8.12) and runs the tests under it and the current Node; tools/test.js skips a test that says it needs a newer Node (the hub, Node 22). service.test.js forbids what Node 12.21 lacks (?., ??, ||=, replaceAll, .at, Object.hasOwn, fs.rmSync, node: and /promises modules, randomUUID, base64url, AbortController, atob, performance, ...) and checks its own rules; ESLint takes the service, the scripts and the tests as ES2019, tsc targets ES2019. tools/oldchrome.js runs every page check in Chromium 87 (a snapshot build of 87.0.4280: revision 812847 for Linux, 812851 for macOS, pinned SHA-256) as well as Chrome for Testing 120, and prints each engine's version; pages.test.js checks the scripts and the CSS for what Chromium 87 lacks (:is, :where, :has, a complex :not, aspect-ratio, dvh, overflow: clip, the individual transforms, unprefixed mask, the newer colour functions, media ranges, .at, Object.hasOwn, structuredClone, ...) and parses the scripts as ES2021; the pages needed no change (their scripts are ES5). metrics.test.js counts a read once on Node 12 (readFileSync calls fs.openSync there). CI caches Node.js 12.21 and both Chromium builds. README, AGENTS.md and the docs say webOS 22 and newer (Node 12, Chromium 87). Not checked on a TV: the setup and the service on webOS 22."
impact: medium
affected_modules: ["helper/tvprofile.js", "helper/lgscreensaver.js", "scripts/devtools-close.sh", "scripts/bootstrap.sh", "install.sh", "tools/check.sh", "tools/test.js", "tools/oldchrome.js", "tools/oldchrome-container.sh", "eslint.config.js", "tsconfig.json", ".github/workflows/checks.yml", ".github/workflows/dev-build.yml", ".github/workflows/release.yml", "DECISIONS.md", "AGENTS.md", "README.md", "docs/tested-tvs.md", "docs/install.md", "docs/development/internals.md", "docs/development/testing.md", "docs/screensaver.md", "docs/security.md"]
related_tests: ["tools/test/tvprofile.test.js (the floor is webOS 22: SDK 7 with Node.js 12; webOS 22, 23 and 24 supported, 5 and 6 not; lgScreensaver and devtoolsRestart from webOS 25 only)", "tools/test/scripts.test.js (the setup and install.sh refuse webOS 5 and 6 and a Node.js older than 12; webOS 22 with Node.js 12.21, firmware 04.60.91 and the native Home is set up without --force, with the overlay window; devtools-close.sh does not restart WebAppMgr on webOS 22 or an unknown version)", "tools/test/lgscreensaver.test.js (nothing registers on webOS SDK 7, 8 and 9; an unknown version waits and registers once the profile says webOS 25)", "tools/test/service.test.js (nothing needs a Node newer than 12.21; the rules catch what Node 12 lacks and let through what it has)", "tools/test/pages.test.js (nothing in the pages is newer than Chromium 87; the rules catch what it lacks; the scripts parse as ES2021)", "tools/check.sh (every test under Node.js 12.21.0)", "tools/oldchrome.js (every page in Chromium 87.0.4280 and 120)"]
commit_ref: "feature/webos22 (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T16:38:32Z"
```

```yaml
id: CU-20261101-03
type: fix
title: "Setup through the stand-in: Home is opened when the manager app is in front, so the new Home is not undone"
description: "On the owner's webOS 22 TV the setup run from the manager app ended with LG's Home back: scripts/10-cleanyourtv-home (the stand-in way) opens Home only when nothing or Home is in front, then checks that the launcher opened in webapp-mgr and undoes the mount otherwise; with the manager app in front nothing opened Home within the check. It now opens Home when the manager app (com.cleanyourtv.manager) is in front too. Checked on the TV: after a reboot the launcher took over Home (home: mounting the launcher over LG's Home, sam restarted)."
impact: low
affected_modules: ["scripts/10-cleanyourtv-home"]
related_tests: ["tools/test/scripts.test.js (the stand-in way opens Home when nothing, Home or the manager app is in front, before it checks the new Home)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T17:30:00Z"
```

```yaml
id: CU-20261101-04
type: fix
title: "Input key: a hook that has run a while is seen as attached (the manager said not available on this firmware)"
description: "The owner: the Input key said it was not available on this firmware, yet it worked. helper/inputhook.js hookInfo() counted the hook attached only from its start lines in its log (InputHook initialized, lib_main returned: 0), and the log keeps only its newest lines, so a hook that has run a while had lost them (seen on the webOS 22 TV: only key lines left). Attached is now its start in the log, or its library in lginput2's memory maps with keys going through it; keys alone are not enough. helper/paths.js HOOK_LOG may be set with CYTV_HOOK_LOG (for the tests)."
impact: low
affected_modules: ["helper/inputhook.js", "helper/paths.js"]
related_tests: ["tools/test/inputhook.test.js (attached from the start lines, or from the library in lginput2 with keys; keys without the library, or the library without keys, are not)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T17:30:00Z"
```

```yaml
id: CU-20261101-05
type: feature
title: "Phone remote: rename a TV, fix a silent soundbar, and a switch to another TV starts afresh"
description: "The owner: the second TV showed as TV 2 with no way to rename it; switching TVs did not refresh (a TV that had rebooted showed inactive); and the sound fix used on the living-room TV (picture, no sound until the output was set to the TV's speakers and back to the soundbar) should be on the remote. helper/remote.js: POST /name {name} on the phone's API sets the TV's name (remote.name, cleaned; blank for LG's own), as /api/remote/name now does through the same setName; POST /sound/reset reads the sound output (com.webos.service.apiadapter/audio/getSoundOutput), and when it is a soundbar (external_*) sets tv_speaker, waits 1.5 s and sets it back; 409 when the sound is not on a soundbar, 429 within 8 s of the last. helper/remotepage.js: the status line opens the TV's sheet whenever a key is held: the TVs (read again from /hub/tvs each time), Rename this TV, and Fix the sound while the last status said a soundbar; useTv() clears the sleeping state, the last status, what is on and the sound before it starts that TV's checks. hub/server.js: /hub/tvs asks the linked TVs their names again at most every 20 s, so a rename shows in the next list. Checked on the living-room TV by hand before this (the same output change brought the sound back)."
impact: medium
affected_modules: ["helper/remote.js", "helper/remotepage.js", "hub/server.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (from the phone: the TV renamed and its name back to LG's own; the soundbar set up again by the TV speakers and back, refused when not on a soundbar and when asked twice at once; the page has useTv, /sound/reset and /name)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T17:30:00Z"
```

```yaml
id: CU-20261101-06
type: fix
title: "Phone remote on webOS 22: the arrows, play, info, blue and the digits work (no sendKeyCodes there), a held key is its press"
description: "The owner: the phone remote did not move with the arrows on the playroom TV (webOS 22). Its network input has no sendKeyCodes (\"Unknown method\"); read from its service's API permissions and binary: sendSpecialKey, test/sendKeyCode {keyCode} and the pointer socket, and no sendLongKeyEvent. helper/remote.js keyCode(): sendKeyCodes, and on Unknown method test/sendKeyCode with the same Linux code from then on; longKey(): sendLongKeyEvent, and on Unknown method the plain key through sendSpecialKey from then on. Checked on the TV by hand: test/sendKeyCode 103 (Up) moved the launcher's focus from the dock to the top row, 108 (Down) moved it back; sendSpecialKey takes BACK, HOME and DASH there and answers invalid key for a name it does not know."
impact: medium
affected_modules: ["helper/remote.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (webOS 22: the arrows through test/sendKeyCode with sendKeyCodes asked once, named keys unchanged, a held key its plain press)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T17:40:00Z"
```

```yaml
id: CU-20261101-07
type: fix
title: "webOS 22: Disney+ opens (LG's admanager left running there), and the debloat check no longer looks for its stub"
description: "The owner: Disney+ spun for ever on the playroom TV (webOS 22) and not on the living-room TV. Same Disney+ (24.5.8) on both; with the whole debloat undone it reached Who's watching, with the ads and adapps groups off too, and with only adapps off (adoverlay-service stubbed, the ad servers blocked) it opened a profile at once; with admanager stubbed again it stayed on its logo (35 s, twice). So the do-nothing stub over LG's admanager is the cause there (DECISIONS.md D-20261101-2). helper/tvprofile.js adManagerStub: true from webOS 25 (SDK 10) on, false below and when unknown; scripts/debloat-stop.sh adds admanager to the stubbed programs only when tvprofile.js says so for the SDK in /etc/os-release (VERSION_ID, there before luna is; read the same as the SDK on both TVs: 7.6.0, 10.3.2); helper/debloatcheck.js does not look for the admanager stub where the profile says LG keeps it. The playroom TV was left with adapps switched off until this ships. Gap: the manager's debloat menu still lists the app ads group as on there."
impact: medium
affected_modules: ["helper/tvprofile.js", "scripts/debloat-stop.sh", "helper/debloatcheck.js", "DECISIONS.md"]
related_tests: ["tools/test/tvprofile.test.js (adManagerStub from webOS 25 on only, also from the shell)", "tools/test/scripts.test.js (webOS 22 and an unreadable version: admanager not stubbed, adoverlay-service still)", "tools/test/debloatcheck.test.js (webOS 22: admanager not looked for, the rest in place)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T18:10:00Z"
```

```yaml
id: CU-20261101-08
type: feature
title: "webOS 22: the service answers LG's screensaver question, so the photos show instead of LG's screensaver"
description: "The owner: the screensaver did not work on the playroom TV; it should be ours before LG's. On webOS 22 nothing registered (tvprofile.js lgScreensaver '' below webOS 25, as nothing had been tried there), so LG's own screensaver came after its 3 minutes without a key (nopd's [TIMER]ScreenSaver:180; tvpowerd asked its two /power2 clients, screenmanager and Netflix, and launched com.webos.app.screensaver). Read on that TV: LG's bus module /usr/lib/nodejs/palmbus.js is there and tvpowerd's API has registerScreenSaverRequest and responseScreenSaverRequest under /power, with the same 3000 ms wait and a string timestamp. tvprofile.js lgScreensaver is 'bus' on webOS 22 (SDK 7) as from webOS 25 on; webOS 23 and 24 stay off until tried. helper/lgscreensaver.js unchanged but for its notes. Checked on the playroom TV with 1.6.56 (after the profile fix, CU-20261101-11): one subscription of ours on tvpowerd's /power (beside LG's browser); LG asked after 3 minutes, the service answered no in 40 ms, tvpowerd logged [setNack] clientName: cleanyourtv (not 'is not exist') and cancelled, LG's screensaver did not open, and Home opened with the photos."
impact: medium
affected_modules: ["helper/tvprofile.js", "helper/lgscreensaver.js"]
related_tests: ["tools/test/tvprofile.test.js (lgScreensaver 'bus' on webOS 22 and from webOS 25 on, '' on 23, 24 and unknown)", "tools/test/lgscreensaver.test.js (webOS SDK 7.6.0 registers and answers on the same connection; 8 and 9 do not register)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T18:10:00Z"
```

```yaml
id: CU-20261101-09
type: security
title: "Dev tools: minimatch 11.0.1 under ESLint (Dependabot alert 1, GHSA-g3hv-75wg-m249)"
description: "GitHub flagged minimatch below 11.0.1 (denial of service through glob-part amplification), pulled in by ESLint 9.9.0 (3.1.5, through @eslint/eslintrc and @eslint/config-array). It is a development tool only: nothing in package.json reaches the TV. No 3.x or 10.x fix exists, so package.json overrides minimatch to 11.0.1 (Node 18 and newer; lint runs on the current Node, CI on Node 22). Checked: npm run lint passes, ESLint still applies its config (ES2019, 7 rules) and still reports a planted no-undef error in helper/."
impact: none
affected_modules: ["package.json", "package-lock.json"]
related_tests: ["tools/lint.js (ESLint over the service, scripts, tools and pages)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T18:40:00Z"
```

```yaml
id: CU-20261101-10
type: feature
title: "Manager > App updates: LG's store apps updated from the manager, as LG's store does it"
description: "The owner: show an option to update the apps (Disney+ and others) so LG's app update screen is not needed. Read from LG's store code (its discovery_2024 bundle in WebAppMgr's cache), its services' API permissions and both TVs' install history (a read-only research pass): LG keeps its update list itself (com.webos.service.pkgUpdate/statusAll, else com.webos.appUpdateService/statusAll: status Y an update, F one LG wants before the app opens, nsu Y needs newer TV software), and its store installs with com.webos.service.pkgInstall/install {id, subscribe: false, silence: false, target: {deviceId: INTERNAL_STORAGE}}. helper/appupdates.js: GET /api/appupdates joins LG's list with the installed apps (an app removed since LG's check and LG's own system apps left out); POST /api/appupdates/update {id} or {all: true} queues them and installs one at a time with LG's store's call, never the app on screen, not while LG installs another, watched in LG's install list until the version changes, cancelled (pkgInstall/cancel) after ten minutes; GET /api/appupdates/state is the progress without asking LG. Manager: App updates (after Debloat) lists them with their versions, OK updates one, Update all, an app needing newer TV software shown but not offered (the TV's software updates are blocked to keep root), progress read every 3 s while updates run, the last results in green or red. The list read on both TVs with this code: the playroom TV Prime Video (F), the living-room TV Apple Music and Apple TV (F); Peacock (removed) and LG's Life on Screen left out. Tried on the playroom TV with 1.6.56 (the owner said go): Prime Video 7.5.11 updated to 7.5.14 in about 10 s through POST /api/appupdates/update, LG showed its own toast (Application has been successfully updated) and took it off its list."
impact: medium
affected_modules: ["helper/appupdates.js", "helper/helper.js", "manager/src/js/menu.js", "manager/app/index.html", "tools/oldchrome.js", "docs/manager.md", "docs/api.md", "AGENTS.md"]
related_tests: ["tools/test/appupdates.test.js (the list joined and filtered; LG's store's install call; one at a time; not the app on screen nor while LG installs another; done by the new version; LG's refusal, an end without a new version, cancelled when too long; bad requests refused; the progress without asking LG)", "tools/oldchrome.js 'app updates' (Chromium 87 and 120: the list, Update all, the one needing TV software not offered, OK starts one, Updating, the green result and the app gone from the list)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T19:20:00Z"
```

```yaml
id: CU-20261101-11
type: fix
title: "The TV profile saved by an older version is decided again at start (webOS 22's screensaver part waited for a restart)"
description: "After the update to 1.6.55 the playroom TV logged 'screensaver: not registered on webOS SDK 7.6.0' although /api/tv said lgScreensaver 'bus': helper/tvprofile.js create() used the profile saved in tv.json by 1.6.54 until its refresh, and lgscreensaver.js decides once at start. create() now decides the saved facts (model, firmware, SDK, LG's Home) again with this version's rules, so a changed rule applies from the first start after an update."
impact: low
affected_modules: ["helper/tvprofile.js"]
related_tests: ["tools/test/tvprofile.test.js (a profile saved by an older version, with webOS 22's old screensaver decision, is decided again at start)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T19:20:00Z"
```

```yaml
id: CU-20261101-12
type: fix
title: "webOS 22: LG's online services group is not available there, and the debloat check says nothing about it"
description: "After the playroom TV's debloat was switched back on, Check that it works said LG's online servers were not in the hosts file. On webOS 22 LG's sdx names US.lgtvsdp.com for every service the group blocks (homeprv_secure, ibis_stat_secure, rdx_secure, iot: read on the TV), the host LG's app store and app updates use too, so scripts/debloat-hosts.sh rightly blocks nothing there. helper/tvprofile.js lgServerHosts: from webOS 25 (SDK 10) on; helper/debloatcheck.js does not look for the group's lines where the profile says no. Gap: the manager still shows the switch there."
impact: low
affected_modules: ["helper/tvprofile.js", "helper/debloatcheck.js", "docs/debloat.md"]
related_tests: ["tools/test/tvprofile.test.js (lgServerHosts from webOS 25 on, from the shell)", "tools/test/debloatcheck.test.js (webOS 22: LG's online servers not looked for)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T19:40:00Z"
```

```yaml
id: CU-20261101-13
type: fix
title: "Hub: a TV in standby counts as off at once (the phone's presses waited 8 s for 'the TV did not answer in time')"
description: "The owner: the remote seemed broken, {\"error\":\"the TV did not answer in time\"}. The living-room TV was in standby from 18:58:43 to 19:10:27 (tvpowerd); a TV in standby keeps its link to the hub open but answers nothing, so the hub kept it as linked and on, and every press went down the link and waited 8 s for a 504 instead of the off answer that gives the phone its Turn the TV on button. hub/server.js: every beat (20 s) the hub also asks each linked TV its small /tv-info question and drops the link when no answer comes within 6 s (the TV then counts as off; it links again when it wakes, remote.js noticing the gap); a press that times out asks the same question at once; the time limits are options (beatMs, aliveMs, answerMs). Deployed to the hub on Sandino-Ubuntu: both TVs stay linked across the beats."
impact: medium
affected_modules: ["hub/server.js"]
related_tests: ["tools/test/hub.test.js (a TV in standby with its link still open: dropped after its unanswered question, listed off, a press answered off at once)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T19:20:00Z"
```

```yaml
id: CU-20261101-14
type: fix
title: "webOS 22: LG's admanager kept off again, and Disney+ still opens (its entry hidden from LG's hub)"
description: "The owner: keep the ads off and Disney+ working, even if an LG part has to be replaced, unless letting it run is fine with the hosts blocked. Read on the playroom TV: Disney+ asks admanager for LG's advertising ID (getAdid) when it starts. On webOS 25 LG's hub starts the stub for that call, sees it end and answers 'Failed Connecting to Service' at once (living-room TV log), so Disney+ goes on; on webOS 22 the hub logs the stub's start and end and answers nothing, so Disney+ waited on its logo (reproduced). Letting admanager run is not enough there: it reaches LG's ad servers through sdx (sdx/send, getServer), which on webOS 22 names only US.lgtvsdp.com, the app store's host, so the hosts file cannot block it. With an empty file bind-mounted over admanager's two .service files and ls-control scan-services, a call is answered 'Service does not exist' at once, and Disney+ opened to its home (tried by hand, then undone). helper/tvprofile.js adManager replaces adManagerStub: 'stub' from webOS 25, 'hide' on webOS 22, '' on webOS 23 and 24 and unknown; scripts/debloat-stop.sh stubs admanager for stub and hide and, for hide, mounts the empty file over both .service files and has the hub rescan; scripts/debloat-undo.sh unmounts them and rescans; helper/debloatcheck.js looks for both on webOS 22 (paths.js DBUS for the tests). DECISIONS.md D-20261101-3 supersedes D-20261101-2."
impact: medium
affected_modules: ["helper/tvprofile.js", "scripts/debloat-stop.sh", "scripts/debloat-undo.sh", "helper/debloatcheck.js", "helper/paths.js", "DECISIONS.md", "docs/debloat.md", "docs/tested-tvs.md"]
related_tests: ["tools/test/tvprofile.test.js (adManager: stub from webOS 25, hide on webOS 22, nothing on 23, 24 and unknown, also from the shell)", "tools/test/scripts.test.js (admanager hidden as well on webOS 22, stubbed on webOS 25, left where the version is unknown; the stop script mounts over both .service files and rescans, the undo unmounts and rescans)", "tools/test/debloatcheck.test.js (webOS 22: stubbed and hidden is in place, not hidden is said; webOS 23 leaves it to LG)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-01T19:40:00Z"
```

```yaml
id: CU-20261103-01
type: feature
title: "Customize > Theme > Holiday themes: pick one now (Christmas, fall...), or let each come by date"
description: "The owner: Halloween turned itself off, and now wants Christmas or fall, but could only pick a theme that replaces Dawn. Holiday themes were one switch: during a holiday's dates its theme went over the chosen theme. helper/theme.js: a holiday theme can be picked now (POST /api/theme/holiday-pick {id}; {id: ''} ends it), kept as theme.holidayPick {id, until}: shown over the chosen theme at once, whatever the date and with the by-date switch off, until the end of its dates on or after the day it was picked (Winter holidays picked on 3 November until 26 December; Halloween picked in November until the next 31 October), then the holidays by date again when that switch is on; downloaded when picked, kept when another theme is chosen; only a holiday theme is taken. GET /api/theme/list holidays adds pick and themes (each holiday theme with its dates, in the order of the year). Launcher: the Holiday themes row opens its own menu: By date (the switch), each holiday theme with its dates (Showing until <day> when picked, Showing now, by date), and Stop the holiday theme while one is picked; dates in the TV's language."
impact: low
affected_modules: ["helper/theme.js", "app/src/js/menus.js", "i18n/en.json", "tools/oldchrome.js", "docs/themes.md"]
related_tests: ["tools/test/theme.test.js (Winter holidays picked on 3 November: shown now until 26 December, kept when another theme is chosen, ended with its dates, then by date; Halloween picked in November until the next 31 October; ended on request; a theme that is not a holiday refused; the holiday themes listed with their dates)", "tools/oldchrome.js 'holiday themes' (Chromium 87 and 120: the menu with By date and the holiday themes with their dates; Winter holidays picked: Showing until and a Stop row; Stop ends it)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-03T03:10:00Z"
```

```yaml
id: CU-20261103-02
type: fix
title: "Dawn: the pointer reaches the buttons at the top again (Input, Search...), not only the remote's keys"
description: "The owner: on Dawn the Magic Remote's pointer could not select the top buttons such as Input; only the arrow keys could. Dawn has a cut-out of its scenery over the clock (effects.foreground), so the apps' area (#view) is brought forward over it (z-index 7, over #top with the buttons at 5), and Dawn's apps' area starts at the top of the screen (--view-top 0px): its empty part lay over the buttons and took the pointer (the point at each button's middle was #scroll). app/src/css/frame.css: with a foreground, #view lets the pointer through and only its tiles (apps and watch cards) take it."
impact: low
affected_modules: ["app/src/css/frame.css", "app/index.html", "tools/oldchrome.js"]
related_tests: ["tools/oldchrome.js 'dawn pointer' (Chromium 87 and 120, Dawn: the point at the middle of each of the five top buttons is that button, and a tile still takes the pointer; it failed before the fix with #scroll there)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-03T03:40:00Z"
```

```yaml
id: CU-20261103-03
type: fix
title: "The Input button on Home shows the Inputs picker as the Input key does, and the Home key puts the picker away"
description: "The owner: the Input button on the Home screen opened a full-screen menu (the launcher's own Inputs list) where the remote's Input key shows the Inputs picker; and over some overlays the Home key did not go home. The launcher already closes its own menus, search and photo chooser on the Home key (input.js webOSRelaunch); the Inputs picker is an app of its own (an overlay window) that the Home key never reaches and that had nothing for the TV going elsewhere. helper/inputkey.js: POST /api/picker/show shows the picker as scripts/inputkey.sh does (the kept-ready picker relaunched, the on-demand one started with ondemand; {launcher: true} where the key opens the launcher's list or the picker does not start); POST /api/picker/hide relaunches it with {hide: true} only while its own notes said it is up (picker show, then hide or close). Launcher: the Input button asks for the picker and opens its own list only when told to or when the service does not answer; the Home key also asks for the picker to be put away. Picker 1.2.2: a relaunch or start with hide only puts it away (never shows it), and it goes when its page is hidden. Not tried on a TV yet (both were off)."
impact: low
affected_modules: ["helper/inputkey.js", "app/src/js/config.js", "app/src/js/input.js", "picker/app/index.html", "picker/app/appinfo.json", "tools/oldchrome.js"]
related_tests: ["tools/test/inputkey.test.js (the kept-ready picker asked to show itself, the on-demand one started with ondemand, the launcher's list where the key opens it or the picker fails; the Home key puts the picker away only while it is up, and once)", "tools/oldchrome.js 'input button' (Chromium 87 and 120: the Input button asks for the picker and opens no list, opens the launcher's list when told to; the Home key asks for the picker to be put away)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-03T04:20:00Z"
```

```yaml
id: CU-20261103-04
type: fix
title: "webOS 25: the Home key closes Customize, Search and the rest while Home is in front (LG did nothing then)"
description: "The owner: on Dawn the Home key did nothing from Customize's settings or from Search. The launcher closes its menus, Search, the photo chooser and the picker on the Home key's relaunch (input.js homeKey), but on the living-room TV (webOS 25) no relaunch came: LG's log for a Home press while Home was in front reads lginput2 [KEY_HOME] button press, then surface-manager KEYFILTER_APPLAUNCH 'com.webos.app.home is foreground app', and nothing more. webOS 22 relaunches Home with launchType homeKey itself. The input hook already logs every key LG's input service sends with its Linux code; lined up against LG's own key names, KEY_HOME is 773 there (KEY_PREVIOUS 412, OK with the pointer 272). helper/homekey.js: where tvprofile.js says homeKeyWatch (webOS 25 and newer), it reads what the hook's log gained every 300 ms and, on a Home press (state=1) while Home is in front, relaunches Home with {launchType: 'homeKey'}, which the launcher already answers; not while another app is in front (LG goes Home then), once per press, a log that shrank read from its start. VRR, asked at the same time: the TV's model config says supportVRR vrr_off and supportFreesync false (its panel runs at 120 Hz), so the PS5 is right that it has none."
impact: low
affected_modules: ["helper/homekey.js", "helper/tvprofile.js", "helper/helper.js", "docs/launcher.md", "AGENTS.md"]
related_tests: ["tools/test/homekey.test.js (a Home press while Home is in front relaunches Home with homeKey, once; nothing for older lines, other keys, a release or another app in front; a shrunk log read from its start; webOS 22 left to LG)", "tools/test/tvprofile.test.js (homeKeyWatch from webOS 25 on)", "tools/test/api.test.js (the homekey part runs)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-03T20:55:00Z"
```

```yaml
id: CU-20261104-01
type: feature
title: "Fix the picture (a black picture with only the sound or the subtitles): LG's logs kept, then the TV restarted; LG's logs kept at each start"
description: "The owner on the living-room TV: videos played only their subtitles, then neither sound nor picture, in every app. LG's log showed every stream since the TV's start at 22:31 UTC muted by its video output (avmutemanager setAvMute videoMute on, owner com.webos.service.videooutput) and never unmuted (14 streams, no videoMute off), the players torn down and started again, and surface-manager 'Punch through is not working' (also seen in a good boot, so not the cause by itself). A restart cleared it, as on 2026-11-01; LG recorded no crash either time. Its logs from the bad start were gone (LG keeps them in RAM and turns them over within minutes), so the cause is not known yet; the suspect is our boot step that mounts the launcher and restarts SAM about 55 s into the start, while LG's media services start. The owner: an option for it in the settings, and find out why. helper/picturediag.js: a copy of LG's logs (dbg-log and its rotations, messages, bootd.log, our boot and service logs) four minutes into each start of the TV (the service up less than 15 minutes into it), the last 2 kept; POST /api/picture/fix {restart: true} keeps a copy at that moment (the last 3) with a summary (uptime, the app in front, LG's video mutes on and off and punch-through warnings) and restarts the TV 2 s later, at most once in 5 minutes; GET /api/picture/diag lists the copies; all in diag/, root only (LG's logs hold the TV's sdx sign-in headers), never sent anywhere. The phone remote's TV sheet: Fix the picture (it is black): restart the TV, with a confirmation (POST /picture/fix); the manager: Fix the picture, with Cancel and Yes, restart the TV."
impact: medium
affected_modules: ["helper/picturediag.js", "helper/helper.js", "helper/remote.js", "helper/remotepage.js", "manager/src/js/menu.js", "manager/app/index.html", "docs/troubleshooting.md", "docs/remote.md", "docs/manager.md"]
related_tests: ["tools/test/picturediag.test.js (a start's copy only at a start of the TV, the last 2 kept, root only, with the summary of LG's video mutes; Fix the picture keeps the logs, then restarts the TV, at most once in 5 minutes; without restart only kept, the last 3 kept)", "tools/test/remote.test.js (Fix the picture from the phone goes to the picture part with restart; the page has the call)", "tools/test/api.test.js (the picturediag part runs)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-04T04:10:00Z"
```

```yaml
id: CU-20261105-01
type: fix
title: "The Input key and the Input button did nothing: the Home key's call could leave a hidden picker LG never showed again"
description: "The owner: the Input key and the Input button on Home did nothing on the living-room TV (picker mode on demand, chosen in the manager). Since 1.6.59 (CU-20261103-03) the launcher asks on the Home key for the picker to be put away. The service believed the picker was up from its notes and relaunched it with {hide: true}, also when it had already been closed, which started it: that page stayed alive, hidden, without its on-demand flag (set only from the first launch's parameters), so it no longer closed after use. Every Input press then woke the hidden page (picker relaunch, show, painted in the log) with LG's window not shown (surface-manager NL_VSC had no visible:true for those launches); closing the app brought it back (the next launch showed its window at once). helper/inputkey.js hidePicker: only a picker in the app manager's running list is touched; the on-demand one is closed, only the kept-ready one told to hide; it is never started. Picker 1.2.3: a page started only to be put away closes itself, and a relaunch with ondemand makes it close after use however it was first started."
impact: medium
affected_modules: ["helper/inputkey.js", "picker/app/index.html", "picker/app/appinfo.json"]
related_tests: ["tools/test/inputkey.test.js (kept ready: told to hide while up, once; on demand: closed; not running although it said it was up: nothing is started)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-05T04:25:00Z"
```

```yaml
id: CU-20261105-02
type: feature
title: "Inputs show an icon for the device plugged in (a PS5-style console, a Switch-style handheld, a soundbar...)"
description: "The owner: nice icons for what is plugged in, such as the PS5, a Nintendo Switch or the Sonos. Every input had the same HDMI icon. A block shared by the launcher (app/src/js/core.js) and the picker (picker/app/index.html, 1.2.4): ten line icons drawn here in the style of the others, the shape of the device and never a company's logo, as this repository is public (tower, handheld, block, soundbar, box, stick, pad, disc, laptop, settop), and deviceIcon(name), which matches the name the device gives over HDMI-CEC or the owner's label (PS5, PlayStation, Nintendo, Xbox, Sonos, Bose, Apple TV, Fire TV, Roku, Blu-ray, Xfinity...); a name that says nothing keeps the HDMI icon. Used by the picker's inputs and pinned inputs, the launcher's Inputs list and its input tiles (the icon follows a name that comes or changes later). Also: the 2-second Home delay reported earlier was not real, two log clocks 2.07 s apart (/proc/uptime and LG's log clock); measured, Home reaches the launcher in 0.2 to 0.7 s, and nothing was changed for it."
impact: low
affected_modules: ["app/src/js/core.js", "app/src/js/tiles.js", "app/src/js/menus.js", "app/index.html", "picker/app/index.html", "picker/app/appinfo.json", "tools/oldchrome.js", "docs/input-key.md"]
related_tests: ["tools/test/deviceicons.test.js (the same block in the launcher and the picker; each device name gets its icon, one that says nothing keeps HDMI; plain drawn shapes; used by all four places)", "tools/oldchrome.js 'picker icons' (Chromium 87 and 120: an input named Game console gets the pad, HDMI 2 the plain icon)"]
commit_ref: "feature/hardening (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-05T05:50:00Z"
```

```yaml
id: CU-20261108-01
type: fix
title: "Black picture in every app on webOS 25: the media services restarted after the takeover, and a Fix a black picture / Restart the TV on the phone's power key"
description: "The owner: no picture and no sound, only subtitles, a third time (2026-11-08), and no restart to be found on the phone remote (it was behind a tap on the status line). The copy picturediag.js kept 4 minutes into that start shows LG's videoMute set 4 times and never lifted, with Netflix in front, as on 2026-11-01 and -03. Upstream's issue 122 is the same TV software (SDK 10.3.2, flutter Home, the boot log 'after-sam ... services: none'): there, restarting videooutputd and then umediaserver brought the picture back. Taken from upstream by reviewed cherry-pick (D-20261028-1, authors kept, AI co-author lines removed): fe44798 (umediaserver after SAM on webOS 26) and 056fe08 (videooutputd and umediaserver on webOS 25 with the flutter or web Home; a file after-sam-services replaces the list on one TV). The fork's own part: POST /api/picture/fix {media: true} keeps LG's logs and restarts those two services where they run, the TV left on (at most every 30 s); the phone's power key opens a sheet (Turn the TV off, Fix a black picture, Restart the TV) instead of a bare 'Turn the TV off?'; the TV sheet has the same two; the manager's Fix the picture offers both; a page from before (POST /picture/fix with no body) still restarts the TV. The phone's wait after Turn the TV on is three minutes instead of 90 s, since a TV switched off completely starts from cold (that start, woken over Wi-Fi, linked about 100 s after the wake), and the off text comes back when it gives up."
impact: medium
affected_modules: ["helper/tvprofile.js", "scripts/after-sam.sh", "helper/picturediag.js", "helper/remote.js", "helper/remotepage.js", "manager/src/js/menu.js", "manager/app/index.html", "compat.json", "docs/tv-changes.md", "docs/tested-tvs.md", "docs/troubleshooting.md", "docs/remote.md", "docs/manager.md"]
related_tests: ["tools/test/tvprofile.test.js (webOS 25 flutter/web: videooutputd umediaserver; webOS 26: arccontroller umediaserver; native and unknown unchanged)", "tools/test/after-sam.test.js (the after-sam-services file replaces the list; an update leaves it)", "tools/test/picturediag.test.js (media: the logs kept, then videooutputd and umediaserver in order, no reboot, not twice at once; a service that does not run is skipped)", "tools/test/remote.test.js (the power sheet and both calls in the page; no body restarts the TV; media restarts the services)"]
commit_ref: "feature/black-picture (the cherry-picks of fe44798 and 056fe08 and the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-08T19:55:00Z"
```

```yaml
id: CU-20261108-02
type: chore
title: "The API test runs the service on port 38765, not the TV's 8765"
description: "tools/check.sh failed on the owner's Mac because another program there listened on 127.0.0.1:8765 (EADDRINUSE: the service in api.test.js did not start). helper/helper.js takes CYTV_PORT (never set on the TV, where it stays 8765); api.test.js sets it to 38765, or CYTV_TEST_PORT."
impact: low
affected_modules: ["helper/helper.js", "tools/test/api.test.js"]
related_tests: ["tools/test/api.test.js (the whole contract runs against the service on the test port, with 8765 taken)"]
commit_ref: "feature/black-picture (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-08T20:10:00Z"
```

```yaml
id: CU-20261108-03
type: feature
title: "Phone remote: an Input key that switches the TV to an HDMI input or Live TV"
description: "The phone remote had no Input key. The top row gains one (beside the gear): a sheet with the TV's inputs as its own Inputs picker lists them (LG's eim getAllInputStatus through apps.js: the name the TV gives what is plugged in, then the port; Nothing connected dimmed), Live TV while the manager has it on, and the one on the screen outlined. A tap launches that input's app (com.webos.app.hdmiN) or this launcher's Live TV (Home with {live: true}). remote.js: GET /inputs and POST /input {id}, which switches only to an input on that list."
impact: low
affected_modules: ["helper/remote.js", "helper/remotepage.js", "helper/apps.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (the Input key lists the inputs and Live TV, and switches only to those; Live TV left out when switched off; the page has the key and its call)"]
commit_ref: "feature/black-picture (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-08T23:00:00Z"
```

```yaml
id: CU-20261108-04
type: feature
title: "Phone remote: an apps rail beside the remote on a wide portrait screen; keys, touchpad and apps side by side in landscape"
description: "On a folding iPhone the page kept its one phone column: closed, a strip beside it stayed empty; open in landscape, the remote sat in the middle of the screen. layout() in the page picks from the window: landscape with room (at least 700 x 480) puts the keys on the left (always shown), the touchpad, Type and TV as tabs on the right (no Remote or Apps tab there) and the apps as a strip under them; a portrait screen at least 460 wide and 0.6 as wide as high keeps the remote and adds a rail of the apps beside it (the unit is worked out from the width left beside the rail, the rail scrolls in its own space). A phone is unchanged. The apps (dock order) fill the Apps tab and the rail or strip from one /apps answer, each icon asked once. Also: 123 in landscape leaves the tab on the right as it is, and switching TVs reads that TV's apps (the old TV's list stayed before)."
impact: low
affected_modules: ["helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (the page carries layout() with its thresholds, the rail and wide grids, the dock, 123 without a tab switch in landscape, and the apps read again after a TV switch)"]
commit_ref: "feature/black-picture (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-09T00:30:00Z"
```

```yaml
id: CU-20261108-05
type: fix
title: "Phone remote: the folding iPhone closed and turned gets keys and touchpad side by side; turns are noticed at once; the apps on the right, left or under the remote"
description: "On the owner's iPhone Duo closed, landscape showed the phone's column cut off at the bottom (the page is about 583 x 458 points there), and turning the open phone did not change the layout until it was folded and opened again. layout() now reads the window from the visual viewport as well as innerWidth/innerHeight, takes landscape from 560 x 400 (the keys may shrink to 0.66 of a unit there; their height budget is 600 without the tabs), skips while a text box has the keyboard, and runs on resize, the visual viewport's resize, orientationchange, the orientation media query, again 150/400/900 ms after each (iOS reports late; a fold passes through sizes of no pose) and each second while the page shows. Closed and upright the page gets 382 of the 466 points: iOS keeps the right column for its own controls in web pages and they cannot draw there (WebKit says it is exploring a way), so the phone's column stays. The gear (now This phone) gains Apps on a wider screen: Right, Left or Under the remote (the remote centred), kept on the phone. The page reports its sizes once per new set (POST /screen); the service logs them as numbers so the layouts can be tuned for a phone not to hand."
impact: medium
affected_modules: ["helper/remotepage.js", "helper/remote.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (layout() thresholds and its listeners, the 1 s check, the left and under layouts and their saved choice, no viewport rewrite; /screen logged once per new set of sizes, numbers only, the layout name from a fixed set)"]
commit_ref: "feature/black-picture (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-09T01:30:00Z"
```

```yaml
id: CU-20261108-06
type: fix
title: "Phone remote: the apps' side set for upright and turned apart; tabs scroll in their place on wide screens; turns followed after a key press; the vibration test gone"
description: "On the owner's iPhone Duo open in landscape, the gear's apps option changed nothing on the screen (it only set the upright rail), and the TV tab grew the page so the keys spread out and the D-pad went off the screen. The gear (This phone) now has Apps upright (right by default) and Apps turned (under the touchpad by default), each Right, Left or Under, kept on the phone (cytv-remote-apps); landscape gains a rail on the right or left of the keys and touchpad (the unit's width budget 824 there). In the rail and landscape layouts a tab other than the keys (TV, Type, Apps, Touchpad) is size-contained and scrolls in its place. layout() skipped every check after any key press (a key's own switch is an input and keeps the focus); it now waits only for a text box. The Vibration test (ways 1 and 2, the iPhone's own switch) is gone: the owner's iPhone taps with each key's own switch, which stays the only way."
impact: low
affected_modules: ["helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (fb without a way, switches whenever vibration is on, no Vibration test; the landscape rails and the strip; the side per layout and its saved pair; the contained tabs; the typing check limited to text boxes)"]
commit_ref: "feature/black-picture (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-09T02:30:00Z"
```

```yaml
id: CU-20261112-01
type: fix
title: "Watchdog: started on every boot path and after an update, keeps the crash logs of a boot, starts a failing service less often"
description: "Upstream e2be3e4 (issue 65), ported by hand (D-20261028-1). The boot script started the watchdog only at its end, so with LG's Home selected (DISABLE) and after an update (Home already replaced) no watchdog ran; it now starts right after the service, and bootstrap.sh stops the running one before an update, its rollback and a setup, so the one from the new files runs. watchdog.sh is one block that ends in exit (an update copying a new file over the running one does not confuse it), only a shell running bootstrap.sh holds it back (not any command line naming it), and a service that stops again at once is started after 10, 20 ... 120 s. The fork's limit stays (5 starts in 10 minutes, then one note until the next boot). The crash log no longer keeps only the first run: each run that ended adds its last 100 lines, and past 400 lines the first run of the boot and the latest ones are kept (upstream kept only the latest 400, which a loop of quick crashes fills with the same lines). Share log now includes it."
impact: medium
affected_modules: ["scripts/watchdog.sh", "scripts/10-cleanyourtv-home", "scripts/bootstrap.sh", "helper/sharelog.js", "docs/development/internals.md"]
related_tests: ["tools/test/scripts.test.js (the watchdog: replaced file, bootstrap.sh hold, backoff, the limit with the first crash first, the trimmed crash log, the start before every way out of the boot script and the stop in bootstrap.sh)"]
commit_ref: "feature/upstream-fixes-2026-11 (the commit that adds this entry, cherry picked from e2be3e4)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T12:00:00Z"
```

```yaml
id: CU-20261112-02
type: fix
title: "Boot on LG's native Home: the stand-in mounted first, launcher files copied only when changed, no black screen after the app manager restarts"
description: "Upstream abf8682 (pull request 162, issues 125 and 162), ported by hand (D-20261028-1) to the fork's boot path. Applies to the stand-in way (LG's native Home: the playroom webOS 22 TV); stage-home.sh's change applies to every TV. (1) At boot, when an earlier boot wrote home-takeover ('standin <LG's Home program>') and LG's Home as it came, tvprofile.js, home-method and the staged launcher are unchanged since, the stand-in is mounted before the service and before any Node.js step; WebAppMgr's one restart without its inspector is then left out (it would close the launcher the stand-in opened; it is off below webOS 25 anyway). Unlike upstream, cytv-token.js (written into app/ by the service at every start) and the app folder itself do not count as a newer launcher, or the fast start would almost never run. (2) stage-home.sh copies only launcher files that changed (cmp), removes those gone from app/ (not appinfo.json), skips folders, and touches home-overlay.staged. (3) home-standin.sh: when its registration ends with 'com.webos.applicationManager is not running', it waits for the app manager, has webapp-mgr close the launcher and ends, so Home starts afresh (a launcher left open as Home gave a black screen with the pointer). (4) watchdog.sh on the stand-in way: the TV on with nothing in front for two checks sets Home up again (twice, then LG's Home until the next reboot); Home listed as running without its stand-in closes the launcher (and reopens Home if it was in front). The app in front is the service's own /api/foreground answer the watchdog already asks for, so all-well costs no extra luna call, and neither check runs in the watchdog's first 90 s, while the boot script brings Home up and checks it itself. Not taken: the black box (top, meminfo and loadavg every 30 s written to the TV's flash: a timer and a history on the TV against D-20261029-7, and the load average is meaningless on the Realtek TVs), and the Node 8 SIGABRT retry in exec.js and the 5 s delay of the app watch in apps.js (a Node 8.12 fault; the fork's floor is Node 12.21). The webOS 25 living-room TV uses the mount way: only stage-home.sh changes there."
impact: medium
affected_modules: ["scripts/10-cleanyourtv-home", "scripts/stage-home.sh", "scripts/home-standin.sh", "scripts/watchdog.sh", "docs/development/internals.md", "docs/tv-changes.md"]
related_tests: ["tools/test/scripts.test.js (the fast start's order and conditions, its find run against a folder, stage-home.sh against a folder, the stand-in after an app manager restart, the watchdog's empty screen, grace, fallback, Home without its stand-in, and no calls while an app is in front)"]
commit_ref: "feature/upstream-fixes-2026-11 (the commit that adds this entry, cherry picked from abf8682)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T13:00:00Z"
```

```yaml
id: CU-20261112-03
type: fix
title: "Debloat: the hosts copy in RAM is unmounted only while it is on top, so another tool's /etc/hosts mount (update blocking) stays"
description: "Upstream 8a2bed5 (issue 87), ported by hand (D-20261028-1). In the fork the unmount lives in debloat-hosts.sh, which both debloat-stop.sh and debloat-undo.sh call, not in debloat-undo.sh as upstream: it unmounted /etc/hosts whenever its marker /tmp/cleanyourtv-hosts.mounted existed, so with Glasshouse's table or the Homebrew Channel's update block mounted over our copy later, a debloat change or undo took their mount off instead (on the playroom TV the update block keeps root). It now unmounts only when /etc/hosts is our copy (test -ef); otherwise the mounts stay and the marked lines are written into the file that is shown. The copy's path (CYTV_HOSTS_COPY) and a test bin folder (CYTV_TEST_BIN) can be pointed elsewhere for the tests; on the TV neither is set. docs/debloat.md says how it works with Glasshouse."
impact: medium
affected_modules: ["scripts/debloat-hosts.sh", "docs/debloat.md"]
related_tests: ["tools/test/scripts.test.js (debloat-hosts.sh run with a stand-in umount and mount: our copy on top is unmounted and removed; another table on top is left mounted and only our lines leave it)"]
commit_ref: "feature/upstream-fixes-2026-11 (the commit that adds this entry, cherry picked from 8a2bed5)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T13:30:00Z"
```

```yaml
id: CU-20261112-04
type: fix
title: "Wallpapers: with an interval set, opening Home changes the photo only once the interval has passed"
description: "Upstream 29589be (issues 234 and 225), ported by hand (D-20261028-1; the fork's wall.js has the chosen photo and the fitted layout, upstream's has credits and add-ons). With an interval (10 s to 60 min) Home still showed a new photo every time it opened, so the interval did not mean what it said and every opening decoded a new full-size photo while the page refreshed. Now a new photo on opening only when that many seconds have passed since the last change (or the clock was set back); 'Each time Home opens' (0) is unchanged, and the interval timer runs again on each opening."
impact: low
affected_modules: ["app/src/js/wall.js", "app/index.html", "docs/wallpapers.md"]
related_tests: ["tools/test/wall.test.js (new: the interval kept on opening, a new photo after it, 0 every time, a clock set back, off)"]
commit_ref: "feature/upstream-fixes-2026-11 (the commit that adds this entry, cherry picked from 29589be)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T14:00:00Z"
```

```yaml
id: CU-20261112-05
type: fix
title: "Home: app icons that failed before the service answered are asked again"
description: "Upstream 8710e0d (TylerBuza), ported by hand (D-20261028-1). The launcher can draw its saved layout before the service answers at a start; an icon asked for then failed, its tile showed the app's name, and an unchanged app list did not rebuild the tile, so the name stayed. After every answer of the app list (also an unchanged one, before the early return) a tile whose icon failed asks for it again with ?retry=n (the service strips the query), at most twice per tile; the name stays until the picture loads and a second failure does not add a second name. Live TV's built-in icon is never asked for."
impact: low
affected_modules: ["app/src/js/tiles.js", "app/src/js/layout.js", "app/index.html", "docs/troubleshooting.md"]
related_tests: ["tools/test/tile-retry.test.js (new: the name kept until the retry loads, no duplicate retry, at most two, one name, Live TV left alone, the retry before the unchanged-layout return)"]
commit_ref: "feature/upstream-fixes-2026-11 (the commit that adds this entry, cherry picked from 8710e0d)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T14:30:00Z"
```

```yaml
id: CU-20261112-06
type: fix
title: "Uninstall is never offered for safeupdate and appupdateblocker (the Homebrew Channel already was not)"
description: "Upstream bc8b93a, ported by hand (D-20261028-1): the fork already kept the Homebrew Channel, the input hook, LG's apps and its own out of Uninstall with one pattern (helper/apps.js KEEP), which both the removable flag Home is given and the uninstall call check. safeupdate and appupdateblocker join it: they keep LG's firmware and app updates away, and on the playroom TV a firmware update would remove root."
impact: low
affected_modules: ["helper/apps.js", "docs/launcher.md"]
related_tests: ["tools/test/apps.test.js (neither is marked removable, and an uninstall of either is refused without a call to the app store)"]
commit_ref: "feature/upstream-fixes-2026-11 (the commit that adds this entry, cherry picked from bc8b93a)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T15:00:00Z"
```

```yaml
id: CU-20261112-07
type: fix
title: "Continue watching: a TV without Telemachus is not asked for it on every read of Home's rows"
description: "Every read of Home's rows (at load, every minute while Home shows, on a relaunch; the service keeps a read 20 s) asked 127.0.0.1:8770 twice (/api/continue, then /api/brief) unless the Telemachus switch was off, also on a TV with nothing there. Now a Telemachus that does not answer is left alone: 30 s, then twice as long after each unanswered try, at most 10 minutes (a doubling wait rather than a flat 10 minutes, so a Telemachus that starts after the service at boot shows within a minute or two); /api/brief is not asked when /api/continue got no answer at all (an older Telemachus that answers 404 still is); switching Telemachus on again asks it at once. A Telemachus that answers is asked on every read as before. On Home, Customize > Continue watching shows the Telemachus switch only where the Telemachus app is installed; its cards, search's Look in and the TV health line were already shown only then. API paths and settings keys unchanged."
impact: low
affected_modules: ["helper/watch.js", "app/src/js/menus.js", "app/src/js/config.js", "app/src/js/watch.js", "app/index.html", "docs/launcher.md"]
related_tests: ["tools/test/watch.test.js (new: one question then none until the wait is over, at most every 10 minutes over two hours; found again when it starts later; asked at once when switched on)", "tools/test/launcher.test.js (new: the switch only with the app installed)"]
commit_ref: "feature/integrations-dormant (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T21:30:00Z"
```

```yaml
id: CU-20261112-08
type: fix
title: "/api/apps no longer gives the launcher the Sonos settings (the speaker's address among them)"
description: "launcherConfig() in helper/apps.js passed config.sonos (the followed speaker's id, address, port and room) to every page that reads /api/apps, although no launcher, picker or notification code reads it (grep for sonos in app/, picker/ and notify/: only the device-name pattern for a soundbar's input). It is now left out the same way as the voice, notification, wallpaper, photo feed and account settings. security.md already said the service's replies never give the address. The recorded API replies do not contain Sonos settings, so the golden file is unchanged."
impact: low
affected_modules: ["helper/apps.js", "docs/security.md"]
related_tests: ["tools/test/apps.test.js (new: a configured speaker's address and id are not in /api/apps)", "tools/test/api.test.js (unchanged, passes)"]
commit_ref: "feature/integrations-dormant (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T21:45:00Z"
```

```yaml
id: CU-20261112-09
type: fix
title: "Photo feed: the hourly timer runs only while a feed is set up"
description: "helper/photofeed.js started its hourly interval at every start of the service, also on a TV with no feed (it then woke every hour to do nothing). It is now started only while a feed is configured: at start when one is, by setup(), and stopped by disconnect(); a feed removed some other way (config.json edited) stops the timer at its next turn. Reading the ids before a photo when the last read is over an hour old (next()) is unchanged, and the photo feed's rows in Customize and on the wallpapers page stay."
impact: low
affected_modules: ["helper/photofeed.js", "docs/screensaver.md"]
related_tests: ["tools/test/photofeed.test.js (new: no hourly timer without a feed, one after setup or a second setup, none after disconnect or removal)"]
commit_ref: "feature/integrations-dormant (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T22:00:00Z"
```

```yaml
id: CU-20261112-10
type: feature
title: "Phone remote: Screen off (the sound stays on) and Screen on in the power key's sheet"
description: "The phone remote's power key offers Screen off beside Turn the TV off, Fix a black picture and Restart the TV: the picture goes dark while the sound, the apps and the network stay on (for music). It is LG's own screen off, the call upstream's phone remote makes (addons/catalog/phoneremote/service.js, POWER.off: tvpower/power/turnOffScreen), written for the fork's remote rather than ported (the fork's remote has its own service and page), with standbyMode active so the screen can come back (passive cannot without pulling the plug, per the Home Assistant LG library's notes). New LAN paths with the paired key: POST /picture/off, /picture/on (turnOnScreen, standbyMode active) and /picture/state (tvpower getPowerState). The sheet asks the power state when it opens; while the TV says Screen Off, Screen on comes first and the sheet says that any key on the TV's remote or Screen on brings the picture back. A refusal from the TV is shown. No full shut down (shutDown) is offered: the TV then answers nothing on the network. The same tvpower calls are used on webOS 22 and 25 (the older com.webos.service.tv.power name is webOS 4); not yet tried on either TV. The picker's pre-warm and the Sonos bar already treat a non-Active screen as off, and the watchdog's screen check needs Active, so a dark screen does not set them off."
impact: medium
affected_modules: ["helper/remote.js", "helper/remotepage.js", "docs/remote.md"]
related_tests: ["tools/test/remote.test.js (new: turnOffScreen and turnOnScreen with standbyMode active, the power state, a refusal said, no shutDown in the code; the sheet's rows with the screen on and off, run against a stand-in page)"]
commit_ref: "feature/integrations-dormant (the commit that adds this entry)"
author: "Lance Sandino (with Claude Code)"
timestamp: "2026-11-12T22:30:00Z"
```
