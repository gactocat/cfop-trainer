// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-last-layer-setup.mts
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { rotationNeutral } from '@/lib/cube-rotation';
import { buildLastLayerSetup } from '@/lib/last-layer-setup';
import { AUFS } from '@/types/pll';

const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
let checks = 0;
for (const [id, presets] of Object.entries({ ...OLL_PRESET_ALGORITHMS, ...PRESET_ALGORITHMS })) {
  for (const preset of presets) {
    const { rest: algorithm } = splitAuf(preset);
    for (const auf of AUFS) {
      for (const mode of ['cube', 'prefix'] as const) {
        for (const offset of AUFS) {
          const label = `${id}, ${preset}, ${auf}, ${mode}, ${offset}`;
          const setup = buildLastLayerSetup({ algorithm, auf }, mode, offset);
          const scrambled = solved.applyAlg(setup.scramble);
          assert.deepEqual(scrambled.patternData.CENTERS.pieces, solved.patternData.CENTERS.pieces, label);
          const result = scrambled.applyAlg(rotationNeutral(setup.solution));
          for (const orbit of ['CORNERS', 'EDGES']) {
            assert.deepEqual(result.patternData[orbit], solved.patternData[orbit], label);
            // Default presets must preserve F2L. Alternate legacy PLL presets
            // can contain source errors; all still have to round-trip exactly.
            if (preset === presets[0]) {
              assert.deepEqual(scrambled.patternData[orbit].pieces.slice(4), solved.patternData[orbit].pieces.slice(4), label);
              assert(scrambled.patternData[orbit].orientation.slice(4).every((o) => o === 0), label);
            }
          }
          // With no random offset, cube mode has already applied the saved AUF.
          if (mode === 'cube' && offset === 'U0') assert.equal(setup.solution, algorithm);
          checks++;
        }
      }
    }
  }
}
console.log(`Verified ${checks} OLL/PLL setup and solution combinations, including rotations, AUF modes and random offsets.`);
