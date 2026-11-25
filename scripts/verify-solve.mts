// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-solve.mts
//
// Solves from a scramble: random-state scrambles (two-phase search), the
// best / ao5 / ao12 figures, where each CFOP stage ends on a smart cube, and
// the guide that leads the cube to the scrambled state (routes worked out
// again from where the cube is).
import assert from 'node:assert/strict';
import { applyFaceTurns, applyTurn, SOLVED, stateEquals, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import type { CubeHolding } from '@/lib/smart-cube/holding';
import { planSetup } from '@/lib/smart-cube/setup-guide';
import {
  cubeSolveResync,
  cubeSolveTurn,
  cubeSolveView,
  needsRoute,
  startCubeSolve,
  withRoute,
  WRONG_TURNS_BEFORE_REROUTE,
  type CubeSolveSession,
} from '@/lib/smart-cube/solve-session';
import { cfopLevel, cfopMoveCount, cfopStages, splitCfop, type TimedTurn } from '@/lib/solve/cfop-split';
import { applyMoves, generateScramble, inverseState, movesInHolding, routeBetween, scrambleState, SCRAMBLE_MAX_MOVES } from '@/lib/solve/scramble';
import { cubeSolve, handSolve } from '@/lib/solve/solve-record';
import { averageOf, bestAverageOf, formatSolveTime, solveStats } from '@/lib/solve/solve-stats';
import { initTwoPhase, isSolvable, randomCubeState, solveTwoPhase } from '@/lib/solver/two-phase';

let checks = 0;
const ok = (condition: boolean, message: string) => { assert.ok(condition, message); checks++; };
const eq = <T,>(actual: T, expected: T, message: string) => { assert.deepEqual(actual, expected, message); checks++; };

/** A repeatable source of numbers in [0, 1) (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The two-phase search and random states
let started = performance.now();
initTwoPhase();
const initMs = performance.now() - started;
ok(stateEquals(applyMoves(SOLVED, solveTwoPhase(SOLVED)!), SOLVED) && solveTwoPhase(SOLVED)!.length === 0, 'a solved cube needs no moves');
for (let i = 0; i < 200; i++) ok(isSolvable(randomCubeState(seeded(i))), `random state ${i} is a legal cube`);
ok(!isSolvable({ ...SOLVED, co: [1, 0, 0, 0, 0, 0, 0, 0] }), 'a twisted corner is not a legal cube');
ok(solveTwoPhase({ ...SOLVED, co: [1, 0, 0, 0, 0, 0, 0, 0] }) === null, 'an illegal state has no solution');
{
  // Every corner orientation and permutation appears; the twist is spread evenly.
  const twists = [0, 0, 0];
  for (let i = 0; i < 3000; i++) twists[randomCubeState(seeded(10_000 + i)).co[0]]++;
  ok(twists.every((n) => n > 850 && n < 1150), `corner twists are uniform: ${twists}`);
}

// --- Scrambles
const FACE_TURN = /^[URFDLB](2|')?$/;
started = performance.now();
const scrambles = Array.from({ length: 40 }, (_, i) => generateScramble(seeded(i + 1)));
const scrambleMs = (performance.now() - started) / scrambles.length;
for (const [i, scramble] of scrambles.entries()) {
  const tokens = scramble.split(' ');
  ok(tokens.every((t) => FACE_TURN.test(t)), `scramble ${i} is face turns: ${scramble}`);
  ok(tokens.every((t, k) => k === 0 || t[0] !== tokens[k - 1][0]), `scramble ${i} never turns one face twice in a row: ${scramble}`);
  ok(tokens.length >= 15 && tokens.length <= SCRAMBLE_MAX_MOVES, `scramble ${i} has 15-${SCRAMBLE_MAX_MOVES} moves: ${tokens.length}`);
  // It leads to the state drawn for it (the same seed draws the same state)...
  const drawn = randomCubeState(seeded(i + 1));
  ok(stateEquals(applyFaceTurns(SOLVED, scramble), drawn), `scramble ${i} reaches the random state it was made for`);
  // ...and solving that state gets back to solved.
  const solution = solveTwoPhase(drawn)!;
  ok(stateEquals(applyMoves(drawn, solution), SOLVED), `the scrambled state ${i} solves`);
}
ok(new Set(scrambles).size === scrambles.length, 'scrambles differ');
ok(generateScramble() !== generateScramble(), 'scrambles from the platform generator differ');
{
  // Turned in a holding: faces map through it, so yellow top / blue front swaps U-D and F-B.
  const scramble = scrambles[0];
  ok(stateEquals(scrambleState(scramble, 'white-green'), applyFaceTurns(SOLVED, scramble)), 'white top, green front is the cube\'s own frame');
  const swapped = scramble.replace(/[UDFB]/g, (f) => ({ U: 'D', D: 'U', F: 'B', B: 'F' })[f]!);
  ok(stateEquals(scrambleState(scramble, 'yellow-blue'), applyFaceTurns(SOLVED, swapped)), 'yellow top, blue front turns the opposite faces');
}

// --- Routes between states
for (let i = 0; i < 20; i++) {
  const from = randomCubeState(seeded(500 + i));
  const to = randomCubeState(seeded(900 + i));
  const route = routeBetween(from, to)!;
  ok(route !== null && stateEquals(applyMoves(from, route), to), `route ${i} leads from one state to the other`);
  ok(route.length <= 22, `route ${i} is short: ${route.length}`);
}
{
  const target = scrambleState(scrambles[1], 'yellow-blue');
  const near = applyTurn(applyTurn(target, 'R', 1), 'U', 3);
  eq(routeBetween(near, target)!.length, 2, 'two turns away takes two moves back');
  eq(routeBetween(target, target), [], 'no route needed to stay');
  ok(stateEquals(inverseState(inverseState(target)), target), 'undoing twice is the state again');
  ok(stateEquals(applyMoves(SOLVED, solveTwoPhase(inverseState(target))!), target), 'solving the inverse state scrambles');
}

// --- Best, ao5, ao12 (newest first, milliseconds)
eq(averageOf([10_000, 12_000, 11_000, 30_000, 9_000], 5), 11_000, 'ao5 drops the best and the worst');
eq(averageOf([10_000, 12_000, 11_000, 30_000], 5), null, 'ao5 needs five solves');
eq(averageOf([10_000, 12_000, 11_000, 30_000, 9_000, 1_000], 5), 11_000, 'ao5 is over the latest five');
const twelve = [12_000, 11_000, 13_000, 10_000, 60_000, 11_500, 12_500, 9_500, 14_000, 10_500, 11_000, 13_500];
eq(averageOf(twelve, 12), (twelve.reduce((a, t) => a + t, 0) - 9_500 - 60_000) / 10, 'ao12 drops one best and one worst');
eq(averageOf(twelve.slice(1), 12), null, 'ao12 needs twelve solves');
eq(bestAverageOf([20_000, 10_000, 10_000, 10_000, 10_000, 10_000, 30_000], 5), 10_000, 'the best ao5 can be an older one');
const stats = solveStats([12_000, 8_000, 15_000]);
ok(stats.count === 3 && stats.best === 8_000 && stats.ao5 === null && stats.ao12 === null && stats.mean === 35_000 / 3, 'stats with three solves');
eq(formatSolveTime(12_345), '12.34', 'a single is cut to the hundredth');
eq(formatSolveTime(12_345, { average: true }), '12.35', 'an average is rounded');
eq(formatSolveTime(65_320), '1:05.32', 'a minute and more');
eq(formatSolveTime(null), '-', 'no time is a dash');

// --- CFOP stages on a smart cube
/** Quarter turns a cube reports for an algorithm in a holding (a half turn is two quarters one way). */
function quarterTurns(alg: string, holding: CubeHolding): { face: Face; amount: 1 | 3 }[] {
  const plan = planSetup(alg, holding)!;
  const out: { face: Face; amount: 1 | 3 }[] = [];
  for (const step of plan.steps) {
    for (const [face, amount] of Object.entries(step.turns) as [Face, number][]) {
      if (amount === 3) out.push({ face, amount: 3 });
      else for (let k = 0; k < amount; k++) out.push({ face, amount: 1 });
    }
  }
  return out;
}
function play(start: CubeState, turns: readonly { face: Face; amount: 1 | 3 }[]) {
  const states: CubeState[] = [];
  let s = start;
  for (const t of turns) states.push(s = applyTurn(s, t.face, t.amount));
  return states;
}
const invert = (alg: string) => alg.split(' ').reverse().map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`)).join(' ');

// A solve built backwards from solved, so each stage ends where intended.
// Neighbouring stages never turn the same face across their boundary.
const CROSS = 'D R2';
const PAIRS = ['L U L\'', 'R\' U\' R', 'L\' U\' L', 'R U R\''];
const OLL = 'U R U R\' U R U2 R\'';
const PLL = 'U R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'';

function solveOf(parts: string[], holding: CubeHolding) {
  const solution = parts.join(' ');
  const start = applyMoves(SOLVED, quarterTurns(invert(solution), holding));
  const turns = quarterTurns(solution, holding);
  const states = play(start, turns);
  return { start, turns, states, timed: turns.map((t, i): TimedTurn => ({ ...t, t: i * 100 })) };
}

{
  const solve = solveOf([CROSS, ...PAIRS, OLL, PLL], 'yellow-blue');
  ok(stateEquals(solve.states[solve.states.length - 1], SOLVED), 'the built solve ends solved');
  const split = splitCfop(solve.start, solve.states, 'U');
  eq(split.cross, 'U', 'yellow top: the cross is white, the cube\'s U face');
  eq(split.ends, [2, 5, 8, 11, 14, 23, 39], 'each stage ends on its last turn');
  ok(cfopLevel(solve.states[1], 'U') === 0, 'half the cross is no cross');
  const stages = cfopStages(solve.timed, split);
  eq(stages.map((s) => s.moves), [2, 3, 3, 3, 3, 8, 15], 'moves per stage (a half turn is one move)');
  eq(stages.map((s) => s.ms), [200, 300, 300, 300, 300, 900, 1600], 'time per stage');
  eq(stages.map((s) => s.tps), [10, 10, 10, 10, 10, 8.89, 9.38], 'TPS per stage');
  ok(stages.every((s) => !s.skipped), 'no stage skipped');
  eq(cfopMoveCount(solve.timed, split), 37, 'the solve\'s moves add up the stages');

  const record = cubeSolve({
    scramble: 'R U', holding: 'yellow-blue', start: solve.start,
    turns: solve.turns.map((t, i) => ({ ...t, cubeTime: 5_000 + i * 100, state: solve.states[i] })),
  });
  ok(record.timer === 'cube' && record.ms === 3_900 && record.moveCount === 37 && record.turns![0].t === 0, 'a cube solve is timed first turn to last');
  eq(record.split, split, 'the record keeps where the stages ended');
  const hand = handSolve('R U', 12_345.6);
  ok(hand.timer === 'hand' && hand.ms === 12_346 && hand.turns === undefined, 'a hand solve keeps its time only');
}
{
  // A PLL skip, an OLL skip, and the cross with all four pairs on one turn.
  const pllSkip = solveOf([CROSS, ...PAIRS, OLL], 'yellow-blue');
  const pllStages = cfopStages(pllSkip.timed, splitCfop(pllSkip.start, pllSkip.states, 'U'));
  ok(pllStages[6].skipped && pllStages[6].moves === 0 && pllStages[6].ms === 0 && !pllStages[5].skipped, 'PLL skip: no time, no moves');
  const ollSkip = solveOf([CROSS, ...PAIRS, PLL], 'yellow-blue');
  const ollStages = cfopStages(ollSkip.timed, splitCfop(ollSkip.start, ollSkip.states, 'U'));
  ok(ollStages[5].skipped && ollStages[5].moves === 0 && !ollStages[6].skipped && ollStages[6].moves === 15, 'OLL skip: no time, no moves');
  const oneTurn = solveOf(['D', OLL, PLL], 'yellow-blue');
  const oneSplit = splitCfop(oneTurn.start, oneTurn.states, 'U');
  eq(oneSplit.ends.slice(0, 5), [0, 0, 0, 0, 0], 'the cross and the pairs end on the same turn');
  const oneStages = cfopStages(oneTurn.timed, oneSplit);
  ok(!oneStages[0].skipped && oneStages.slice(1, 5).every((s) => s.skipped && s.moves === 0), 'F2L 1-4 skipped after an X-cross of all pairs');
}
{
  // Colour neutral: the same solve held white top builds the cross on yellow (the cube's D face).
  const solve = solveOf([CROSS, ...PAIRS, OLL, PLL], 'white-green');
  const split = splitCfop(solve.start, solve.states, 'U');
  eq(split.cross, 'D', 'the cross is the face whose F2L was done first, whatever the holding prefers');
  eq(split.ends, [2, 5, 8, 11, 14, 23, 39], 'the same stages on the yellow cross');
}
{
  // Stopped before the end: only the stages reached.
  const solve = solveOf([CROSS, ...PAIRS, OLL, PLL], 'yellow-blue');
  const partial = splitCfop(solve.start, solve.states.slice(0, 10), 'U');
  eq(partial.ends, [2, 5, 8], 'cross and two pairs reached');
  eq(cfopMoveCount(solve.timed.slice(0, 10), partial), 2 + 3 + 3 + 1, 'turns after the last stage still count');
}

// --- The smart cube's guide to the scrambled state
function feed(session: CubeSolveSession, alg: string) {
  const events: string[] = [];
  let n = 0;
  for (const t of quarterTurns(alg, session.holding)) {
    const result = cubeSolveTurn(session, { ...t, cubeTime: 1_000 + n++ * 100, state: applyTurn(session.state, t.face, t.amount) });
    session = result.session;
    if (result.event) events.push(result.event);
  }
  return { session, events };
}
{
  const scramble = scrambles[2];
  let session = startCubeSolve(scramble, 'yellow-blue', SOLVED);
  ok(session.phase === 'scramble' && session.route?.kind === 'scramble', 'from solved the guide is the scramble itself');
  const half = scramble.split(' ').slice(0, 5).join(' ');
  session = feed(session, half).session;
  eq(cubeSolveView(session).doneTokens, 5, 'five tokens turned');
  // Two wrong turns: shown as the turns that take them back.
  const wrong = session.route!.plan.tokens[5][0] === 'R' ? 'L' : 'R';
  const other = wrong === 'R' ? 'F' : 'B';
  session = feed(session, `${wrong} ${other}`).session;
  ok(cubeSolveView(session).undo === `${other}' ${wrong}'` && !needsRoute(session), 'two wrong turns: take them back');
  session = feed(session, `${other}'`).session;
  ok(cubeSolveView(session).undo === `${wrong}'`, 'one taken back, one to go');
  session = feed(session, `${other} ${wrong === 'R' ? 'D' : 'U'}`).session;
  ok(needsRoute(session) && session.route === null, `${WRONG_TURNS_BEFORE_REROUTE} wrong turns: the route is worked out again`);
  const rest = session.fallback!;
  eq(rest.split(' ').slice(0, 3).join(' '), `${wrong === 'R' ? 'D' : 'U'}' ${other}' ${wrong}'`, 'meanwhile: the wrong turns taken back, then the rest');
  ok(stateEquals(applyMoves(session.state, quarterTurns(rest, 'yellow-blue')), session.target), 'taking them back and finishing reaches the scramble');
  {
    const longer = `${rest} U U'`.replace(/ U U'$/, ' U2 U2');
    eq(withRoute(session, session.state, longer).route?.moves, rest, 'a longer route from the solver loses to the way back');
    eq(withRoute(session, session.state, null).route?.moves, rest, 'without a route from the solver, the way back');
  }
  // The solver's route from here, in the user's notation.
  const from = session.state;
  const route = movesInHolding(routeBetween(from, session.target)!, 'yellow-blue');
  ok(withRoute({ ...session, state: applyTurn(from, 'U', 1) }, from, route).route === null, 'a route for a state the cube has left is dropped');
  session = withRoute(session, from, route);
  ok(session.route?.kind === 'reroute' && !needsRoute(session), 'the new route is guided');
  const done = feed(session, session.route!.moves);
  ok(done.session.phase === 'ready' && done.events.join() === 'ready', 'following the new route makes the cube ready');
  ok(stateEquals(done.session.state, done.session.target), 'ready means the scrambled state');

  // Solving: the first turn starts, solved stops on the cube's clock.
  const solved = feed(done.session, invert(scramble));
  eq(solved.events, ['start', 'stop'], 'the first turn starts the timer and solving stops it');
  ok(solved.session.phase === 'done' && solved.session.elapsedMs === (solved.session.turns.length - 1) * 100, 'timed from the first turn to the last');
}
{
  // Not solved at the start: a route from where the cube is.
  const scramble = scrambles[3];
  const elsewhere = randomCubeState(seeded(77));
  let session = startCubeSolve(scramble, 'yellow-blue', elsewhere);
  ok(needsRoute(session), 'an unsolved cube waits for a route');
  const toElsewhere = movesInHolding(routeBetween(elsewhere, scrambleState(scrambles[4], 'yellow-blue'))!, 'yellow-blue');
  ok(withRoute(session, elsewhere, toElsewhere) === session, 'a route to another scramble is not taken');
  session = withRoute(session, elsewhere, movesInHolding(routeBetween(elsewhere, session.target)!, 'yellow-blue'));
  const follow = feed(session, session.route!.moves);
  ok(follow.session.phase === 'ready', 'the route from an unsolved cube leads to the scrambled state');
  // Back to solved on the way: the scramble itself again.
  const back = startCubeSolve(scramble, 'yellow-blue', elsewhere);
  const resolved = cubeSolveResync(back, SOLVED);
  ok(resolved.route?.kind === 'scramble', 'a cube solved again goes back to the scramble');
  // A resync that does not fit the guide asks for a new route.
  const guided = startCubeSolve(scramble, 'yellow-blue', SOLVED);
  ok(needsRoute(cubeSolveResync(guided, applyTurn(SOLVED, 'F', 1))), 'a resync off the guide asks for a new route');
  ok(startCubeSolve(scramble, 'yellow-blue', scrambleState(scramble, 'yellow-blue')).phase === 'ready', 'a cube already scrambled is ready');
}

console.log(`verify-solve: ${checks} checks passed. Tables ${initMs.toFixed(0)} ms, ${scrambleMs.toFixed(1)} ms per scramble.`);
