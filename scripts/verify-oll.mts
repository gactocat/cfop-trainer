// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-oll.mts
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import { ALL_OLLS } from '@/data/oll-definitions';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { rotationNeutral } from '@/lib/cube-rotation';
import { invertAlg } from '@/lib/invert-alg';
import { AUFS } from '@/types/pll';
import { OLL_IDS } from '@/types/oll';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();
function assertF2LSolved(pattern: KPattern, label: string) {
  for (const orbit of ['CORNERS', 'EDGES']) {
    const data = pattern.patternData[orbit];
    assert.deepEqual(data.pieces.slice(4), solved.patternData[orbit].pieces.slice(4), label);
    assert(data.orientation.slice(4).every((o) => o === 0), label);
  }
  assert.deepEqual(pattern.patternData.CENTERS.pieces, solved.patternData.CENTERS.pieces, label);
}
function signature(pattern: KPattern): string {
  return ['CORNERS', 'EDGES'].map((orbit) => pattern.patternData[orbit].orientation.slice(0, 4).join('')).join('/');
}

assert.deepEqual(ALL_OLLS.map((def) => def.id), OLL_IDS);
assert.deepEqual(Object.keys(OLL_PRESET_ALGORITHMS), OLL_IDS);
const cases = new Set<string>();
let algorithms = 0;
for (const def of ALL_OLLS) {
  const setup = solved.applyAlg(def.setupAlg);
  assertF2LSolved(setup, `${def.id}: setup must preserve F2L and centers`);
  // An OLL case is an orientation pattern, independent of LL permutation.
  // Quotient by AUF to ensure none of the 57 cases is duplicated.
  const canonical = AUFS.map((auf) => signature(setup.applyAlg(auf === 'U0' ? '' : auf))).sort()[0];
  assert(!cases.has(canonical), `${def.id}: duplicate OLL case`);
  cases.add(canonical);
  for (const algorithm of OLL_PRESET_ALGORITHMS[def.id]) {
    for (const auf of AUFS) {
      const turn = auf === 'U0' ? '' : auf;
      const result = setup.applyAlg(invertAlg(turn)).applyAlg(`${turn} ${rotationNeutral(algorithm)}`);
      assertF2LSolved(result, `${def.id}: ${algorithm}, AUF ${auf}`);
      for (const orbit of ['CORNERS', 'EDGES']) {
        assert(result.patternData[orbit].orientation.every((o) => o === 0), `${def.id}: unsolved OLL, ${algorithm}, AUF ${auf}`);
      }
    }
    algorithms++;
  }
}
assert.equal(cases.size, 57);
console.log(`Verified ${cases.size} distinct OLL cases and ${algorithms} presets in all 4 AUF orientations.`);
