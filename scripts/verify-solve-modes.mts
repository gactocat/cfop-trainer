// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-solve-modes.mts
//
// The kinds of solve (lib/solve/solve-modes.ts): their definitions, the
// states and scrambles each starts from (f2l leaves the cross solved, ll the
// first two layers), what stops each on a smart cube, the stages read for
// each, recognition and execution, the records they keep, and how records of
// several kinds move between the device and an account. Also how long
// scrambles take to make.
import assert from 'node:assert/strict';
import { MESSAGES } from '@/i18n/messages';
import { SOLVE_MODE_ENTRIES } from '@/data/home-entries';
import { solveSettingsOf } from '@/lib/practice-settings-store';
import { applyFaceTurns, applyTurn, FACES, SOLVED, stateEquals, type Face } from '@/lib/smart-cube/cube-state';
import {
  colourFace, colourFrame, CUBE_COLOURS, fitsTop, frameColours, holdingFrame, turnedDown,
  type ColourHolding, type CubeColour, type Frame,
} from '@/lib/smart-cube/holding';
import { planSetup } from '@/lib/smart-cube/setup-guide';
import { cubeSolveTurn, restartCubeSolve, startCubeSolve, type CubeSolveSession } from '@/lib/smart-cube/solve-session';
import { mergeTurns } from '@/lib/smart-cube/solve-record';
import { cfopLevel, cfopStages, CFOP_STAGES, splitCfop, type TimedTurn } from '@/lib/solve/cfop-split';
import {
  generateModeScramble, randomCrossSolvedState, randomLastLayerState, randomModeState, scrambleCrossFace,
} from '@/lib/solve/mode-scramble';
import {
  modeCubeSolve, modeHandSolve, modeMoveCount, modeRecordStages, modeStages, readModeRecord, splitMode,
} from '@/lib/solve/mode-record';
import { applyMoves, movesInHolding, scrambleState, SCRAMBLE_MAX_MOVES } from '@/lib/solve/scramble';
import { scrambleFeed } from '@/lib/solve/scramble-client';
import { createSolveLibrary, type AccountSolves, type DeviceSolves, type ImportDecision, type Outbox, type SyncMemory } from '@/lib/solve/solve-library';
import {
  CROSS_GOAL, crossSolved, goalReached, goalWithinOneTurn, modeGoal, scrambleFitsMode, solvedCrosses, SOLVED_GOAL,
} from '@/lib/solve/solve-goal';
import { DEFAULT_MODE_CROSS, isSolveMode, modeOfSlug, SOLVE_MODE, SOLVE_MODES, type SolveMode } from '@/lib/solve/solve-modes';
import { handSolve, parseSolveRecord, readRecord, recordMoveCount, SOLVE_EVENTS, withPenalty, type SolveRecord } from '@/lib/solve/solve-record';
import { countedMs, solveStats } from '@/lib/solve/solve-stats';
import { initTwoPhase, isSolvable, solveTwoPhase } from '@/lib/solver/two-phase';

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

const ALL_HOLDINGS: ColourHolding[] = CUBE_COLOURS.flatMap((top) => CUBE_COLOURS.filter((front) => fitsTop(top, front)).map((front) => ({ top, front })));

// --- The modes
{
  eq([...SOLVE_MODES], ['cfop', 'cross', 'f2l', 'll'], 'four kinds, CFOP first');
  eq([...SOLVE_EVENTS], [...SOLVE_MODES], 'each kind is a kind of record');
  for (const mode of SOLVE_MODES) {
    const def = SOLVE_MODE[mode];
    ok(def.id === mode && def.event === mode, `${mode}: its records are its own`);
    ok(/^[a-z0-9][a-z0-9-]{0,31}$/.test(def.event), `${mode}: the event fits the solves table`);
    ok(def.href === `/solve/${def.slug}` && modeOfSlug(def.slug) === mode, `${mode}: the page is /solve/${def.slug}`);
    for (const key of [def.name, def.description]) {
      ok(MESSAGES.en[key].length > 0 && MESSAGES.ja[key].length > 0, `${mode}: ${key} in English and Japanese`);
    }
    // The stages are a run of CFOP's.
    const from = CFOP_STAGES.indexOf(def.stages[0]);
    eq([...def.stages], CFOP_STAGES.slice(from, from + def.stages.length), `${mode}: its stages are CFOP's in order`);
  }
  eq([...SOLVE_MODE.cfop.stages], [...CFOP_STAGES], 'CFOP times every stage');
  eq([...SOLVE_MODE.cross.stages], ['cross'], 'the cross alone');
  eq([...SOLVE_MODE.f2l.stages], ['f2l1', 'f2l2', 'f2l3', 'f2l4'], 'F2L: the four pairs');
  eq([...SOLVE_MODE.ll.stages], ['oll', 'pll'], 'the last layer: OLL and PLL');
  ok(new Set(SOLVE_MODES.map((m) => SOLVE_MODE[m].slug)).size === 4, 'the slugs differ');
  ok(modeOfSlug('oll') === null && isSolveMode('f2l') && !isSolveMode('skewb'), 'other names are not modes');
  eq(DEFAULT_MODE_CROSS, 'white', 'F2L and last-layer scrambles leave a white cross unless asked otherwise');
  eq(SOLVE_MODE_ENTRIES.map((e) => [e.id, e.href, e.name, e.art]), [
    ['cfop', '/solve/cfop', 'CFOP', 'solve'], ['cross', '/solve/cross', 'Cross', 'cross'],
    ['f2l', '/solve/f2l', 'F2L', 'f2l'], ['ll', '/solve/ll', 'LL', 'pll'],
  ], 'top page entries for each kind');
  // Each kind has its own settings, defaulting as CFOP's do.
  for (const mode of SOLVE_MODES) {
    const own = solveSettingsOf({}, mode);
    ok(own.top === 'white' && own.front === 'green' && own.inspection, `${mode}: white top, green front and inspection until chosen`);
  }
  const set = solveSettingsOf({ solves: { f2l: { top: 'yellow', front: 'blue', inspection: false } } }, 'f2l');
  ok(set.top === 'yellow' && set.front === 'blue' && !set.inspection, 'F2L\'s settings are its own');
  ok(solveSettingsOf({ solves: { f2l: { top: 'yellow', front: 'blue' } } }, 'll').top === 'white', 'and do not reach the last layer\'s');
}

