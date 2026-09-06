# CFOP Trainer

A small web app for speedcubers working on CFOP. Manage your F2L and PLL
algorithms, record solve times per case, and drill recognition with a random
trainer that surfaces the cases you have practised least recently.

Live: https://pll-manager.vercel.app

The interface is available in English and Japanese (switch it in Settings).
Everything is stored in your browser's `localStorage`; there is no account and
no server. Algorithms can be exported and imported as JSON from the settings
dialog. The app is installable as a PWA and works offline.

## Features

- PLL and F2L case lists with a 3D / last-layer view, best time, ao5, and
  last-practised date per case
- Multiple algorithms per case with one starred as the active one, with AUF
  handled separately
- Random trainer with per-case selection (named sets of cases can be saved
  and restored), spacebar / tap timing, and a staleness-weighted draw
- F2L inverse-setup mode: shows a short setup scramble so you can bring your
  own cube into the case before timing. The setup is drawn from a pool of
  alternative routes to the case, so it does not spell out the solution; a
  random U turn can be added on top

## Development

```bash
npm ci
npm run dev       # http://localhost:3000
npm run check     # lint + typecheck + build
```

Built with Next.js (App Router), React, TypeScript, Tailwind CSS, and
[cubing.js](https://js.cubing.net/). See `AGENTS.md` for a map of the
codebase and the conventions used.
