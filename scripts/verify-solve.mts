// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-solve.mts
//
// Solves from a scramble: random-state scrambles (two-phase search), the
// best / ao5 / ao12 figures with +2 and DNF, the inspection's penalties,
// holdings by colour and where each CFOP stage ends in them, the guide that
// leads a smart cube to the scrambled state (routes worked out again from
// where the cube is), and how solves move between the device and an account.
import assert from 'node:assert/strict';
import { applyFaceTurns, applyTurn, SOLVED, stateEquals, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import {
  colourFrame, CUBE_COLOURS, FACE_COLOUR, fitsTop, holdingColours, holdingFrame, type CubeHolding, type Frame,
} from '@/lib/smart-cube/holding';
import { solveSettingsOf } from '@/lib/practice-settings-store';
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
import { inspectionCall, inspectionPenalty, inspectionShown } from '@/lib/solve/inspection';
import {
  applyOutbox, createSolveLibrary, isMissingOnServer,
  type AccountSolves, type DeviceSolves, type ImportDecision, type Outbox, type SyncMemory,
} from '@/lib/solve/solve-library';
import { bottomFace, cubeSolve, handSolve, parseSolveRecord, recordFrame, withPenalty, type SolveRecord } from '@/lib/solve/solve-record';
import { averageOf, bestAverageOf, countedMs, DNF, formatRecordTime, formatSolveTime, solveStats } from '@/lib/solve/solve-stats';
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
ok(stats.count === 3 && stats.best === 8_000 && stats.ao5 === null && stats.ao12 === null, 'stats with three solves');
eq(formatSolveTime(12_345), '12.34', 'a single is cut to the hundredth');
eq(formatSolveTime(12_345, { average: true }), '12.35', 'an average is rounded');
eq(formatSolveTime(65_320), '1:05.32', 'a minute and more');
eq(formatSolveTime(null), '-', 'no time is a dash');

// --- +2 and DNF
eq(countedMs({ ms: 6_900, penalty: 'plus2' }), 8_900, '+2 adds two seconds');
eq(countedMs({ ms: 6_900, penalty: 'dnf' }), DNF, 'a DNF counts as no time');
eq(formatRecordTime({ ms: 6_900, penalty: 'plus2' }), '8.90+', '+2 shows the added time with a plus');
eq(formatRecordTime({ ms: 6_900, penalty: 'dnf' }), 'DNF', 'a DNF shows as DNF');
eq(formatSolveTime(DNF, { average: true }), 'DNF', 'a DNF average shows as DNF');
{
  const times = [10_000, DNF, 12_000, 8_000, 11_000];
  eq(solveStats(times).best, 8_000, 'the best leaves DNFs out');
  eq(solveStats([DNF, DNF]).best, null, 'no best when every solve is a DNF');
  eq(solveStats([countedMs({ ms: 7_000, penalty: 'plus2' }), 8_500]).best, 8_500, 'a +2 competes with its two seconds added');
  eq(averageOf(times, 5), 11_000, 'ao5 with one DNF drops it as the worst');
  eq(averageOf([10_000, DNF, 12_000, DNF, 11_000], 5), DNF, 'ao5 with two DNFs is a DNF');
  const dozen = [12_000, 11_000, 13_000, DNF, 10_000, 11_500, 12_500, 9_500, 14_000, 10_500, 11_000, 13_500];
  eq(averageOf(dozen, 12), (dozen.filter((t) => t !== DNF).reduce((a, t) => a + t, 0) - 9_500) / 10, 'ao12 with one DNF drops it as the worst');
  eq(averageOf(dozen.map((t, i) => (i === 0 ? DNF : t)), 12), DNF, 'ao12 with two DNFs is a DNF');
  eq(bestAverageOf([DNF, DNF, 9_000, 9_000, 9_000, 9_000, 9_000], 5), 9_000, 'the best ao5 skips windows that are DNF');
  eq(bestAverageOf([DNF, DNF, 9_000, 9_000, 9_000], 5), DNF, 'every window a DNF: the best ao5 is a DNF');
  const record = handSolve('R U', 6_900);
  const plus2 = withPenalty(record, 'plus2');
  ok(plus2.penalty === 'plus2' && plus2.ms === 6_900 && record.penalty === undefined, 'a penalty is set on a copy; the time stays as measured');
  ok(withPenalty(plus2, null).penalty === undefined && !('penalty' in withPenalty(plus2, null)), 'and taken off again');
  eq(withPenalty(plus2, 'dnf').penalty, 'dnf', 'one penalty at a time');
}

// --- Inspection (WCA: over 15 s is +2, over 17 s DNF; calls at 8 and 12 s)
eq(inspectionPenalty(15_000), null, '15.00 s is still in time');
eq(inspectionPenalty(15_001), 'plus2', 'over 15 s is +2');
eq(inspectionPenalty(17_000), 'plus2', '17.00 s is still +2');
eq(inspectionPenalty(17_001), 'dnf', 'over 17 s is DNF');
eq(inspectionShown(0), { seconds: 15 }, 'starts at 15');
eq(inspectionShown(1_000), { seconds: 14 }, 'a second later 14');
eq(inspectionShown(14_999), { seconds: 1 }, 'the last second');
eq(inspectionShown(15_500), { penalty: 'plus2' }, 'then +2');
eq(inspectionShown(17_500), { penalty: 'dnf' }, 'then DNF');
eq([7_999, 8_000, 11_999, 12_000, 14_999, 15_000].map(inspectionCall), [null, 8, 8, 12, 12, null], 'calls at 8 and 12 seconds');
{
  const timed = handSolve('R U', 9_000, { penalty: inspectionPenalty(16_200)!, inspectionMs: 16_200.4 });
  ok(timed.penalty === 'plus2' && timed.inspectionMs === 16_200, 'a solve keeps its inspection and its penalty');
}

// --- Holdings by colour
eq(colourFrame({ top: 'yellow', front: 'blue' }), holdingFrame('yellow-blue'), 'yellow top, blue front is the app\'s default holding');
eq(colourFrame({ top: 'yellow', front: 'green' }), holdingFrame('yellow-green'), 'yellow top, green front');
eq(colourFrame({ top: 'white', front: 'green' }), holdingFrame('white-green'), 'white top, green front is the cube\'s own frame');
for (const holding of ['yellow-blue', 'yellow-green', 'white-green'] as const) {
  eq(colourFrame(holdingColours(holding)), holdingFrame(holding), `${holding} as colours and back`);
}
{
  const frames = new Set<string>();
  for (const top of CUBE_COLOURS) {
    for (const front of CUBE_COLOURS) {
      const frame = colourFrame({ top, front });
      ok((frame === null) === !fitsTop(top, front), `${top} with ${front}: ${fitsTop(top, front) ? 'a holding' : 'no holding'}`);
      if (!frame) continue;
      ok(FACE_COLOUR[frame.U] === top && FACE_COLOUR[frame.F] === front, `${top} top, ${front} front sits as asked`);
      frames.add(JSON.stringify(frame));
    }
  }
  eq(frames.size, 24, 'the 24 ways to hold a cube');
  eq(FACE_COLOUR[colourFrame({ top: 'white', front: 'green' })!.R], 'red', 'white top, green front has red on the right');
  eq(FACE_COLOUR[colourFrame({ top: 'yellow', front: 'blue' })!.R], 'red', 'yellow top, blue front has red on the right too');
}
{
  const smart = holdingColours('yellow-blue');
  eq(solveSettingsOf({}, 'cfop', smart), { top: 'yellow', front: 'blue', inspection: true }, 'unset: the smart cube\'s holding and inspection on');
  eq(solveSettingsOf({ solves: { cfop: { top: 'white', front: 'red', inspection: false } } }, 'cfop', smart),
    { top: 'white', front: 'red', inspection: false }, 'set for CFOP');
  eq(solveSettingsOf({ solves: { cfop: { inspection: false } } }, 'cfop', smart), { top: 'yellow', front: 'blue', inspection: false }, 'only the inspection set');
}

// --- CFOP stages on a smart cube
/** Quarter turns a cube reports for an algorithm in a holding (a half turn is two quarters one way). */
function quarterTurns(alg: string, holding: CubeHolding | Frame): { face: Face; amount: 1 | 3 }[] {
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

function solveOf(parts: string[], holding: CubeHolding | Frame) {
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
    scramble: 'R U', holding: { top: 'yellow', front: 'blue' }, start: solve.start,
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
  // Every holding: the same solve turned in it ends each stage on the same
  // turn, with the cross on the bottom face of that holding.
  for (const top of CUBE_COLOURS) {
    for (const front of CUBE_COLOURS) {
      const frame = colourFrame({ top, front });
      if (!frame) continue;
      const solve = solveOf([CROSS, ...PAIRS, OLL, PLL], frame);
      const split = splitCfop(solve.start, solve.states, bottomFace(frame));
      eq(FACE_COLOUR[split.cross], FACE_COLOUR[frame.D], `${top} top, ${front} front: the cross is on the bottom`);
      eq(split.ends, [2, 5, 8, 11, 14, 23, 39], `${top} top, ${front} front: each stage ends on its last turn`);
    }
  }
  // Read on another face, the same solve has no cross until it is solved.
  const yellowTop = solveOf([CROSS, ...PAIRS, OLL, PLL], 'yellow-blue');
  ok(splitCfop(yellowTop.start, yellowTop.states, 'D').ends[0] >= 30, 'read on the top face, the cross comes only near the end');
  const record = cubeSolve({
    scramble: 'R U', holding: { top: 'white', front: 'red' }, start: solveOf([CROSS], colourFrame({ top: 'white', front: 'red' })!).start,
    turns: [],
  });
  ok(record.split!.cross === 'D' && FACE_COLOUR[recordFrame(record).U] === 'white', 'a record keeps its holding; the cross is the yellow bottom');
  eq(recordFrame({ holding: 'yellow-green' }), holdingFrame('yellow-green'), 'records from the first version keep their smart cube holding');
  eq(recordFrame({}), holdingFrame('yellow-blue'), 'a record without a holding reads as yellow top, blue front');
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

// --- On the cube: ready in the scrambled state, the first turn starts (the inspection runs between, on the screen's clock)
{
  const scramble = scrambles[5];
  let session = startCubeSolve(scramble, colourFrame({ top: 'yellow', front: 'blue' })!, SOLVED);
  const events: string[] = [];
  for (const t of quarterTurns(scramble, session.holding)) {
    const result = cubeSolveTurn(session, { ...t, cubeTime: 0, state: applyTurn(session.state, t.face, t.amount) });
    session = result.session;
    if (result.event) events.push(result.event);
  }
  ok(session.phase === 'ready' && events.join() === 'ready', 'turning the scramble makes the cube ready');
  const first = quarterTurns('R', session.holding)[0];
  ok(cubeSolveTurn(session, { ...first, cubeTime: 0, state: applyTurn(session.state, first.face, first.amount) }).event === 'start', 'its first turn starts the solve');
}

// --- Records read back: from the first version, from this one, and from a later one
{
  const first = { id: 'a1b2c3d4-0000-4000-8000-000000000001', version: 1, event: 'cfop', recordedAt: '2026-11-26T01:18:00.000Z', scramble: 'R U', ms: 6_900, timer: 'cube', holding: 'yellow-blue', turns: [], moveCount: 0, split: { cross: 'U', ends: [] } };
  const read = parseSolveRecord(JSON.parse(JSON.stringify(first)))!;
  ok(read !== null && read.penalty === undefined && recordFrame(read) === holdingFrame('yellow-blue'), 'a record from the first version reads as it was');
  const later = parseSolveRecord({ ...first, penalty: 'plus2', inspectionMs: 12_000, holding: { top: 'white', front: 'green' }, futureField: { x: 1 } })!;
  ok(later.penalty === 'plus2' && later.inspectionMs === 12_000 && (later as unknown as { futureField: unknown }).futureField !== undefined,
    'a later version\'s fields are kept, so saving here does not drop them');
  ok(parseSolveRecord({ ...first, penalty: 'plus3' })!.penalty === undefined, 'an unknown penalty is left off');
  for (const bad of [null, [], { ...first, version: 2 }, { ...first, event: 'f2l' }, { ...first, ms: -1 }, { ...first, recordedAt: 'never' }, { ...first, timer: 'watch' }]) {
    ok(parseSolveRecord(bad) === null, `not a record: ${JSON.stringify(bad)?.slice(0, 40)}`);
  }
  ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(handSolve('R', 1).id), 'ids are UUIDs, as the account keeps them');
}

// --- Solves between the device and an account (in-memory backends)
{
  const solve = (n: number, extra: Partial<SolveRecord> = {}): SolveRecord => ({
    ...handSolve('R U', 10_000 + n), id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    recordedAt: new Date(Date.UTC(2026, 10, 26, 0, n)).toISOString(), ...extra,
  });
  function world({ server = [] as SolveRecord[], onDevice = [] as SolveRecord[], missing = false, decision = null as ImportDecision | null } = {}) {
    const deviceRows = new Map(onDevice.map((r) => [r.id, r]));
    const serverRows = new Map(server.map((r) => [r.id, r]));
    const outboxes = new Map<string, Outbox>();
    const decisions = new Map<string, ImportDecision>(decision ? [['u1', decision]] : []);
    const failures = { save: 0, load: 0 };
    let online = true;
    const device: DeviceSolves = {
      load: async (event) => [...deviceRows.values()].filter((r) => r.event === event),
      put: async (r) => { deviceRows.set(r.id, JSON.parse(JSON.stringify(r))); },
      remove: async (id) => { deviceRows.delete(id); },
    };
    const missingError = () => Object.assign(new Error('missing'), { code: 'PGRST205', status: 404 });
    const account: AccountSolves = {
      load: async () => {
        if (missing) throw missingError();
        if (failures.load > 0) { failures.load--; throw Object.assign(new Error('offline'), { status: 0 }); }
        return [...serverRows.values()];
      },
      save: async (_user, records) => {
        if (failures.save > 0) { failures.save--; throw new Error('network'); }
        for (const r of records) serverRows.set(r.id, JSON.parse(JSON.stringify(r)));
      },
      remove: async (_user, ids) => {
        if (failures.save > 0) { failures.save--; throw new Error('network'); }
        for (const id of ids) serverRows.delete(id);
      },
    };
    const memory: SyncMemory = {
      // Stored as JSON, as on the device.
      readOutbox: (user) => JSON.parse(JSON.stringify(outboxes.get(user) ?? { upserts: {}, deletes: [] })),
      writeOutbox: (user, outbox) => { outboxes.set(user, JSON.parse(JSON.stringify(outbox))); },
      importDecision: (user) => decisions.get(user) ?? null,
      setImportDecision: (user, d) => { decisions.set(user, d); },
    };
    const library = createSolveLibrary({ device, account, memory, online: () => online });
    return { library, deviceRows, serverRows, outboxes, decisions, failures, setOnline: (v: boolean) => { online = v; } };
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const ids = (list: readonly SolveRecord[]) => list.map((r) => r.id.slice(-2));

  // A guest: the device.
  {
    const w = world({ onDevice: [solve(1)] });
    w.library.setSource({ kind: 'device' });
    w.library.getSnapshot('cfop');
    await settle();
    ok(w.library.getSnapshot('cfop').where === 'device' && w.library.getSnapshot('cfop').solves.length === 1, 'a guest sees the device\'s solves');
    await w.library.save(solve(2));
    await w.library.save(withPenalty(solve(2), 'dnf'));
    await w.library.remove('cfop', solve(1).id);
    ok(w.deviceRows.size === 1 && w.deviceRows.get(solve(2).id)!.penalty === 'dnf', 'a guest\'s changes stay on the device');
    ok(w.serverRows.size === 0, 'and never reach a server');
  }
  // Signed in: the account, through the outbox.
  {
    const w = world({ server: [solve(1)], onDevice: [solve(1), solve(2), solve(3)] });
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('cfop');
    await settle(); await settle();
    let snap = w.library.getSnapshot('cfop');
    ok(snap.where === 'account' && eqIds(snap.solves, ['01']), 'signed in: the account\'s solves, not the device\'s');
    eq(snap.offer, 2, 'the device\'s solves not in the account are offered');
    await w.library.save(solve(4));
    await settle();
    ok(w.serverRows.has(solve(4).id) && w.library.getSnapshot('cfop').unsaved === 0, 'a new solve is saved to the account');
    await w.library.save(withPenalty(solve(4), 'plus2'));
    await settle();
    eq(w.serverRows.get(solve(4).id)!.penalty, 'plus2', 'a penalty reaches the account');
    await w.library.save(withPenalty(solve(4), null));
    await settle();
    eq(w.serverRows.get(solve(4).id)!.penalty, undefined, 'and taking it off too');
    // Offline: kept in the outbox, sent when back.
    w.setOnline(false);
    await w.library.save(solve(5));
    await w.library.remove('cfop', solve(1).id);
    snap = w.library.getSnapshot('cfop');
    ok(snap.unsaved === 2 && eqIds(snap.solves, ['05', '04']) && !w.serverRows.has(solve(5).id), 'offline: shown at once, waiting in the outbox');
    w.setOnline(true);
    w.failures.save = 1;
    w.library.resume();
    await settle(); await settle();
    snap = w.library.getSnapshot('cfop');
    ok(snap.failed && snap.unsaved === 2, 'a failed save is kept and flagged');
    w.library.retry('cfop');
    await settle(); await settle();
    snap = w.library.getSnapshot('cfop');
    ok(!snap.failed && snap.unsaved === 0 && w.serverRows.has(solve(5).id) && !w.serverRows.has(solve(1).id), 'retried: saved and deleted on the server');
    // A failed save goes again by itself after two seconds.
    w.failures.save = 1;
    await w.library.save(solve(6));
    await settle();
    ok(w.library.getSnapshot('cfop').failed && !w.serverRows.has(solve(6).id), 'a failed save waits');
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await settle();
    snap = w.library.getSnapshot('cfop');
    ok(!snap.failed && snap.unsaved === 0 && w.serverRows.has(solve(6).id), 'and is saved without asking');
    // The offer: bring the device's solves in once; the device keeps its copies.
    await w.library.importDevice('cfop');
    await settle(); await settle();
    snap = w.library.getSnapshot('cfop');
    ok(w.serverRows.has(solve(2).id) && w.serverRows.has(solve(3).id) && snap.offer === 0, 'imported: the device\'s solves are in the account');
    ok(w.serverRows.has(solve(1).id) === false, 'a solve deleted from the account is not brought back by the import');
    ok(w.deviceRows.size === 3 && w.decisions.get('u1') === 'imported', 'the device keeps its copies; the import is remembered');
    // Another device signing in sees them.
    const other = world({ server: [...w.serverRows.values()] });
    other.library.setSource({ kind: 'account', userId: 'u1' });
    other.library.getSnapshot('cfop');
    await settle(); await settle();
    eq(other.library.getSnapshot('cfop').solves.length, w.serverRows.size, 'another device sees the same solves');
    // Signing out: the guest's solves again.
    w.library.setSource({ kind: 'device' });
    await settle();
    eq(w.library.getSnapshot('cfop').solves.length, 3, 'signed out: the device\'s solves again');
  }
  // Chosen at the first sign-in: imported without asking; declined: never offered.
  {
    const wanted = world({ onDevice: [solve(1), solve(2)], decision: 'wanted' });
    wanted.library.setSource({ kind: 'account', userId: 'u1' });
    wanted.library.getSnapshot('cfop');
    await settle(); await settle(); await settle();
    ok(wanted.serverRows.size === 2 && wanted.library.getSnapshot('cfop').offer === 0, 'import chosen at the first sign-in: brought in at once');
    const declined = world({ onDevice: [solve(1)], decision: 'declined' });
    declined.library.setSource({ kind: 'account', userId: 'u1' });
    declined.library.getSnapshot('cfop');
    await settle(); await settle();
    ok(declined.library.getSnapshot('cfop').offer === 0 && declined.serverRows.size === 0, 'declined: not offered again');
    const decide = world({ onDevice: [solve(1)] });
    decide.library.setSource({ kind: 'account', userId: 'u1' });
    decide.library.getSnapshot('cfop');
    await settle(); await settle();
    decide.library.declineImport('cfop');
    ok(decide.library.getSnapshot('cfop').offer === 0 && decide.decisions.get('u1') === 'declined', 'declining the offer is remembered');
  }
  // A server without the solves table: the device keeps a signed-in user's solves.
  {
    const w = world({ onDevice: [solve(1)], missing: true });
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('cfop');
    await settle(); await settle();
    let snap = w.library.getSnapshot('cfop');
    ok(snap.where === 'device-for-account' && snap.solves.length === 1, 'server not ready: the device\'s solves');
    await w.library.save(solve(2));
    snap = w.library.getSnapshot('cfop');
    ok(w.deviceRows.has(solve(2).id) && snap.unsaved === 0 && w.outboxes.size === 0, 'and new solves stay on the device, as before');
  }
  // The account cannot be read (offline): new solves wait in the outbox.
  {
    const w = world({ server: [solve(1)] });
    w.failures.load = 1;
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('cfop');
    await settle();
    ok(w.library.getSnapshot('cfop').status === 'error', 'a failed load is shown');
    w.setOnline(false);
    await w.library.save(solve(2));
    ok(eqIds(w.library.getSnapshot('cfop').solves, ['02']) && !w.deviceRows.has(solve(2).id), 'a solve timed meanwhile waits for the account');
    w.setOnline(true);
    w.library.retry('cfop');
    await settle(); await settle(); await settle();
    const snap = w.library.getSnapshot('cfop');
    ok(snap.status === 'ready' && eqIds(snap.solves, ['02', '01']) && w.serverRows.has(solve(2).id), 'loaded again: the waiting solve is saved and shown with the rest');
  }
  eq(applyOutbox([solve(1), solve(2)], { upserts: { [solve(3).id]: solve(3), [solve(1).id]: withPenalty(solve(1), 'dnf') }, deletes: [solve(2).id] }, 'cfop').map((r) => `${r.id.slice(-2)}${r.penalty ?? ''}`),
    ['03', '01dnf'], 'the outbox over a list: added, changed and deleted');
  ok(isMissingOnServer({ code: 'PGRST205' }) && isMissingOnServer({ code: '42P01' }) && isMissingOnServer({ code: 'PGRST202' }) && isMissingOnServer({ status: 404 }), 'a missing table or function');
  ok(!isMissingOnServer({ code: 'PT409' }) && !isMissingOnServer(new Error('Failed to fetch')) && !isMissingOnServer(null), 'other errors are not');
  void ids;
}
function eqIds(list: readonly SolveRecord[], expected: string[]) {
  return JSON.stringify(list.map((r) => r.id.slice(-2))) === JSON.stringify(expected);
}

console.log(`verify-solve: ${checks} checks passed. Tables ${initMs.toFixed(0)} ms, ${scrambleMs.toFixed(1)} ms per scramble.`);
