# Third-party notices

The MIT licence in `LICENSE` covers the **code** in this repository — everything
under `js/`, `scripts/`, `tests/`, plus `index.html`, `style.css` and
`server.js`.

It does **not** cover the art and audio under `public/assets/`. Those come from
free asset packs by **ansimuz** (Luis Zuno) and stay under their own terms,
which are permissive but are not ours to relicense.

## Art

| Path | Pack | Source |
| --- | --- | --- |
| `public/assets/sunnyland-woods/` | SunnyLand | https://ansimuz.itch.io/sunny-land-pixel-game-art |
| `public/assets/sunnyland-winter/` | SunnyLand (winter set) | https://ansimuz.itch.io/sunny-land-pixel-game-art |
| `public/assets/fort-of-illusion/` | SunnyLand Fort of Illusion | https://ansimuz.itch.io/sunnyland-fort-of-illusion |

The SunnyLand pack is listed on itch.io as **Creative Commons Zero v1.0
Universal (CC0)**. The Fort of Illusion pack is published under ansimuz's usual
free terms: personal and commercial use, modification and redistribution are
all permitted, and credit is appreciated rather than required. Credit is given
here regardless, because the art is most of what this game looks like.

`dirt.png`, `top_tiles.png` and `wooden_sign.png` sit loose in
`public/assets/`; they belong to the same packs or are derived from them.

## Audio

`public/assets/sunnyland-woods/sounds/` ships with the SunnyLand pack. The
sound effects (`jump`, `item`, `hurt`, `enemy-death`) fall under the pack
licence above.

**The background music does not, necessarily.** `the_valley.m4a` / `.ogg` — the
track wired up as `bgm` in `js/Config.js` — is credited on the SunnyLand page to
**Pascal Belisle** and is distributed there as a separate download from the art.
The pack's CC0 line is generally read as applying to the graphics, with the
music carved out. **Confirm the music terms directly with the pack page before
shipping this anywhere commercial**, or swap the track for one whose licence is
unambiguous.

## Fonts

`public/fonts/press-start-2p-latin.woff2` and `press-start-2p-latin-ext.woff2`
are **Press Start 2P** by CodeMan38, licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/) — source:
https://fonts.google.com/specimen/Press+Start+2P

The font is vendored rather than loaded from `fonts.googleapis.com` on purpose.
The hosted stylesheet makes every visitor's browser contact Google and hand over
its IP address, which is a third-party transfer this project's deployment does
not want to make. Serving the woff2 from our own origin keeps the request count
lower *and* keeps the privacy claim on the deploying domain true.

## SVG icons

`public/svgs/` (heart, mic, mute, pause, play, reset, sprite) are part of this
project and fall under `LICENSE`.
