# Solves from a scramble

The top page groups its entries: Algorithms (F2L, OLL, PLL) and Solve. Solve
has one entry, CFOP (`/solve/cfop`); another kind of solve (F2L only, the last
layer) is one more entry in `src/data/home-entries.ts` and a page under
`/solve/`.

## CFOP

The page shows a random-state scramble, the timer, the latest solve and this
device's records.

- Scramble: face turns, turned in the user's holding (yellow top and blue
  front by default, from the smart cube settings), with the scrambled cube
  unfolded beside it. The next scramble shows as soon as a solve is recorded;
  the refresh button skips one.
- Without a smart cube: the practice hold timer (`useHoldTimer`). Hold for
  0.3 s (red), let go to start (green), press anywhere or Space to stop,
  Escape to abandon. Everything but the timer, the app header included,
  steps aside while held or running.
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

## Stages

`lib/solve/cfop-split.ts` reads the stages from the state after every turn:
Cross, F2L1 to F2L4 (cross and that many pairs), OLL (the top face one
colour) and PLL (solved, the final AUF included). Each stage ends at the first
turn after which the cube is at least that far. Stages finished on the same
turn (an X-cross, an OLL or PLL skip) take no time and no moves and are marked
as skipped. Every turn between two stage ends counts for the later one, so
turns that break and remake a pair count where they happen; rotations of the
whole cube are not turns.

The cross is colour neutral: the face whose F2L was done first, with the
bottom face of the holding winning a tie. A white-cross solver gets white; a
colour-neutral one gets the colour they used.

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

`lib/solve-store.ts` keeps solves in IndexedDB (`cfop-solves`, store
`solves`, indexed by event and time) on this device only, like the smart
cube's solves: nothing enters the account document. A record has the time,
scramble, date and how it was timed; a cube solve also its turns (ms from the
first), holding, move count and where each stage ended. The stats are the best
single, the latest ao5 and ao12 (the best and the worst dropped, as the WCA
does) and the best of each. Undo on the latest solve and Delete in the list
remove a record.

## Checks

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-solve.mts
```

Scrambles (face turns, no face twice in a row, 15-21 moves, reach the drawn
state, solve back), routes between states, ao5 / ao12, stage ends on built
solves (skips, colour neutral, stopped early) and the guide's re-routing.
