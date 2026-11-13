# Troubleshooting

- **Black screen after switching or rebooting.** Wait a minute; if it stays black, restart the TV. If the new Home does not come
  up, the setup removes the boot scripts and restarts the TV with LG's Home by itself.
- **Every app's picture is black, with only the sound or the subtitles.** LG has the video muted at the start of every stream and
  never lifts it (seen three times on webOS 25 right after the TV started; LG records no crash, and a restart clears it). On webOS 25
  and 26 with LG's flutter or web Home the boot now restarts LG's media services after the app manager (see
  [TV changes](tv-changes.md)), which is what fixed it on an OLED65B2RLA. If it happens anyway, use the phone remote's power key:
  **Fix a black picture** restarts the media services (`videooutputd`, then `umediaserver`) with the TV left on; open the app again
  afterwards. If the picture is still black, **Restart the TV** there (at most once in 5 minutes). The manager's **Fix the picture**
  offers both. LG's logs are kept first each time. The service also keeps a
  copy of LG's logs from a few minutes into each start (the last 2). Both are in `/media/developer/cleanyourtv/diag/`, readable only
  by root: LG's logs hold the TV's own sign-in headers, so they never leave the TV; they are what can tell why it happens.
- **The Home button opens LG's full-screen Home, not CleanYourTV.** Some TVs have a Home Style setting. Set TV Settings > General >
  Home Settings > Home Style to Basic.
- **Apps do not open, an HDMI input has no picture or the remote no longer controls HDMI-CEC devices (webOS 5 to 23).** These
  followed the restart of the app manager on TVs with LG's native Home (issues 14, 23 and 24). From service 1.6.6 such a TV takes
  over Home without that restart. **Share log** shows the steps under *Boot steps*; open an issue with it if the problem stays.
- **App names instead of icons after a start.** Home can draw its saved layout before the service answers, and the icons asked for
  then fail. After each answer of the app list a failed icon is asked again, at most twice per tile, and the name stays until the
  picture loads. If names stay, the service is not answering: see the report.
- **An app is missing from the grid.** Check **Hidden apps** in Customize. Apps without a launch icon are not listed.
- **After a firmware update removed root.** Re-root, then run the [install command](install.md#1-install-the-manager-app) and the setup again.
- **The Input key opens LG's picker.** Check the Input key switch in the manager app and run **Learn the Input key**.
- **A loading circle appears every half minute and the remote stops responding until you hold Back.** The Input key can show the
  Inputs list over the running app with a small app that the service starts in the background. On webOS 6.5 (reports) the TV closes that
  app again and it keeps the remote. From v1.5.13 webOS before 10 starts the app only when the key is pressed and closes it after use,
  and on any TV the service switches to that when it had to start the background app three times in ten minutes
  (`picker.mode: ondemand` in `config.json`). **Input key** > **Input key shows** chooses by hand; switching the Input key off entirely
  gives the key back to LG.
- **The manager list does not show Share log or Uninstall.** Before v1.5.13 the list could not scroll; update, then move down: the
  list scrolls and fades where more rows are hidden.
- **Text appears twice in menus or the Live TV list on webOS 5 (blurred, overlapping).** webOS 5's browser (Chromium 68) can keep the old
  text when a list is redrawn. From v1.5.13 the launcher swaps the list for a fresh element there instead of rewriting it.
- **The service restarts by itself.** On some TVs Node.js 8 stops with `uv_close: Assertion ... failed`. From v1.5.13 the service
  logs its last operations when it finds that the previous run ended without a clean exit; they appear in **Share log** under the
  service log, so a report names the cause.
- **`FAILED_IPKG_INSTALL`.** Remove the `com.cleanyourtv.manager` entry marked `half-installed` from
  `/media/developer/apps/var/lib/opkg/status` and install again.
- **Live TV shows the setup code again.** The playlist address was reset or never saved; run the pairing again, or send it with
  `POST /api/live/settings` ([Live TV](live-tv.md#setting-it-up)).
- **Something is broken after an update.** A launcher or service that does not start is replaced by the previous version
  automatically. **Go back to the previous launcher** in the manager returns to the previous launcher by hand.
- **The TV does not wake from the network (Wake-on-LAN) after it was switched off.** LG has two ways to switch off. With
  the TV's **Quick Start+** setting on, the remote and
  `luna://com.webos.service.tvpower/power/powerOff` only suspend the TV: Wake-on-LAN wakes it in a few seconds and CleanYourTV is
  already Home, since the boot scripts do not run again. `luna://com.webos.service.tvpower/power/shutDown` switches it off
  completely: it uses less power, but Wake-on-LAN no longer wakes it (the remote and HDMI-CEC from a device on an input still do), and
  the next start is a cold boot, with LG's Home until the boot scripts have run. Checked on webOS 22 (65QNED866QA). Use `powerOff`
  in scripts that must wake the TV again.
- **Back to LG's Home right now.** In the manager, **CleanYourTV as Home** off, or `sh /media/developer/cleanyourtv/undo-home.sh`
  over SSH.

## Reporting a problem

An AI assistant can help you read the report and find the cause: see [Working on problems with an AI assistant](ai.md).


Open an [issue](https://github.com/LanceSandino/cleanyourtv-WebOS/issues) and attach the output of **Share log**
(manager app, see [The manager app](manager.md#share-log)). It is masked, so it does not contain your addresses or keys. Say which
TV and firmware you have and what you expected.
