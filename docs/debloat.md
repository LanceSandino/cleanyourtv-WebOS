# Debloat

An optional clean-up of LG's ads and telemetry. It is on by default in the setup; the [manager app](manager.md) has a **Debloat**
screen with its groups (eight on with it, and three you switch on yourself: HbbTV, LG's content miner from the start and LG's
online services), and **Check that it works**.

## What it does

At every start, as soon as the boot scripts run (about 45 seconds after the TV starts, on a webOS 25 TV) and before LG's own ad and
tracking services start, the debloat:

| Group | What it does |
|---|---|
| **Ads** | Prevents `adoverlay-service` from starting, and adds LG's ad servers to `/etc/hosts`, pointing at `127.0.0.1` and `::1` and marked `# cleanyourtv-debloat`: `eic.ads.lgtvcommon.com`, `nl.ad.lgsmartad.com` and `nl.info.lgsmartad.com`, and those of the TV's own country (LG names them `<country>.ad.lgsmartad.com` and `<country>.info.lgsmartad.com`; the country is LG's Smart Service setting, `smartServiceCountryCode2`). |
| **LG's ad service for apps** | Prevents `admanager` from starting. Its own switch because some apps do not play without it (HBO Max, upstream issue 47; Disney+ works): switch only this off for such an app. Off with **Ads** too. |
| **Viewing tracking (LivePlus)** | Prevents `acr2` from starting: it recognises what is on screen and reports it. And `livepick-plus`, LG's shopping overlays (LG Shoptime) built on what `acr2` recognises; it follows every app that opens and downloads its lists from LG. |
| **Telemetry logs** | Stops the systemd services `remotelogger` and `service-logger`, and LG's crash and log reports: stops `rdxd` (LG's remote diagnostics daemon, which makes the reports) and prevents `uploadd` from starting (it sends them to LG, `rdl.lgtvcommon.com`). On the TV seen, LG's own consent for this was off (`system.collectDevLogs`), and the Homebrew Channel already makes their spool folders read-only; this takes the programs away as well. |
| **Suggestions and nudges** | Stops `contentminer`, and prevents `nudge` and `sportsalarm` from starting. `nudge` is held by the stub too: it starts late in LG's boot (about 85 seconds) and ignores a stop, which made systemd wait 90 seconds. |
| **LG's unused network services** | Stops two of LG's services that listen on your network and that nothing on a TV needs: the LPD print server (`cups-lpd.socket`, port 515, which takes print jobs from anyone on the network) and `ninfod` (answers IPv6 node information queries with the TV's name and addresses). |
| **LG's ad and promotion settings** | LG's own switches, the ones LG's Settings menus change: home promotions, screensaver ads, the ad cookie, Smart Tips, sports alerts, limit ad tracking (on), content recommendations, Live TV promotions, LivePlus and the promotion video. Each value is saved first (`/media/developer/cleanyourtv/lgsettings-saved.json`) and put back when the group is switched off; a key this firmware does not have is left alone. Looked at again every ten minutes and when the TV wakes. |
| **HbbTV red-button pages** | Off unless you switch it on. HbbTV off, Do Not Track on and the device ID off (LG's own switches, saved and put back like the group above). The broadcasters' red-button extras stop on the tuner; own-your-glass found they carried most of the third-party trackers. |
| **LG's content miner, from the start** | Off unless you switch it on. Stops `contentminer` as soon as the boot scripts run (also when **Suggestions and nudges** is off), and mounts a do-nothing stub over its program so nothing starts it again until the next restart. See below. |
| **LG's online services** | Off unless you switch it on. Blocks, in `/etc/hosts` (marked `# cleanyourtv-debloat`, applied as soon as the boot scripts run), the servers LG's `sdx` service names on this TV for LG's own online services: the region's `tv.wiselg.com` (LG's picks for Home, LG Channels, LG's voice service, LG sign-in, sports, shopping, nudges, quick cards), Live TV's viewing statistics (`ibsstat`), remote diagnostics (`rdx2`) and ThinQ (`lgtviot.com`, `connect-client.lgthinq.com`), with the region's LG Channels hosts (`lgtvcommon.com`). Those stop working. The app store and app updates, firmware updates and LG's internet check are not blocked. |
| **Stop LG pre-loading apps** | webOS 25 only. LG's preload manager starts apps such as LG Channels, Netflix and YouTube in the background so they open faster, and they then take memory and show up as running. This switches its pre-loading off for every app except Home (the launcher, so Home stays quick) and anything of the Homebrew Channel's, with its own call, until it restarts; the service does it again after every start. See below. |

A program is prevented from starting by mounting a do-nothing stub over it (in RAM; the real files are not changed). Where
`/etc/hosts` is on the read-only system partition, a copy with the ad lines is kept in RAM (`/tmp/cleanyourtv-hosts`) and mounted
over it until the next restart. Each group can be switched on or off on its own; the ones that are off are listed in
`options.debloatOff` in `config.json`.

Nothing is uninstalled. It applies only while the launcher is Home, because LG's own Home needs some of those services to start;
switching back to LG's Home lifts the debloat first.

### At boot

Measured on an 86UR8000 (webOS 25) from LG's own logs (`/var/log/bootd.log`, the debug log and the process start times): LG starts
`remotelogger` at 2 seconds, `service-logger` at 18, `contentminer`, `rdxd` and `dmost` at 22, the on-demand `uploadd` at 27, the
Homebrew Channel's service at 33 and its boot scripts at 44. After `rest-boot-done` (53 seconds) LG's activity manager starts the
on-demand services: `sportsalarm` at 58, `livepick-plus` at 59, `adoverlay-service` and `acr2` at 61. At `boot-done` (85 seconds)
systemd starts `nudge` and `uploadd.service`.

The debloat used to wait a minute after the boot scripts, so it stopped them at about 113 seconds: `acr2` and the ad overlay ran for
about 50 seconds at every start, and `nudge` until 204 (its stop waited 90 seconds). Now `10-cleanyourtv-home` starts it first
(`15-cleanyourtv-debloat early`), before it stages Home: the stubs are in place before the activity manager starts anything, so
`acr2`, `livepick-plus`, the ad services, `sportsalarm` and `nudge` do not run at all, and the daemons LG started earlier are stopped
at about 45 seconds instead of 113. The boot hook then runs it once more when LG's boot is done (LG's `/tmp/boot-done`), which does
only what is missing. If Home was not taken over after all, the hook lifts it again. Each step is in `/tmp/cleanyourtv-boot.log`.

The daemons LG starts before the boot scripts (`remotelogger`, `service-logger`, `contentminer`, `rdxd`) still run for those first
seconds: nothing can stop them earlier without changing LG's files. systemd's own way to keep a unit from starting in RAM (a mask in
`/run`) ranks below LG's units in `/etc/systemd/system` and needs a reload of systemd during LG's boot; the stub does the same for
the ones that start later, without either.

### Not stopped

What else was looked at on that TV, and why it is left running:

| Program | What it is | Why it stays |
|---|---|---|
| `dmost` | LG Channels' manager: the LG Channels lines in the channel list, their video screensaver, and a "system beacon" with the TV's identity to LG's `cdpbeacon` server | Its beacon goes out before the boot scripts run, and LG Channels (and, through the channel list it updates, Live TV) may depend on it; **LG's online services** blocks the beacon's server |
| `crashd`, `faultmanager` | LG's crash handler and fault manager (the reboot after a fault) | Part of how the TV recovers; with `rdxd` and `uploadd` gone their reports stay on the TV |
| `PmLogDaemon`, `PmKLogDaemon` | The system log | Every program writes to it; the logs stay on the TV |
| `sdp-server-notice` | Notices from LG's server, shown on the TV | Also service messages; started on demand |
| `com.webos.chromecast.log` | Google Cast's log service | Part of Cast |


### LG's content miner

LG's content miner (`com.webos.service.contentminer`) fills the rows LG's Home shows under an app. For most apps (YouTube, Disney+,
Apple TV, LG Channels) it asks LG's servers through LG's `sdx` service (`homeprv` on LG's `tv.wiselg.com`, the TV's region in front):
`sdx` adds the TV's identity to the request (device ID, model, firmware, country, language, the terms accepted, LG's sign-in token).
What comes back is LG's pick for that app, not what was watched here (no app has given the miner a personal key). For the apps that write
their own row (Netflix, Prime Video; their launch point names a local source), the miner only wakes the app's own service, which asks
its own servers. The miner keeps what it fetched on the TV (a database only it may read), so the rows survive a restart.