// --- Goals
{
  const crossOnly = randomCrossSolvedState('D', seeded(3));
  ok(crossSolved(crossOnly, 'D') && goalReached(CROSS_GOAL, crossOnly), 'a cross is a cross');
  ok(!goalReached(SOLVED_GOAL, crossOnly) && !goalReached({ kind: 'f2l', cross: 'D' }, crossOnly), 'and not the first two layers');
  const twoLayers = randomLastLayerState('U', seeded(4));
  ok(goalReached({ kind: 'f2l', cross: 'U' }, twoLayers) && !goalReached({ kind: 'f2l', cross: 'D' }, twoLayers), 'the first two layers around the cross asked for');
  ok(goalReached(SOLVED_GOAL, SOLVED) && goalReached(CROSS_GOAL, SOLVED) && goalReached({ kind: 'f2l', cross: 'R' }, SOLVED), 'a solved cube reaches every goal');
  eq(solvedCrosses(SOLVED, 'F'), ['F', 'U', 'R', 'D', 'L', 'B'], 'a solved cube has every cross, the one preferred first');
  ok(goalWithinOneTurn(SOLVED_GOAL, applyTurn(SOLVED, 'U', 1)) && !goalWithinOneTurn(SOLVED_GOAL, applyFaceTurns(SOLVED, 'R U')), 'one turn from solved, or two');
  eq(modeGoal('cfop'), SOLVED_GOAL, 'CFOP ends solved');
  eq(modeGoal('ll', 'green'), SOLVED_GOAL, 'the last layer ends solved, the last AUF included');
  eq(modeGoal('cross'), CROSS_GOAL, 'the cross ends on a cross of any colour');
  eq([modeGoal('f2l'), modeGoal('f2l', 'yellow')], [{ kind: 'f2l', cross: 'U' }, { kind: 'f2l', cross: 'D' }], 'F2L ends on the two layers of its cross colour (white unless chosen)');
}

