// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-last-layer-alternatives.mts
//
// For every OLL/PLL case, sets up the case with the inverse of each other
// preset (as the inverse-setup trainer does) and checks that the first preset,
// standing in for the starred algorithm, still solves it in every AUF mode and
// random offset.
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { rotationNeutral } from '@/lib/cube-rotation';
import { prefixAuf } from '@/lib/f2l-auf';
import { alternativeSetups } from '@/lib/last-layer-alternatives';
import { buildLastLayerSetup } from '@/lib/last-layer-setup';
import type { LastLayerPractice } from '@/types/practice';
import { AUFS } from '@/types/pll';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

function assertSolved(practice: LastLayerPractice, pattern: KPattern, label: string) {
  assert.deepEqual(pattern.patternData.CENTERS.pieces, solved.patternData.CENTERS.pieces, label);
  for (const orbit of ['CORNERS', 'EDGES']) {
    const data = pattern.patternData[orbit];
    const from = practice === 'oll' ? 4 : 0;
    assert.deepEqual(data.pieces.slice(from), solved.patternData[orbit].pieces.slice(from), label);
    assert(data.orientation.every((o) => o === 0), label);
  }
}

const sets: [LastLayerPractice, Record<string, readonly string[]>][] = [
  ['oll', OLL_PRESET_ALGORITHMS],
  ['pll', PRESET_ALGORITHMS],
];
let checks = 0;
const counts: string[] = [];
for (const [practice, presets] of sets) {
  for (const [id, algs] of Object.entries(presets)) {
    const all = algs.map((preset) => {
      const { auf, rest } = splitAuf(preset);
      return { auf, algorithm: rest };
    });
    const alternatives = all.map((r) => prefixAuf(r.auf, r.algorithm));
    let usable = 0;
    for (const auf of AUFS) {
      const record = { ...all[0], auf };
      for (const mode of ['cube', 'prefix'] as const) {
        for (const offset of AUFS) {
          let setups: string[] = [];
          const setup = buildLastLayerSetup(record, mode, offset, (inverse) => {
            setups = alternativeSetups(kpuzzle, practice, inverse, alternatives);
            return inverse;
          });
          usable = setups.length;
          for (const base of setups) {
            const label = `${id}, ${base}, ${auf}, ${mode}, ${offset}`;
            const built = buildLastLayerSetup(record, mode, offset, () => base);
            assert.equal(built.solution, setup.solution, label);
            assertSolved(practice, solved.applyAlg(built.scramble).applyAlg(rotationNeutral(built.solution)), label);
            checks++;
          }
        }
      }
    }
    counts.push(`${id}: ${usable}/${algs.length - 1}`);
  }
}
console.log(counts.join('  '));
console.log(`Verified ${checks} alternative OLL/PLL setups across AUF modes and random offsets.`);
