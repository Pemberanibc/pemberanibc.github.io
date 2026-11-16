# Pemberani Tournament Edisi 3.0 — Live Group Draw

A working draw application for the ceremony: the organiser presses the buttons, a cryptographic random
generator decides, and the big screen animates exactly what was decided.

| Address | What it is |
| --- | --- |
| `draw/` | The draw arena. With the control dock on one laptop, or as the audience screen in presentation mode |
| `draw/?present` | Audience screen: no organiser controls |
| `draw/control.html` | Organiser control panel |
| `draw/?cloud` | Audience screen on a **different device**, following the organiser over the internet |

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

## Conducting the draw

Before the ceremony: open the control panel, press **Reset draw** if a rehearsal was run, and check the sound.

1. Connect the projector or TV to the laptop as an **extended** display.
2. Open `draw/control.html` and press **Fullscreen presentation**. Drag the new window to the big screen and click
   its **Fullscreen** button (that click also switches the sound on).
3. **Start draw** — opening sting, the wheel appears.
4. **Draw next pair** — the wheel spins about 7 seconds and stops on the pair. The name is revealed.
5. **Reveal group** — the A/B selector runs and lands on a group; the pair moves onto that board.
   If one group is already full the pair goes to the other one automatically, and the screen says so.
6. **Next draw** — clears the stage. Repeat 4 to 6 for all 12 pairs.
7. After the twelfth pair the final reveal starts by itself. **View final results** switches between the
   final screen and the arena.

The gold button is always the next step, and the **space bar** presses it (also on the arena page, so a
presenter clicker works). The control panel shows a pair only after the wheel has stopped.

Other controls: **Pause / Resume animation** (freezes a spin or the A/B selector), **Undo last draw** (the pair
returns to the wheel and leaves its group; asks first), **Reset draw** (asks first), **Sound on/off**.
Buttons that are not allowed at that moment are disabled: the next pair cannot be drawn until the previous one has a group.

**One laptop, one screen:** open `draw/` and use the dock at the bottom. **Presentation mode** (or the `P` key)
hides the dock; the space bar keeps working. `F` toggles fullscreen.

Progress is saved in the browser after every step. If the page is refreshed or the browser is reopened, the
draw continues where it was, even in the middle of a spin.

## Second screen

- **Second window on the same laptop (recommended):** nothing to set up. Both windows share one saved state in
  the browser and update each other instantly. No internet needed. They must be the same browser and profile.
- **A different device (smart TV browser, another laptop, phones in the hall):** in the control panel, section
  *Audience screen*, sign in with a scorer account. The panel then publishes each step to the tournament's
  Firebase Realtime Database at `pt3/draw`, and any device that opens `draw/?cloud` follows it read-only.
  This needs internet on both devices and the `pt3` rule from the main README (public read, admin write).
  Without sign-in nothing is sent anywhere, and the `?cloud` screen says so instead of pretending to be in sync.
  Note: **Committee tools → reset** in the scorer console clears everything under `pt3`, including the published
  copy of the draw. The laptop keeps its own copy and publishes it again at the next step.

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
control panel with the audience screen open, every button, refresh during a spin, exports, fullscreen,
presentation mode, 4K, phone and reduced-motion layouts.
