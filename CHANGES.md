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
