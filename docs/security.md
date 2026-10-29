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
| 8794 | Phone remote | Only while a phone is paired or pairing is open: the home network only, a key per phone (the TV keeps its SHA-256), requests from other pages refused; also the read-only TV tab (TV health, nothing secret); see [Phone remote](remote.md) |

**Telnet.** The Homebrew Channel starts a telnet server, an open root shell for anyone on your network, unless the file
`/var/luna/preferences/webosbrew_telnet_disabled` exists. The manager shows which, and **Telnet (Homebrew Channel)** switches it
(from the next start of the TV); nothing changes it without you. The Share log says too.

**LG's web inspector (port 9998).** LG's start script for WebAppMgr, the program that runs the TV's web apps (Home, the manager,
YouTube and the rest), always switches on its web inspector (Chromium's DevTools) on port 9998, on every address of the TV and with
no password: anyone on your network can open it and run code inside any web app, Home included. This TV's kernel has no firewall
table to close the port. **LG's web inspector (port 9998)** in the manager is on by default: at every start the boot script mounts a
copy of LG's script without that switch over LG's (`/tmp/cleanyourtv-webapp-mgr.sh` over
`/etc/systemd/system/scripts/webapp-mgr.sh`, in RAM; LG's file is not changed) and starts WebAppMgr again once, early, before Home is
taken over, so it costs nothing later. The switch is removed rather than narrowed to `127.0.0.1`: WebAppMgr's engine has no
`--remote-debugging-address`. Switched off (for a developer's `ares-inspect`), the copy is unmounted and the port opens again at the
next start of the TV; switched on in the manager, it closes at the next start (WebAppMgr is not restarted while you use the TV). By
hand: `sh /media/developer/cleanyourtv/devtools-undo.sh` removes the mount.

**Where updates come from.** Updates and themes come from this project's repository and are checked against the checksums of the
release. A file on the TV (`/media/developer/cleanyourtv/source`, root only) can name another repository for testing; the manager
and the Share log then show that repository with a warning, since its releases are someone else's.

**Pictures without the token.** App icons are loaded by the pages as images, which cannot carry the API token, so `GET /icon/<id>`
is answered without it; everything else needs it once it is required. The bare `file://` origin of webOS 4's Chromium 53 counts as
one of our apps only on webOS 4 (and while the TV's version is not known yet).

What the setup changes on the TV is listed in [What it changes on the TV](tv-changes.md).

## What is open on the TV

**TV health > Open ports and services** in the manager app, and the phone remote's TV tab (paired phones only), list every port
that listens on the TV: the program that holds it, whether the network can reach it (**LAN**) or only the TV itself
(**loopback**), and how it is guarded, in green (guarded as it should be, or discovery only), amber (open by design, or with
someone else's rules) or red (open with no check at all). It reads `/proc/net/tcp`, `tcp6`, `udp` and `udp6` and finds each
socket's program in `/proc/<pid>/fd`, in the service, only when the view is opened (kept 30 seconds). The answers come from this
table in `helper/exposure.js`; a port that is not in it is shown as **unknown** (amber), with its program. A port held on loopback
only is green whatever it is. Nothing in the view names an address, a MAC, a token or a key.

| Port | What | On the network | Why |
|---|---|---|---|
| 22/tcp | SSH (a root shell; dropbear from the Homebrew Channel) | green or amber | Green when password login is switched off (dropbear `-s` or `-g`, OpenSSH `PasswordAuthentication no`); amber otherwise: root logs in with a key, and with a password only if one was ever set |
| 53 | DNS for the TV itself (connman) | amber | Answers name lookups; loopback only on the TVs seen |
| 515/tcp | LPD print server (LG's `cups-lpd`; systemd holds the port) | amber | Takes print jobs from anyone on the network, with no check (a TV has no printer); the debloat group **LG's unused network services** closes it |
| 3000, 3001/tcp | LG's second-screen API (SSAP: LG ThinQ, Home Assistant) | amber | A new device must be accepted on the TV first (LG's prompt); an accepted device can control the TV |
| 7000/tcp | AirPlay (LG) | amber | Devices on the network can show media; LG's AirPlay settings decide whether a code is asked |
| 8008, 8009, 8443/tcp | Google Cast (LG) | amber | Devices on the network can cast to the TV |
| 8765/tcp | CleanYourTV service | red | It must listen on loopback only (it does: green there, with the Origin, Host and API-token checks) |
| 8766/tcp | Live TV setup page | green | While it is open: a 6-digit code, ten minutes |
| 8767/tcp | Network notifications (opt-in) | green | A token; wrong tokens lock an address out for ten minutes; an optional allow list; the notification call only |
| 8768 to 8790/tcp | Share log page (its own `node sharelog.js`) | green | While it is open: a random address, ten minutes, a masked report |
| 8769/tcp | Voice and Home Assistant setup page (in the service) | green | While it is open: a random address, ten minutes |
| 8770/tcp | Telemachus (a separate program) | amber | Its own access rules, not CleanYourTV's (green when it listens on loopback only) |
| 8791, 8792/tcp | Wallpapers and Cards phone pages | green | While they are open: a 6-digit code, 15 and 10 minutes |
| 8794/tcp | Phone remote | green | Paired phones only (a key each, the TV keeps a hash), home-network addresses only, requests from other pages refused; plain HTTP on your Wi-Fi |
| One the system picks | Sonos volume events (opt-in) | green | Only the chosen speaker's address, on a random path, while the option is on |
| 9080/tcp | Netflix second screen (DIAL) | amber | Phones on the network can start Netflix and hand it a video |
| 9998/tcp | WebAppMgr's web inspector (DevTools) | **red**; green "closed" once closed | No authentication: anyone on the network can run code inside the TV's web apps, Home included. The kernel has no firewall table, so **LG's web inspector (port 9998)** (on by default) starts WebAppMgr without it; while it is on and WebAppMgr still has the port, the row says it closes at the next start |
| 18181, 36866/tcp | DIAL (LG, through `xinetd`): for the TV's apps and for phones | amber | Phones on the network can find and start apps that support DIAL (YouTube, Netflix) and hand them a video |
| 1900/udp | SSDP discovery (UPnP) | green | Discovery only |
| 1902/udp | LG's SDDP discovery | green | Discovery only |
| 5353/udp | mDNS discovery | green | Discovery only |
| Any, held by `upnpd` | LG's UPnP media renderer (DLNA) | amber | Devices on the network can play media on the TV |

UDP sockets from port 32768 up that are not in the table are the reply ports of discovery clients and are counted, not listed.
On the owner's 86UR8000 (webOS 25) on 2026-10-29, before the web inspector option, this showed 9998 in red, SSH amber (dropbear
without `-s`), LG's AirPlay, Cast, SSAP, UPnP and Netflix ports amber, our 8765 (loopback) and 8794 green, and as unknown: 515
(systemd: LG's `cups-lpd.socket`, now in the table), 1842 (a Homebrew Channel app's service, `org.webosbrew.inputhook`), 9761 (LG's
`tvlink-network-proxy`), 18181 and 36866 (LG's DIAL through `xinetd`, now in the table).

The same view lists **services**: our parts (and any that failed to load), the boot scripts in `/var/lib/webosbrew/init.d`, whether
the watchdog runs, Telemachus, and LG's programs the debloat stops (stopped, or running again: from **Check that it works**, at
most every five minutes from here). **LG's running services** lists all of LG's systemd services (`systemctl`, only when opened).

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
**Rows from LG for other apps** switches this off. **LG's picks** under it leaves out the rows LG's servers chose (the miner's) and
keeps only the rows the apps wrote themselves (an app whose launch point names a local source for the miner, from
`com.webos.applicationManager/listLaunchPoints`, a read); the miner's database is then not read. The miner itself sends the TV's
identity to LG when it asks for its rows; the debloat's opt-in **LG's content miner, from the start** stops it when the boot scripts
start ([Debloat](debloat.md)).

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
  watching from Disney's feed for TV makers (`partner/continueWatching`), and the name of the account's active profile (so the cards
  can say whose row it is; it stays on the TV), and renews the access key with the refresh key when it runs
  out. Pictures come from `disney.images.edge.bamgrid.com` (HTTPS only, Disney's image server). The socket is open only while a code
  waits. This is not an interface Disney offers to others: it can stop working when Disney changes its web player, and it uses your
  account as the web player would.
- The keys are never returned by the service: not in `/api/apps`, not in `/api/watch/accounts` (linked or not, and the server's name).
  **Unlink** forgets them. The access stays listed in your Plex account (Authorized Devices), Stremio account or Disney+ account
  until you remove it there (Disney+: Account > Log out of all devices).
## Search

**Search** on Home ([Search](launcher.md#search)) sends the words nowhere. The service looks them up in what it already has in
memory: the titles of the rows it last read for Continue watching (above), with Home's switches and removed cards, and the app
manager's list of apps on the TV (`com.webos.applicationManager/listApps`, a read), whose `inAppSearchParams` say which apps open
their own search with words (YouTube's `{"contentTarget": "q=$SEARCH_KEYWORD"}`). A search reads nothing anew: no row, no
picture, no account, no address; the words reach only the app you open, as its own launch parameters, like a search typed in that
app. LG's search and voice services, search aggregators (JustWatch, Reelgood), the streaming services' web APIs and Google's are
never asked. `GET /api/search` has the same origin, Host and API-token checks as every other route.

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
