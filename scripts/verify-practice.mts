// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-practice.mts
//
// Session figures per case, and the AUF a case starts with.
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import { F2L_PRESET_ALGORITHMS } from '@/data/f2l-preset-algorithms';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { aufStartOf, aufStartPatch, caseOffset, type AufStart } from '@/lib/auf-start';
import { rotationNeutral } from '@/lib/cube-rotation';
import { appendUTurn, splitF2LAuf } from '@/lib/f2l-auf';
import { buildF2LSetup, seededRandom } from '@/lib/f2l-scramble';
import { alignedOffset, buildLastLayerSetup } from '@/lib/last-layer-setup';
import { summarizeByCase, type SessionSolve } from '@/lib/session-stats';
import type { F2LId } from '@/types/f2l';
import { AUFS } from '@/types/pll';

let checks = 0;
const ok = (condition: boolean, message: string) => { assert.ok(condition, message); checks++; };
const near = (a: number | undefined, b: number, message: string) => ok(a !== undefined && Math.abs(a - b) < 1e-9, `${message}: ${a} vs ${b}`);

// --- Session figures per case
const solve = (caseId: string, seconds: number, recognitionMs: number | null, undone = false): SessionSolve =>
  ({ caseId, name: `${caseId} Perm`, seconds, recognitionMs, undone });
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

// --- The AUF choice
ok(aufStartOf({ randomAuf: true }) === 'random', 'saved random AUF reads as random');
ok(aufStartOf({ randomAuf: false }) === 'fixed', 'saved fixed AUF reads as fixed');
ok(aufStartOf({ randomAuf: false, alignAuf: true }) === 'algorithm', 'aligned AUF reads as algorithm');
ok(aufStartOf({ randomAuf: true, alignAuf: true }) === 'algorithm', 'aligning wins over a stale random flag');
for (const choice of ['fixed', 'random', 'algorithm'] as AufStart[]) {
  ok(aufStartOf(aufStartPatch(choice)) === choice, `${choice} survives saving`);
}
ok(aufStartPatch('algorithm').randomAuf === false, 'older versions read an aligned AUF as fixed, not random');
const noRandom = () => { throw new Error('random drawn'); };
ok(caseOffset('fixed', "U'", noRandom) === 'U0', 'fixed adds no turn and draws nothing');
ok(caseOffset('algorithm', "U'", noRandom) === "U'", 'algorithm turns by the aligned AUF and draws nothing');
ok(caseOffset('random', "U'", () => 0.6) === AUFS[2], 'random draws a turn and ignores the algorithm');

// --- Aligned last-layer cases: the body alone solves them, for every AUF and display mode
const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();
const same = (a: typeof solved, orbit: string, from = 0) =>
  JSON.stringify(a.patternData[orbit].pieces.slice(from)) === JSON.stringify(solved.patternData[orbit].pieces.slice(from)) &&
  a.patternData[orbit].orientation.slice(from).every((o: number) => o === 0);
let lastLayer = 0;
for (const [id, presets] of Object.entries({ ...PRESET_ALGORITHMS, ...OLL_PRESET_ALGORITHMS })) {
  for (const preset of presets) {
    const { rest: algorithm } = splitAuf(preset);
    for (const auf of AUFS) {
      for (const mode of ['cube', 'prefix'] as const) {
        const record = { algorithm, auf };
        const setup = buildLastLayerSetup(record, mode, caseOffset('algorithm', alignedOffset(record, mode)));
        const label = `${id} ${preset} ${auf} ${mode}`;
        ok(setup.effectiveAuf === 'U0' && setup.solution === algorithm, `${label}: no AUF left before the algorithm`);
        const after = solved.applyAlg(setup.scramble).applyAlg(rotationNeutral(algorithm));
        ok(same(after, 'CORNERS') && same(after, 'EDGES'), `${label}: the algorithm alone solves the case`);
        lastLayer++;
      }
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
      const fixed = buildF2LSetup(id, { auf, body }, 'fixed', seededRandom(seed));
      const aligned = buildF2LSetup(id, { auf, body }, 'algorithm', seededRandom(seed));
      ok(aligned.uOffset === auf && aligned.scramble === appendUTurn(fixed.scramble, auf), `${label}: the setup turned by the AUF`);
      const viaBody = solved.applyAlg(aligned.scramble).applyAlg(rotationNeutral(body));
      const viaAuf = solved.applyAlg(fixed.scramble).applyAlg(rotationNeutral(`${auf === 'U0' ? '' : auf} ${body}`));
      ok(same(viaBody, 'CORNERS', 4) === same(viaAuf, 'CORNERS', 4) && same(viaBody, 'EDGES', 4) === same(viaAuf, 'EDGES', 4),
        `${label}: the body alone ends like the AUF and the body`);
      if (index === 0) ok(same(viaBody, 'CORNERS', 4) && same(viaBody, 'EDGES', 4), `${label}: the primary algorithm solves F2L`);
      f2l++;
    }
  });
}

console.log(`Verified ${checks} checks: session figures per case, the AUF choice, ${lastLayer} aligned last-layer cases and ${f2l} aligned F2L setups.`);
