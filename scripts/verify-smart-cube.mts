// Unit checks for the smart cube model, holdings, setup guide, trainer
// session and support detection. Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-smart-cube.mts
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import { ALL_F2LS } from '@/data/f2l-definitions';
import { F2L_PRESET_ALGORITHMS } from '@/data/f2l-preset-algorithms';
import { F2L_SCRAMBLE_POOL } from '@/data/f2l-scramble-pool';
import { ALL_OLLS } from '@/data/oll-definitions';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { rotationNeutral } from '@/lib/cube-rotation';
import { invertAlg } from '@/lib/invert-alg';
import {
  SOLVED, applyFaceTurns, applyTurn, isF2LSolved, isLastLayerOriented, isSolvedUpToLastLayerTurn, stateEquals,
  type Amount, type CubeState, type Face,
} from '@/lib/smart-cube/cube-state';
import { GanGen4Cipher, createCommandMessage, parseMac, toKociembaFacelets, type GanCubeEvent } from '@/lib/smart-cube/gan-gen4';
import { MAC_FORMAT_ERROR, startGanGen4Session, type GanTrafficRecord } from '@/lib/smart-cube/gan-gen4-session';
import { CUBE_HOLDINGS, lastLayerFace, userNotation, holdingFrame, type CubeHolding } from '@/lib/smart-cube/holding';
import { advanceGuide, applyPlan, guideView, planSetup, GUIDE_START, type SetupPlan } from '@/lib/smart-cube/setup-guide';
import { manualStart, sessionMove, startSession, type TrainerSession } from '@/lib/smart-cube/trainer-session';
import { smartCubeUnsupported } from '@/lib/smart-cube/support';
import { buildSmartSolve, mergeTurns, solveNotation, turnsPerSecond } from '@/lib/smart-cube/solve-record';
import { manualStartVirtual, resetVirtual, startVirtual, virtualMove, virtualNotation, type VirtualSession } from '@/lib/smart-cube/virtual-session';
import { displayRotation } from '@/lib/smart-cube/holding';
import { F2L_STICKERING_MASK, f2lStickeringMask } from '@/lib/f2l-stickering-mask';
import { OLL_STICKERING_MASK, ollStickeringMask } from '@/lib/oll-stickering-mask';

let checks = 0;
const ok = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const eq = <T,>(a: T, b: T, label: string) => { assert.deepEqual(a, b, label); checks++; };
const facelets = (s: CubeState) => toKociembaFacelets([...s.cp], [...s.co], [...s.ep], [...s.eo]);

