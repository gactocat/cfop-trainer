// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-practice.mts
//
// Session figures (the whole session and per case), the AUF a case starts
// with, the hold-to-start timer, each selected case once, and move counts.
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import { F2L_PRESET_ALGORITHMS } from '@/data/f2l-preset-algorithms';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { aufStartOf, aufStartPatch, caseOffset, type AufStart } from '@/lib/auf-start';
import { rotationNeutral } from '@/lib/cube-rotation';
import { appendUTurn, prefixAuf, splitF2LAuf } from '@/lib/f2l-auf';
import { buildF2LSetup, seededRandom } from '@/lib/f2l-scramble';
import { holdStep, type HoldInput, type HoldPhase } from '@/lib/hold-timer';
import { saveCubeSolve, type CaseTimes } from '@/lib/practice-log';
import { countMoves, movesPerSecond, solutionMoves } from '@/lib/move-count';
import { doneCases, nextRoundCase, roundPosition, shuffled } from '@/lib/practice-round';
import { buildLastLayerSetup, buildPracticeSetup } from '@/lib/last-layer-setup';
import { summarizeByCase, summarizeSession, type SessionSolve } from '@/lib/session-stats';
import type { F2LId } from '@/types/f2l';
import { AUFS } from '@/types/pll';

let checks = 0;
const ok = (condition: boolean, message: string) => { assert.ok(condition, message); checks++; };
const near = (a: number | undefined, b: number, message: string) => ok(a !== undefined && Math.abs(a - b) < 1e-9, `${message}: ${a} vs ${b}`);

// --- Session figures per case
const solve = (caseId: string, seconds: number, recognitionMs: number | null, undone = false, moveCount: number | null = null): SessionSolve =>
  ({ caseId, name: `${caseId} Perm`, seconds, recognitionMs, undone, moveCount, tps: moveCount === null ? null : movesPerSecond(moveCount, seconds) });
// Newest first, as the session log keeps them.
const rows = summarizeByCase([
  solve('T', 1.5, 900),
  solve('Ua', 3.0, 500, true),
  solve('Aa', 2.0, null),
  solve('T', 2.5, 1100),
  solve('Aa', 1.0, 700),
  solve('Z', 4.0, null),
]);
ok(rows.map((r) => r.caseId).join() === 'T,Aa,Z', 'cases ordered by their latest solve; a case only undone is left out');
const [t, aa, z] = rows;
ok(t.count === 2 && t.name === 'T Perm', 'T counts its two solves');
near(t.solve.mean, 2.0, 'T solve mean');
near(t.solve.best, 1.5, 'T solve best');
near(t.recognition?.mean, 1.0, 'T recognition mean');
near(t.recognition?.best, 0.9, 'T recognition best');
ok(aa.count === 2, 'Aa counts a solve without recognition');
near(aa.solve.mean, 1.5, 'Aa solve mean includes both');
near(aa.recognition?.mean, 0.7, 'Aa recognition mean only over solves that had one');
near(aa.recognition?.best, 0.7, 'Aa recognition best');
ok(z.recognition === null, 'no recognition at all shows as none');
ok(summarizeByCase([]).length === 0, 'empty session');
ok(summarizeByCase([solve('T', 2, 800, true), solve('T', 1, 600)]).map((r) => r.count).join() === '1', 'undone solves are not counted');
ok(summarizeByCase([solve('T', 2, 800, true), solve('Aa', 1, 600), solve('T', 3, 900)]).map((r) => r.caseId).join() === 'Aa,T',
  'an undone latest solve does not move its case to the top');

