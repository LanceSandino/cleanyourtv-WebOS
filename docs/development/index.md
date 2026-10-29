# Contributing

The code is on [GitHub](https://github.com/LanceSandino/cleanyourtv-WebOS), a fork of [lasharor/cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS) ([About this fork](../fork.md)). Issues and pull requests are welcome, especially
reports from TVs that are not in the [tested list](../tested-tvs.md).

## Layout

| Folder or file | What it is |
|---|---|
| `app/` | The launcher: `src/` (its CSS and script files), the built `index.html` and `version.json`. |
| `manager/`, `picker/`, `notify/` | The three apps of the package (manager, Inputs picker, picture notification card); the manager is built from `manager/src`. |
| `themes/` | The [themes](../themes.md): one folder each (`theme.json`, `preview.jpg`, a wallpaper) and `index.json`. Read by the TVs from GitHub, not shipped with the service; [contribute one](../themes.md#contributing-a-theme). |
| `helper/` | The root service (Node.js), one module per part: see [Internals](internals.md#the-service). |
| `scripts/` | Boot, setup and restore scripts: `bootstrap.sh`, `10-cleanyourtv-home`, `stage-home.sh`, `undo-home.sh`, the debloat scripts. |
| `voice/` | Source of the small speech program `cytv-asr` and its build script. |
| `third-party/` | The bundled inputhook files and the QR library. |
| `tools/` | `check.sh`: every check (the tests in `tools/test` on the current Node, the built pages, types and lint; with `--chromium` the pages in Chromium 120); `build-pages.js`: builds the launcher and manager pages from their sources; `theme-docs.js`: regenerates the table of theme settings in the docs; `theme-index.js`: writes `themes/index.json`; `theme-preview.mjs`: renders a theme in headless Chrome (and makes its screenshot); `doc-shots.mjs`: makes the documentation's screenshots of the phone remote, the hub, Search, TV health and the screensaver in headless Chrome, with made-up data and stand-ins (`--write` puts them in `docs/screenshots`). |
| `ipk/build.py` | Builds the release files. |
| `package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json` | Development tools only: type checks, lint and formatting. |
| `compat.json` | The list of tested firmware the setup reads. |
| `install.sh`, `uninstall.sh` | The installer and uninstaller. |
| `docs/`, `zensical.toml` | This documentation. |

## Building

```sh
python3 ipk/build.py
```

writes the release files to `dist/`: `com.cleanyourtv.manager_<version>_all.ipk`, `frontend-<version>.tgz` and a `.sha256` file for
each, and the Homebrew Channel repository: `apps.json` and `com.cleanyourtv.manager.manifest.json`, which point at the package in
the release tagged `v<version>` (`CYTV_TAG` and `CYTV_REPO` change the tag and the repository). The Homebrew Channel reads
`releases/latest/download/apps.json`, so the newest release is what it offers. The **service** version is `VERSION` in
`helper/helper.js`; the **launcher** version is `app/version.json` and `VERSION` in `app/src/js/core.js` (the build refuses to run
when they differ). Run `node tools/build-pages.js` after changing a page's sources.

## Translations

The screens are written in English and translated from `i18n/<language>.json` (English text as the key); `tools/build-pages.js`
puts what each page uses into it, and `node tools/i18n.js` shows how complete each language is. See
[`i18n/README.md`](https://github.com/LanceSandino/cleanyourtv-WebOS/blob/dev/i18n/README.md) for adding a language or a text.

## Branches and releases

| Branch | What it is |
|---|---|
| `dev` | Where all work lands, including pull requests (it is the default branch). Every push publishes the [dev build](../managing.md#dev-builds). |
| `main` | The last release. Only the release workflow moves it. |
| any other | Your own work in progress. Pushes run the checks but publish nothing; merge into `dev` to let people try it. |

The release workflow (`.github/workflows/release.yml`) runs when it is started by hand (Actions > Release > Run workflow); this fork
has no daily schedule, so nothing is released without a person deciding it. When the files that go into the
package changed on `dev` since the last release, `tools/release.sh` raises the patch version of the service (and of the launcher
when `app/` changed), commits that to `dev` and moves `main` to it; the workflow then builds and publishes `v<version>` with the
commit subjects as release notes. Raise a minor or major version by hand on `dev` and the script keeps it.
`CYTV_DRY=1 sh tools/release.sh` shows what the next release would contain.

Using an AI assistant to find or fix a bug is welcome: see [Working on problems with an AI assistant](../ai.md) and `AGENTS.md` in the
repository root.

## Rules of the road

- **Per-TV differences go in `helper/tvprofile.js`**, with a case in `tools/test/tvprofile.test.js`; settings are changed only through
  `config.update` (`helper/config.js`).
- **Support webOS 25 and newer.** The service runs on Node.js 16 (webOS 25 has 16.20.2): nothing newer, such as global `fetch`,
  `structuredClone` or `Array.prototype.findLast`. `sh tools/check.sh` catches the usual ones (`tools/test/service.test.js`).
- **The pages run in Chromium 120 and newer.** The launcher is written without a framework; its older scripts are ES5 and stay so until
  they are touched, new code may use what Chromium 120 has. Only transform and opacity are animated, because the TV's GPU is weak.
- **Do not store private data in the repository.** No playlist addresses, access keys, IP addresses or names.
- **Documentation must match the code.** When a feature changes, change its page here and, if it is mentioned there, the README.
- **Licence.** The project is MIT. Do not copy code from GPL projects into it; describe behaviour and write your own.

## Adding a TV to the tested list

Open an issue with the output of **Share log** and say whether it worked. A pull request that adds an entry to `compat.json` is
welcome too: `firmware`, optionally `sdk`, `homeType`, `status` and a `note`.

## Dev builds

Every push to `dev` publishes the [dev build](../managing.md#dev-builds) that people can install from the manager app.
See [Testing and CI](testing.md).
