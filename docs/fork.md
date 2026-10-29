# About this fork

This is **LanceSandino/cleanyourtv-WebOS**, a fork of [lasharor/cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS).
CleanYourTV for LG webOS (the launcher, the root service, Live TV, the Input key, notifications, voice, themes, wallpapers, the
debloat and the manager app) is the work of lasharor and its contributors; all credit for it goes to them. The home-screen design
follows the Android TV project [CleanYourTV](https://github.com/Gathin23/cleanyourtv). Both are MIT licensed, and so is this fork.

The fork stays close to upstream and adds a few things on top.

## What the fork adds

| Area | What | Read more |
|---|---|---|
| Screensaver | Your photos with the time and the date when Home is left alone, instead of LG's clock screensaver: in a mat behind a frame like a frame TV's (seven woods, seven paints, two metals, four profiles), or full screen. Left and Right step through them. | [Screensaver](screensaver.md) |
| Photo feed | A small, documented, read-only feed any server can offer: the TV fetches one photo at a time and keeps at most 30, never the whole library. family-calendar offers one with its Frameo photos. | [The photo feed contract](screensaver.md#the-photo-feed-contract) |
| Glass theme and UI | A Glass theme, a focus that glides between tiles, the app name under the focused grid tile and a name that slides, clock and greeting typography, and Up/Down that land on the tile above or below and go straight back. Ideas from [Razdva122/clean-your-tv-lg-webos](https://github.com/Razdva122/clean-your-tv-lg-webos) (MIT); no code was copied. | [Themes](themes.md), [The launcher](launcher.md) |
| Security | From an audit of the whole repository: our apps send a per-install API token a web page cannot read, the service answers only requests addressed to `127.0.0.1`/`localhost`, picture downloads cannot reach the TV through a name, and every GitHub Action is pinned to a commit. | [Security](security.md) |
| TV health | The processor per core, temperature, memory and swap, storage, the flash's wear, Wi-Fi, the open ports with how each is guarded, and the services, on the TV (manager app) and read-only on a paired phone (the phone remote's TV tab); read only while someone looks, nothing kept on the TV. Ideas from [glasshouse](https://github.com/rorygallagher2024/glasshouse). | [The manager app](manager.md), [Phone remote](remote.md#the-tv-tab), [Security](security.md#what-is-open-on-the-tv) |
| Updates | A TV set up from this fork updates only from this fork (releases, themes and the compatibility list), and releases are made by hand from reviewed code, not every night. | [Updating](managing.md) |

## Installing from this fork

The same as upstream, with this repository's addresses: in the Homebrew Channel add
`https://github.com/LanceSandino/cleanyourtv-WebOS/releases/latest/download/apps.json`, or over SSH:

```sh
ssh root@<tv-ip> 'curl -fsSL https://raw.githubusercontent.com/LanceSandino/cleanyourtv-WebOS/main/install.sh | CYTV_REPO=LanceSandino/cleanyourtv-WebOS sh'
```

A TV that already runs upstream's CleanYourTV is moved to the fork by the SSH line above (it also keeps the TV on the fork).

## Upstream

Changes from upstream are brought in by a reviewed merge, never by the TV itself. Problems with this fork, and with what it adds,
go in [this fork's issues](https://github.com/LanceSandino/cleanyourtv-WebOS/issues); security problems privately through
[a security advisory](https://github.com/LanceSandino/cleanyourtv-WebOS/security/advisories/new). Questions about CleanYourTV in
general, and the community, are best at [upstream](https://github.com/lasharor/cleanyourtv-WebOS) and its Discord; the issues and
pull requests the documentation links to by number are upstream's.