// --- The whole session: mean time, moves and TPS over the kept solves
const session = [
  solve('T', 2.0, null, false, 14),
  solve('Ua', 9.0, null, true, 11),
  solve('Aa', 1.5, null, false, 9),
  solve('T', 3.0, null, false, null),
];
const totals = summarizeSession(session);
ok(totals.count === 3, 'an undone solve is not counted');
near(totals.meanSeconds ?? undefined, (2.0 + 1.5 + 3.0) / 3, 'mean time over kept solves');
near(totals.meanMoves ?? undefined, (14 + 9) / 2, 'mean moves over solves whose moves are known');
near(totals.meanTps ?? undefined, (7 + 6) / 2, 'mean TPS: the mean of each solve\'s TPS');
const empty = summarizeSession([]);
ok(empty.count === 0 && empty.meanSeconds === null && empty.meanMoves === null && empty.meanTps === null, 'an empty session has no figures');
const byCase = summarizeByCase(session);
ok(byCase.map((r) => r.caseId).join() === 'T,Aa', 'per case, newest first, undone left out');
near(byCase[0].moves ?? undefined, 14, 'per case moves over the known ones');
near(byCase[0].tps ?? undefined, 7, 'per case TPS');
ok(byCase[1].recognition === null, 'no recognition without a cube');

// --- Move counts: face and wide turns 1, slices 2, rotations 0, groups times their repeat
ok(countMoves("R U R' U'") === 4, 'plain turns');
ok(countMoves("R U2 R' U2") === 4, 'a half turn is one move');
ok(countMoves("y R U R'") === 3 && countMoves("x2 z' R") === 1, 'rotations are not moves');
ok(countMoves("r U r' M2") === 4 && countMoves("M2 U M U2 M' U M2") === 7, 'a wide turn is one, a slice one');
ok(countMoves("Rw U Rw' 2R") === 4, 'Rw-style wide turns and layer prefixes');
ok(countMoves("(R U R' U')2") === 8 && countMoves("(R U R' U')'") === 4, 'groups count times their repeat');
ok(countMoves('') === 0 && solutionMoves('U0', '') === null, 'no algorithm, no moves');
ok(solutionMoves('U0', "R U R'") === 3 && solutionMoves("U'", "R U R'") === 4, 'an AUF needed first is one more move');
ok(movesPerSecond(12, 2) === 6 && movesPerSecond(10, 3) === 3.33 && movesPerSecond(5, 0) === null, 'TPS to two decimals');

// --- The hold-to-start timer
const walk = (inputs: HoldInput[], from: HoldPhase = 'idle', pressOnNext = false) => {
  let phase = from;
  const effects: string[] = [];
  for (const input of inputs) {
    const step = holdStep(phase, input, { pressOnNext });
    phase = step.phase;
    if (step.effect) effects.push(step.effect);
  }
  return { phase, effects: effects.join() };
};
ok(walk(['press', 'release']).phase === 'idle' && walk(['press', 'release']).effects === '', 'letting go too soon does not start');
ok(walk(['press', 'held']).phase === 'armed', 'held long enough arms');
ok(walk(['press', 'held', 'release']).effects === 'start' && walk(['press', 'held', 'release']).phase === 'running', 'letting go when armed starts');
ok(walk(['press', 'held', 'release', 'release']).phase === 'running', 'a stray release while running does nothing');
ok(walk(['press', 'held', 'release', 'press']).effects === 'start,stop', 'a press while running stops');
ok(walk(['press', 'held', 'release', 'press', 'release']).phase === 'stopped', 'the release after stopping does nothing');
ok(walk(['press', 'cancel']).phase === 'idle' && walk(['press', 'held', 'cancel']).effects === '', 'Escape drops a hold without starting');
ok(walk(['press', 'held', 'release', 'cancel']).effects === 'start,abort', 'Escape while running drops the attempt');
ok(walk(['held', 'release'], 'idle').phase === 'idle', 'nothing happens without a press');
ok(walk(['press'], 'stopped').effects === 'next' && walk(['press'], 'stopped').phase === 'idle', 'a press on the result goes on');
ok(walk(['press', 'held', 'release'], 'stopped', true).effects === 'next,start', 'without a setup, holding on the result starts the next case');
ok(walk(['press', 'release'], 'stopped', true).phase === 'idle', 'a short press on the result only goes on');

