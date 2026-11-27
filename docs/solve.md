# Solves from a scramble

The top page groups its entries: Algorithms (F2L, OLL, PLL) and Solve. Solve
has one entry, CFOP (`/solve/cfop`); another kind of solve (F2L only, the last
layer) is one more entry in `src/data/home-entries.ts` and a page under
`/solve/`.

## CFOP

The page shows a random-state scramble, the timer, the latest solve and the
records (this device's, or the account's when signed in).

- Holding: each kind of solve has its own top and front colours (CFOP now;
  F2L and last-layer solves will have theirs), yellow top and blue front
  until chosen (the smart cube's holding, if set). They are set under the
  scramble ("Holding: … · inspection on" opens them); a front colour must sit
  beside the top one, so the top colour and its opposite are disabled. The
  scramble is turned holding the cube this way, as the app's practice setups
  are, rather than white top and green front as at a WCA competition: the
  solver keeps the cube as they solve and never rotates it before starting.
  The unfolded cube beside the scramble, the smart cube guide and the stages
  all follow the holding.
- Inspection (on by default, beside the holding): as the WCA runs it. Over
  15 s before starting adds +2, over 17 s makes the solve a DNF; 8 and 12
  seconds are shown in small type under the count. Without a smart cube a tap
  (or Space) starts the inspection and the hold timer then starts the solve;
  with one, the inspection starts when the cube reaches the scrambled state
  and ends with its first turn. It is timed on the screen's clock, as its
  countdown shows it. Escape ends an inspection.
- Without a smart cube: the practice hold timer (`useHoldTimer`). Hold for
  0.3 s (red), let go to start (green), press anywhere or Space to stop,
  Escape to abandon. Everything but the timer, the app header included,
  steps aside while inspecting, held or running.
- With a smart cube: the scramble is guided turn by turn, as in practice with
  setup. Turns done dim, the next is underlined, wrong turns show the turns
  that take them back. From three wrong turns in a row, a resync that does not
  fit the guide, or a cube that is not solved when the scramble appears, the
  route to the scrambled state is worked out again from where the cube is (the
  shorter of the solver's route and taking the wrong turns back). The cube in
  the scrambled state is ready; its first turn starts the timer and solving it
  stops it, on the cube's clock. Space stops by hand (recorded as an
  on-screen time) and Escape abandons the attempt.
- Results: time; with a cube also moves and TPS (moves counted as in practice:
  turns of one face in a row merged, a slice two moves) and each stage.
- +2 and DNF: buttons on the latest solve and on each solve in the list set or
  take off a penalty (one at a time), whether the inspection set it or not.
  A +2 shows as "8.90+" (two seconds added), a DNF as "DNF" with the measured
  time beside it. Cube data stays as it was.

## Stages

`lib/solve/cfop-split.ts` reads the stages from the state after every turn:
Cross, F2L1 to F2L4 (cross and that many pairs), OLL (the top face one
colour) and PLL (solved, the final AUF included). Each stage ends at the first
turn after which the cube is at least that far. Stages finished on the same
turn (an X-cross, an OLL or PLL skip) take no time and no moves and are marked
as skipped. Every turn between two stage ends counts for the later one, so
turns that break and remake a pair count where they happen; rotations of the
whole cube are not turns.

The cross is the bottom face of the solve's holding (the face opposite the
top colour); OLL is its top face. Records keep the holding they were solved
in (records from before keep their smart cube holding and stored stages).

## Scrambles

`lib/solver/two-phase.ts` is Kociemba's two-phase algorithm, written for this
app on the smart cube's cubie model (no library). A scramble draws a state
uniformly from all legal cube states (`randomCubeState`, from
`crypto.getRandomValues`), solves it within 21 moves and inverts the solution,
which is how the WCA's scramble programs make random-state scrambles.

The tables take about 0.25 s to build and a scramble about 15 ms (Node on a
Mac); both run in a module worker (`lib/solve/scramble-worker.ts`), with one
scramble made ahead. Without a worker the same code runs on the page.
`routeBetween` uses the same search for the smart cube's routes.

## Records

A record has the time as measured, scramble, date, how it was timed, any
penalty and the inspection; a cube solve also its turns (ms from the first),
holding, move count and where each stage ended. The stats count +2 with its
two seconds and DNF as slower than any time: the best single leaves DNFs out,
and ao5 / ao12 drop the best and the worst (a DNF is the worst), so two DNFs
make the average a DNF. The best ao5 and ao12 are shown too. Undo on the
latest solve and Delete in the list remove a record.

Where they are kept (`lib/solve/solve-library.ts`, wired in
`lib/solve-store.ts`):

- A guest's solves stay in IndexedDB (`cfop-solves`, store `solves`) on the
  device.
- A signed-in user's solves are in the account: one row each in the
  `solves` table, read directly (own rows only) and written through
  `save_solves` / `delete_solves`
  (`supabase/migrations/20261126000000_solves.sql`). They are outside the
  account document, whose allow-list older app versions and the server
  enforce, so older versions never see them. Every change (a new solve, a
  penalty, a delete) is saved at once and kept in an outbox in localStorage
  (`cfop:solve-outbox:v1`) until the server has it, so a solve timed offline
  is saved later. Saving shows nothing: a failed save is tried again by
  itself (after 2 s, then longer, up to a minute) and when back online.
- Signing in offers to bring the device's solves into the account, once per
  account and device (`cfop:solve-import:v1`). Choosing to import device data
  at the first sign-in brings them in without asking. Ids are kept, so an
  import never doubles a solve; the device keeps its copies, and solves the
  account has had (including ones deleted there) are not brought back.
- When the server has no `solves` table yet (the migration is not applied), a
  signed-in user's solves stay on the device as before, and the records say
  so.

Settings (holding and inspection per kind) are in the practice settings
(`solves` in `pll-app:practice-settings:v1`), so they follow the account like
the other settings. Older versions drop the field when they save the
settings; the solve settings then go back to their defaults.

## Checks

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-solve.mts
```

Scrambles (face turns, no face twice in a row, 15-21 moves, reach the drawn
state, solve back), routes between states, +2 / DNF in the best and ao5 /
ao12, the inspection's boundaries, all 24 holdings and stage ends in each
(skips, stopped early), the guide's re-routing, records from older and newer
versions, and the move between device and account (offline outbox, failed
saves, the import offer, a server without the table) with in-memory
backends. The migration was checked in PGlite with stand-ins for Supabase's
auth schema and roles.
