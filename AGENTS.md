# CFOP Trainer

Web app for managing CFOP F2L and PLL algorithms, recording solve times, and
training recognition with random cases. Pure client-side: all user data lives
in `localStorage`, there is no backend and no API route. Deployed on Vercel
from `main` (https://pll-manager.vercel.app), installable as a PWA.

Stack: Next.js (App Router, every route prerendered at build time), React 19,
TypeScript strict, Tailwind CSS v4, cubing.js for 3D / LL visualisation.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm ci                # install (lockfile is the source of truth)
npm run dev           # http://localhost:3000
npm run lint          # eslint (next/core-web-vitals + typescript)
npm run typecheck     # tsc --noEmit
npm run build         # next build, prerenders every route
npm run check         # lint + typecheck + build, same as CI
```

There is no test suite. Before finishing a change, run `npm run check` and
verify the affected screen in the browser; `npm run build` is what Vercel runs.
CI (`.github/workflows/ci.yml`) runs the same three steps on every PR.

## Layout

- `src/app/` — routes. `/` (home), `/pll`, `/pll/[id]`, `/f2l`, `/f2l/[id]`,
  `/random`, `manifest.ts`. Detail routes use `generateStaticParams`.
- `src/components/` — UI. Almost everything is a `'use client'` component.
  PLL and F2L have parallel component sets (`PllGrid` / `F2LGrid`,
  `RandomTrainer` / `F2LRandomTrainer`, ...); keep them in step when changing
  shared behaviour.
- `src/hooks/` — React hooks that wrap a store (`useAlgorithms`,
  `useF2LAlgorithms`, `use*RandomSelection`, `use*RandomSolves`, settings
  toggles) plus `useSpacebar` and `useMounted`.
- `src/lib/` — stores and pure helpers. Stores follow one pattern: a module
  with `getSnapshot` / `getServerSnapshot` / `subscribe` / `mutate`, a cached
  value, and a `localStorage` key prefixed `pll-app:` with a `:v1` suffix.
  Hooks consume them via `useSyncExternalStore`. Pure helpers (`invert-alg`,
  `f2l-auf`, `stale-weighted-pick`, `stats`) have no React dependency.
- `src/data/` — static case definitions and preset algorithms.
  `f2l-definitions.ts` case numbering and orientation follow speedcubedb.
- `src/types/` — shared types, including the `PllId` / `F2LId` unions and
  their `*_IDS` arrays.
- `public/sw.js` — hand-written service worker (network-first navigations,
  stale-while-revalidate assets). Bump `CACHE_NAME` if you change what it caches.

## Conventions

- Hydration: stores return an empty server snapshot, so anything that depends
  on `localStorage` renders a neutral state on the server. Use `useMounted()`
  when markup must differ between SSR and client; do not add
  `useEffect(() => setState(...), [])`, the lint config rejects it
  (`react-hooks/set-state-in-effect`).
- Persisted data is versioned by key (`...:v1`). When changing a record shape,
  add a migration in the store's read path (see `normalizeRecord` in
  `lib/storage.ts`) rather than breaking existing users' data.
- Algorithms are stored as move strings in standard notation; the AUF is kept
  as a separate `U0 | U | U2 | U'` field and joined for display with
  `prefixAuf`.
- Styling is Tailwind utility classes inline, with `dark:` variants for every
  colour. No CSS modules.
- 3D players (`F2L3DPlayer`, `Pll3DPlayer`) each hold a WebGL context. Mount
  them lazily / on demand in lists to avoid exhausting contexts.
- Commits: Conventional Commits with a scope (`feat(f2l): ...`,
  `fix(pll): ...`, `chore: ...`). Explain the why in the body.