// --- Each selected case once
const cases = ['T', 'Aa', 'Ua', 'Z'];
const order = shuffled(cases, seededRandom(7));
ok([...order].sort().join() === [...cases].sort().join(), 'the round deals every case once');
const orders = new Set(Array.from({ length: 20 }, (_, i) => shuffled(cases, seededRandom(i + 1)).join()));
ok(orders.size > 1, 'the order is random');
const dealt = (caseId: string, undone = false) => ({ caseId, undone });
ok(nextRoundCase(order, []) === order[0], 'the round starts with its first case');
ok(nextRoundCase(order, [dealt(order[0])]) === order[1], 'then the next');
ok(nextRoundCase(order, [dealt(order[1]), dealt(order[0], true)]) === order[0], 'an undone case comes again');
ok(doneCases(order, [dealt(order[0]), dealt(order[0]), dealt('Ga')]).size === 1, 'a case counts once, other cases not at all');
ok(nextRoundCase(order, order.map((id) => dealt(id))) === null, 'done once every case has a kept solve');
ok(roundPosition(2, 4, false) === 3 && roundPosition(3, 4, true) === 3 && roundPosition(4, 4, false) === 4, 'which case of the round is on screen');

// --- What a cube-timed solve saves: case practice its time and the cube's
// record; random practice nothing (the session only)
const saved: string[] = [];
const caseTimes: CaseTimes = {
  add: (seconds) => { saved.push(`time ${seconds}`); return 't1'; },
  remove: (id) => { saved.push(`remove ${id}`); },
  best: null, ao5: null, count: 0,
};
const smartSaves = { saveSmart: (solve: string) => { saved.push(`smart ${solve}`); return 's1'; }, deleteSmart: (id: string) => { saved.push(`delete ${id}`); } };
ok(saveCubeSolve({ caseTimes: undefined, seconds: 1.2, solve: 'turns', ...smartSaves }) === null && saved.length === 0,
  'random practice saves neither a time nor the cube record');
const undoCase = saveCubeSolve({ caseTimes, seconds: 1.2, solve: 'turns', ...smartSaves });
ok(saved.join() === 'time 1.2,smart turns', 'case practice saves the time and the cube record');
undoCase?.();
ok(saved.join() === 'time 1.2,smart turns,remove t1,delete s1', 'undo takes both back');
saved.length = 0;
saveCubeSolve({ caseTimes, seconds: 2, solve: null, ...smartSaves });
ok(saved.join() === 'time 2', 'a solve stopped by hand saves its time only');

// --- The AUF choice
ok(aufStartOf({ randomAuf: true }) === 'random', 'saved random AUF reads as random');
ok(aufStartOf({ randomAuf: false }) === 'in-algorithm', 'the old "as set" reads as the AUF in the algorithm');
ok(aufStartOf({ randomAuf: false, alignAuf: true }) === 'pre-applied', 'aligned AUF reads as pre-applied');
ok(aufStartOf({ randomAuf: true, alignAuf: true }) === 'pre-applied', 'aligning wins over a stale random flag');
for (const choice of ['pre-applied', 'in-algorithm', 'random'] as AufStart[]) {
  ok(aufStartOf(aufStartPatch(choice)) === choice, `${choice} survives saving`);
}
ok(aufStartPatch('pre-applied').randomAuf === false, 'versions before alignAuf read pre-applied as "as set", not random');
ok(!aufStartPatch('in-algorithm').randomAuf && !aufStartPatch('in-algorithm').alignAuf, 'in-algorithm is stored as the old "as set"');
const noRandom = () => { throw new Error('random drawn'); };
ok(caseOffset('in-algorithm', "U'", noRandom) === 'U0', 'in-algorithm adds no turn and draws nothing');
ok(caseOffset('pre-applied', "U'", noRandom) === "U'", 'pre-applied turns by the AUF and draws nothing');
ok(caseOffset('random', "U'", () => 0.6) === AUFS[2], 'random draws a turn and ignores the algorithm');

// --- Last-layer practice cases, for every AUF: pre-applied leaves the body
// alone to solve and looks like the list's pre-applied card, in-algorithm
// needs the AUF too and looks like the list's in-algorithm card, and every
// random turn is solved by the solution shown. None depends on the list's
// AUF display, which the practice setup does not take.
const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();
const same = (a: typeof solved, orbit: string, from = 0) =>
  JSON.stringify(a.patternData[orbit].pieces.slice(from)) === JSON.stringify(solved.patternData[orbit].pieces.slice(from)) &&
  a.patternData[orbit].orientation.slice(from).every((o: number) => o === 0);
