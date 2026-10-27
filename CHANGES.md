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
