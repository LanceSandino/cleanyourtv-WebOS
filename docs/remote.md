# Phone remote

Your phone, on the same Wi-Fi as the TV, as its remote: the arrows round OK, Back, Home and Settings, the volume, play and pause, a
touchpad for the pointer, typing into a search box on the TV, and the apps of your dock. It is off until you pair a phone.

## Pairing a phone

1. On the TV: **Customize** > **Phone remote...** (or the CleanYourTV app > Phone remote) > **Pair a phone**.
2. Scan the QR code with the phone's camera. The remote opens and pairs itself; the code on the TV also works typed in.
3. On the phone: **Add to Home Screen** (Safari's Share menu, or Chrome's menu), so it opens full screen like an app.

The code works for two minutes, and five wrong codes close it. Each phone gets its own key, kept on that phone; the TV keeps only a
fingerprint of it (a SHA-256), so a copy of the TV's settings cannot be used as a key. **Phone remote** in the CleanYourTV app lists
the phones: OK on one removes it, and that phone stops working at once. **Phone remote: Off** stops the remote for every phone without
forgetting them.

| Tab | What it does |
|---|---|
| Remote | The arrows (hold one to repeat), OK, Back, Home, Settings, the volume and Mute, rewind, play, pause and fast forward, and Turn the TV off. |
| Touchpad | Drag to move the pointer, tap to click, two fingers to scroll, as with the Magic Remote. |
| Type | Text for a search box on the TV: open the box first, the text goes where its cursor is; Delete and Enter. |
| Apps | The apps in the order of your dock, then the others; a tap opens one. |

## How it works, and what it can reach

- The page and its commands come from the TV's own service on port **8794**, only while a phone is paired (or pairing is open), and
  only for addresses of the home network. It is plain HTTP on your Wi-Fi, like the other phone pages; no port is opened on your
  router, and nothing goes through the internet.
- Every command carries the phone's key. Another web site open on the phone cannot send commands (the TV refuses requests from other
  pages), and the page cannot be shown inside another site.
- The keys go to LG's own network input, the way LG's phone app sends them; text goes to LG's on-screen keyboard. The remote presses
  only what you tap: nothing here changes the TV or its volume by itself.

Turning the TV **on** from the phone needs something that stays on at home, because the TV's service sleeps with the TV: the TV wakes
on a Wake-on-LAN packet (on this TV **Turn on via Wi-Fi** is on), and a phone's browser cannot send one. A small helper for an
always-on computer at home is planned.
