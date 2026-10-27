# Sonos volume on screen

When the TV's sound goes to a Sonos soundbar, over HDMI ARC/eARC or an optical cable, LG's own volume display shows no number: the
volume is the soundbar's, not the TV's. This option shows the soundbar's volume as a small bar with the number over whatever is on
screen, each time it changes, whether it was changed with the TV's remote, the Sonos app or the buttons on the bar. Meanwhile LG's
own bar, which has no number to show, is hidden (on webOS 25; see [LG's own volume bar](#lgs-own-volume-bar)).

It is **off by default** and it **only reads** the volume. Nothing in it can change the volume, mute or any other setting of the
speaker.

## Switch it on

In the manager app: **More** > **Sonos volume on screen** > **Show the Sonos volume**.

| Row | What it does |
|---|---|
| **Show the Sonos volume** | On or off. |
| **Speaker** | **Automatic** (the default) follows the only Sonos soundbar on the network (Playbar, Playbase, Beam, Arc, Ray or Amp), or the only Sonos player when there is just one. Choosing the row searches the network and lists every player with its room and model, so you can choose one; that is needed when there are several soundbars. |
| **Place on screen** | Top left (the default), top right, bottom left or bottom right. Picture notifications keep their own place; the volume shows beside them. |
| **Hide LG's volume bar** | On by default: while **Show the Sonos volume** is on and the TV's sound goes to the soundbar (HDMI ARC/eARC or optical), LG's own volume bar stays away, so only this bar shows. Off: both show. On a TV where this was not tried it says *not available on this TV*. |
| **Now** | What it reads now: the volume and whether it is muted, or why it cannot follow the speaker. |

The bar appears for three seconds after the last change, only while the TV's screen is on and its sound goes out to an external
device. With the TV's own speakers LG shows its own volume, so the bar stays away. Muting shows the bar with a crossed-out speaker.

## LG's own volume bar

With the sound on a soundbar, LG still shows its own volume bar when the remote's volume keys are pressed, only without a number.
On webOS 25, LG's surface manager draws that bar only while one of LG's settings, `com.webos.surfacemanager.volumeOSD` in LG's
configuration service (configd), is not `false`, and it follows that setting while the TV runs. **Hide LG's volume bar** sets it to
`false`, and only while it applies:

- The service writes one small file, `{"volumeOSD": false}`, into configd's runtime layer, `/var/run/tvconfig/remote/`, which is in
  RAM and which configd reads before LG's built-in settings. Then it asks configd to read its settings again
  (`luna://com.webos.service.config/reconfigure`), as LG itself does at every start. No file of LG's is changed and nothing is mounted.
- It removes the file again (and asks configd to read again) as soon as the option, or **Show the Sonos volume**, is switched off,
  or the TV's sound goes anywhere but HDMI ARC/eARC or optical: the TV's speakers, headphones or a Bluetooth speaker then get LG's
  bar as usual. The sound output is looked at every 20 seconds.
- The remote's volume and mute keep working as before; only LG's bar on screen (and its mute icon) stays away. A restart of the TV
  brings LG's bar back by itself; the service hides it again once it runs.

By hand, from a shell on the TV:

```sh
cat /var/run/tvconfig/remote/com.webos.surfacemanager.json   # {"volumeOSD": false} while LG's bar is hidden
rm /var/run/tvconfig/remote/com.webos.surfacemanager.json && \
  luna-send -n 1 -w 15000 -f luna://com.webos.service.config/reconfigure '{}' </dev/null   # LG's bar back until the service hides it again
```

## How it works

1. **Finding the speaker.** The service asks the local network which Sonos players there are (SSDP, the way the Sonos app finds them)
   and reads each one's description: its id, room and model. The chosen speaker is saved by its id, so it is found again when its
   address changes.
2. **Following the volume.** The service reads the current volume and mute (UPnP `GetVolume` and `GetMute` on port 1400 of the
   speaker) and subscribes to the speaker's volume events. From then on the speaker tells the TV about each change, at once. The
   subscription is renewed every 15 minutes and dropped when the option is switched off.
3. **When the events do not arrive.** If no event reaches the TV within eight seconds (a firewall between the two, for example), the
   service reads the volume once a second instead, and only while the screen is on.
4. **Showing it.** A change starts the hidden notify app (the one that shows [picture notifications](notifications.md)) with the
   new volume. It does not take the remote. Starting that app takes 1 to 2 seconds on webOS 25, so after the bar fades its window
   stays open, empty and transparent, for ten minutes: a change in that time shows at once. The first change after a pause of more
   than ten minutes (or after a restart) still waits for the app to start.

No Sonos account, no internet and no Sonos app are involved: everything stays on your local network.

## When it does not show

- **Now** says *No Sonos speaker found*: the TV and the speaker must be on the same network (the same Wi-Fi or LAN, no guest network
  in between). **Speaker** > **Search again**.
- **Now** says *several speakers: choose one*: there are several soundbars; choose yours under **Speaker**.
- **Now** shows the volume, but nothing appears on screen: check that the TV's sound output is the soundbar (LG's **Sound Out**
  setting), and that the volume really changes on the speaker.
- **Now** says *read every second*: the speaker's events do not reach the TV. It still works, a little later than with events.

The service log (`/tmp/cleanyourtv-helper.log` on the TV) has a line for each step, starting with `sonos:`.

## For developers

`helper/sonos.js` holds the search, the subscription and the event port; `notify/app` draws the bar (`kind: "volume"`, launched only
by the service itself); `helper/lgvolume.js` hides and shows LG's bar, on the TVs `helper/tvprofile.js` allows (`lgVolumeBar`). Service API, on `127.0.0.1:8765`:

| Endpoint | Purpose |
|---|---|
| `GET /api/sonos/status` | On or off, the chosen speaker (`null`: automatic), the speaker followed, the place, `hideLg` and `lgBar` (LG's own bar: `shown`, `hidden` or `unsupported`), the state (`off`, `searching`, `listening`, `not found`, `error`), `events` or `polling`, the volume and mute |
| `POST /api/sonos/find` | Searches the network (about three seconds); answers `{speakers: [{id, name, model, theater}]}` |
| `POST /api/sonos/set` `{enabled, speaker, position, hideLg}` | Changes the settings; `speaker` is an id from the last search, or `""` for automatic |

The tests (`tools/test/sonos.test.js`) run against stand-in players on the computer, and check that every request a player receives
is a search, a description, `GetVolume`, `GetMute` or a subscription.
