# Debloat

An optional clean-up of LG's ads and telemetry. It is on by default in the setup; the [manager app](manager.md) has a **Debloat**
screen with its groups (seven on with it, and HbbTV, which you switch on yourself), and **Check that it works**.

## What it does

About a minute after every boot, the debloat:

| Group | What it does |
|---|---|
| **Ads** | Prevents `adoverlay-service` from starting, and adds LG's ad servers to `/etc/hosts`, pointing at `127.0.0.1` and `::1` and marked `# cleanyourtv-debloat`: `eic.ads.lgtvcommon.com`, `nl.ad.lgsmartad.com` and `nl.info.lgsmartad.com`, and those of the TV's own country (LG names them `<country>.ad.lgsmartad.com` and `<country>.info.lgsmartad.com`; the country is LG's Smart Service setting, `smartServiceCountryCode2`). |
| **LG's ad service for apps** | Prevents `admanager` from starting. Its own switch because some apps do not play without it (HBO Max, upstream issue 47; Disney+ works): switch only this off for such an app. Off with **Ads** too. |
| **Viewing tracking (LivePlus)** | Prevents `acr2` from starting: it recognises what is on screen and reports it. |
| **Telemetry logs** | Stops the systemd services `remotelogger` and `service-logger`. |
| **Suggestions and nudges** | Stops `contentminer` and `nudge`, and prevents `sportsalarm` from starting. |
| **LG's ad and promotion settings** | LG's own switches, the ones LG's Settings menus change: home promotions, screensaver ads, the ad cookie, Smart Tips, sports alerts, limit ad tracking (on), content recommendations, Live TV promotions, LivePlus and the promotion video. Each value is saved first (`/media/developer/cleanyourtv/lgsettings-saved.json`) and put back when the group is switched off; a key this firmware does not have is left alone. Looked at again every ten minutes and when the TV wakes. |
| **HbbTV red-button pages** | Off unless you switch it on. HbbTV off, Do Not Track on and the device ID off (LG's own switches, saved and put back like the group above). The broadcasters' red-button extras stop on the tuner; own-your-glass found they carried most of the third-party trackers. |
| **Stop LG pre-loading apps** | webOS 25 only. LG's preload manager starts apps such as LG Channels, Netflix and YouTube in the background so they open faster, and they then take memory and show up as running. This switches its pre-loading off for every app except Home (the launcher, so Home stays quick) and anything of the Homebrew Channel's, with its own call, until it restarts; the service does it again after every start. See below. |

A program is prevented from starting by mounting a do-nothing stub over it (in RAM; the real files are not changed). Where
`/etc/hosts` is on the read-only system partition, a copy with the ad lines is kept in RAM (`/tmp/cleanyourtv-hosts`) and mounted
over it until the next restart. Each group can be switched on or off on its own; the ones that are off are listed in
`options.debloatOff` in `config.json`.

Nothing is uninstalled. It applies only while the launcher is Home, because LG's own Home needs some of those services to start;
switching back to LG's Home lifts the debloat first.

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

The debloat at boot waits a minute in a background job, which can be lost (upstream issue 29). A minute and a half after the service
starts, and half a minute after the TV wakes, a group of the scripts that is not in place is applied again, and the service log
says so (`debloat: not in place ... applied again`).

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
