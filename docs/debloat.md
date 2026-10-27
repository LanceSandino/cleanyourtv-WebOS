# Debloat

An optional clean-up of LG's ads and telemetry. It is on by default in the setup; the [manager app](manager.md) has a **Debloat**
screen with its five groups.

## What it does

About a minute after every boot, the debloat:

| Group | What it does |
|---|---|
| **Ads** | Prevents `admanager` and `adoverlay-service` from starting, and adds `eic.ads.lgtvcommon.com`, `nl.ad.lgsmartad.com` and `nl.info.lgsmartad.com` to `/etc/hosts`, pointing at `127.0.0.1` and `::1` and marked `# cleanyourtv-debloat` (other entries are untouched). |
| **Viewing tracking (LivePlus)** | Prevents `acr2` from starting: it recognises what is on screen and reports it. |
| **Telemetry logs** | Stops the systemd services `remotelogger` and `service-logger`. |
| **Suggestions and nudges** | Stops `contentminer` and `nudge`, and prevents `sportsalarm` from starting. |
| **Stop LG pre-loading apps** | webOS 25 only. LG's preload manager starts apps such as LG Channels, Netflix and YouTube in the background so they open faster, and they then take memory and show up as running. This gives it LG's own list with every app switched off except Home (the launcher, so Home stays quick) and anything of the Homebrew Channel's, and restarts it (`preload-manager.service`) so it reads that list. See below. |

A program is prevented from starting by mounting a do-nothing stub over it (in RAM; the real files are not changed). Where
`/etc/hosts` is on the read-only system partition, a copy with the ad lines is kept in RAM (`/tmp/cleanyourtv-hosts`) and mounted
over it until the next restart. Each group can be switched on or off on its own; the ones that are off are listed in
`options.debloatOff` in `config.json`.

Nothing is uninstalled. It applies only while the launcher is Home, because LG's own Home needs some of those services to start;
switching back to LG's Home lifts the debloat first.

### LG's pre-loading

The preload manager takes its list from one of LG's settings, `com.webos.service.preloadmanager.supportAppList` in LG's configuration
service (configd), and reads it only when it starts. About a minute after the service starts (so after every start of the TV), and
whenever the group is switched on, the service:

1. reads the current list from configd, switches every app off in it except `com.webos.app.home` and `org.webosbrew.*`, and writes it
   as `com.webos.service.preloadmanager.json` into each country folder of configd's layer in RAM, `/var/run/tvconfig/rmm/<country>/`
   (the same way as [Hide LG's volume bar](sonos.md#lgs-own-volume-bar); it never replaces or removes a file it did not write);
2. asks configd to read its settings again (`luna://com.webos.service.config/reconfigure`) and checks that configd now gives that list;
   if it does not, it takes the file away again and leaves the preload manager alone until the setting is changed;
3. restarts the preload manager: `systemctl restart preload-manager.service`.

It looks every ten minutes whether the setting is still there and puts it back (with a restart) if it was lost. Switching the group or
the debloat off removes the file, asks configd to read again and restarts the preload manager once more, so LG's list is back. A
restart of the TV clears the file; apps that were already started stay until they are closed. It does nothing while LG's Home is chosen.

## Turning it off

Switch a group off in the manager app (**Debloat**), or **Switch all off**. It starts that group's services again, unmounts its stubs
and, for **Ads**, removes the marked hosts lines. Switching the last group off switches the debloat off. To pause it without the manager, create `/media/developer/cleanyourtv/DISABLE-DEBLOAT`.

## What it does not do

It does not block updates: firmware update blocking (for example with the Homebrew Channel's tools) is separate and is not touched.
It does not claim to remove all tracking. It stops the services listed above and nothing else.
