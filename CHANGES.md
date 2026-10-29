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
