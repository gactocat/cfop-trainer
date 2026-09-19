import { rotationNeutral } from '@/lib/cube-rotation';
import { combineAuf, invertAuf, prefixAuf, aufToMove } from '@/lib/f2l-auf';
import { invertAlg } from '@/lib/invert-alg';
import type { PracticeSettings } from '@/lib/practice-settings-store';
import type { Auf } from '@/types/pll';

export interface LastLayerAlgorithm {
  algorithm: string;
  auf: Auf;
}

// One source of truth for the physical setup, diagram and displayed solution.
// Cube mode applies the stored AUF before presenting the case, so only the
// body remains to solve. Prefix mode leaves that AUF in the solution.
export function buildLastLayerSetup(
  record: LastLayerAlgorithm,
  aufDisplay: PracticeSettings['aufDisplay'],
  uOffset: Auf = 'U0',
) {
  const baseAuf = aufDisplay === 'prefix' ? record.auf : 'U0';
  const baseSolution = prefixAuf(baseAuf, record.algorithm);
  const effectiveAuf = combineAuf(invertAuf(uOffset), baseAuf);
  return {
    scramble: `${invertAlg(rotationNeutral(baseSolution))} ${aufToMove(uOffset)}`.trim(),
    solution: prefixAuf(effectiveAuf, record.algorithm),
    effectiveAuf,
    body: record.algorithm,
  };
}

export type LastLayerSetup = ReturnType<typeof buildLastLayerSetup>;
