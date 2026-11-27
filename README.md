# CFOP Trainer

A small web app for speedcubers working on CFOP. Manage your F2L, OLL and PLL
algorithms, record solve times per case, and drill recognition with a random
trainer that surfaces the cases you have practised least recently.

Live: https://cfop.app

The interface is available in English and Japanese (switch it in Settings).
Guests save to the browser's `localStorage` and can work offline. With Supabase
configured, email/password accounts save settings, algorithms and times to
PostgreSQL and can use them across devices. Signed-in accounts require a
connection to save. See [account setup](docs/accounts.md) for deployment steps.
The app is installable as a PWA and includes a Capacitor iOS app.
See [iOS development and release](docs/ios.md) for simulator and device setup.

## Features

- F2L, OLL and PLL case lists with a 3D / last-layer view, best time, ao5, and
  last-practised date per case
- Multiple algorithms per case with one starred as the active one, with AUF
  handled separately
- Random trainer with per-case selection (named sets of cases can be saved
  and restored), spacebar / tap timing, and a staleness-weighted draw
- Practice of a single algorithm from its case page, with the same options as
  random practice, timed into that algorithm's times
- Two practice modes, no setup and with setup, chosen when practice starts
- F2L with setup: shows a short setup scramble so you can bring your
  own cube into the case before timing. The setup is drawn from a pool of
  alternative routes to the case, so it does not spell out the solution; a
  random U turn can be added on top
- OLL and PLL with setup: apply the inverse of the starred algorithm
  (or first preset) to a fully solved cube before timing. Trainer mode
  and random U-layer orientation settings are shared across F2L, OLL and PLL
- AUF display can rotate the preview or include the AUF in the solution,
  chosen for each list while selecting its cases and applied consistently to
  that list's cards, case pages, 2D / 3D previews and practice
- All 57 OLL cases with 285 preset algorithms from [SpeedCubeDB](https://www.speedcubedb.com/a/3x3/OLL), grouped by shape
- GAN Gen4 smart cubes over Web Bluetooth (Chrome and Edge) and in the iOS app,
  connected from the practice options: with setup, the setup is followed turn
  by turn; with no setup, the case is solved on a virtual cube that follows
  the cube. The timer starts with the first turn and stops when the case is
  solved, timed on the cube's clock
- CFOP solves from random-state scrambles (two-phase search in a worker),
  timed with the hold timer or a smart cube; with a cube, the scramble is
  guided turn by turn and each solve is split into cross, four F2L pairs, OLL
  and PLL with time, moves and TPS. Holding colours per kind of solve, WCA
  inspection with automatic +2 / DNF, penalties set by hand, best / ao5 /
  ao12, and solves saved to the account when signed in. See [solves](docs/solve.md)

## Development

```bash
npm ci
npm run dev       # http://localhost:3000
npm run check     # lint + typecheck + build
# Verify OLL presets, AUF orientations and F2L preservation (Node 24):
node --import ./scripts/register-src-alias.mjs scripts/verify-oll.mts
# Verify OLL/PLL setup and solution pairs in both AUF display modes:
node --import ./scripts/register-src-alias.mjs scripts/verify-last-layer-setup.mts
# Verify migration from per-practice preferences to shared settings:
node --import ./scripts/register-src-alias.mjs scripts/verify-practice-settings.mts
# Verify the smart cube model, setup guide and trainer logic (against cubing.js):
node --import ./scripts/register-src-alias.mjs scripts/verify-smart-cube.mts
# Verify scrambles, ao5 / ao12, CFOP stage splits and the smart cube scramble guide:
node --import ./scripts/register-src-alias.mjs scripts/verify-solve.mts
```

Built with Next.js (App Router), React, TypeScript, Tailwind CSS, and
[cubing.js](https://js.cubing.net/). See `AGENTS.md` for a map of the
codebase and the conventions used.
