# The launcher

The launcher replaces LG's Home. It is a web page of the project that the TV's browser runs, so it starts fast and works the
same on every supported webOS version.

![Home screen](screenshots/home.jpg)

## The screen

- **Dock.** Up to four apps, large, on the first row.
- **Top shelf.** The name of the focused app and an ambient glow taken from its icon.
- **Grid.** All other apps, sorted by how often you use each one (or A to Z).
- **Top buttons.** Inputs, Live TV, Settings and Customize, and a clock. The buttons you see are yours to change; **Add a button**
  also offers **LG TV**, LG's own TV from the antenna or cable (Live TV is the playlist player).
- **No pushed apps.** The placeholder apps LG pushes onto Home (a "stub" that downloads the real app when opened) and the
  promotions it pushes as apps (Rakuten TV's `ui30`, Streaming Week) are left out of the dock and the grid.
- **Open apps.** Optionally a green dot on the tile of every app that is open, as on the active input in the Inputs list: off by
  default, **Customize** > **Mark running apps** switches it on, in the launcher and in the Inputs picker. Back on the home screen lists
  the open apps to close them (see [Running apps](#running-apps)).

## Keys

| Action | How |
|---|---|
| Open an app | OK |
| Move between the rows | Up and Down go to the app or button above or below; the opposite key right after goes straight back to where the focus was |
| App options (dock, hide, uninstall) | Hold OK on an app |
| Move or remove a top button | Hold OK on it |
| Customize | The **Customize** button |
| Live TV | The **Live TV** button or tile |
| Switch input | The **Inputs** button |
| Put an input on Home | Hold OK on it in the Inputs list |
| Close running apps | Back on the home screen |
| Back to Home | The remote's **Home** key closes whatever is open over Home (Customize, the Inputs list, the photo chooser); coming back from an app with Back keeps the menu you left |

The Magic Remote pointer works too: pointing and clicking, and holding the button on an app for its options.

![App options](screenshots/options.jpg)

## Running apps

Back on the home screen lists the apps that are open, as LG's Home does with its Recents on a second Back. OK closes an app,
**Close all** closes every app in the list, and Back leaves it. Closing an app also removes it from LG's recent apps.

It lists the apps the launcher knows, including the ones you hid from the grid; Home itself, CleanYourTV's own apps and the TV's
system apps are never in it. LG's preload manager starts some apps in the background so they open faster (on webOS 25: LG Channels,
Netflix, YouTube); an app is listed only if that copy of it was on the screen, so those are not shown as open. The list is read when it opens and closes when you leave Home. Suggested and first built by
[Steefzar](https://github.com/lasharor/cleanyourtv-WebOS/issues/16).

![Running apps](screenshots/running.jpg)

## Customize

![Customize menu](screenshots/customize.jpg)

**Customize** holds how Home looks, in four groups (**Home**, **Look**, **Photos**, **More**). Every menu opens the same way:
Customize's list on the left with the focused section's rows showing on the right (Right or OK goes into them); a section keeps
Customize's list on the left with that section lit. Lists with pictures show the focused one large on the left: the theme list each
theme's screenshot, and the Screensaver its frame, mat and photos as an example that follows the focus down its Frame and Mat lists:

- the **dock**: each app in it can be replaced (an app already in the dock swaps places), moved or removed, and **Add an app...**
  fills a free place. Holding OK on an app gives **Add to dock**, **Move left**, **Move right**, **Remove from dock** and **Hide app**;
- the **top buttons**: move one left or right, remove it, or add Inputs, Settings, Live TV or any app;
- **hidden apps** (show them again);
- the **app order** (most used first, or A to Z);
- **mark running apps** (a green dot on their tiles, or none);
- the **clock**: its format (automatic, 12 or 24 hour), where it stands (**Position**: the theme's place, top left or top centre), its
  **Size** (the theme's, smaller or larger) and, on a theme whose picture has a cut-out like Dawn, whether it stands **Behind the
  picture** or in front. Position, Size and Behind the picture stay when you change theme; over a holiday theme and over your own
  photos the clock is always in front, and over your photos a time as large as a lock screen's (Dawn's) moves top left at a usual
  size, out of the photo's way;
- the **theme** (see [Themes](themes.md)) and the **accent colour**; the theme list shows each theme's screenshot;
- **Wallpapers**: your own photos behind Home, and how often they change (see [Wallpapers](wallpapers.md));
- **More settings...**, which opens the [manager app](manager.md) for everything the TV and the service do.

Putting the dock, buttons, hidden apps, order and clock back to the defaults is in the manager app: **Reset Home customization**.


## Continue watching

Highlight an app on Home and, a moment later, a row of its episodes, films or videos opens under that app's row:

- **Telemachus:** one card per show, the latest it watched: the episode you are in the middle of (with a bar for how far you got),
  or else the next one to watch (marked **Up next on Telemachus**). Never its channel's whole lineup.
- **Plex (or PLX), Stremio:** what you started and did not finish, with a bar for how far you got.
- **The other apps** (YouTube, Disney+, Apple TV and the like): the row LG's own Home shows for that app, as LG keeps it on the TV,
  without LG's advertisements. Which apps have one is LG's choice; an app LG has nothing for shows no row. Netflix and Prime Video
  keep their own row there, from the profile last used in the app: their **Continue watching** comes first (Prime Video with the
  season and episode), then their suggestions. These rows are as fresh as the app last made them; there is no bar for how far you
  got, because the apps do not give it.
 Down goes into the row; OK opens it in that app: Telemachus at that episode or film (an older Telemachus app
without the `play` launch option just opens), Plex, PLX or Stremio at their own Home, where their Continue Watching row has
the same item first, and the other apps at that video or film, as LG's Home opens it. For an app in the dock, Home slides up to show the row under the dock (as it does when you go down
into the apps), and back when the row closes. The row closes when you move on along that app's row or above it; going down past it
keeps it. Nothing is
shown for apps without episodes, and there are no app shortcuts (your apps are on Home already).

Holding OK on a card offers **Resume** (or **Play**), **Open** the app, **Remove from this row** (for Telemachus the whole show, so its
next episode does not come back), **Hide the row of** that app, and the settings below.

**Customize** > **Continue watching**:

- **Show on Home** switches the rows off (nothing is then read).
- **Telemachus** switches Telemachus's cards off (it is not read then).
- **Rows from LG for other apps** switches LG's rows off, keeping Telemachus, Plex and Stremio.
- **Show removed cards again** (when you removed some) brings them all back.
- **Link Plex...** shows a 4-character code: open `plex.tv/link` on a phone or a computer, signed in to Plex, and enter it. The TV
  then reads Continue Watching from your own Plex server, at the first of its addresses that answers as that server (its address on
  your network first).
- **Link Stremio...** shows a link: open it on a phone or a computer and sign in to Stremio there. The TV then reads your Stremio
  library and shows what you started and did not finish, newest first.
- A linked service shows its name; OK on it offers **Unlink**. A code is valid for ten minutes.

No password is typed on the TV. The service reads Telemachus on the TV itself (`127.0.0.1:8770`, which answers programs on the TV and
refuses web pages) and the linked services; it fetches the pictures and serves them from memory, so the Home page
contacts no other site. Nothing is shown from Telemachus when it is not installed.

## Uninstalling apps

Holding OK on an app offers **Uninstall...** for the apps the TV lets go of: apps from LG's app store (also LG's own store apps, such
as LG Movies & TV or LG Gaming Portal) and developer apps. It asks first; the app and its data leave the TV, and LG's app store
installs it again. LG's system apps (Home Hub, LG Channels, Sports, Multi View and the like) are part of the firmware and can only be
hidden. CleanYourTV, the Homebrew Channel (it keeps the TV rooted) and LG Input Hook (the Input key needs it) are never offered. In
**Customize** > **Hidden apps**, holding OK on a hidden app uninstalls it too.
## Cards

Cards are set up in the [manager app](manager.md), **Cards**. Themes with places for cards (**Lock Screen**, **Bloom** and **Horizon**)
also have a **Cards** row in **Customize** that opens it. It lists the places (above the clock, beside the clock, a column on the right,
above the dock); choose one to put a card there or leave it empty. A card you chose stays when you switch to another theme with the
same place. The QR code for the phone page goes as soon as the phone saves: back to Home when you came from Customize > Cards, so the
card shows at once (the phone page stays open for more changes, at most an hour).

| Card | What it shows |
|---|---|
| Greeting | Good morning, afternoon or evening, with your name if you set one, and the date or the weather on a second line where there is room. |
| Weather | The temperature and the sky now at a place you choose by its ZIP or postal code on the TV, or search for by name on the phone page, from Open-Meteo (free, no account), with the next three days if you like; °C or °F. The TV asks at most every 30 minutes and keeps the last answer for when the internet is away. In a short place (Glass's line above the clock) it is one line: the icon, the temperature, the place and the sky. |
| Home Assistant entity | One entity with an icon, its state (On, Off, 8.4 °C) and its name. Select it with the remote (it joins the row of top buttons) and press OK to switch a light, switch, fan or automation, or to run a scene or script. Locks, alarms and covers are never switched from the TV. |
| Home Assistant entities | A list of entities, one per line on the phone page, with an optional title. |
| Home Assistant camera | A camera's picture, renewed every 10, 30 or 60 seconds while Home is shown. |
| Text | Your own text. `{{greeting}}`, `{{time}}`, `{{date}}` and `{{weekday}}` are filled in and kept up to date, and `{{weather.temp}}` and `{{weather.text}}` with a weather card on Home; `**bold**`, `*italic*` and a line starting with `#` for a heading. In three sizes. |

The weather card needs no phone: choose **Weather** for a place and the TV asks for a **ZIP code** at once (later: the place's row,
then **Place**). Type it with the remote's numbers, LG's on-screen keyboard (OK on **ZIP code**) or the phone remote's **Type**, then
**Look it up**: the code is searched in the TV's own country (any country when nothing is found there), and a place in the US also
switches the card to °F. **Temperature** (°C or °F) and **Show** (now, or now and the next days) are rows there too.

Names, texts and the other options are typed on your phone: **Cards** > **Set up from your phone** in the manager app shows a QR
code. The page shows a form for each place, and **Edit as JSON** shows all cards at once, for example
`{"greeting": {"type": "greeting", "name": "Sam"}}`. It stays open while you use it, at most an hour, and needs the code shown on
the TV. The Home Assistant cards use the address and the long-lived access token set in the manager app under **More** >
**Home Assistant** > **Set up from your phone**, the same ones [Voice](voice.md) uses. Without them a Home Assistant card says that
Home Assistant is not set up; the TV asks Home Assistant for the states every 30 seconds while Home is shown. The phone page
offers your entities while you type.

Cards dim after three minutes without a key press and shift by a few pixels every few minutes, so nothing stays in one place on an
OLED panel for hours. How a theme marks its places is in [Themes](themes.md#slots-for-cards).

## Inputs

The **Inputs** button lists HDMI inputs by the names LG shows, with what is connected and a marker on the active one. OK
switches to the input.

### An input on Home

Hold OK on an input in the Inputs list and choose **Add to Home**. The input then shows as a tile, with the HDMI symbol, the name
the TV gives it (for example the name of the connected console) and its port. It is a tile like an app: OK switches to the input,
and holding OK on it offers **Add to dock**, **Move left**, **Move right** and **Remove from dock**. **Remove from Home** takes it
off again; that is also in the Inputs list. A tile of an input with nothing connected is dimmed and still switches to it.

In the [Inputs picker](input-key.md) of the Input key, holding OK on an HDMI input does the same: it is added to Home, or taken off
when it already is. An input in the dock also shows in the picker's row of dock apps.

Suggested and first built by [ibexes](https://github.com/lasharor/cleanyourtv-WebOS/pull/25).

![Inputs menu](screenshots/inputs.jpg)

## Icons

Each tile uses the app's own icon. The tile colour is taken from the icon's edge colour, so an icon that reaches its edges blends
into the tile, and the ambient glow comes from the icon's most vivid colour. Colours are worked out once per app and remembered.

A picture on one flat colour (a logo on black) gives that colour to its tile, taken from the picture's four corners, so the picture does
not show as a square. A transparent logo drawn in near-black (made for a white background) gets a light tile, where it would hardly be seen. The Inputs picker colours the tiles of its apps the same way.

An icon that is an opaque square with a transparent margin around it (many LG icons) is enlarged so it fills its tile, and a
gradient icon in the dock gets a tile with the same gradient ([#3](https://github.com/lasharor/cleanyourtv-WebOS/issues/3)).

## Language

Menus follow the TV's language, or the one chosen in the manager app: English, Dutch, German, French, Spanish, Russian, Turkish and
Arabic. See [Languages](languages.md), also for adding one.

## Themes

The look of the home screen (colours, tile and text size, columns, clock, glow, animation speed, wallpaper) is a [theme](themes.md),
chosen in the manager app.

## Settings file

Settings are stored on the TV in `/media/developer/cleanyourtv/config.json`:

| Key | Meaning |
|---|---|
| `dock` | App ids in the dock (as many as the theme's dock holds). When the theme has room for more, your most used other apps fill the free places, until you change the dock yourself. |
| `topbar` | The buttons at the top. |
| `hidden` | App ids you hid. |
| `pinnedInputs` | The inputs on Home: `{id, label, port}`, `id` being the input's app (for example `com.webos.app.hdmi2`). |
| `sort` | `usage` or `alpha`. |
| `clock` | `auto`, `12` or `24`. |
| `runDots` | `true` shows a green dot on open apps (off by default). |

See [`config.example.json`](https://github.com/LanceSandino/cleanyourtv-WebOS/blob/main/config.example.json). Change settings in
the launcher; the file is read and written by the service.
