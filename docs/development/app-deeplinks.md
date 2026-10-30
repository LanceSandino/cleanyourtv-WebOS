# App deep links and search launches

A research note for Search on Home ("Where to watch"): which launch parameters each streaming app on an LG TV accepts to open
**a title**, and to open **its own search with words**. CleanYourTV only uses what an app already supports; nothing in the apps is
changed. Collected on 2026-10-29 on the webOS 25 test TV, read-only: the apps' `appinfo.json`, LG's logs of launches made that day,
the scripts the web apps load (from WebAppMgr's caches, then downloaded from the same public addresses and read, never run), the
strings of the LG layer inside the native apps, and public sources. Tried on the TV on 2026-10-30: Disney+'s `page=search` and Sling's
search link open their search with the words (used, `helper/search.js`); Stremio takes nothing; Plex's `plex://show/<id>` reached
Plex's profile choice (a profile with a PIN), so whether it lands on the title is not seen yet.

## How a launch reaches an app

CleanYourTV opens an app with `luna://com.webos.applicationManager/launch {"id": <app>, "params": {...}}`.

- A **web app** gets the whole `params` object as JSON in `webOSSystem.launchParams` (older: `PalmSystem.launchParams`), at start and
  again with a `webOSRelaunch` event when it is already running. Each app decides which keys it reads; most read only `contentTarget`.
- A **native app** (Netflix, Prime Video, YouTube, YouTube TV, Apple TV) gets it through LG's layer inside the app, which turns it
  into the app's own launch form.
- `deeplinkingParams` in `appinfo.json` (`{"contentTarget":"$CONTENTID"}` in almost every app) is only the template LG's Home fills
  in; it says nothing about which values the app understands. `inAppSearchParams` (the app's own search with words) is declared by
  **YouTube and YouTube TV only** on this TV. `inAppVoiceIntent` (Netflix, Prime Video, YouTube, YouTube TV) is LG's voice template.
- LG's public documentation does not describe these fields: the [appinfo.json reference](https://webostv.developer.lge.com/develop/references/appinfo-json)
  documents `handlesRelaunch` only, and LG staff on the developer forum say partner material is under NDA
  ([forum thread](https://forum.webostv.developer.lge.com/t/how-to-implement-deep-linking-and-add-content-to-lg-webos-tv/24869)).
  Everything below therefore comes from the apps themselves unless it says otherwise.

**Evidence**, strongest first: **code** (read in the script the app runs on LG, or in the LG layer of a native app), **log** (seen in
LG's logs from a real launch on the test TV), **row** (the format the app's own row in LG's Home writes; CleanYourTV reads these in
`helper/lgrows.js`), **public** (documented or reported publicly), **guess**. Only the launches the owner made by hand were observed;
nothing was launched for this note.

## Summary

| App (id) | Title | Search with words | Evidence | CleanYourTV today |
|---|---|---|---|---|
| YouTube (`youtube.leanback.v4`) | `contentTarget: "v=<videoId>"` (+`&t=<s>`), `list=<playlistId>`, channel `c=<UC…>` | `contentTarget: "q=<words>"` | code, log, appinfo | `v=` from watch links; search from appinfo (works) |
| YouTube TV (`youtube.leanback.ytv.v1`) | `v=<videoId>` (live channels only by their video id), `bid=<browseId>` | `q=<words>` | appinfo, code (keys only) | `v=` from www.youtube.com watch links; search from appinfo |
| Disney+ (`com.disney.disneyplus-prod`) | `page=browse&id=entity-<uuid>` (page), `page=play&id=…` (plays) | `page=search&searchText=<words>` | code, log (browse); search untested | browse (works); no search |
| Netflix (`netflix`) | `m=<titleId>&source_type=27` | none found | log, row | `m=<id>&source_type=27` from netflix.com/title links |
| Prime Video (`amazon`) | `detail?gti=<amzn1.dv.gti…>` or the bare `amzn1.dv.gti…` | none confirmed (voice template only) | code (LG layer), row | `detail?gti=` from gti links |
| Hulu (`hulu`) | `george_dl_url: <hulu.com series/movie/watch link>`; `contentTarget` only takes legacy `<digits>_content` | none | code | opens as it is |
| Plex (`cdp-30`) | `contentTarget: "plex://movie/<id>"` / `plex://show/<id>`, or an `https://` Plex link | none | code | opens as it is |
| Sling TV (`com.movenetworks.app.sling-tv-sling-production`) | `contentTarget: "https://watch.sling.com/1/<type>/<id>[/watch]"` | `https://watch.sling.com/1/category/search?q=<words>` | code | opens as it is |
| Spotify (`spotify-beehive`) | Spotify URI or open.spotify.com link | `spotify:search:<words>` | code | not used |
| Peacock (`com.peacock.tv`) | unknown | unknown | none (script not readable) | opens as it is |
| Apple TV (`com.apple.appletv`) | `https://tv.apple.com/<cc>/<show\|movie>/<name>/umc.cmc.<id>` | unknown | row | as the row writes it |
| Stremio (`io.strem.tv`) | none: the app reads no launch parameters | none | code (earlier note), log | opens as it is |

Not installed on the test TV, so not covered: PLX (`com.beb.plxnative`), Max, Paramount+, Tubi, Pluto TV, Fubo, Crunchyroll.
(Paramount+ and Pluto TV left scripts in WebAppMgr's cache from earlier installs; they were not read.) Other installed apps are not
streaming services for Where to watch: Apple Music, LG Movies & TV (a stub), LG Gaming Portal, a game.

## YouTube

- **Versions:** app 25.1.1, Cobalt 25.lts.30 (LG build), TV client `www.youtube.com/tv` (kabuki, read on 2026-10-29).
- **How a launch arrives:** LG's code in Cobalt (`deeplink_utils.cc`) appends `contentTarget` as a query string to the start address
  `https://www.youtube.com/tv?…` (log: `MakeLaunchParamURL url :https://www.youtube.com/tv?additionalDataUrl=…&q=<words>`). The
  `reason` parameter only adds YouTube's tracking values (`searchResult` gives `utm_content=s&launch=search`); it is not needed.
- **Title:** the TV client reads `v` (with `t`, start seconds) to play a video, `list` (with `index`, `v`) for a playlist, and `c` (with
  `params`) to open a channel: **code**. So `v=<videoId>`, `list=<playlistId>` and `c=<channelId>` (the `UC…` id, not a handle).
- **Search:** `q=<words>` opens YouTube's search with the words (the client turns it into a search request, which the log shows
  right after the launch): **code, log**; `appinfo.json` declares `inAppSearchParams` `{"contentTarget":"q=$SEARCH_KEYWORD"}`. The owner
  confirms it works.
- **Public:** Home Assistant users launch YouTube with `system.launcher/launch` and a `contentId`; a bare video id is reported to work
  on webOS 4 and not on others ([thread](https://community.home-assistant.io/t/youtube-app-opens-on-tv-using-webostv-integration-but-no-video-plays/315935),
  [thread](https://community.home-assistant.io/t/play-youtube-on-smart-tv/101407)). On this Cobalt the value is a query string, so
  `v=<id>` is the form that works.
- **Today / could:** CleanYourTV sends `v=<id>` for `youtube.com/watch?v=` links and `q=<words>` for search. It could also take
  `youtu.be/<id>`, playlist links (`list=`) and channel links (`c=`).

## YouTube TV

- **Versions:** app 25.1.0; same Cobalt loader; the start address is `https://www.youtube.com/tv/upg/` (the name of its storage file).
- **Search:** `q=<words>`, declared in its own `inAppSearchParams`: **appinfo**. Not seen in the logs.
- **Title:** the YouTube TV client's start code treats `q`, `v` and `bid` (a browse page id) as deep links and skips loading Home
  for them: **code** (only that start module was read, not the code that opens the page). So `v=<videoId>` opens a video.
- **Live channels:** there is no key for a network or a channel name; a live channel can be opened only by the video id of its live
  stream (`v=`). CleanYourTV has no source of those ids, so live channels cannot be opened at a channel today.
- **Today / could:** CleanYourTV sends `v=` only for `www.youtube.com/watch` links. Links from Plex for `youtube-tv` probably point at
  `tv.youtube.com` (not verified), which `launch()` does not match.

## Disney+

- **Versions:** shell 24.5.8; the app itself is Disney's web app loaded from `cd-dmgz.bamgrid.com/bbd/prod/26.19.1.mrtoad.04/`.
- **How a launch arrives:** Disney's LG adapter (`static/js/chunks/lg_tv_webos.es6.js`) splits `contentTarget` on `&` and `=` into
  a map, **without decoding**; at start the app puts the map into the address (`#deeplink?<key>=<value>&…`), which its router parses
  with `decodeURIComponent` (and tries `JSON.parse` on each value); on relaunch the map goes to the router as it is, undecoded.
- **Title:** `page=browse&id=<id>` opens the title's page and `page=play&id=<id>` plays it (Disney's "external browse/play action"
  routes); `page=movie_details|series_details|event_details&id=…` also exist. `distributionPartner=lg` and the other keys in LG's
  format (`programType`, `contentId`, `type`, `contentType`) are only analytics. **code**; LG's format with `page=browse&id=entity-<uuid>`
  was launched by the owner (**log**) and works.
- **Search:** any `page=<route>` is routed to that page; the `search` route takes `searchText` as a deep-link parameter. So
  `contentTarget: "page=search&searchText=<words>"` should open Disney+'s search with the words: **code**, not tried on a TV.
  Because the value is decoded at start but not on relaunch, the words should be sent as they are, with `&`, `=`, `#`, `%` and `?`
  replaced by spaces (a lone `%` would break the decoding). Words that are only digits become a number in its parser (an edge case).
- **Today / could:** browse works; search could be added (an app-side search that `appinfo.json` does not declare).

## Netflix

- **Versions:** app 3.0.1 (native, NRDP 2026.1.3; LG layer 1.0.76).
- **Title:** `contentTarget: "m=<titleId>&source_type=27"`. LG's layer (`libwebosPlugin.so`) hands `contentTarget` to Netflix's UI as its
  launch query string (the log shows the same text plus `additionalDataUrl`), with `source_type` defaults by launch reason in its strings.
  Netflix's own row in LG's Home writes the same `m=…&source_type=27…` form: **log, row**. The log shows Netflix coming to the
  front with it; whether the title page opened is not in the log.
- **Search:** none found. Netflix's `inAppVoiceIntent` (`intent`, `intentParam`, e.g. `SearchContent`) is forwarded by LG's layer to
  Netflix's voice service with a voice routing token (`v1.0/voice/controls`), not to the app as a query; not usable from a launch.
- **Today / could:** as it is (`m=<id>&source_type=27` from `netflix.com/title/<id>` links). No search.

## Prime Video

- **Versions:** app 9.2.14 (native "ignition" runtime; LG layer `libprime-video-device-layer.so`).
- **Title:** LG's layer takes a `contentTarget` that starts with `amzn1` and turns it into `detail?gti=<id>` with an LG `refMarker`;
  any other string is passed to Prime Video's deep-link handler as it is. So both `detail?gti=amzn1.dv.gti.<uuid>` and the bare
  `amzn1.dv.gti.<uuid>` open the title: **code** (strings of the LG layer), **row** (Prime Video's own row writes `detail?gti=`).
  Not launched on the TV that day. Links that carry only an ASIN have no known form (**guess** only).
- **Search:** no string form found. LG's layer also forwards voice parameters (`intent`, `intentParam`, `languageCode`; its
  `inAppVoiceIntent` is `{"contentTarget":{"intent":…,"intentParam":…,"languageCode":…}}`) to Prime Video's UI; whether a launch with
  `intent: "SearchContent"` searches is unknown (the UI is downloaded at run time and was not read). Would need a test on a TV.
- **Today / could:** as it is.

## Hulu

- **Versions:** shell 7.0.6; Hulu's LG web app `lgbbd.app.hulu.com/build_files/lgbbd/1/cb36f58029bb.9b49d17fee65/` (October 2026).
- **How a launch arrives (`george.js`, LG deep-link parser):** if `contentTarget` is present, only the form `<digits>_content…` is
  used (it becomes `hulu://?contentId=<digits>`, a legacy numeric id); anything else in `contentTarget` is dropped. Without
  `contentTarget`, a top-level `george_dl_url` parameter (URI-decoded) is taken as a Hulu deep link.
- **Title:** Hulu's deep-link parser takes `hulu://…` and `https://hulu.com/…` links with the paths `series/<slug-uuid>`,
  `movie/<slug-uuid>`, `shows/<id>`, `watch/<uuid>` (plays), `network?networkId=<uuid>` (live), finds the UUID in the slug and opens the
  page. So `params: {"george_dl_url": "<https://www.hulu.com/series/…-<uuid>>"}` (and no `contentTarget`) should open the title:
  **code**, not tried on a TV.
- **Search:** no deep link to search in the parser.
- **Today / could:** opens as it is; could open titles from Hulu links with `george_dl_url`.

## Plex

- **Versions:** shell 5.2.1; Plex's web app `app.plex.tv/tv-v5-webos/`.
- **Title:** its webOS deep-link handler (`getAppConfig_ts.js`) reads `contentTarget`: an `http(s)://` value is a Plex link resolved with
  the signed-in user's token; a `plex://…` value is a Plex id (`guid`); anything else gets `plex://` put in front. A guid opens the
  title's page (preplay). So `contentTarget: "plex://movie/<id>"` or `"plex://show/<id>"`, with `<id>` the 24-character id Plex's
  catalogue (Discover) gives: **code**, not tried on a TV. Needs the Plex app signed in.
- **Search:** none.
- **Today / could:** Plex offers in Where to watch, and Plex cards, open the app as it is; they could open the title.

## Sling TV

- **Versions:** app 6.56.1 (`webapp.movetv.com/lg/dist-6.56.1/`).
- **Title:** `contentTarget` is a link on `watch.sling.com` (`main.*.js`, "LgDeepLink"): `https://watch.sling.com/1/<type>/<id>[/watch|/browse]`
  with the types `program`, `asset`, `franchise`, `channel`, `network`, `call_sign`, `category`, `rental`, `recording`, `hub`, `collection`.
  `/watch` plays (a channel's live stream for `channel`), `/browse` (the default) opens the page: **code**, not tried on a TV.
  What link Plex gives for Sling is not known.
- **Search:** `https://watch.sling.com/1/category/search?q=<words>` sets `guideId=search` and `extra_keywords=<words>`, and Sling's search
  screen fills its search box from those: **code**, not tried. The words are a URL parameter (encode them).
- **Today / could:** opens as it is; could pass Sling links through, and search.

## Spotify

- **Versions:** shell 2.0.37; `tv.scdn.co/webos4plus/v2/ad3ec52/js/spotifytv.js`.
- **Title and search:** `contentTarget` (or `data`, `handledBy`) that does not start with `?` is a Spotify URI or `open.spotify.com`
  link; albums, playlists, shows, episodes, artists and genres open their page, and a search URI opens `/search/<query>`. So
  `spotify:search:<words, encoded>` should open Spotify's search: **code**, not tried. (A value starting with `?` is Spotify Connect's
  login data.) Music only, so not part of Where to watch.

## Peacock, Apple TV, Stremio

- **Peacock** (7.4.302): its shell is encrypted and its UI is loaded from `tv.clients.peacocktv.com/lightning/release/prod/webos/…`
  (seen in WebAppMgr's cache); the server refused the download (HTTP 403), so it was not read. No Peacock launch in the logs.
  Unknown; keep opening it as it is.
- **Apple TV** (16.2.4, native): the binary is not readable while the app is not running. The `tv.apple.com` link form is what its
  own row writes (**row**); not launched that day. Search unknown.
- **Stremio** (1.13.3): the logs show `contentTarget` values reaching the app (`stremio:///…`), but its TV UI reads launch
  parameters only through LG's webOSTV.js library and acts on none (earlier note), so it opens as it is.

## Recommended changes

Ordered by confidence. None of these were tried on a TV for this note; each needs a check on the TV after it is made, and a test in
`tools/test/where.test.js` or `tools/test/search.test.js`.

1. **YouTube links** (`helper/deeplinks.js`, high): besides `youtube.com/watch?v=`, accept `youtu.be/<id>` (`v=<id>`), playlist links
   (`list=<id>`, with `v=` when present) and channel links `youtube.com/channel/UC…` (`c=UC…`). Evidence: YouTube's TV client
   reads `v`, `list` and `c`; Cobalt appends `contentTarget` to its address (log).
2. **Disney+ search** (`helper/search.js`, medium-high): a known search launch for `com.disney.disneyplus-prod`:
   `{contentTarget: "page=search&searchText=<words>"}`, with `& = # % ?` in the words replaced by spaces. Evidence: Disney's `search`
   route takes `searchText` from a deep link. This is a search the app supports but does not declare in `appinfo.json`, so it needs
   a small table of known searches next to the appinfo ones; that is a decision for the owner (a Decision Entry).
3. **Plex titles** (`helper/where.js` / `helper/deeplinks.js`, medium-high): open Plex offers (Plex's own platform and `plex-library`)
   at the title with `{contentTarget: "plex://" + (kind === 'movie' ? 'movie' : 'show') + "/" + <Discover id>}`. Evidence: Plex's webOS
   deep-link handler.
4. **Hulu titles** (`helper/deeplinks.js`, medium): for a `hulu.com/(series|movie|watch)/…<uuid>` link send
   `{george_dl_url: encodeURIComponent(link)}` and no `contentTarget`. Evidence: Hulu's LG deep-link parser. `launch()` returns
   `params`, so this fits without a new shape.
5. **Sling** (`helper/deeplinks.js` and `helper/search.js`, medium): pass `https://watch.sling.com/1/…` links as `contentTarget`
   unchanged; search with `https://watch.sling.com/1/category/search?q=<encoded words>`. Evidence: Sling's LG deep-link code. Plex's
   link format for Sling is unknown.
6. **Spotify search** (`helper/search.js`, medium-low): `{contentTarget: "spotify:search:" + encodeURIComponent(words)}`. Evidence:
   Spotify's TV deep-link reducer.
7. **YouTube TV links** (`helper/deeplinks.js`, low): `tv.youtube.com/watch/<id>` to `v=<id>`. Evidence: the start module treats `v`
   (and `q`, `bid`) as deep links; Plex's link format for YouTube TV is not verified.
8. **Not recommended without a test on a TV:** Prime Video search through the voice-intent object, any Netflix search, Peacock,
   Apple TV search, Hulu search. No evidence that they work.

Also: the comments in `helper/deeplinks.js` and `helper/disney.js` still call the Disney+ browse format unverified; the owner has
since confirmed it opens the page, and the Netflix form is now seen in LG's logs.

## Sources

App code read (public addresses, downloaded and read on 2026-10-29, never run):

- YouTube: `https://www.youtube.com/tv` and its `kabuki` base script; YouTube TV: `https://www.youtube.com/tv/upg/` and its `ytvlr`
  base script; LG's Cobalt loader strings (`deeplink_utils.cc`) from the app on the TV.
- Disney+: `https://cd-dmgz.bamgrid.com/bbd/prod/26.19.1.mrtoad.04/static/js/` (`chunks/lg_tv_webos.es6.js` and the app chunks).
- Hulu: `https://lgbbd.app.hulu.com/build_files/lgbbd/1/cb36f58029bb.9b49d17fee65/george.js`.
- Plex: `https://app.plex.tv/tv-v5-webos/` (`index.html`, `getAppConfig_ts.js`, the app chunks).
- Sling TV: `https://webapp.movetv.com/lg/dist-6.56.1/static/js/main.3c6b3352.js`.
- Spotify: `https://tv.scdn.co/webos4plus/v2/ad3ec52/js/spotifytv.js`.
- Netflix and Prime Video: strings of LG's layers in the apps on the TV (`lib/libwebosPlugin.so.1`, `lib/libprime-video-device-layer.so`).

Public:

- LG, [appinfo.json reference](https://webostv.developer.lge.com/develop/references/appinfo-json) (no deep-link fields documented).
- LG developer forum, [deep linking thread](https://forum.webostv.developer.lge.com/t/how-to-implement-deep-linking-and-add-content-to-lg-webos-tv/24869)
  (partner material under NDA).
- Home Assistant, [LG webOS integration](https://www.home-assistant.io/integrations/webostv/) (no content-id examples) and its
  library [aiowebostv](https://github.com/home-assistant-libs/aiowebostv/blob/main/aiowebostv/webos_client.py)
  (`launch_app_with_content_id` sends `{"id", "contentId"}`, `launch_app_with_params` sends `{"id", "params"}`).
- Home Assistant community threads on YouTube content ids (linked in the YouTube section).