// --- cube model
for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
  eq(applyTurn(SOLVED, face, 4), SOLVED, `${face}4 is identity`);
  ok(stateEquals(applyTurn(applyTurn(SOLVED, face, 1), face, 3), SOLVED), `${face} ${face}' is identity`);
}
let sexy = SOLVED;
for (let i = 0; i < 6; i++) sexy = applyFaceTurns(sexy, "R U R' U'");
ok(stateEquals(sexy, SOLVED), "(R U R' U')6 is identity");
// Example from gan-web-bluetooth's documentation of the same model.
const fr = applyFaceTurns(SOLVED, 'F R');
eq([fr.cp, fr.co, fr.ep, fr.eo], [[0, 5, 2, 1, 7, 4, 6, 3], [1, 2, 0, 2, 1, 1, 0, 2], [1, 9, 2, 3, 11, 8, 6, 7, 4, 5, 10, 0], [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]], 'F R matches the reference');
eq(facelets(SOLVED), 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', 'solved facelets');

// --- predicates, both last-layer faces
const TPERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
for (const ll of ['U', 'D'] as const) {
  const turn = (moves: string) => (ll === 'U' ? moves : moves.replace(/[UDRL]/g, (f) => ({ U: 'D', D: 'U', R: 'L', L: 'R' })[f]!));
  ok(isF2LSolved(SOLVED, ll) && isLastLayerOriented(SOLVED, ll) && isSolvedUpToLastLayerTurn(SOLVED, ll), `solved meets every goal (${ll})`);
  const auf = applyFaceTurns(SOLVED, turn('U2'));
  ok(isSolvedUpToLastLayerTurn(auf, ll), `an AUF counts as solved for PLL (${ll})`);
  const sune = applyFaceTurns(SOLVED, turn("R U R' U R U2 R'"));
  ok(isF2LSolved(sune, ll) && !isLastLayerOriented(sune, ll), `Sune keeps F2L, breaks orientation (${ll})`);
  const tperm = applyFaceTurns(SOLVED, turn(TPERM));
  ok(isLastLayerOriented(tperm, ll) && !isSolvedUpToLastLayerTurn(tperm, ll), `T-perm keeps orientation, is not solved (${ll})`);
  ok(!isSolvedUpToLastLayerTurn(applyFaceTurns(tperm, turn('U')), ll), `T-perm plus AUF is still not solved (${ll})`);
  ok(!isF2LSolved(applyFaceTurns(SOLVED, turn('R')), ll), `R breaks F2L (${ll})`);
  ok(!isF2LSolved(applyFaceTurns(SOLVED, turn('D')), ll), `a turn of the opposite face breaks F2L (${ll})`);
}

// --- holdings
eq(lastLayerFace('yellow-blue'), 'D', 'yellow top is the cube D face');
eq(lastLayerFace('white-green'), 'U', 'white top is the cube U face');
const cubeTurns = (plan: SetupPlan) => plan.steps.map((s) => Object.entries(s.turns).map(([f, n]) => `${f}${n === 1 ? '' : n === 2 ? '2' : "'"}`).join('+')).join(' ');
eq(cubeTurns(planSetup("R U R' U'", 'yellow-blue')!), "R D R' D'", 'yellow-blue maps U to D');
eq(cubeTurns(planSetup("R U F", 'yellow-green')!), 'L D F', 'yellow-green maps R to L');
eq(cubeTurns(planSetup("F B", 'yellow-blue')!), 'B F', 'yellow-blue swaps F and B');
eq(cubeTurns(planSetup("R U' F2", 'white-green')!), "R U' F2", 'white-green is the cube frame');
eq(userNotation(holdingFrame('yellow-blue'), 'D', 3), "U'", 'cube D\' reads as U\' with yellow on top');

// --- planning wide turns, slices, rotations and groups
eq(cubeTurns(planSetup('r U', 'white-green')!), 'L F', 'r is L then x');
eq(cubeTurns(planSetup("M U", 'white-green')!), "R+L' B", "M is R L' then x'");
eq(cubeTurns(planSetup('y R', 'white-green')!), 'B', 'a rotation changes the frame only');
eq(cubeTurns(planSetup("(R U)2 R'", 'white-green')!), "R U R U R'", 'groups repeat');
eq(cubeTurns(planSetup("(R U)'", 'white-green')!), "U' R'", 'a primed group is inverted');
eq(planSetup("R U Q", 'white-green'), null, 'unknown tokens are rejected');
const cancelling = planSetup("R U U' F", 'white-green')!;
eq(cubeTurns(cancelling), 'R F', 'turns of one face that cancel are dropped');
eq(cancelling.tokenEnds, [1, 1, 1, 2], 'cancelled tokens count as done with the step before');
eq(cubeTurns(planSetup("R' z' U", 'white-green')!), '', 'a turn and its inverse across a rotation cancel');
eq(cubeTurns(planSetup('R R', 'white-green')!), 'R2', 'repeated turns merge');

// --- independent check against cubing.js: does each preset reach the goal
// in both models? Covers every holding, wide turn, slice and rotation in the data.
const kpuzzle = await cube3x3x3.kpuzzle();
const kSolved = kpuzzle.defaultPattern();
const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => `${a} ${b}`.trim()));
const PREFIX: Record<CubeHolding, string> = { 'yellow-blue': 'x2', 'yellow-green': 'z2', 'white-green': '' };
// The virtual cube is drawn with the same rotations these checks use.
for (const h of CUBE_HOLDINGS) eq(displayRotation(h), PREFIX[h], `display rotation for ${h}`);
function kNormalized(p: KPattern): KPattern {
  for (const r of ROTATIONS) {
    const q = r ? p.applyAlg(r) : p;
    if (q.patternData.CENTERS.pieces.every((x, i) => x === kSolved.patternData.CENTERS.pieces[i])) return q;
  }
  throw new Error('no rotation homes the centres');
}
// cubing.js piece order: corners/edges 0-3 U layer, 4-7 D layer, edges 8-11 middle.
function kGoal(p: KPattern, ll: 'U' | 'D', goal: 'f2l' | 'oll'): boolean {
  const q = kNormalized(p);
  const llSet = ll === 'U' ? [0, 1, 2, 3] : [4, 5, 6, 7];
  for (const orbit of ['CORNERS', 'EDGES'] as const) {
    const d = q.patternData[orbit];
    for (let i = 0; i < d.pieces.length; i++) {
      if (llSet.includes(i)) { if (goal === 'oll' && d.orientation[i] !== 0) return false; continue; }
      if (d.pieces[i] !== i || d.orientation[i] !== 0) return false;
    }
  }
  return true;
}
let compared = 0, reached = 0;
function compare(holding: CubeHolding, alg: string, goal: 'f2l' | 'oll', label: string) {
  const plan = planSetup(alg, holding);
  assert.ok(plan, `${label}: plan`);
  const ll = lastLayerFace(holding);
  const mine = applyPlan(SOLVED, plan);
  const ours = goal === 'f2l' ? isF2LSolved(mine, ll) : isLastLayerOriented(mine, ll);
  const theirs = kGoal(kSolved.applyAlg(`${PREFIX[holding]} ${alg}`), ll, goal);
  assert.equal(ours, theirs, `${label} (${holding}): ours ${ours}, cubing.js ${theirs}`);
  compared++;
  if (ours) reached++;
}
for (const holding of CUBE_HOLDINGS) {
  for (const def of ALL_F2LS) {
    for (const p of F2L_PRESET_ALGORITHMS[def.id]) compare(holding, `${def.setupAlg} ${p}`, 'f2l', `${def.id} ${p}`);
    for (const s of F2L_SCRAMBLE_POOL[def.id] ?? []) compare(holding, `${s} ${def.primaryAlg}`, 'f2l', `${def.id} pool ${s}`);
  }
  for (const def of ALL_OLLS) {
    for (const p of OLL_PRESET_ALGORITHMS[def.id]) compare(holding, `${def.setupAlg} ${rotationNeutral(p)}`, 'oll', `${def.id} ${p}`);
  }
  for (const [id, presets] of Object.entries(PRESET_ALGORITHMS)) {
    for (const p of presets) compare(holding, rotationNeutral(p), 'oll', `PLL ${id} ${p}`);
  }
}
checks += compared;
console.log(`  ${compared} preset checks agree with cubing.js (${reached} reach the goal).`);