// --- The states each kind starts from
{
  const N = 2000;
  for (const face of FACES) {
    // F2L: the cross on `face` solved; the rest random.
    let pairs = 0;
    const cornerAt = new Map<number, number>();
    for (let i = 0; i < N / 4; i++) {
      const s = randomModeState('f2l', face, seeded(1_000 * FACES.indexOf(face) + i));
      ok(isSolvable(s) && crossSolved(s, face), `f2l on ${face}: a legal state with the cross solved`);
      ok(!goalWithinOneTurn({ kind: 'f2l', cross: face }, s), `f2l on ${face}: the two layers not within a turn`);
      pairs += cfopLevel(s, face) - 1;
      cornerAt.set(s.cp[0], (cornerAt.get(s.cp[0]) ?? 0) + 1);
    }
    ok(pairs < N / 4 * 0.05, `f2l on ${face}: pairs are solved only by chance (${pairs} in ${N / 4})`);
    ok(cornerAt.size === 8, `f2l on ${face}: any corner can be anywhere`);
    // The last layer: the first two layers solved, the last layer random.
    let oriented = 0;
    for (let i = 0; i < N / 4; i++) {
      const s = randomModeState('ll', face, seeded(50_000 + 1_000 * FACES.indexOf(face) + i));
      const level = cfopLevel(s, face);
      ok(isSolvable(s) && (level === 5 || level === 6), `ll on ${face}: a legal state with the first two layers solved`);
      ok(!goalWithinOneTurn(SOLVED_GOAL, s), `ll on ${face}: not solved, nor an AUF away`);
      if (level === 6) oriented++;
    }
    ok(oriented < N / 4 * 0.03, `ll on ${face}: OLL skips by chance only (${oriented} in ${N / 4})`);
    // The cross alone: no cross within a turn.
    for (let i = 0; i < 50; i++) {
      const s = randomModeState('cross', face, seeded(90_000 + i));
      ok(isSolvable(s) && !goalWithinOneTurn(CROSS_GOAL, s), 'cross: a legal state with no cross within a turn');
    }
  }
  // The last layer, uniformly: each last-layer corner place holds each of the
  // four corners, each twist; each edge place each edge, each flip; corner and
  // edge permutations have the same parity (a legal cube).
  const ll = Array.from({ length: 6000 }, (_, i) => randomLastLayerState('U', seeded(200_000 + i)));
  const D_CORNERS = [4, 5, 6, 7];
  const D_EDGES = [4, 5, 6, 7];
  const count = <T,>(xs: T[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>());
  const within = (m: Map<unknown, number>, n: number, expected: number) => m.size === n && [...m.values()].every((v) => Math.abs(v - expected) < expected * 0.15);
  ok(within(count(ll.map((s) => s.cp[4])), 4, 1500), 'a last-layer corner place holds any of the four corners alike');
  ok(within(count(ll.map((s) => s.co[5])), 3, 2000), 'twisted any way alike');
  ok(within(count(ll.map((s) => s.ep[6])), 4, 1500), 'an edge place any of the four edges alike');
  ok(within(count(ll.map((s) => s.eo[7])), 2, 3000), 'flipped either way alike');
  ok(ll.every((s) => D_CORNERS.every((p) => D_CORNERS.includes(s.cp[p])) && D_EDGES.every((p) => D_EDGES.includes(s.ep[p]))), 'last-layer pieces stay in the last layer');
  ok(new Set(ll.map((s) => JSON.stringify(s))).size > 5500, 'last-layer states vary (62208 in all)');
  // OLL skips at 1 in 216 and PLL skips (oriented and permuted but for an AUF) as often as chance makes them.
  const skips = ll.filter((s) => cfopLevel(s, 'U') === 6).length;
  ok(skips > 6000 / 216 / 2 && skips < 6000 / 216 * 2, `OLL skips about 1 in 216: ${skips} in 6000`);
}

// --- Scrambles
initTwoPhase();
const FACE_TURN = /^[URFDLB](2|')?$/;
const lengths: Record<string, number[]> = {};
function checkScramble(mode: SolveMode, scramble: string, name: string, min: number) {
  const tokens = scramble.split(' ');
  ok(tokens.every((t) => FACE_TURN.test(t)), `${name}: face turns: ${scramble}`);
  ok(tokens.every((t, k) => k === 0 || t[0] !== tokens[k - 1][0]), `${name}: never one face twice in a row: ${scramble}`);
  ok(tokens.length >= min && tokens.length <= SCRAMBLE_MAX_MOVES, `${name}: ${min}-${SCRAMBLE_MAX_MOVES} moves: ${tokens.length}`);
  (lengths[mode] ??= []).push(tokens.length);
}
const MIN_MOVES: Record<SolveMode, number> = { cfop: 15, cross: 15, f2l: 15, ll: 7 };
for (const mode of SOLVE_MODES) {
  for (let i = 0; i < 30; i++) {
    const face = FACES[i % 6];
    const scramble = generateModeScramble(mode, face, seeded(300_000 + i));
    const name = `${mode} scramble ${i} (cross on ${face})`;
    checkScramble(mode, scramble, name, MIN_MOVES[mode]);
    // It leads to the state drawn for it (the same seed draws the same state)...
    const drawn = randomModeState(mode, face, seeded(300_000 + i));
    const reached = applyFaceTurns(SOLVED, scramble);
    ok(stateEquals(reached, drawn), `${name}: reaches the state drawn for it`);
    // ...which is what the kind starts from...
    if (mode === 'f2l') ok(crossSolved(reached, face) && cfopLevel(reached, face) < 5, `${name}: the cross solved, the two layers not`);
    if (mode === 'll') ok(cfopLevel(reached, face) >= 5 && !goalWithinOneTurn(SOLVED_GOAL, reached), `${name}: the two layers solved, the cube not`);
    if (mode === 'cross') ok(solvedCrosses(reached).length === 0, `${name}: no cross`);
    // ...and solving it gets back to solved.
    ok(stateEquals(applyMoves(reached, solveTwoPhase(reached)!), SOLVED), `${name}: the scrambled state solves`);
  }
}
{
  // Turned holding the cube as set for the scramble, the cross is on the
  // colour asked for: every scramble orientation with a white cross, and
  // every cross colour from white top, green front.
  const cases: [ColourHolding, CubeColour][] = [
    ...ALL_HOLDINGS.map((h): [ColourHolding, CubeColour] => [h, 'white']),
    ...CUBE_COLOURS.map((c): [ColourHolding, CubeColour] => [{ top: 'white', front: 'green' }, c]),
  ];
  eq(scrambleCrossFace({ top: 'white', front: 'green' }, 'white'), 'U', 'white top, green front, white cross: the cross on U as written');
  eq(scrambleCrossFace({ top: 'yellow', front: 'blue' }, 'white'), 'D', 'yellow top: on D');
  eq(scrambleCrossFace({ top: 'white', front: 'green' }, 'green'), 'F', 'a green cross from white top, green front: on F');
  eq(scrambleCrossFace({ top: 'white', front: 'yellow' }, 'white'), null, 'no such holding');
  cases.forEach(([holding, cross], i) => {
    const name = `${holding.top} top, ${holding.front} front, ${cross} cross`;
    const face = scrambleCrossFace(holding, cross)!;
    const frame = colourFrame(holding)!;
    const f2l = scrambleState(generateModeScramble('f2l', face, seeded(400_000 + i)), frame);
    ok(crossSolved(f2l, colourFace(cross)) && cfopLevel(f2l, colourFace(cross)) < 5, `${name}: the F2L scramble leaves the cross, and only the cross, on ${cross}`);
    const ll = scrambleState(generateModeScramble('ll', face, seeded(500_000 + i)), frame);
    ok(cfopLevel(ll, colourFace(cross)) >= 5 && !stateEquals(ll, SOLVED), `${name}: the last-layer scramble leaves the two layers around ${cross}`);
  });
}
const lengthRange = (mode: SolveMode) => {
  const ls = [...lengths[mode]].sort((a, b) => a - b);
  return `${ls[0]}-${ls[ls.length - 1]} (mean ${(ls.reduce((a, b) => a + b, 0) / ls.length).toFixed(1)})`;
};

// --- Solves built backwards from solved, so each stage ends where intended
function quarterTurns(alg: string, holding: Frame): { face: Face; amount: 1 | 3 }[] {
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
const invert = (alg: string) => alg.split(' ').reverse().map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`)).join(' ');
const CROSS = 'D R2';
const PAIRS = ['L U L\'', 'R\' U\' R', 'L\' U\' L', 'R U R\''];
const OLL = 'U R U R\' U R U2 R\'';
const PLL = 'U R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'';

/**
 * A solve as a solver makes it: scrambled holding the cube one way, then
 * turned over to put the cross colour at the bottom; `before` are the stages
 * done before the scramble's end (left solved), `parts` the ones solved.
 */
function built(scrambleHolding: ColourHolding, cross: CubeColour, before: string[], parts: string[], gaps: (i: number, isFirst: boolean) => number = () => 100) {
  const scrambleFrame = colourFrame(scrambleHolding)!;
  const solving = turnedDown(scrambleFrame, cross).frame;
  const all = [...before, ...parts].join(' ');
  // The scrambled state: everything undone, then the stages before redone.
  const scrambleTurns = [...quarterTurns(invert(all), solving), ...(before.length ? quarterTurns(before.join(' '), solving) : [])];
  const start = applyMoves(SOLVED, scrambleTurns);
  const scramble = movesInHolding(mergeTurns(scrambleTurns), scrambleFrame);
  // Solving turns, timed: `gaps` before each (the first of each part is marked).
  const firsts = new Set<number>();
  let n = 0;
  for (const part of parts) {
    firsts.add(n);
    n += quarterTurns(part, solving).length;
  }
  const turns = quarterTurns(parts.join(' '), solving);
  let t = 5_000;
  let state = start;
  const timed = turns.map((turn, i) => {
    if (i > 0) t += gaps(i, firsts.has(i));
    state = applyTurn(state, turn.face, turn.amount);
    return { ...turn, cubeTime: t, state };
  });
  return { scramble, scrambleFrame, solving, start, timed };
}

/** Run a session: the scramble turned from solved, then the solve; the events and where it stopped. */
function runSession(scramble: string, scrambleFrame: Frame, goal: Parameters<typeof startCubeSolve>[3], timed: ReturnType<typeof built>['timed']) {
  let session: CubeSolveSession = startCubeSolve(scramble, scrambleFrame, SOLVED, goal);
  const events: string[] = [];
  for (const t of quarterTurns(scramble, scrambleFrame)) {
    const result = cubeSolveTurn(session, { ...t, cubeTime: 0, state: applyTurn(session.state, t.face, t.amount) });
    session = result.session;
    if (result.event) events.push(result.event);
  }
  for (const turn of timed) {
    if (session.phase === 'done') break;
    const result = cubeSolveTurn(session, turn);
    session = result.session;
    if (result.event) events.push(result.event);
  }
  return { session, events };
}

const WCA: ColourHolding = { top: 'white', front: 'green' };
const ends = (record: SolveRecord) => record.split!.ends;
{
  // F2L: the cross left by the scramble, the pairs solved; the solve stops
  // when the fourth pair is in, with the last layer still to do.
  for (const [holding, cross] of [[WCA, 'white'], [{ top: 'yellow', front: 'blue' }, 'white'], [WCA, 'green'], [{ top: 'red', front: 'blue' }, 'orange']] as [ColourHolding, CubeColour][]) {
    const name = `F2L, ${holding.top} top, ${holding.front} front, ${cross} cross`;
    const b = built(holding, cross, [CROSS], [...PAIRS, OLL, PLL]);
    ok(crossSolved(b.start, colourFace(cross)) && cfopLevel(b.start, colourFace(cross)) === 1, `${name}: starts with the cross alone`);
    const run = runSession(b.scramble, b.scrambleFrame, modeGoal('f2l', cross), b.timed);
    const pairTurns = quarterTurns(PAIRS.join(' '), b.solving).length;
    ok(run.session.phase === 'done' && run.events.join() === 'ready,start,stop', `${name}: ready, started by the first turn, stopped by the fourth pair`);
    eq(run.session.turns.length, pairTurns, `${name}: stopped on the last turn of the pairs, the last layer not solved`);
    const record = modeCubeSolve('f2l', { scramble: b.scramble, scrambleHolding: holding, cross, start: run.session.target, turns: run.session.turns });
    ok(record.event === 'f2l' && record.timer === 'cube' && record.crossColour === cross, `${name}: an F2L record with its cross colour`);
    eq(ends(record), [-1, 2, 5, 8, 11], `${name}: the cross before the first turn, then each pair`);
    eq(frameColours(readModeRecord(record)!.frame), frameColours(b.solving), `${name}: read in the holding it was solved in`);
    const stages = modeRecordStages(record)!;
    eq(stages.map((s) => s.stage), ['f2l1', 'f2l2', 'f2l3', 'f2l4'], `${name}: the four pairs`);
    eq(stages.map((s) => s.notation), PAIRS, `${name}: each pair's moves as made`);
    eq([record.moveCount, modeMoveCount(record)], [12, 12], `${name}: 12 moves`);
    ok(record.ms === (pairTurns - 1) * 100, `${name}: timed from the first turn to the last`);
  }
  // The last layer: the two layers left by the scramble; OLL then PLL; stops solved.
  for (const [holding, cross] of [[WCA, 'white'], [{ top: 'yellow', front: 'green' }, 'white'], [WCA, 'blue']] as [ColourHolding, CubeColour][]) {
    const name = `LL, ${holding.top} top, ${holding.front} front, ${cross} cross`;
    const b = built(holding, cross, [CROSS, ...PAIRS], [OLL, PLL]);
    ok(cfopLevel(b.start, colourFace(cross)) === 5, `${name}: starts with the two layers alone`);
    const run = runSession(b.scramble, b.scrambleFrame, modeGoal('ll', cross), b.timed);
    ok(run.session.phase === 'done' && stateEquals(run.session.state, SOLVED), `${name}: stops solved`);
    const record = modeCubeSolve('ll', { scramble: b.scramble, scrambleHolding: holding, cross, start: run.session.target, turns: run.session.turns, inspectionMs: 4_200 });
    eq(ends(record), [-1, -1, -1, -1, -1, 8, 24], `${name}: the two layers before the first turn, then OLL and PLL`);
    const stages = modeRecordStages(record)!;
    eq(stages.map((s) => [s.stage, s.notation]), [['oll', OLL], ['pll', PLL]], `${name}: OLL and PLL as made`);
    ok(record.inspectionMs === 4_200 && record.event === 'll', `${name}: the inspection kept`);
  }
  // An LL with an OLL skip: OLL takes no time, PLL every move.
  {
    const b = built(WCA, 'white', [CROSS, ...PAIRS], [PLL]);
    const run = runSession(b.scramble, b.scrambleFrame, modeGoal('ll'), b.timed);
    const record = modeCubeSolve('ll', { scramble: b.scramble, scrambleHolding: WCA, start: run.session.target, turns: run.session.turns });
    const stages = modeRecordStages(record)!;
    ok(stages[0].skipped && stages[0].moves === 0 && stages[0].ms === 0 && !stages[1].skipped && stages[1].moves === 15, 'LL with an OLL skip');
  }
}
{
  // The cross alone, in every colour: the first cross made stops the solve,
  // whatever its colour, and the record keeps that colour.
  for (const cross of CUBE_COLOURS) {
    const name = `cross, ${cross}`;
    const b = built(WCA, cross, [], [CROSS, ...PAIRS, OLL, PLL]);
    ok(solvedCrosses(b.start).length === 0, `${name}: no cross at the start`);
    const run = runSession(b.scramble, b.scrambleFrame, modeGoal('cross'), b.timed);
    ok(run.session.phase === 'done' && run.events.join() === 'ready,start,stop', `${name}: stopped`);
    eq(run.session.turns.length, 3, `${name}: on the cross's last turn (D R2 is three quarter turns)`);
    const record = modeCubeSolve('cross', { scramble: b.scramble, scrambleHolding: WCA, start: run.session.target, turns: run.session.turns });
    eq([record.crossColour, ends(record)], [cross, [2]], `${name}: the colour made and where the cross ended`);
    eq(frameColours(readModeRecord(record)!.frame), frameColours(b.solving), `${name}: read with that colour at the bottom`);
    eq(modeRecordStages(record)!.map((s) => [s.stage, s.notation, s.moves]), [['cross', CROSS, 2]], `${name}: one stage, its moves as made`);
  }
  // An X-cross (the cross and all four pairs on the last turn of a D2):
  // still the cross alone, where CFOP reads five stages.
  {
    const b = built(WCA, 'white', [], ['D2', OLL, PLL]);
    const run = runSession(b.scramble, b.scrambleFrame, modeGoal('cross'), b.timed);
    const record = modeCubeSolve('cross', { scramble: b.scramble, scrambleHolding: WCA, start: run.session.target, turns: run.session.turns });
    eq([run.session.turns.length, ends(record)], [2, [1]], 'an X-cross ends the cross alone on its turn');
    eq(splitMode('cfop', b.start, run.session.turns.map((t) => t.state), 'U').ends, [1, 1, 1, 1, 1], 'where CFOP reads the cross and four pairs');
  }
  // A cross of another colour made first ends it too (colour neutral, the
  // rule chosen: see docs/solve.md).
  {
    const greenCross = randomCrossSolvedState('F', seeded(9));
    const start = applyFaceTurns(greenCross, 'F R');
    ok(!goalWithinOneTurn(CROSS_GOAL, start), 'two turns from a green cross');
    const b = built(WCA, 'white', [], [CROSS, ...PAIRS, OLL, PLL]);
    let s: CubeSolveSession = { ...startCubeSolve(b.scramble, b.scrambleFrame, SOLVED, modeGoal('cross')), phase: 'ready', state: start, target: start };
    const events: string[] = [];
    for (const [i, turn] of quarterTurns('R\' F\'', holdingFrame('white-green')).entries()) {
      const result = cubeSolveTurn(s, { ...turn, cubeTime: i * 100, state: applyTurn(s.state, turn.face, turn.amount) });
      s = result.session;
      if (result.event) events.push(result.event);
    }
    ok(events.join() === 'start,stop' && s.turns.length === 2 && crossSolved(s.state, 'F'), 'a green cross made first stops the solve');
    eq(modeCubeSolve('cross', { scramble: 'F R', scrambleHolding: WCA, start, turns: s.turns }).crossColour, 'green', 'and is recorded as green');
  }
  // Restarting keeps the goal.
  {
    const b = built(WCA, 'white', [CROSS], [...PAIRS, OLL, PLL]);
    const session = startCubeSolve(b.scramble, b.scrambleFrame, SOLVED, modeGoal('f2l'));
    eq(restartCubeSolve(session, applyTurn(SOLVED, 'R', 1)).goal, modeGoal('f2l'), 'an attempt guided again keeps its goal');
    eq(startCubeSolve(b.scramble, b.scrambleFrame, SOLVED).goal, SOLVED_GOAL, 'without a goal, solved (CFOP as before)');
  }
}
{
  // CFOP read as a mode: every stage, as cfop-split.ts reads it.
  const b = built(WCA, 'white', [], [CROSS, ...PAIRS, OLL, PLL]);
  const states = b.timed.map((t) => t.state);
  const split = splitMode('cfop', b.start, states, 'U');
  eq(split, splitCfop(b.start, states, 'U'), 'CFOP\'s stages as cfop-split.ts reads them');
  eq(split.ends, [2, 5, 8, 11, 14, 23, 39], 'each stage on its last turn');
  eq(splitMode('f2l', b.start, states, 'U').ends, [2, 5, 8, 11, 14], 'read for F2L: up to the fourth pair');
  eq(splitMode('cross', b.start, states, 'U').ends, [2], 'read for the cross: the cross');
}

// --- Recognition and execution (cfop-split.ts's, kept per mode)
{
  // Each part's first turn comes 1 s after the last turn of the one before
  // (its recognition), the others 100 ms apart.
  const b = built(WCA, 'white', [], [CROSS, ...PAIRS, OLL, PLL], (_, isFirst) => (isFirst ? 1_000 : 100));
  const turns: TimedTurn[] = b.timed.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - b.timed[0].cubeTime }));
  const split = splitMode('cfop', b.start, b.timed.map((t) => t.state), 'U');
  const stages = modeStages('cfop', turns, { split, frame: b.solving });
  const quarterCounts = [CROSS, ...PAIRS, OLL, PLL].map((part) => quarterTurns(part, b.solving).length);
  eq(stages.map((s) => s.stage), [...CFOP_STAGES], 'CFOP: every stage');
  eq(stages.map((s) => s.recognitionMs), [0, 1_000, 1_000, 1_000, 1_000, 1_000, 1_000], 'recognition: from the stage before to the first turn (the first stage starts with the timer)');
  eq(stages.map((s) => s.executionMs), quarterCounts.map((n) => (n - 1) * 100), 'execution: from the first turn to the last');
  ok(stages.every((s) => s.recognitionMs + s.executionMs === s.ms), 'recognition and execution add up to the stage\'s time');
  eq(stages, cfopStages(turns, split, b.solving), 'as cfop-split.ts reads them');
  // Skips: no recognition, no execution; the next stage's recognition takes in the look.
  const skip = built(WCA, 'white', [], [CROSS, ...PAIRS, PLL], (_, isFirst) => (isFirst ? 700 : 100));
  const skipTurns = skip.timed.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - skip.timed[0].cubeTime }));
  const skipStages = modeStages('cfop', skipTurns, { split: splitMode('cfop', skip.start, skip.timed.map((t) => t.state), 'U'), frame: skip.solving });
  ok(skipStages[5].skipped && skipStages[5].recognitionMs === 0 && skipStages[5].executionMs === 0, 'an OLL skip has neither');
  eq(skipStages[6].recognitionMs, 700, 'PLL\'s recognition runs from the last pair');
  // For a mode: its stages only, the first one's recognition 0 (the inspection).
  const f2l = built(WCA, 'white', [CROSS], [...PAIRS, OLL, PLL], (_, isFirst) => (isFirst ? 800 : 100));
  const run = runSession(f2l.scramble, f2l.scrambleFrame, modeGoal('f2l'), f2l.timed);
  const record = modeCubeSolve('f2l', { scramble: f2l.scramble, scrambleHolding: WCA, start: run.session.target, turns: run.session.turns });
  eq(modeRecordStages(record)!.map((s) => [s.stage, s.recognitionMs, s.executionMs, s.tps]),
    [['f2l1', 0, 200, 15], ['f2l2', 800, 200, 15], ['f2l3', 800, 200, 15], ['f2l4', 800, 200, 15]], 'F2L: each pair\'s recognition, execution and TPS of execution');
  const ll = built(WCA, 'white', [CROSS, ...PAIRS], [OLL, PLL], (_, isFirst) => (isFirst ? 1_500 : 100));
  const llRun = runSession(ll.scramble, ll.scrambleFrame, modeGoal('ll'), ll.timed);
  const llRecord = modeCubeSolve('ll', { scramble: ll.scramble, scrambleHolding: WCA, start: llRun.session.target, turns: llRun.session.turns });
  eq(modeRecordStages(llRecord)!.map((s) => [s.stage, s.recognitionMs, s.executionMs]), [['oll', 0, 800], ['pll', 1_500, 1_500]], 'LL: OLL from the first turn, PLL after its recognition');
}

