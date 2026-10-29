# Screensaver

When Home is left alone, CleanYourTV can show your photos full screen with the time and the date, instead of LG's screensaver. It
is off until you switch it on in **Customize** > **Screensaver**.

| Setting | What it does |
|---|---|
| Use the screensaver | On or off. The line under it says where the photos come from. |
| Starts after | 1, 2, 5, 10, 15 or 30 minutes without a key or a pointer move on Home. |
| New photo | Every 10, 15, 30 or 60 seconds, or every 5 or 15 minutes, cross-faded. |
| Time and date | Shown at the bottom left (with the frame: small, in the mat's top corner), or not. |
| Style | **Frame** (the default): the photos in a mat behind a frame, like a frame TV, below. **Photos**: each whole on black. |
| Frame | A wood (**Walnut**, the default, Oak, Teak, Ash, Cherry, Grey oak, Black ash), a paint (Black, White, Charcoal, Sand, Navy, Sage, Burgundy), a metal (Brass, Silver), or No frame. A list: OK ticks one, Back goes back. |
| Profile | The frame's shape: **Modern** (flat, rounded outside), Thin, Bevelled (sloping down to the picture) or Classic (a flat, a hollow and a bead). |
| Mat | **From the photo** (a light mat with a little of the photo's own colour, a dark one for a dark photo; warm white when the feed does not say the colour), White, Cream, Grey, Charcoal, Black or Linen. A list. |
| Photos at a time | **Up to two side by side** (the default), up to three, or **One**: then a landscape photo fills the inside of the frame (cut at the top and bottom as needed) and a portrait one hangs in the mat. |
| Finish | None; **Canvas**: the weave of a canvas over the photo; **Painting**: the canvas with a warm varnish, a little darker towards the edges. |
| Label | **Under the photo**: the caption and the day in pencil, as on a signed print; **Plaque**: on a brass plate on the frame; or off. |
| Show it now | Starts it at once, to see how it looks. |

While it shows, **Left** and **Right** step back and forward through the last 50 photos (Right past the last one brings a new photo,
and the timer starts again); right-to-left languages mirror them. Any other key or a move of the Magic Remote ends it, and that key
does nothing else. It does not start over Live TV, and it is darker from ten at night to seven in the morning.

**The frame.** Like a frame TV: the frame goes round the screen, four mitred sides of real-looking wood (the grain along each side,
each side its own length of board), paint or brushed metal, lit from above by its profile, and it throws a soft shadow on the mat.
The photos hang behind the mat, each in its own window with a bevelled edge, whole: one landscape photo large, a portrait one tall,
and the photos that follow it of the same orientation beside it (up to two, or three portraits with **Photos at a time**: up to
three); the first that does not fit is shown next. A photo near the screen's shape, and with **One** any landscape photo, fills the
inside of the frame instead. The label shows what the photo feed says: the caption and the day it was taken (or else added).
Nothing moves but the cross-fade from one photo to the next; the frame is drawn once, from a few small pictures that come with the
launcher (`app/saver-*.webp`, made by `tools/saver-art.mjs`). With **Style** set to **Photos**, photos are shown whole on black
(portrait photos too).

**LG's screensaver.** Before the TV starts its own screensaver it asks the apps that registered for it. While the screensaver is on
and there are photos, the launcher answers no and shows the photos instead; otherwise LG's screensaver starts as before. When
another app is on the screen (and idle), Home comes forward with the photos, and a key or the pointer goes straight back to that
app; the Home key ends them and stays on Home. Never over an HDMI input: a game console or a set-top box is in use even when the
remote is not (LG does not count a game controller), so there the launcher answers yes and LG decides, as it did before. Whether a
TV asks Home at all depends on the firmware: if LG's screensaver still appears, set **Starts after** shorter than LG's.

## Where the photos come from

1. A **photo feed**, when one is set up (below).
2. Otherwise the [Wallpapers](wallpapers.md) photos (phone uploads and Immich), in a shuffled order.

A photo feed's photos are Wallpapers photos as well: Customize > Wallpapers counts them, shows them behind Home and lets you choose
one of them as your wallpaper.

The TV never holds a whole photo library. It reads the feed's list of photo ids every hour and fetches a photo, at 1920 pixels,
only when it is about to be shown (and the one after it). Photos are shown from memory (the last 8); only a small offline set goes
to the TV's storage: the first 5 at once, then at most one new photo every half hour, at most 20 photos (24 MB), and nothing while
the storage has less than 300 MB free. A screensaver that changes photos all evening therefore hardly writes to the TV's flash
memory. A photo from the feed chosen as the wallpaper is always kept. Photos come in a shuffled round: every photo once before any comes back, never the same one twice in a row.
The round is saved with the list, so after a restart the TV goes on where it was; a photo added on the server joins the current
round, and a photo hidden or deleted on the server leaves the TV at the next read of the list. With the server away, the photos
already on the TV keep the screensaver going.

## Setting up a photo feed

1. On the server that offers the feed, create a token for the TV and copy its **setup code** (it starts with `cyfp1.`). The code
   holds the server's address, a token that can only read the feed, and the server's own root certificate. In
   [family-calendar](#family-calendar-and-frameo) this is **Admin** > **Photo feeds**, on the server itself.
2. On the TV: **Customize** > **Screensaver** > **Photo feed...** shows a QR code and an address with a 6-digit code. Open it on a
   phone, or type the address on a computer on the same network (the computer that runs family-calendar works: copy the setup code
   there and paste it straight in); the page opens on **Photo feed**. Paste the code and choose **Check and save**. The code is tried
   before it is saved. The CleanYourTV app's **Wallpapers** screen shows the feed (**Photo feed**: how many photos, when it was read)
   and can disconnect it.

The token is kept in `config.json` (readable by root only) and is never shown again or sent to the launcher. The TV talks to the
server over HTTPS only, trusts only the certificate in the code, and follows no redirects. To stop, choose **Disconnect the photo
feed** on the phone page (its photos leave the TV), and revoke the token on the server.

Over SSH the same works on the TV itself:

```sh
curl -s -X POST 127.0.0.1:8765/api/photofeed/setup -d '{"code":"cyfp1...."}'
curl -s 127.0.0.1:8765/api/photofeed/status
```

## The photo feed contract

Any server can offer a photo feed; the TV needs only these two calls and a setup code. Everything is HTTPS, and every request carries
`Authorization: Bearer <token>` with a token that can do nothing but read the feed.

| Call | Answer |
|---|---|
| `GET /api/feed/photos` | `200` `{"stamp": "...", "photos": [{"id": "...", "createdAt": "...", "takenAt": "...", "caption": "...", "width": 4032, "height": 3024, "color": "#8a7b70"}]}`: the photos to show, newest first, with `ETag`; `304` for a matching `If-None-Match`. Ids are 1-64 characters of `A-Z a-z 0-9 _ -`. Only `id` is required; the others are used by the screensaver's frame when they are there: `takenAt` (or else `createdAt`) for the label's day, `caption` (at most 80 characters are shown), `width` and `height` of the photo as stored (upright), and `color`, its average colour, for the mat. |
| `GET /api/feed/photos/<id>?w=1920` | `200` `image/jpeg`: the photo upright, fitted inside w x w without enlarging, metadata removed (`w` is 1280, 1920 or 2560). `404` for a photo that is gone or hidden, `422` for one the server cannot convert: the TV skips both. |

A refused token is `401`; the TV then keeps showing what it has and says so on the phone page. The **setup code** is `cyfp1.` and
base64url (no padding) of the JSON `{"u": "https://<host>[:port]", "t": "<token>", "ca": "<root certificate, base64 DER>"}`; `ca` may
be left out for a server with a publicly trusted certificate. The TV sends the address in `u` exactly as given, also as the `Host`.

### family-calendar and Frameo

The first server with a photo feed is family-calendar, which imports a Frameo frame's photos read-only on the server and offers
them, with its other photos, as a feed (**Admin** > **Photo feeds**). The TV never talks to Frameo or holds the Frameo identity:
hiding a photo in family-calendar hides it on the TV too.

## Service API

| Call | What it does |
|---|---|
| `GET /api/photofeed/status` | Set up or not, the server's host, the last 4 characters of the token, how many photos, how many on the TV, the last read |
| `GET /api/photofeed/next` | The id of the next photo, already on the TV (`{"id": null}` when there is none) |
| `GET /api/photofeed/photo/<id>` | That photo (JPEG) |
| `POST /api/photofeed/setup {code}`, `POST /api/photofeed/refresh`, `POST /api/photofeed/disconnect` | Set up, read the list now, remove |