// --- setup guide
const plan = planSetup("R U2 M' r", 'white-green')!;
const feed = (p: SetupPlan, moves: [Face, Amount][]) => moves.reduce((g, [f, n]) => advanceGuide(p, g, f, n), GUIDE_START);
let g = feed(plan, [['R', 1], ['U', 3], ['U', 3]]);
eq(g.step, 2, "U2 can be turned as U' U'");
eq(guideView(plan, g).doneTokens, 2, 'two tokens done');
g = feed(plan, [['R', 1], ['U', 1], ['U', 1], ['L', 1], ['R', 3]]);
eq(g.step, 3, "M' accepts L then R'");
g = feed(plan, [['R', 1], ['U', 1], ['U', 1], ['R', 3], ['L', 1]]);
eq(g.step, 3, "M' accepts R' then L");
g = feed(plan, [['R', 1], ['F', 1], ['F', 1]]);
eq(g.wrong, [{ face: 'F', amount: 2 }], 'wrong turns of one face merge');
eq(guideView(plan, g).undo, 'F2', 'undo shows the merged turn');
g = advanceGuide(plan, g, 'F', 2);
eq([g.step, g.wrong.length], [1, 0], 'undoing returns to the path');
g = feed(plan, [['R', 1], ['U', 1]]);
eq(guideView(plan, g).remaining, 'U', 'half done U2 needs one more U');
const yb = planSetup("R U", 'yellow-blue')!;
eq(guideView(yb, feed(yb, [['R', 1], ['B', 1]])).undo, "F'", 'undo is written in the user frame');

