// The 3D cube beside a guided setup or scramble: the smart cube's state as it
// is now, turned to how the user holds it, and the next move to make, which
// the player turns over and over. Pure, so scripts/verify-smart-cube.mts can
// check it against cubing.js's own 3x3x3.

import type { Amount, CubeState, Face } from '@/lib/smart-cube/cube-state';
import { rotateFrame, userNotation, type Frame } from '@/lib/smart-cube/holding';
import type { GuideProgress, SetupPlan } from '@/lib/smart-cube/setup-guide';

const mod4 = (n: number) => ((n % 4) + 4) % 4;

// cubing.js orders the pieces differently from the cube model (Kociemba):
//   edges UF UR UB UL DF DR DB DL FR FL BR BL, corners UFR URB UBL ULF DRF DFL DLB DBR.
// Twists are counted the same way. CUBING_EDGE[k] is cubing.js's index of
// the model's edge k (UR UF UL UB DR DF DL DB FR FL BL BR), and so on.
const CUBING_EDGE = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10];
const CUBING_CORNER = [0, 3, 2, 1, 4, 5, 6, 7];
const inverse = (map: readonly number[]) => map.map((_, i) => map.indexOf(i));
const MODEL_EDGE = inverse(CUBING_EDGE);
const MODEL_CORNER = inverse(CUBING_CORNER);

export interface OrbitTransformation {
  permutation: number[];
  orientationDelta: number[];
}

/** The state as cubing.js's 3x3x3 transformation data (centres untouched). */
export function cubingTransformationData(state: CubeState): Record<'EDGES' | 'CORNERS' | 'CENTERS', OrbitTransformation> {
  return {
    EDGES: {
      permutation: MODEL_EDGE.map((k) => CUBING_EDGE[state.ep[k]]),
      orientationDelta: MODEL_EDGE.map((k) => state.eo[k]),
    },
    CORNERS: {
      permutation: MODEL_CORNER.map((k) => CUBING_CORNER[state.cp[k]]),
      orientationDelta: MODEL_CORNER.map((k) => state.co[k]),
    },
    CENTERS: { permutation: [0, 1, 2, 3, 4, 5], orientationDelta: [0, 0, 0, 0, 0, 0] },
  };
}

export interface NextMove {
  /** How the cube is held for the move: the 3D cube is shown this way. */
  frame: Frame;
  /** The move to show, in the user's notation from `frame` (with any rotation before it); '' when none. */
  alg: string;
}

/**
 * The next move of a guide: taking back the last wrong turn, the rest of a
 * step begun (a half turn's second quarter, a slice's other face), or the next
 * step as the scramble writes it, with any rotation before it (and, for the
 * last step, the rotations after it), so turning the cube over shows too.
 */
export function nextGuideMove(plan: SetupPlan, progress: GuideProgress): NextMove {
  const step = plan.steps[progress.step];
  const frame = step?.frame ?? plan.finalFrame;
  const wrong = progress.wrong[progress.wrong.length - 1];
  if (wrong) return { frame, alg: userNotation(frame, wrong.face, mod4(-wrong.amount) as Amount) };
  if (!step) return { frame, alg: '' };
  if (Object.values(progress.acc).some((n) => mod4(n ?? 0) !== 0)) {
    // Part of a wide turn or slice: the cube is held turned by the part done,
    // and the rest is that move again ("M" after one M of M2).
    const axis = step.axisTurn;
    const done = axis ? mod4(progress.acc[axis.face] ?? 0) : 0;
    const whole = axis && done !== 0 && (Object.keys(step.turns) as Face[]).every((face) =>
      mod4(progress.acc[face] ?? 0) === mod4(face === axis.face ? done : -done));
    if (axis && whole) {
      const left = mod4(step.turns[axis.face]! - done);
      return { frame: rotateFrame(frame, axis.axis, axis.dir * done), alg: `${axis.move}${['', '', '2', "'"][left]}` };
    }
    const left = (Object.entries(step.turns) as [Face, number][])
      .map(([face, n]) => [face, mod4(n - (progress.acc[face] ?? 0))] as const)
      .filter(([, n]) => n !== 0)
      .map(([face, n]) => userNotation(frame, face, n as Amount));
    return { frame, alg: left.join(' ') };
  }
  const last = progress.step === plan.steps.length - 1;
  return { frame: step.leadFrame, alg: last && plan.trailing ? `${step.moves} ${plan.trailing}` : step.moves };
}