// --- Records
{
  const hand = modeHandSolve('f2l', 'R U', 12_345.6, { penalty: 'plus2', inspectionMs: 9_000 });
  ok(hand.event === 'f2l' && hand.timer === 'hand' && hand.ms === 12_346 && hand.penalty === 'plus2' && hand.inspectionMs === 9_000, 'a hand-timed F2L solve');
  ok(modeRecordStages(hand) === null && modeMoveCount(hand) === undefined && readModeRecord(hand) === null, 'with no stages or moves');
  eq(modeHandSolve('cfop', 'R U', 1_000).event, handSolve('R U', 1_000).event, 'CFOP\'s hand solves as before');
  for (const mode of SOLVE_MODES) {
    const record = modeHandSolve(mode, 'R U', 9_000);
    const read = parseSolveRecord(JSON.parse(JSON.stringify(record)))!;
    ok(read !== null && read.event === mode, `${mode}: a record read back keeps its kind`);
    ok(/^[a-z0-9][a-z0-9-]{0,31}$/.test(read.event), `${mode}: its event fits the solves table`);
    eq(withPenalty(read, 'dnf').event, mode, `${mode}: a penalty keeps the kind`);
  }
  const b = built(WCA, 'white', [CROSS, ...PAIRS], [OLL, PLL]);
  const run = runSession(b.scramble, b.scrambleFrame, modeGoal('ll'), b.timed);
  const cube = modeCubeSolve('ll', { scramble: b.scramble, scrambleHolding: WCA, start: run.session.target, turns: run.session.turns, penalty: 'dnf' });
  const read = parseSolveRecord(JSON.parse(JSON.stringify(cube)))!;
  eq(read, cube, 'a cube-timed last-layer solve read back as it was');
  ok(read.penalty === 'dnf' && read.holding !== undefined && read.scrambleHolding!.top === 'white', 'with its penalty and holdings');
  // CFOP's records through the same functions: made by cubeSolve, read by readRecord.
  {
    const c = built({ top: 'yellow', front: 'blue' }, 'green', [], [CROSS, ...PAIRS, OLL, PLL]);
    const run = runSession(c.scramble, c.scrambleFrame, modeGoal('cfop'), c.timed);
    const record = modeCubeSolve('cfop', { scramble: c.scramble, scrambleHolding: { top: 'yellow', front: 'blue' }, start: run.session.target, turns: run.session.turns });
    ok(record.event === 'cfop' && record.crossColour === 'green', 'a CFOP cube solve, its cross colour read from the solve');
    eq(readModeRecord(record), readRecord(record), 'read as readRecord reads it');
    eq([modeMoveCount(record), recordMoveCount(record)], [37, 37], 'its moves as recordMoveCount counts them');
    eq(modeRecordStages(record)!.map((s) => s.notation), [CROSS, ...PAIRS, OLL, PLL], 'each stage\'s moves as made');
  }
  // CFOP's records from before modes read as before.
  const first = { id: 'a1b2c3d4-0000-4000-8000-000000000001', version: 1, event: 'cfop', recordedAt: '2026-11-26T01:18:00.000Z', scramble: 'R U', ms: 6_900, timer: 'cube', holding: 'yellow-blue', turns: [], moveCount: 0, split: { cross: 'U', ends: [] } };
  ok(parseSolveRecord(first)?.event === 'cfop', 'a CFOP record from the first version still reads');
  ok(parseSolveRecord({ ...first, event: 'skewb' }) === null && parseSolveRecord({ ...first, event: 'F2L' }) === null, 'unknown kinds do not');
  // Stats per kind: from each kind's own list.
  const times = (list: SolveRecord[]) => solveStats(list.map(countedMs));
  const cross = [9_000, 8_000, 7_000, 6_000, 5_000].map((ms) => modeHandSolve('cross', 'R', ms));
  ok(times(cross).ao5 === 7_000 && times(cross).best === 5_000, 'the cross\'s best and ao5 from its own solves');
}

