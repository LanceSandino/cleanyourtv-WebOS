# Security

## What this changes on a TV

CleanYourTV runs a service **as root** on a rooted TV. It listens on `127.0.0.1:8765` only. A few short-lived pages open on the
local network on request, and an optional notification endpoint and the Sonos volume's event port are off by default.

| Port | What | When it is open |
|---|---|---|
| 8765 (`127.0.0.1` only) | The service API | Always; see [Service API](api.md) |
| 8766 | Live TV pairing page | While you set up Live TV: a 6-digit code shown on the TV, ten minutes |
| 8767 | Network notifications | Only when you switch it on in the manager app; needs a token |
| 8768 and up | Share-log page | Ten minutes, at a random address, with a masked report |
| 8769 | Voice setup page | Ten minutes, at a random 128-bit address, closed after saving |
| 8791 | Wallpapers page | While the QR screen is open in the manager app: a 6-digit code shown on the TV, at most an hour; see [Wallpapers](wallpapers.md) |
| One the system picks | Sonos volume events | Only while **Sonos volume on screen** is on: takes `NOTIFY` from the chosen speaker's address on a random path, nothing else; see [Sonos volume on screen](sonos.md) |
| 8792 | Cards page | The same, for the options of the cards on Home; see [Cards](launcher.md#cards) |
| 8794 | Phone remote | Only while a phone is paired or pairing is open: the home network only, a key per phone (the TV keeps its SHA-256), requests from other pages refused; see [Phone remote](remote.md) |

**Telnet.** The Homebrew Channel starts a telnet server, an open root shell for anyone on your network, unless the file
`/var/luna/preferences/webosbrew_telnet_disabled` exists. The manager shows which, and **Telnet (Homebrew Channel)** switches it
(from the next start of the TV); nothing changes it without you. The Share log says too.

**Where updates come from.** Updates and themes come from this project's repository and are checked against the checksums of the
release. A file on the TV (`/media/developer/cleanyourtv/source`, root only) can name another repository for testing; the manager
and the Share log then show that repository with a warning, since its releases are someone else's.

**Pictures without the token.** App icons are loaded by the pages as images, which cannot carry the API token, so `GET /icon/<id>`
is answered without it; everything else needs it once it is required. The bare `file://` origin of webOS 4's Chromium 53 counts as
one of our apps only on webOS 4 (and while the TV's version is not known yet).

What the setup changes on the TV is listed in [What it changes on the TV](tv-changes.md).

## Network notifications

Off until switched on in the manager app. It then listens on port 8767 for `POST /notify` with `Authorization: Bearer <token>`
(a random 192-bit token kept in `config.json`, readable by root only). It exposes only the notification call. Wrong tokens lock
an address out for ten minutes, requests are limited to 20 a minute and 32 KB, and an optional `allow` list restricts addresses.
It is plain HTTP: the token can be read by anyone who can watch the traffic on your network.

**Show as QR code** in the manager makes the same port serve one more page, `GET /t/<24 random characters>`, for ten minutes: it shows the address and the
token so a phone can copy them. The address is created when the code is shown (96 bits of randomness), follows the same allow list, and stops
working after ten minutes, when notifications are switched off or the service restarts. Anyone who sees the code on the screen, or can read
the traffic, can read the token while it is open; **New token** replaces it.

## Sonos volume on screen

Optional and off by default. It only reads, and only on the local network: no account, nothing sent to the internet.

- **What it sends:** an SSDP search (a multicast `M-SEARCH` for Sonos players) when it looks for the speaker; to the speaker itself
  (port 1400, plain HTTP as the Sonos app uses it) a `GET` of its description, the UPnP actions `GetVolume` and `GetMute`, and
  `SUBSCRIBE` / `UNSUBSCRIBE` for its volume events. Those two actions are the only ones in the code; anything else is refused before
  it is sent, and the tests check that a stand-in speaker receives nothing else. It never changes the volume, mute or any setting.
- **What it listens to:** while the option is on, one port the system picks, for the speaker's events. It answers only `NOTIFY`
  requests from the followed speaker's address, on a path with 96 random bits made for each subscription and, once the
  subscription is confirmed, with its id, at most 256 KB; everything else is refused. A device on the network that can fake the
  speaker's address and has seen the path can only show a wrong number on the screen. Switching the option off unsubscribes and
  closes the port.
- **Search answers:** an answer is used only when it points at its sender's own Sonos description (`/xml/device_description.xml`
  on the address it came from), never at another address or the TV itself.
- The speaker's address, id and room are kept in `config.json` (readable by root only); the service's replies give the room and
  model, not the address.
- **Hide LG's volume bar** (on by default while the option is on) changes one of LG's settings in RAM only: it writes
  `{"volumeOSD":false}` as `com.webos.surfacemanager.json` into the country folders of configd's layer `/var/run/tvconfig/rmm/` and
  asks LG's configuration service to read its settings again, only while the sound goes to HDMI ARC/eARC or optical, and removes the
  file otherwise. See [Sonos volume on screen](sonos.md#lgs-own-volume-bar).

## LG's settings changed in RAM

**Hide LG's volume bar** changes one of LG's settings through LG's configuration service (configd), in RAM only
(`helper/lgconfig.js`): it writes one small JSON file into the country folders of configd's layer `/var/run/tvconfig/rmm/` (in RAM;
configd reads it above LG's built-in settings), keeps a record of what it wrote in `/tmp/cleanyourtv-lgconfig.json`, and only ever
replaces or removes a file that holds exactly what it wrote, so LG's own files are never touched. After each change it asks configd to
read its settings again (`reconfigure`). A restart of the TV clears it.

The debloat group **Stop LG pre-loading apps** uses the preload manager's own call (`setPreloadPolicy`, `isEnabled` false) for the apps
it would pre-load, except Home and anything of the Homebrew Channel's. That is kept in the preload manager's memory only; nothing is
restarted, and the call is made only for apps LG already allows, so LG's saved list does not change. See
[Debloat](debloat.md#lgs-pre-loading).

## Themes

The manager downloads the theme list, screenshots, theme files and wallpapers from `raw.githubusercontent.com` (the `main` branch of this
repository) over HTTPS, when you open **Theme** or choose a theme. They are data only: the service checks every value against its list,
limits the sizes (theme 32 KB, wallpaper 1.5 MB, screenshot 600 KB), checks that images are images and refuses anything else. There is
no script or CSS in a theme. Anything merged into `main` becomes available to every TV, which is the same trust you place in the
releases of this repository; there is no signature.

## Photo feed (screensaver)

Optional and off until a setup code from a server that offers a photo feed (for example family-calendar) is pasted on the Wallpapers
phone page. The service then reads that server's feed over HTTPS only, trusting only the root certificate in the setup code, with a
token that can only read the feed; it follows no redirects. The token is kept in `config.json` (root only) and is never returned by
the service or given to the launcher. At most 30 photos (40 MB) are kept on the TV. See [Screensaver](screensaver.md).

## Continue watching

Home's first grid row reads Telemachus on the TV itself (`127.0.0.1:8770`, no key from the TV). The show and
film pictures it names come from `image.tmdb.org` (HTTPS only, no redirects, at most 1 MB each): the service fetches them when Home
shows them and keeps at most 12 MB of pictures in memory, never on disk; the Home page only ever sees an id. Switch the row off in **Customize** >
**Continue watching** > **Show on Home** and nothing is read.

For the other apps, the service reads the rows LG's own Home shows (YouTube, Disney+, Apple TV and the like) from LG's content miner
on the TV: its database, which only that LG service may read, is read as that service (`luna-send -a com.webos.service.contentminer`,
a read, nothing written). For an app the miner has nothing of, the row the app wrote itself (Netflix, Prime Video) is read from
LG's app manager (`com.webos.applicationManager/getAllContents`, a read); the calls those apps ask LG's Home to make when a row is
shown (`onShow`, to the app's own service) are never made. LG's advertisements in those rows come from another LG service
(`com.webos.service.admanager`), which is never called; items marked as promoted are dropped. The pictures named there are fetched by
the service over HTTPS from the app's own image server, or from LG's (`aic.imagesvc.lgtvcommon.com`, `ngfts.lge.com`, plain HTTP as
LG uses them), images only, at most 1 MB each and 12 MB in memory all together, never on disk; **Customize** > **Continue watching** >
**Rows from LG for other apps** switches this off.

Plex, Stremio and Disney+ are read only once you link them there, with their own TV sign-in (no password on the TV):

- **Plex:** the service asks `plex.tv` for a code (HTTPS), then every 3 s for at most ten minutes whether it was entered. It keeps the
  account's key and your server's own key in `config.json` (readable by root only), and asks `plex.tv` once for the server's
  addresses. It keeps the first that answers as that server (Plex's `/identity`, asked without a key): those on your network first,
  then, unless the server requires secure connections, the same addresses over plain `http://` (for a router that blocks Plex's
  secure `plex.direct` names of addresses on your network), then those from outside; never Plex's relay. After that it reads only
  your Plex server (`/hubs/continueWatching/items`), at that address: often plain `http://` on your network, so the server's key is
  visible on your network, as it is for the Plex app. Pictures come from the server's picture route with that key; the key is added
  by the service and never reaches the Home page.
- **Stremio:** the service asks `link.stremio.com` for a link (HTTPS), then every 3 s for at most ten minutes whether it was used. It
  keeps the key it gets in `config.json` and reads your library from `api.strem.io` (HTTPS); pictures come from
  `images.metahub.space` (HTTPS only, Stremio's image server).
- **Disney+:** Disney+ has no sign-in for other programs, so the service signs in the way Disney's own web player does (all HTTPS). It
  reads the web player's public key from `www.disneyplus.com/begin` (kept in memory only, never in this project) and registers the TV
  as a device with Disney (`disney.api.edge.bamgrid.com`). Then it opens Disney's socket (`disney.connections.edge.bamgrid.com`) and asks
  for an 8-digit code. You enter the code at `disneyplus.com/begin`, signed in there. Disney says so on the socket, and the service
  trades that for the account's keys. It keeps the account's refresh key and a 4-hour access key in `config.json`. It reads Continue
  watching from Disney's feed for TV makers (`partner/continueWatching`) and renews the access key with the refresh key when it runs
  out. Pictures come from `disney.images.edge.bamgrid.com` (HTTPS only, Disney's image server). The socket is open only while a code
  waits. This is not an interface Disney offers to others: it can stop working when Disney changes its web player, and it uses your
  account as the web player would.
- The keys are never returned by the service: not in `/api/apps`, not in `/api/watch/accounts` (linked or not, and the server's name).
  **Unlink** forgets them. The access stays listed in your Plex account (Authorized Devices), Stremio account or Disney+ account
  until you remove it there (Disney+: Account > Log out of all devices).
## Weather card

Only with a weather card on Home. The service asks `api.open-meteo.com` over HTTPS for the weather at the card's place, at most every
30 minutes, and keeps the last answer in `weather.json`; the request carries the place's coordinates (rounded to about a kilometre) and
nothing else. Searching a place on the phone page sends the name you type to `geocoding-api.open-meteo.com`. No account or key.

## Home Assistant cards

They use the Home Assistant address and token set under **More** > **Home Assistant**, the same ones Voice uses; nothing else is stored. The service reads the states with one
request every 20 seconds at most, switches only lights, switches, fans, input booleans and automations (and runs scenes and scripts)
when you press OK on a card, and passes a camera's picture to the launcher. Locks, alarms and covers are never switched.

## Voice

Optional and off by default. Installing it downloads files over HTTPS from PyPI, Ubuntu's archive and Moonshine's model server;
each file is checked against a SHA-256 value written in the code, and a mismatch stops the install. The recogniser is a 64-bit
program started by the root service with its own copy of the C library; it reads audio from a pipe and prints text.

- Audio from the remote's microphone is held in memory only while recognising.
- Only the recognised text is sent, and only to the address you set (plain `http://` is possible: the token is then visible on
  your network) and, if you switch on AI chat, to `openrouter.ai` over HTTPS with your OpenRouter key and the model you chose.
  OpenRouter and that model's provider see the text.
- The phone setup page is a short-lived page on the local network (port 8769, a random 128-bit address, ten minutes, closed after
  saving, plain HTTP: the key is visible on the network while it is typed).
- With Home Assistant set up, the recognised text goes to the address you set, with your long-lived access token (plain `http://` is
  possible: the token is then visible on your network; a self-signed certificate is accepted only when you switch that on).
- The keys and the token are kept in `config.json` (readable by root only) and are never returned by the service.
- Pausing LG's voice assistant sends it SIGSTOP; nothing of LG's is modified.

## Trust

Everything it installs comes from this repository's GitHub releases and runs as root. Releases carry a SHA-256 file, which
detects corruption but **not a compromised repository**. Download only from the release page of this repository.

## Dev builds

The manager's **Update channel** can follow the dev builds: the pre-release named `dev` that GitHub Actions publishes for each
push to the `dev` branch. It is opt-in and off by default; the stable updater only reads the latest non-pre-release. A dev build is
downloaded over HTTPS from the repository the TV already updates from and checked against the `.sha256` file in the same release,
so the check protects against a damaged download, not against someone who can publish to the repository (the same is true of
stable releases, which are not signed yet). The only pre-release the updater reads is the one tagged `dev`, and the files must be
the package and launcher names the updater already expects.

## Limits to know about

- Any app on the TV can already run root commands through the Homebrew Channel; apps are not a security boundary on a rooted TV.
- `/media/developer` is world-writable on webOS. The setup removes group and other write access from this project's files and
  keeps the playlist and settings files owner-only, but the parent folder remains writable.
- The service API refuses requests from web pages (any `http(s)` origin) and requests addressed to any name but `127.0.0.1` or
  `localhost` (DNS rebinding). A web page can hide its origin (a sandboxed frame sends `null`, as our own apps do), so our apps also
  send an **API token**: a random value the service keeps for root only and writes as `cytv-token.js` into the launcher, the manager
  and the picker, where a web page cannot read it. Once every app has it and one has sent it back, a request with origin `null` and
  no token is refused; until then (or when an app could not get it) the service accepts it as before, so a TV keeps working.
  Programs on the TV (scripts, `curl`) send no origin and need no token.
- A notification picture is downloaded only from an address that is not the TV itself, checked again after the name is looked up.

!!! tip "Move from telnet to SSH"
    A rooted TV often has an unauthenticated telnet server open on the local network. Turn telnet off and SSH on in the
    Homebrew Channel's settings.

## Reporting

Open a private security advisory on the [GitHub repository](https://github.com/LanceSandino/cleanyourtv-WebOS/security/advisories),
or an issue that does not include exploit details.