// --- trainer session: F2L with yellow on top
const f2lPlan = planSetup("R U R'", 'yellow-blue')!;
// Yellow on top: the last layer is the cube's D face.
let session: TrainerSession = startSession('f2l', 'D', f2lPlan, applyFaceTurns(SOLVED, 'D'));
eq(session.phase, 'setup', 'F2L solved with any last layer is a base');
let state = session.base!;
const turn = (face: Face, amount: 1 | 3, t: number) => {
  state = applyTurn(state, face, amount);
  const r = sessionMove(session, { face, amount, cubeTime: t, state });
  session = r.session;
  return r.event;
};
eq(turn('R', 1, 100), null, 'first setup turn');
eq(turn('D', 1, 200), null, 'second setup turn (U is the cube D face)');
eq(turn('R', 3, 300), 'ready', 'setup done is ready');
// Solve with the inverse, R U' R' (cube R D' R').
eq(turn('R', 1, 1300), 'start', 'first solving turn starts');
eq(session.recognitionMs, 1000, 'recognition is ready to first turn');
eq(turn('D', 3, 1700), null, 'not solved yet');
eq(turn('R', 3, 2100), 'stop', 'F2L solved stops');
eq(session.elapsedMs, 800, 'elapsed is first turn to last turn on the cube clock');
eq(session.solveTurns.map((x) => `${x.face}${x.amount === 3 ? "'" : ''}@${x.cubeTime}`), ['R@1300', "D'@1700", "R'@2100"], 'solving turns are kept with cube times');
const record = buildSmartSolve({
  id: 'x', recordedAt: '2026-11-23T00:00:00.000Z', practice: 'f2l', caseId: 'F2L-1', holding: 'yellow-blue', scramble: "R U R'",
  turns: session.solveTurns, recognitionMs: session.recognitionMs, executionMs: session.elapsedMs!,
});
eq([record.moveCount, record.tps, record.turns.map((x) => x.t), record.startCubeTime], [3, 3.75, [0, 400, 800], 1300], 'record counts, TPS and relative times');
eq(solveNotation(record.turns, record.holding), "R U' R'", 'the record reads in the holding it was made with');

// Wrong turns, then re-solving F2L by other means, restarts the setup.
session = startSession('f2l', 'D', f2lPlan, SOLVED);
state = SOLVED;
turn('F', 1, 10);
eq(session.progress.wrong.length, 1, 'a wrong turn is tracked');
turn('F', 3, 20);
eq([session.phase, session.progress.wrong.length], ['setup', 0], 'taking it back clears it');
// A last-layer pre-turn before starting is absorbed into the base.
turn('D', 1, 30);
turn('D', 1, 40); // a half turn arrives as two quarter turns
eq([session.phase, session.progress.step], ['setup', 0], 'a pre-AUF restarts the setup from the new base');
ok(stateEquals(session.base!, applyFaceTurns(SOLVED, 'D2')), 'the base includes the pre-AUF');

// Not at a base: wait until the goal state appears.
session = startSession('pll', 'D', planSetup(TPERM, 'yellow-blue')!, applyFaceTurns(SOLVED, 'R'));
state = applyFaceTurns(SOLVED, 'R');
eq(session.phase, 'need-base', 'a scrambled cube needs solving first');
turn('R', 3, 10);
eq(session.phase, 'setup', 'solving it captures the base');

