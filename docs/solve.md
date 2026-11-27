# Solves from a scramble

The top page groups its entries: Algorithms (F2L, OLL, PLL) and Solve. Solve
has one entry, CFOP (`/solve/cfop`); another kind of solve (the cross, F2L or
the last layer on its own, see Modes) is one more entry in
`src/data/home-entries.ts` and a page under `/solve/`.

## CFOP

A solve goes through three screens, one at a time, on the same page
(`components/SolveScreens.tsx`, wired by `components/CfopSolve.tsx`; which
screen is on and what the timer shows are worked out in
`lib/solve/solve-screen.ts`). They are built to serve every kind of solve.

- Scramble: the scramble (a step smaller than before), a 3D cube and, at the
  top, the smart cube's button (connect, or its battery once connected), a
  new scramble and a gear for the solve settings (scramble orientation and
  inspection). Nothing else. Without a smart cube the 3D cube is the
  scrambled cube, held in the scramble orientation; with one, it is the cube
  as it is, turning the next move part of the way (see the guide below). The
  records are behind an icon in the app header (as the list pages keep their
  controls there); it opens them over the page (`SolveRecordsButton`).
- Timer: the timer alone, the app header and footer stepped aside. With a
  smart cube it comes by itself once the cube is in the scrambled state: the
  inspection counts up (when on), or 0.00 waits; the first turn starts the
  timer and solving the cube stops it, on the cube's clock. The cube shows
  small under the timer, the cube as it is with each turn played, beside a
  quiet DNF button that ends the solve as a DNF (before the first turn with
  no time). A press on the screen or Space stops it by hand (recorded as an
  on-screen time); Escape abandons it. Without a cube, a press held on the
  scramble screen brings it up: 0.00 red while held too briefly, green once
  letting go starts the solve (0.3 s, `useHoldTimer`), the timer running in
  the plain colour after; let go too soon and it is the scramble screen
  again. A press anywhere or Space stops it; Escape abandons it. With
  inspection on, a tap (or Space) on the scramble screen starts the
  inspection on the timer screen first, as a WCA judge starts it when the
  cube is uncovered; the press is held from there, 0.00 showing its colour
  with the count going on under it. Escape ends an inspection.
- Result: the time where the timer was (with its penalty), under it moves,
  TPS, inspection and the cross colour read (a dash where there is none),
  the scramble in small type, Retry and Next. Retry is the same scramble
  again (back to the scramble screen; with a cube, guided from where the cube
  is); Next, or Space, is a new one. +2, DNF and Undo sit quietly in the
  corner; Undo takes the solve back and keeps the scramble, as Retry does.
  With a cube, each stage follows (see Stages). The cube is idle here:
  turning it starts nothing.

- Scramble orientation: each kind of solve has its own (CFOP now; F2L and
  last-layer solves will have theirs), set in the solve settings: the top
  and front colours the cube is held with to turn the scramble, white top
  and green front until chosen, as at a WCA competition. A front colour must
  sit beside the top one, so the top colour and its opposite are disabled.
  The scramble screen's cube, the smart cube guide and its 3D cube follow
  it. The practice's smart cube holding (yellow top, blue front) is another
  setting and plays no part.
- Cross colour: read from each solve (colour neutral, see Stages), not
  set. Solvers, the better ones especially, often start from whichever
  cross is easiest after the scramble, and the way a scramble is held says
  nothing about it. One version had it as a setting; see Records.
- Inspection (on by default, in the same settings): as the WCA runs it,
  counting up. Over 15 s before starting adds +2, over 17 s makes the solve
  a DNF; 8 and 12 seconds are called in small type under the count. It is
  timed on the screen's clock, as its count shows it. How to start without
  a cube is in the setting's (i).