// --- Several kinds between the device and an account (in-memory backends)
{
  const solve = (n: number, event: SolveMode, extra: Partial<SolveRecord> = {}): SolveRecord => ({
    ...modeHandSolve(event, 'R U', 10_000 + n), id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    recordedAt: new Date(Date.UTC(2026, 10, 28, 0, n)).toISOString(), ...extra,
  });
  function world({ server = [] as SolveRecord[], onDevice = [] as SolveRecord[], decision = null as ImportDecision | null } = {}) {
    const deviceRows = new Map(onDevice.map((r) => [r.id, r]));
    const serverRows = new Map(server.map((r) => [r.id, r]));
    const outboxes = new Map<string, Outbox>();
    const decisions = new Map<string, ImportDecision>(decision ? [['u1', decision]] : []);
    const loads: string[] = [];
    let online = true;
    const device: DeviceSolves = {
      load: async (event) => [...deviceRows.values()].filter((r) => r.event === event),
      put: async (r) => { deviceRows.set(r.id, JSON.parse(JSON.stringify(r))); },
      remove: async (id) => { deviceRows.delete(id); },
    };
    const account: AccountSolves = {
      load: async (_user, event) => {
        loads.push(event);
        return [...serverRows.values()].filter((r) => r.event === event);
      },
      save: async (_user, records) => { for (const r of records) serverRows.set(r.id, JSON.parse(JSON.stringify(r))); },
      remove: async (_user, ids) => { for (const id of ids) serverRows.delete(id); },
    };
    const memory: SyncMemory = {
      readOutbox: (user) => JSON.parse(JSON.stringify(outboxes.get(user) ?? { upserts: {}, deletes: [] })),
      writeOutbox: (user, outbox) => { outboxes.set(user, JSON.parse(JSON.stringify(outbox))); },
      importDecision: (user) => decisions.get(user) ?? null,
      setImportDecision: (user, d) => { decisions.set(user, d); },
    };
    const library = createSolveLibrary({ device, account, memory, online: () => online });
    return { library, deviceRows, serverRows, decisions, loads, setOnline: (v: boolean) => { online = v; } };
  }
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
  const ids = (list: readonly SolveRecord[]) => list.map((r) => r.id.slice(-2));

  // A guest: each kind's list is its own.
  {
    const w = world({ onDevice: [solve(1, 'cfop'), solve(2, 'f2l'), solve(3, 'll'), solve(4, 'f2l')] });
    w.library.setSource({ kind: 'device' });
    for (const mode of SOLVE_MODES) w.library.getSnapshot(mode);
    await settle();
    eq(SOLVE_MODES.map((m) => ids(w.library.getSnapshot(m).solves)), [['01'], [], ['04', '02'], ['03']], 'each kind lists its own solves');
    await w.library.save(solve(5, 'cross'));
    eq(ids(w.library.getSnapshot('cross').solves), ['05'], 'a new cross solve joins the cross\'s list');
    eq(ids(w.library.getSnapshot('cfop').solves), ['01'], 'and not CFOP\'s');
  }
  // Signed in on the F2L page: the offer counts every kind on the device;
  // importing brings them all, without writing over what the account has.
  {
    const accountCopy = withPenalty(solve(1, 'cfop'), 'dnf');
    const w = world({ server: [accountCopy, solve(9, 'f2l')], onDevice: [solve(1, 'cfop'), solve(2, 'cfop'), solve(3, 'f2l'), solve(4, 'll')] });
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('f2l');
    await settle();
    let snap = w.library.getSnapshot('f2l');
    eq(ids(snap.solves), ['09'], 'signed in on the F2L page: the account\'s F2L solves');
    eq(snap.offer, 3, 'the offer: every kind\'s device solves the account does not have');
    ok(w.loads.includes('cfop') && w.loads.includes('ll') && !w.loads.includes('cross'), 'kinds with device solves are read from the account to tell what it has');
    await w.library.importDevice('f2l');
    await settle();
    snap = w.library.getSnapshot('f2l');
    ok(w.serverRows.has(solve(2, 'cfop').id) && w.serverRows.has(solve(3, 'f2l').id) && w.serverRows.has(solve(4, 'll').id), 'imported from the F2L page: CFOP and last-layer solves too');
    eq(w.serverRows.get(accountCopy.id)!.penalty, 'dnf', 'the account\'s own copy of a solve stays as it is');
    ok(snap.offer === 0 && eqIds(snap.solves, ['09', '03']) && w.decisions.get('u1') === 'imported', 'the F2L list shows its import; the choice is remembered');
    w.library.getSnapshot('cfop');
    await settle();
    ok(w.library.getSnapshot('cfop').offer === 0 && eqIds(w.library.getSnapshot('cfop').solves, ['02', '01']), 'CFOP\'s page then offers nothing and lists the import');
  }
  // Chosen at the first sign-in: every kind brought in at once.
  {
    const w = world({ onDevice: [solve(1, 'cross'), solve(2, 'll')], decision: 'wanted' });
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('cfop');
    await settle();
    ok(w.serverRows.size === 2 && w.library.getSnapshot('cfop').offer === 0, 'import chosen at the first sign-in: every kind brought in');
  }
  // Declined from one page: no offer on another.
  {
    const w = world({ onDevice: [solve(1, 'cfop'), solve(2, 'll')] });
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('ll');
    await settle();
    eq(w.library.getSnapshot('ll').offer, 2, 'offered on the last layer\'s page');
    w.library.declineImport('ll');
    w.library.getSnapshot('cfop');
    await settle();
    ok(w.library.getSnapshot('cfop').offer === 0 && w.serverRows.size === 0, 'declined there: not offered on CFOP\'s');
  }
  // What the server does not have yet, of every kind (leaving the page asks first).
  {
    const w = world();
    w.library.setSource({ kind: 'account', userId: 'u1' });
    w.library.getSnapshot('f2l');
    w.library.getSnapshot('cross');
    await settle();
    w.setOnline(false);
    await w.library.save(solve(1, 'f2l'));
    await w.library.save(solve(2, 'cross'));
    eq(w.library.unsaved(), 2, 'two kinds waiting to be saved');
    w.setOnline(true);
    w.library.resume();
    await settle();
    eq(w.library.unsaved(), 0, 'saved once back online');
  }
}
function eqIds(list: readonly SolveRecord[], expected: string[]) {
  return JSON.stringify(list.map((r) => r.id.slice(-2))) === JSON.stringify(expected);
}