// PLL stops at solved apart from the final AUF; manual start keeps no cube time.
session = manualStart(startSession('pll', 'D', planSetup(TPERM, 'yellow-blue')!, SOLVED));
state = applyFaceTurns(SOLVED, 'D');
eq(sessionMove(session, { face: 'D', amount: 1, cubeTime: 5, state }).event, 'stop', 'an AUF away from solved stops PLL');
eq(sessionMove(session, { face: 'D', amount: 1, cubeTime: 5, state }).session.elapsedMs, null, 'manual start leaves the time to the trainer');

// --- whole attempts on the setups the trainers actually show: turning the
// planned setup reaches ready exactly at the end, and solving stops the timer.
const { alternativeSetups } = await import('@/lib/last-layer-alternatives');
const { buildLastLayerSetup } = await import('@/lib/last-layer-setup');
const { splitAuf } = await import('@/lib/auf-from-algorithm');
const { prefixAuf } = await import('@/lib/f2l-auf');
const { AUFS } = await import('@/types/pll');
function attempt(practice: 'f2l' | 'oll' | 'pll', holding: CubeHolding, scramble: string, solution: string, label: string) {
  const setupPlan = planSetup(scramble, holding);
  const solvePlan = planSetup(solution, holding);
  assert.ok(setupPlan && solvePlan, `${label}: plans`);
  let st = startSession(practice, lastLayerFace(holding), setupPlan, SOLVED);
  let cube = SOLVED;
  let time = 0;
  const events: string[] = [];
  const feed = (p: SetupPlan) => {
    for (const step of p.steps) {
      for (const [face, n] of Object.entries(step.turns) as [Face, Amount][]) {
        // A half turn arrives as two quarter turns.
        for (const amount of (n === 2 ? [1, 1] : [n]) as (1 | 3)[]) {
          cube = applyTurn(cube, face, amount);
          const r = sessionMove(st, { face, amount, cubeTime: (time += 100), state: cube });
          st = r.session;
          if (r.event) events.push(r.event);
        }
      }
    }
  };
  feed(setupPlan);
  assert.deepEqual(events, setupPlan.steps.length ? ['ready'] : [], `${label}: ready once, at the end of the setup`);
  feed(solvePlan);
  assert.equal(st.phase, 'done', `${label}: solving stops the timer (${events.join(',')})`);
  assert.ok(st.elapsedMs !== null && st.elapsedMs >= 0, `${label}: elapsed on the cube clock`);
  assert.equal(st.solveTurns[st.solveTurns.length - 1].cubeTime - st.solveTurns[0].cubeTime, st.elapsedMs, `${label}: kept turns span the elapsed time`);
  checks++;
  // No scramble: the same case on a virtual cube, solved by the same turns
  // whatever the physical cube's state.
  let v: VirtualSession | null = startVirtual(practice, holding, scramble, 0);
  assert.ok(v, `${label}: virtual case`);
  assert.ok(!stateEquals(v.caseState, SOLVED) || !setupPlan.steps.length, `${label}: the virtual case is not solved`);
  const vEvents: string[] = [];
  let vt = 1000;
  for (const step of solvePlan.steps) {
    for (const [face, n] of Object.entries(step.turns) as [Face, Amount][]) {
      for (const amount of (n === 2 ? [1, 1] : [n]) as (1 | 3)[]) {
        const r = virtualMove(v!, { face, amount, cubeTime: (vt += 100), hostTime: vt });
        v = r.session;
        if (r.event) vEvents.push(r.event);
      }
    }
  }
  assert.equal(v!.phase, 'done', `${label}: the virtual solve stops (${vEvents.join(',')})`);
  assert.equal(vEvents[0], 'start', `${label}: the first turn starts the virtual attempt`);
  checks++;
}
let attempts = 0;
for (const holding of CUBE_HOLDINGS) {
  for (const [practice, presets] of [['oll', OLL_PRESET_ALGORITHMS], ['pll', PRESET_ALGORITHMS]] as const) {
    for (const [id, algs] of Object.entries(presets as Record<string, readonly string[]>)) {
      const all = algs.map((preset) => { const { auf, rest } = splitAuf(preset); return { auf, algorithm: rest }; });
      const alternatives = all.map((r) => prefixAuf(r.auf, r.algorithm));
      for (const offset of AUFS) {
        let setups: string[] = [];
        const plain = buildLastLayerSetup(all[0], 'cube', offset, (inverse) => {
          setups = alternativeSetups(kpuzzle, practice, inverse, alternatives);
          return inverse;
        });
        for (const base of [plain.scramble, ...setups.map((alt) => buildLastLayerSetup(all[0], 'cube', offset, () => alt).scramble)]) {
          attempt(practice, holding, base, rotationNeutral(plain.solution), `${id} ${offset} ${base}`);
          attempts++;
        }
      }
    }
  }
  for (const def of ALL_F2LS) {
    for (const scramble of F2L_SCRAMBLE_POOL[def.id] ?? []) {
      attempt('f2l', holding, scramble, invertAlg(scramble), `${def.id} ${scramble}`);
      attempts++;
    }
  }
}
console.log(`  ${attempts} trainer attempts reach ready and stop in every holding.`);

