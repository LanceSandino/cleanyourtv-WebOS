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