// --- The page's feed of scrambles (here without a worker, as where none can start)
{
  const f2l = scrambleFeed({ mode: 'f2l', face: 'U' });
  ok(scrambleFeed({ mode: 'f2l' }) === f2l && scrambleFeed({ mode: 'f2l', face: 'D' }) !== f2l, 'one feed per kind and cross face');
  ok(scrambleFeed({ mode: 'cross', face: 'D' }) === scrambleFeed({ mode: 'cross' }), 'the cross alone has one feed');
  const shown: (string | null)[] = [];
  const off = f2l.subscribe(() => shown.push(f2l.getSnapshot().scramble));
  for (let i = 0; i < 100 && f2l.getSnapshot().scramble === null; i++) await new Promise((resolve) => setTimeout(resolve, 20));
  const firstShown = f2l.getSnapshot().scramble!;
  ok(firstShown !== null && crossSolved(scrambleState(firstShown, WCA_FRAME()), 'U'), 'the F2L feed shows a scramble that leaves the white cross');
  for (let i = 0; i < 100; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  f2l.next();
  ok(f2l.getSnapshot().scramble !== null && f2l.getSnapshot().scramble !== firstShown, 'the next one was made ahead: shown at once');
  off();
  eq(f2l.getServerSnapshot(), { scramble: null, failed: false }, 'the server renders none');
}
function WCA_FRAME() { return colourFrame(WCA)!; }

// --- The client's check of the worker's scrambles: a worker of an earlier
// deploy (served from a service worker's cache) made CFOP scrambles on the
// F2L and last-layer pages; the client now tells and makes them itself.
{
  for (const mode of SOLVE_MODES) {
    for (const face of ['U', 'D', 'F'] as const) {
      for (let i = 0; i < 6; i++) {
        ok(scrambleFitsMode(mode, generateModeScramble(mode, face), face), `${mode} scramble ${i} for ${face} fits its mode`);
      }
    }
  }
  let caught = 0;
  for (let i = 0; i < 20; i++) {
    const cfop = generateModeScramble('cfop');
    if (!scrambleFitsMode('f2l', cfop, 'U') && !scrambleFitsMode('ll', cfop, 'U')) caught++;
  }
  eq(caught, 20, 'CFOP scrambles do not pass for F2L or the last layer');
  ok(!scrambleFitsMode('ll', generateModeScramble('f2l', 'U'), 'U'), 'nor does an F2L one for the last layer');
  ok(!scrambleFitsMode('f2l', generateModeScramble('f2l', 'U'), 'D'), 'nor one with its cross elsewhere');
  ok(!scrambleFitsMode('cross', "R' F' U' L' D' B'", 'U') || !goalWithinOneTurn(CROSS_GOAL, applyFaceTurns(SOLVED, "R' F' U' L' D' B'")), 'the cross: none within one turn');
  ok(!scrambleFitsMode('cross', 'R', 'U'), 'a cross one turn away does not fit');
  ok(!scrambleFitsMode('f2l', 'not a scramble', 'U'), 'nor does something that is not a scramble');
}

// --- How long scrambles take (Node on this machine; the page makes them in a worker, one ahead)
{
  const speed: string[] = [];
  for (const mode of SOLVE_MODES) {
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const started = performance.now();
      generateModeScramble(mode, 'U', seeded(700_000 + i));
      times.push(performance.now() - started);
    }
    const sorted = [...times].sort((a, b) => a - b);
    speed.push(`${mode} ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} ms (max ${sorted[sorted.length - 1].toFixed(0)})`);
  }
  console.log(`Scrambles: ${speed.join(', ')}.`);
  console.log(`Scramble lengths: ${SOLVE_MODES.map((m) => `${m} ${lengthRange(m)}`).join(', ')}.`);
}

console.log(`verify-solve-modes: ${checks} checks passed.`);