// --- solve records
eq(mergeTurns([{ face: 'R', amount: 1 }, { face: 'R', amount: 1 }]), [{ face: 'R', amount: 2 }], 'R R is R2');
eq(mergeTurns([{ face: 'R', amount: 1 }, { face: 'R', amount: 3 }, { face: 'U', amount: 1 }]), [{ face: 'U', amount: 1 }], "R R' cancels");
eq(mergeTurns([{ face: 'R', amount: 1 }, { face: 'L', amount: 3 }]).length, 2, 'a slice counts as two outer turns');
eq(solveNotation([{ face: 'D', amount: 1 }, { face: 'D', amount: 1 }, { face: 'B', amount: 3 }], 'yellow-blue'), "U2 F'", 'notation follows the holding');
eq(solveNotation([{ face: 'D', amount: 3 }], 'white-green'), "D'", 'white-green keeps cube faces');
eq([turnsPerSecond(12, 2000), turnsPerSecond(5, 0)], [6, 0], 'TPS, and zero for no time');
eq(manualStart(startSession('pll', 'D', planSetup(TPERM, 'yellow-blue')!, SOLVED)).solveTurns, [], 'a hand-started attempt keeps no turns');

// --- no scramble
{
  const tperm = startVirtual('pll', 'yellow-blue', TPERM, 1000)!;
  ok(stateEquals(tperm.caseState, applyPlan(SOLVED, planSetup(TPERM, 'yellow-blue')!)), 'the virtual case is the setup applied to a solved cube');
  eq(tperm.phase, 'ready', 'the virtual case is ready at once');
  let v = tperm;
  const solveSteps = planSetup(TPERM, 'yellow-blue')!.steps; // T-perm is its own inverse
  const events: string[] = [];
  let t = 5000;
  for (const step of solveSteps) {
    for (const [face, n] of Object.entries(step.turns) as [Face, Amount][]) {
      for (const amount of (n === 2 ? [1, 1] : [n]) as (1 | 3)[]) {
        const r = virtualMove(v, { face, amount, cubeTime: (t += 100), hostTime: t - 3000 });
        v = r.session;
        if (r.event) events.push(r.event);
      }
    }
  }
  eq(events, ['start', 'stop'], 'the first turn starts and the goal stops');
  eq(v.recognitionMs, 1100, 'recognition is case shown to first turn on the host clock');
  eq(v.elapsedMs, v.solveTurns[v.solveTurns.length - 1].cubeTime - v.solveTurns[0].cubeTime, 'elapsed on the cube clock');
  eq(virtualNotation(v).slice(0, 4), ['R', 'U', "R'", "U'"], 'virtual turns read in the holding');
  const again = resetVirtual(v, 9000);
  ok(stateEquals(again.state, again.caseState) && again.phase === 'ready' && again.turns.length === 0, 'reset returns to the case');
  eq(virtualMove(v, { face: 'R', amount: 1, cubeTime: 1, hostTime: 1 }).event, null, 'turns after the stop are ignored');
  const byHand = manualStartVirtual(tperm);
  eq([byHand.phase, byHand.startAt], ['running', null], 'a hand-started virtual attempt has no cube start');
  eq(startVirtual('pll', 'yellow-blue', 'R Q', 0), null, 'an unplannable setup gives no virtual case');
}