- With a smart cube: the scramble is guided turn by turn, as in practice with
  setup. Turns done dim, the next is underlined, wrong turns show the turns
  that take them back, and the 3D cube turns the next move (or the one that
  takes a wrong turn back) part of the way over and over, and plays each turn
  made (see smart-cube.md). From three wrong turns in a row, a resync that
  does not fit the guide, or a cube that is not solved when the scramble
  appears, the route to the scrambled state is worked out again from where
  the cube is (the shorter of the solver's route and taking the wrong turns
  back).
- Moves and TPS (cube solves): moves counted as in practice (turns of one
  face in a row merged, a slice one move), TPS over the whole time.
- +2 and DNF: buttons on the result and on each solve in the records set or
  take off a penalty (one at a time), whether the inspection set it or not.
  A +2 shows as "8.90+" (two seconds added), a DNF as "DNF" with the measured
  time under it. Cube data stays as it was.

## Stages

`lib/solve/cfop-split.ts` reads the stages from the state after every turn:
Cross, F2L1 to F2L4 (cross and that many pairs), OLL (the top face one
colour) and PLL (solved, the final AUF included). Each stage ends at the first
turn after which the cube is at least that far. A stage's time is from the end
of the stage before to its own end: recognition up to its first turn, then
execution (the cross starts the timer, so it has no recognition). Its TPS is
over the execution, as practice counts it. The result and the records show
each stage's time, then in small type recognition, execution, moves and TPS,
and its moves. Stages finished on the same
turn (an X-cross, an OLL or PLL skip) take no time and no moves and are marked
as skipped. Every turn between two stage ends counts for the later one, so
turns that break and remake a pair count where they happen; rotations of the
whole cube are not turns. Each stage's turns are read as moves the way
practice reads them (slices included, see Recorded solves in
`docs/smart-cube.md`), each stage from the frame the one before left; totals
are read again from the turns, so solves recorded before slices were read
show them too.

The cross may be of any colour. The solve is read as CFOP on each of the
six faces, and the face it was built on is the one it stood furthest along
on over the whole solve: its level (0 no cross, 1 the cross, 2-5 the cross
and 1-4 pairs, 6 the last layer one colour, 7 solved) after every turn,
added up (`crossFace`). The face built on keeps its cross, its pairs and
then its last layer for most of the solve; a cross of another colour made
along the way lasts a few turns, and another face reaches its two layers
only in the last turns, with the whole cube nearly solved. So a cross
built, broken and built again, an X-cross, an OLL or PLL skip and a stray
cross of another colour made first all go to the face built on. Faces that
went equally far go to the one whose two layers were done first, then
three pairs, and so on down to the cross; then to the bottom of the
scramble orientation (only a solve decided in one turn gets that far).

Taking the face whose two layers were done first, as an earlier version
did, fails when the last layer is skipped: when the last pair ends with,
say, R', one turn before the end the cube is one R from solved, so the left
face's two layers are done a turn before the cross face's. On route-built
solves with the last layer skipped it took the wrong colour every time;
the sum reads all of them right, as it does every other kind tried.

OLL is the face opposite the cross. The Cross row shows the colour read.
Moves are written as the cube is held to solve: the scramble orientation
turned over by the fewest whole-cube rotations to put the cross colour at
the bottom (`turnedDown` in `lib/smart-cube/holding.ts`): none when it is
there already, x2 from the top (white top, green front with a white cross
becomes yellow top, blue front), x' from the front, x from the back, z from
the right and z' from the left. The cube does not report rotations, so a
rotation made while solving (a y before a pair) is not followed; the moves
after it are written as if it had not been made, as before.

