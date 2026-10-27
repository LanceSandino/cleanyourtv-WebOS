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
