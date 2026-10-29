# Phone remote

Your phone, on the same Wi-Fi as the TV, as its remote, laid out like LG's: power, the volume and channel rockers, the arrows round OK,
Back, Home, Settings, Info and Exit, play and pause, the colour keys and a number pad, a touchpad for the pointer, typing into a search
box on the TV, and the apps of your dock. It is off until you pair a phone.

## Pairing a phone

1. On the TV: **Customize** > **Phone remote...** (or the CleanYourTV app > Phone remote) > **Pair a phone**.
2. Scan the QR code with the phone's camera. The remote opens and pairs itself; the code on the TV also works typed in.
3. On the phone: **Add to Home Screen** (Safari's Share menu, or Chrome's menu), so it opens full screen like an app.

The code works for five minutes, and five wrong codes close it. On an iPhone, a remote added to the Home Screen keeps its own storage: open the icon and pair it there too, with a new code (Pair a phone again on the TV). Each phone gets its own key, kept on that phone; the TV keeps only a
fingerprint of it (a SHA-256), so a copy of the TV's settings cannot be used as a key. **Phone remote** in the CleanYourTV app lists
the phones: OK on one removes it, and that phone stops working at once. **Phone remote: Off** stops the remote for every phone without
forgetting them.

| Tab | What it does |
|---|---|
| Remote | Power (asks first, then turns the TV off), the volume rocker (hold to repeat) and Mute, the channel rocker, Home, the arrows round OK (hold one to repeat), Settings, Info, Back and Exit, rewind, play, pause and fast forward, and the red, green, yellow and blue keys. **123** opens a number pad (1 to 9, 0, the dash and OK). |
| Touchpad | Drag to move the pointer (a quick drag goes further, a slow one is precise), tap to click, two fingers to scroll, as with the Magic Remote; Back, OK and Home under it. |
| Type | Text for a search box on the TV: open the box first, the text goes where its cursor is; Delete and Enter. |
| Apps | The apps in the order of your dock, then the others; a tap opens one. |

## How it works, and what it can reach

- The page and its commands come from the TV's own service on port **8794**, only while a phone is paired (or pairing is open), and
  only for addresses of the home network. It is plain HTTP on your Wi-Fi, like the other phone pages; no port is opened on your
  router, and nothing goes through the internet.
- Every command carries the phone's key. Another web site open on the phone cannot send commands (the TV refuses requests from other
  pages), and the page cannot be shown inside another site.
- The keys go to LG's own network input: the keys LG names (Home, Back, OK, Exit, the gear key's quick settings) by name, the arrows
  and the rest by their key code; text goes to LG's on-screen keyboard. The volume and Mute go to LG's audio service, as the TV's own
  volume does, so a soundbar on HDMI eARC follows them (network input's volume keys did not reach one). The remote presses only what
  you tap: nothing here changes the TV or its volume by itself.
- The touchpad moves and scrolls LG's pointer through its pointer input; a tap is OK, which clicks where the pointer is while it
  shows.

Turning the TV **on** from the phone needs something that stays on at home, because the TV's service sleeps with the TV: the TV wakes
on a Wake-on-LAN packet (on this TV **Turn on via Wi-Fi** is on), and a phone's browser cannot send one. A small helper for an
always-on computer at home is planned.
