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
