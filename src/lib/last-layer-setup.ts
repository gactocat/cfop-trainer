import { rotationNeutral } from '@/lib/cube-rotation';
import { appendUTurn, combineAuf, invertAuf, prefixAuf } from '@/lib/f2l-auf';
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
//
// `chooseSetup` receives the plain inverse of the solution and may return any
// other sequence that reaches the same state (see last-layer-alternatives.ts),
// so the random trainer can hide which algorithm the setup came from.
export function buildLastLayerSetup(
  record: LastLayerAlgorithm,
  aufDisplay: PracticeSettings['aufDisplay'],
  uOffset: Auf = 'U0',
  chooseSetup: (inverse: string) => string = (inverse) => inverse,
) {
  const baseAuf = aufDisplay === 'prefix' ? record.auf : 'U0';
  const baseSolution = prefixAuf(baseAuf, record.algorithm);
  const effectiveAuf = combineAuf(invertAuf(uOffset), baseAuf);
  return {
    scramble: appendUTurn(chooseSetup(invertAlg(rotationNeutral(baseSolution))), uOffset),
    solution: prefixAuf(effectiveAuf, record.algorithm),
    effectiveAuf,
    body: record.algorithm,
  };
}

export type LastLayerSetup = ReturnType<typeof buildLastLayerSetup>;