// --- stickering masks for the virtual cube
{
  type Mask = { orbits: Record<string, { pieces: ({ facelets: string[] } | null)[] }> };
  // Which pieces show any colour, per orbit.
  const shown = (mask: Mask) => Object.fromEntries(Object.entries(mask.orbits).map(([orbit, { pieces }]) => [
    orbit, pieces.flatMap((p, i) => (p?.facelets.some((f) => f === 'regular') ? [i] : [])),
  ]));
  eq(f2lStickeringMask('D'), F2L_STICKERING_MASK, 'the F2L view keeps its mask');
  eq(ollStickeringMask('D'), OLL_STICKERING_MASK, 'the OLL view keeps its mask');
  eq(shown(f2lStickeringMask('D')), { CORNERS: [0, 1, 2, 3], EDGES: [0, 1, 2, 3, 8, 9, 10, 11], CENTERS: [0, 1, 2, 3, 4] }, 'F2L, yellow top: the yellow layer is grey');
  eq(shown(f2lStickeringMask('U')), { CORNERS: [4, 5, 6, 7], EDGES: [4, 5, 6, 7, 8, 9, 10, 11], CENTERS: [1, 2, 3, 4, 5] }, 'F2L, white top: the white layer is grey');
  eq(shown(ollStickeringMask('D')), { CORNERS: [4, 5, 6, 7], EDGES: [4, 5, 6, 7], CENTERS: [5] }, 'OLL, yellow top: only the yellow layer');
  eq(shown(ollStickeringMask('U')), { CORNERS: [0, 1, 2, 3], EDGES: [0, 1, 2, 3], CENTERS: [0] }, 'OLL, white top: only the white layer');
  for (const ll of ['U', 'D'] as const) {
    const mask = ollStickeringMask(ll) as Mask;
    ok(Object.values(mask.orbits).every(({ pieces }) => pieces.every((p) => p!.facelets.slice(1).every((f) => f === 'ignored'))), `OLL ${ll}: only the top colour facelet shows`);
  }
}