The miner starts about 22 to 35 seconds after the TV starts, before the boot scripts (the Homebrew Channel ran them at 39 to 49
seconds on the owner's webOS 25 TV), and asks LG once per start; on one start that request went out about 50 seconds after the start.
**Suggestions and nudges** stops it when the boot scripts start, as the rest of the debloat. **LG's content miner, from the start**
also mounts the stub over its program, so nothing starts it again until the next restart. The groups cannot always stop that first
request at a cold start (with Quick Start+ the TV mostly sleeps and wakes, and the miner does not run again then). Nothing can stop it
earlier without changing LG's files, which CleanYourTV never does. LG's servers for these rows are the same ones LG Channels, LG's
voice service and LG's sign-in use, so they cannot be blocked on their own: **LG's online services** blocks them with LG's other
online services from the same moment.

What it changes: LG's picks on Home (see [Continue watching](launcher.md)) are fetched at most at a cold start, as above; switch
**LG's picks** off there to show only the rows the apps write themselves. Netflix's and Prime Video's rows still come when those apps
or their services run. The Homebrew Channel starts the boot scripts by its own boot task; on some TVs the miner also wakes it at the
start, which has happened before the boot scripts run, so the stub does not stand in its way. The stub is in RAM: after a restart
the miner starts as LG made it, until the boot scripts stop it again.

### LG's pre-loading

The preload manager (`com.webos.service.preloadmanager`) has its own call to switch one app's pre-loading off or on,
`setPreloadPolicy {"application": {"id": ..., "isEnabled": false}}`. That lasts until the preload manager restarts (with the TV) and is
not saved. A few seconds after the service starts, whenever the group is switched on, and every two minutes, the service asks the
preload manager which apps it would pre-load (`getPreloadPolicy`: enabled and allowed) and switches those off, except
`com.webos.app.home` (the launcher, so Home stays quick) and anything of the Homebrew Channel's (`org.webosbrew.*`). The apps it switched
off are kept in `/tmp/cleanyourtv-lgpreload.json`. Switching the group or the debloat off switches exactly those apps on again.

Nothing is restarted and no file of LG's changes: on webOS 25 that call also marks an app as allowed in LG's saved list
(`/var/preferences/webos-preload-manager-conf.json`), so it is only made for apps that are allowed already. The copies the preload
manager already started in the background (running, and never on the screen in that process) are closed then (`closeByAppId`, and
the web app manager's `killApp` where that does not take), so their memory is free at once; an app someone opened is never closed.
Each is closed once: one that is back at the next look is started by something else, and is left running. LG's AirPlay is never
switched off or closed: closed, it launches the last input app, which brought Home over the app on the screen every two minutes.
When the TV wakes from standby (the service slept with it, so its clock jumps) it looks again, as LG pre-loads again on waking. It
does nothing while LG's Home is chosen.

By hand, from a shell on the TV:

```sh
luna-send -n 1 -f luna://com.webos.service.preloadmanager/getPreloadPolicy '{}' </dev/null   # isEnabled per app
luna-send -n 1 -f luna://com.webos.service.preloadmanager/setPreloadPolicy '{"application":{"id":"netflix","isEnabled":true}}' </dev/null
```

## Check that it works

**Debloat** > **Check that it works** looks at the TV now, for each group that is on: the stubs mounted over LG's programs and
none of them running, LG's daemons stopped, the ad servers in the hosts file, no app left that LG would pre-load, LG's settings as
they should be. A group an LG update or a restart of a daemon undid shows **Not in place** with what is wrong.

The debloat at boot runs in a background job, which can be lost (upstream issue 29); the boot hook runs it again when LG's boot is
done. A minute and a half after the service starts, and half a minute after the TV wakes, a group of the scripts that is not in
place is applied again, and the service log says so (`debloat: not in place ... applied again`).

## Turning it off

Switch a group off in the manager app (**Debloat**), or **Switch all off**. It starts that group's services again, unmounts its stubs
and, for **Ads**, removes the marked hosts lines. Switching the last group off switches the debloat off. To pause it without the manager, create `/media/developer/cleanyourtv/DISABLE-DEBLOAT`.

## What it does not do

It does not block updates: firmware update blocking (for example with the Homebrew Channel's tools) is separate and is not touched.
It does not claim to remove all tracking. It stops the services listed above and nothing else.

**What a block on the TV cannot do.** An app or service that asks a DNS server of its own over an encrypted connection (DNS over
HTTPS or TLS) goes past the hosts file; only your router can stop that, by blocking those resolvers for the TV.

**Blocking more on the network.** The **Ads** group blocks a few ad servers on the TV itself. A DNS blocker on your network
(Pi-hole, AdGuard Home) can block many more with a community list such as
[hugobatista/lg-tv-ad-block](https://github.com/hugobatista/lg-tv-ad-block). Apply it to the TV only (in Pi-hole, a group with
the TV as its only client): on one network it also blocked Philips Hue, `developers.google.com`, Apple services and parts of
Prime Video for every other device. Its `list-store` variant also blocks the LG Content Store, so apps can no longer be installed or
updated.
