# Pemberani Tournament Edisi 3.0 — Live Group Draw

A working draw application for the ceremony: the organiser presses the buttons, a cryptographic random
generator decides, and the big screen animates exactly what was decided.

| Address | What it is |
| --- | --- |
| `draw/` | The draw. Everything needed is on this one page: wheel, groups, and the buttons |
| `draw/control.html` | Optional organiser panel (same buttons plus history, exports and online sharing) |
| `draw/?cloud` | Read-only screen on **other devices**, following the organiser over the internet |

Plain HTML, CSS and JavaScript modules, like the rest of this site: no build step, deploys with GitHub Pages as it is.
(React was not used because the repository has no build pipeline; the code is still split into the same parts:
`engine.js` = randomisation and rules, `store.js` = single shared state, `wheel.js`, `sound.js`, `arena.js`,
`control.js`, `results.js`.)

## Run it

It is already part of the site: after this branch is merged, open `https://<your-site>/draw/`.

To run it on the laptop without internet, from the repository folder:

```bash
python3 -m http.server 8791
```

Then open http://localhost:8791/draw/control.html . (Opening the files by double-click does not work; browsers block modules on `file://`.)

## Conducting the draw (on a phone)

Open `draw/` on the phone, held upright. Before the ceremony, press **Reset draw** if a rehearsal was run.

1. **Start draw** — opening sting, the wheel appears. This first tap also switches the sound on.
2. **Draw next pair** — the wheel spins about 7 seconds and stops on the pair. The name is revealed.
3. **Reveal group** — the A/B selector runs and lands on a group. The page scrolls to the group boards so
   everyone sees the pair arrive. If one group is already full the pair goes to the other automatically, and the screen says so.
4. **Next draw** — back to the wheel. Repeat 2 to 4 for all 12 pairs.
5. After the twelfth pair the final reveal starts by itself, with the buttons to download, export as image and print.

The big gold button is always the next step. Under it: **Pause animation** (freezes a spin or the A/B selector;
press again to resume), **Undo last draw** (the pair returns to the wheel and leaves its group; asks first) and
**Reset draw** (asks first). Buttons that are not allowed at that moment are greyed out: the next pair cannot be
drawn until the previous one has a group. **History** (top right) lists every draw with its time.

Sound is always on. On an iPhone, flip the silent switch off and turn the volume up, or nothing will be heard.
To show the draw on a TV, mirror the phone (AirPlay / Smart View / Chromecast) and hold it sideways: the layout
switches to the wide three-column arena.

Progress is saved in the browser after every step. If the page is refreshed or the browser is reopened, the
draw continues where it was, even in the middle of a spin. **Use one phone for the whole draw**: the saved draw
lives in that phone's browser.

## Letting other phones watch

Optional. On the organiser's device open `draw/control.html`, section *Audience screen*, and sign in with a
scorer account. Each step is then published to the tournament's Firebase Realtime Database at `pt3/draw`, and
anyone who opens `draw/?cloud` follows it read-only. This needs internet on both sides and the `pt3` rule from
the main README (public read, admin write). Without sign-in nothing is sent anywhere, and the `?cloud` screen
says so instead of pretending to be in sync. Note: **Committee tools → reset** in the scorer console clears
everything under `pt3`, including the published copy; the organiser's device keeps its own copy and publishes it
again at the next step.

## Results

**Download JSON**, **Download CSV**, **Export as image** (2160 × 2700 PNG) and **Print results** are on the
control panel and on the final screen. All four are generated from the same saved draw. Each history entry has
the time it was allocated.

After the draw, put the groups into `js/config.js` (`GROUPS`, then `DRAW_CONFIRMED = true`) so the match centre
shows them.

## How the randomness works

`engine.js` uses `crypto.getRandomValues` with rejection sampling: each remaining pair is equally likely, and
A or B is a fair 50/50 while both groups have space. Nothing is pre-selected; the result of a step is created at
the moment its button is pressed. The wheel and the A/B selector receive that result and animate towards it —
they cannot choose anything themselves.

## Tests

```bash
node --test draw/tests/engine.test.mjs
```

Rules and randomisation: 500 full draws, uniformity, 6 + 6, automatic assignment, undo, reset, pause, refresh recovery, exports.

```bash
NODE_PATH=$(npm root -g) node draw/tests/e2e.cjs
```

The real pages in Chromium (needs Playwright and the local server above): a complete 12-pair draw driven from the
control panel with the draw screen open, every button, refresh during a spin, exports, and the phone (upright,
small, sideways), 4K and reduced-motion layouts.