Records keep the cross colour read (`crossColour`), the scramble
orientation (`scrambleHolding`), the holding they were solved in
(`holding`, which older versions read their turns in) and where each stage
ended (`split`, on the cross colour's face, which older versions show).
Every record is read again on display: replayed from the scrambled state
(the scramble turned in the scramble orientation, or in records from
before it was kept, in their one holding), the colour read as above and
moves written turned over to it. So records from before (stages on the
bottom of their one holding) and from the version with a cross colour
setting (stages on the colour set) read as solved. A record whose turns
do not replay to its stored stages (the cube resynced to another state
mid-solve) keeps them, as does one from the first version whose scramble
cannot be read. Nothing is written back.

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
cross colour, scramble orientation, holding, move count and where each
stage ended. Records are kept whole (the `record` column of the `solves`
table is the record as it is), and every version keeps fields it does not
know when it saves one again (a penalty), so new fields need no migration.
The stats count +2 with its two seconds and DNF as slower than any time: the best single leaves DNFs out,
and ao5 / ao12 drop the best and the worst (a DNF is the worst), so two DNFs
make the average a DNF. The best ao5 and ao12 are shown too. Undo on the
result and Delete in the list remove a record.

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

Settings (scramble orientation and inspection per kind) are in the practice
settings (`solves` in `pll-app:practice-settings:v1`), so they follow the
account like the other settings. The scramble orientation is kept as `top`
and `front`, which older versions read as their one holding for the
scramble and the solve; a holding they saved is read here as the scramble
orientation. The version with a cross colour setting kept it as `cross`
beside them: it is not read, and is left out when the settings are saved
(that version then reads white). Versions older still drop `solves`
altogether; the solve settings then go back to their defaults.

## Checks

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-solve.mts
```

Scrambles (face turns, no face twice in a row, 15-21 moves, reach the drawn
state, solve back), routes between states, +2 / DNF in the best and ao5 /
ao12, the inspection's boundaries (counting up), the three screens and what
the timer shows on the way (holds without a cube, with and without
inspection, the cube ready), each stage's recognition and execution, the turn over to the cross colour from
all 24 holdings, the cross colour read and stage ends for every scramble
orientation with every cross colour, in every colour an X-cross, a cross
broken and built again, OLL, PLL and last-layer skips, a stray cross of
another colour first and solves routed from random scrambles, the 27
November record and records with a cross colour set read again, older
records that do not replay (stopped early), the guide's re-routing, records from older and newer
versions, and the move between device and account (offline outbox, failed
saves, the import offer, a server without the table) with in-memory
backends. The migration was checked in PGlite with stand-ins for Supabase's
auth schema and roles.

## Modes

Besides CFOP, the cross, F2L and the last layer can each be solved on their
own. Each goes as a CFOP solve does: the scramble makes the cube as it would
be just before that part, and the solve ends when that part is done. The
library is in place; the pages are not yet.

| Mode | Scramble leaves | A smart cube stops at | Stages |
| --- | --- | --- | --- |
| `cfop` | a random state | solved | Cross, F2L1-4, OLL, PLL |
| `cross` | a random state | a cross of any colour | Cross |
| `f2l` | the cross solved, the rest random | the cross and its four pairs | F2L1-4 |
| `ll` | the first two layers solved, the last layer random | solved, the last AUF included | OLL, PLL |

### Definitions

`lib/solve/solve-modes.ts` (type imports only, so the top page can read it
without the solver): `SOLVE_MODES` is `['cfop', 'cross', 'f2l', 'll']` and
`SOLVE_MODE[mode]` has `event` (the records' kind, the same as the mode),
`slug` and `href` (`/solve/cfop`, `/solve/cross`, `/solve/f2l`,
`/solve/ll`), `label` as the top page writes it (CFOP, Cross, F2L, LL),
`name` and `description` as message keys (`solve.mode.<mode>.name`,
`.description`, both locales), `stages` (a run of `CFOP_STAGES`),
`solvedBefore`, `goal` and `setsCross` (f2l and ll leave a cross of a set
colour, white unless chosen: `DEFAULT_MODE_CROSS`). `modeOfSlug(slug)`
reads a page's slug. `SOLVE_MODE_ENTRIES` in `src/data/home-entries.ts` has
an entry per mode in the top page's shape, for the solve group once the
pages exist; the cross's drawing (`art: 'cross'`) is not drawn yet, and the
last layer uses PLL's (the top layer lit). Settings are per mode as they
are per kind: `solveSettingsOf(settings, mode)` and `setSolveSettings(mode,
...)`.

### Scrambles

`lib/solve/mode-scramble.ts` draws each mode's state uniformly and turns its
two-phase solution around, as CFOP's are made:

- cross: any legal state (as CFOP), except one with a cross of any colour
  solved or one face turn away (about 1 in 2000).
- f2l: the cross on one face solved, every other piece (the pairs and the
  last layer) anywhere and any way round.
- ll: the first two layers around that cross solved; the last layer's four
  corners and four edges anywhere in it and any way round, OLL, PLL and the
  AUF in one (62208 states), never solved or only an AUF away.

Every state is legal: twists and flips add up, and the corner and edge
permutations have the same parity (two free edges swap when they do not,
which keeps the draw uniform). No state reaches its mode's goal within one
face turn (`goalWithinOneTurn`), so a smart cube solve never ends on the
turn that starts it.

The cross is left on a face as the scramble is written: turned holding the
cube in the scramble orientation, it ends on the colour at that face. For a
white cross from white top, green front that is U; from yellow top it is D.
`scrambleCrossFace(scrambleHolding, cross)` gives the face; the scramble is
made for it, so a page makes a new one when the scramble orientation or the
cross colour changes.

Scrambles are face turns, never one face twice in a row, at most 21 moves
(in the checks: cross 19-21, f2l 18-21, ll 11-18, about 15 on average). For the last layer the search
looks for up to 60 ms for a shorter solution than the first (about 18);
for the others a longer look saves a move at most, so they stop at the
first within 21 as CFOP does. In Node on a Mac the tables take about 0.25 s
and then a scramble takes about 25 ms (cross, as CFOP; at most about 0.5 s),
6 ms (f2l) and 60 ms (ll). The first scramble shown waits for the tables;
later ones are made ahead and shown at once.

They run in the scramble worker as CFOP's do. `useScramble({ mode, face })`
(CFOP without an argument) gives `{ scramble, failed, next }`; underneath,
`scrambleFeed({ mode, face })` from `lib/solve/scramble-client.ts` is one
feed per mode and face with one scramble made ahead, for
`useSyncExternalStore`. `generateModeScramble(mode, face)` is the same off
the worker.

### When a solve ends

`modeGoal(mode, cross)` (`lib/solve/solve-goal.ts`) is what stops the timer:
solved for CFOP and the last layer, any cross for the cross, and for F2L the
first two layers around the cross of `cross` (the colour the scramble left;
white unless given). A smart cube session takes it:
`startCubeSolve(scramble, frame, state, modeGoal(mode, cross))`; without
it the session stops solved as before. `restartCubeSolve(session, state)`
guides the same scramble again from where the cube is, keeping the goal
(`useCubeSolve` calls `startCubeSolve` with three arguments to restart; a
mode page passes the goal or uses this).

The cross ends at the first turn after which a cross of any colour is
solved, colour neutral. A cross made on the way to another can end it
early: a cross shares one edge with each of its four neighbours, so once
that edge is in, the neighbour's cross needs three more edges home. In
solves of random-state scrambles that built the cross one edge at a time
by the shortest route (9 moves on average), a cross of another colour came
first in about 1 in 600 (50 in 30000, all but 4 of a neighbouring colour);
along the shortest route to the whole cross (6 moves), about 1 in 1500.
Waiting to see whether the solver goes on turning before ending would
catch those, but would not end a cross that flows straight into the first
pair (the next turn, an R say, breaks it), which is how many solvers end
their cross; it would also hold back every result. So the first cross ends
the solve, and the rare early end is the solve to undo. Taking only some
colours (one, or two opposite ones, which share no edge) would leave almost
none; the goal could take a set of faces if that is wanted.

### Stages, recognition and execution

`splitMode(mode, start, states, crossFace)` reads where each CFOP stage
ended, up to the mode's last: `ends` are `[cross]` for the cross,
`[-1, f2l1..f2l4]` for F2L and `[-1 x 5, oll, pll]` for the last layer (-1:
done before the first turn); for CFOP the same as `splitCfop` on that face.

Recognition and execution are cfop-split.ts's (see Stages): each
`StageResult` has `ms`, `recognitionMs` (from the end of the stage before
to the stage's first turn), `executionMs` (from that turn to the one that
finished it), `tps` (over the execution), `moves`, `skipped` and
`notation`. For a mode the stages before its first were done before the
first turn, so its first stage starts the timer and has no recognition, as
the cross has in CFOP: that look is the inspection (`inspectionMs`). A
skipped stage has neither, and the next stage's recognition takes in the
look that found the skip. `modeStages(mode, turns, reading)` keeps the
mode's stages of `cfopStages`.

### Records

A mode's record is a SolveRecord with `event` set to the mode, so each
mode's solves are their own list (`getSolvesSnapshot(mode)`), with their
own best, ao5 and ao12 (`solveStats` over that list), +2 and DNF
(`withPenalty`), inspection and sync, in the device's IndexedDB and the
account's `solves` table as CFOP's are. The kinds fit the table's `event`
rule (lower case letters, digits and hyphens). Older versions ask for
`cfop` only and do not read other kinds, so they never see these.

- `modeHandSolve(mode, scramble, ms, { penalty, inspectionMs })`: timed by
  hand (for CFOP the same as `handSolve`).
- `modeCubeSolve(mode, { scramble, scrambleHolding, cross, start, turns,
  penalty, inspectionMs })`: timed by the cube, with the session's
  `target` as `start` and its turns up to the goal (for CFOP the same as
  `cubeSolve`, which reads the cross colour from the solve). `cross` is the colour the
  scramble left (f2l, ll; white unless given); the cross alone keeps the
  colour it made (the bottom of the scramble orientation first when two
  were made at once). The record keeps `crossColour`, `scrambleHolding`,
  `holding` (the scramble orientation turned over to put the cross at the
  bottom), `turns`, `moveCount` and `split`.
- `readModeRecord(record)`: where its stages ended and the frame its turns
  are read in (`{ split, frame }`), null for a hand solve. A CFOP record as
  `readRecord` reads it (again from its turns), the other kinds as stored.
  `readRecord` itself reads every record as CFOP, so a mode's records go
  through this.
- `modeRecordStages(record)`: its mode's stages (`StageResult`s), null for
  a hand solve.
- `modeMoveCount(record)`: its moves, slices once (for CFOP,
  `recordMoveCount`).

These take a record of any kind, so one result screen and one records list
can serve every mode.

Signing in offers the device's solves of every kind, from any kind's page,
and importing (or the import chosen at the first sign-in) brings them all:
the decision is per account and device, not per kind. A kind with device
solves whose account solves are not loaded yet is read from the account
first, so a copy the account has is never written over. Leaving the page
asks first while changes of any kind are not saved (`library.unsaved()`).

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-solve-modes.mts
```

The modes' definitions and names, each mode's states (legal, the cross or
the two layers solved and the rest random, never within a turn of the
goal; the last layer's pieces spread evenly, OLL skips about 1 in 216),
scrambles for every mode and face (face turns, no face twice in a row,
lengths, the drawn state reached and solved) and in every scramble
orientation and cross colour (the cross on the colour asked for), the
goals, sessions that stop at each mode's goal (F2L at the fourth pair with
the last layer unsolved, the cross in every colour, an X-cross, a cross of
another colour first), stage ends, recognition and execution (with skips),
records of each kind made and read back (CFOP's through cubeSolve and
readRecord), and records of
several kinds between the device and an account (lists per kind, the offer
and import across kinds, the account's copy kept, unsaved changes).