const solvedBy = (scramble: string, solution: string) => {
  const after = solved.applyAlg(scramble).applyAlg(rotationNeutral(solution));
  return same(after, 'CORNERS') && same(after, 'EDGES');
};
const sameState = (a: string, b: string) =>
  JSON.stringify(solved.applyAlg(a).patternData) === JSON.stringify(solved.applyAlg(b).patternData);
let lastLayer = 0;
for (const [id, presets] of Object.entries({ ...PRESET_ALGORITHMS, ...OLL_PRESET_ALGORITHMS })) {
  for (const preset of presets) {
    const { rest: algorithm } = splitAuf(preset);
    for (const auf of AUFS) {
      const record = { algorithm, auf };
      const label = `${id} ${preset} ${auf}`;
      const applied = buildPracticeSetup(record, caseOffset('pre-applied', auf, noRandom));
      ok(applied.effectiveAuf === 'U0' && applied.solution === algorithm, `${label}: pre-applied leaves no AUF before the algorithm`);
      ok(solvedBy(applied.scramble, algorithm), `${label}: pre-applied is solved by the algorithm alone`);
      ok(sameState(applied.scramble, buildLastLayerSetup(record, 'cube').scramble), `${label}: pre-applied matches the list's pre-applied card`);
      const included = buildPracticeSetup(record, caseOffset('in-algorithm', auf, noRandom));
      ok(included.effectiveAuf === auf && included.solution === prefixAuf(auf, algorithm), `${label}: in-algorithm starts with the AUF`);
      ok(solvedBy(included.scramble, included.solution), `${label}: in-algorithm is solved by the AUF and the algorithm`);
      ok(sameState(included.scramble, buildLastLayerSetup(record, 'prefix').scramble), `${label}: in-algorithm matches the list's in-algorithm card`);
      AUFS.forEach((turn, index) => {
        const random = buildPracticeSetup(record, caseOffset('random', auf, () => index / AUFS.length));
        ok(solvedBy(random.scramble, random.solution) && solvedBy(random.scramble, prefixAuf(random.effectiveAuf, algorithm)),
          `${label} ${turn}: a random turn is solved by the solution shown`);
      });
      lastLayer++;
    }
  }
}

// --- Aligned F2L cases: the same setup turned by the algorithm's AUF, so the
// body alone does what the AUF and the body did. The primary algorithms
// (seeded for every user) are also checked to solve F2L outright.
let f2l = 0;
for (const [id, presets] of Object.entries(F2L_PRESET_ALGORITHMS) as [F2LId, readonly string[]][]) {
  presets.forEach((preset, index) => {
    const { auf, rest: body } = splitF2LAuf(preset);
    for (const seed of [1, 2, 3]) {
      const label = `${id} ${preset} seed ${seed}`;
      const included = buildF2LSetup(id, { auf, body }, 'in-algorithm', seededRandom(seed));
      const aligned = buildF2LSetup(id, { auf, body }, 'pre-applied', seededRandom(seed));
      ok(aligned.uOffset === auf && aligned.scramble === appendUTurn(included.scramble, auf), `${label}: the setup turned by the AUF`);
      const viaBody = solved.applyAlg(aligned.scramble).applyAlg(rotationNeutral(body));
      const viaAuf = solved.applyAlg(included.scramble).applyAlg(rotationNeutral(`${auf === 'U0' ? '' : auf} ${body}`));
      ok(same(viaBody, 'CORNERS', 4) === same(viaAuf, 'CORNERS', 4) && same(viaBody, 'EDGES', 4) === same(viaAuf, 'EDGES', 4),
        `${label}: the body alone ends like the AUF and the body`);
      if (index === 0) ok(same(viaBody, 'CORNERS', 4) && same(viaBody, 'EDGES', 4), `${label}: the primary algorithm solves F2L`);
      f2l++;
    }
  });
}

console.log(`Verified ${checks} checks: session figures, move counts, the hold timer, each case once, the AUF choice, ${lastLayer} last-layer practice cases and ${f2l} aligned F2L setups.`);