// --- the GAN Gen4 session shared by the browser and iOS transports
{
  const MAC = '0C:3D:5E:BD:A2:6E';
  const cipher = new GanGen4Cipher(parseMac(MAC)!);
  // A plaintext packet from big-endian bit fields, as the cube sends them.
  const packet = (fields: [number, number][], littleEndian: number[] = []) => {
    let bits = '';
    fields.forEach(([length, value], i) => {
      let word = value.toString(2).padStart(length, '0');
      if (littleEndian.includes(i)) word = (word.match(/.{8}/g) ?? []).reverse().join('');
      bits += word;
    });
    return new Uint8Array((bits.padEnd(160, '0').match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  };
  const solvedFacelets = cipher.encrypt(packet(
    [[8, 0xed], [8, 0x0e], [16, 7], ...[0, 1, 2, 3, 4, 5, 6].map((c): [number, number] => [3, c]),
      ...Array.from({ length: 8 }, (): [number, number] => [2, 0]), ...Array.from({ length: 11 }, (_v, e): [number, number] => [4, e])],
    [2],
  ));

  const events: GanCubeEvent[] = [];
  const traffic: GanTrafficRecord[] = [];
  const reasons: string[] = [];
  const written: Uint8Array[] = [];
  let closes = 0;
  let releaseFirst: () => void = () => {};
  let clock = 1000;
  const session = startGanGen4Session('GANi4_A26E', MAC, {
    onEvent: (e) => events.push(e),
    onTraffic: (r) => traffic.push(r),
    onDisconnect: (reason) => reasons.push(reason),
  }, {
    // The first write is held, to show that the next one waits for it.
    write: (data) => {
      written.push(data);
      return written.length === 1 ? new Promise<void>((resolve) => { releaseFirst = resolve; }) : Promise.resolve();
    },
    close: () => { closes++; },
  }, { now: () => clock++ });

  let threw = '';
  try {
    startGanGen4Session('GAN', 'not a mac', { onEvent() {}, onDisconnect() {} }, { write: async () => {}, close() {} });
  } catch (error) {
    threw = (error as Error).message;
  }
  eq(threw, MAC_FORMAT_ERROR, 'a session needs a valid MAC');
  eq(session.connection.deviceName, 'GANi4_A26E', 'the session keeps the device name');

  session.receive(solvedFacelets);
  const facelets = events.find((e) => e.type === 'FACELETS');
  ok(facelets?.type === 'FACELETS' && facelets.serial === 7, 'a notification decrypts into the cube state event');
  ok(traffic.some((r) => r.op === 'notify' && r.valid === true && r.t >= 1000), 'notifications are logged with the session clock');
  session.receive(new Uint8Array(8));
  ok(traffic.at(-1)?.valid === false && events.length === 1, 'a short notification is logged as invalid and ignored');

  const first = session.connection.sendCommand({ type: 'REQUEST_BATTERY' });
  const second = session.connection.sendCommand({ type: 'REQUEST_HARDWARE' });
  await Promise.resolve();
  eq(written.length, 1, 'a write waits for the one before it');
  releaseFirst();
  await Promise.all([first, second]);
  eq(written.length, 2, 'the queued write goes after the first finishes');
  eq(Buffer.from(written[0]).toString('hex'), Buffer.from(cipher.encrypt(createCommandMessage({ type: 'REQUEST_BATTERY' }))).toString('hex'), 'commands are encrypted with the MAC');
  ok(traffic.filter((r) => r.op === 'write').length === 2, 'writes are logged');

  session.close('test');
  session.close('again');
  session.receive(solvedFacelets);
  eq([closes, reasons], [1, ['test']], 'closing is done once and reported once');
  eq(events.filter((e) => e.type === 'FACELETS').length, 1, 'nothing is handled after closing');

  let silentReasons = 0;
  const failed = startGanGen4Session('GAN', MAC, { onEvent() {}, onDisconnect: () => { silentReasons++; } }, { write: async () => {}, close() {} });
  failed.close('setup failed', false);
  eq(silentReasons, 0, 'a failed setup closes without reporting a disconnect');

}

// --- support detection
const env = { hasBluetooth: false, secureContext: true, maxTouchPoints: 0, nativeApp: false };
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
eq(smartCubeUnsupported({ ...env, hasBluetooth: true, userAgent: CHROME }), null, 'desktop Chrome is supported');
eq(smartCubeUnsupported({ ...env, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }), 'ios', 'iPhone');
eq(smartCubeUnsupported({ ...env, maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' }), 'ios', 'iPad reporting a Mac');
eq(smartCubeUnsupported({ ...env, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' }), 'safari', 'Safari on a Mac');
eq(smartCubeUnsupported({ ...env, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:140.0) Gecko/20100101 Firefox/140.0' }), 'firefox', 'Firefox');
eq(smartCubeUnsupported({ ...env, hasBluetooth: true, secureContext: false, userAgent: CHROME }), 'insecure', 'http');
eq(smartCubeUnsupported({ ...env, nativeApp: true, hasBluetooth: false, userAgent: CHROME }), 'native-app', 'iOS app');

console.log(`All ${checks} smart cube checks passed.`);
