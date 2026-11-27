// The 3D cube beside a guided setup or scramble: the smart cube's state as it
// is now, turned to how the user holds it, and the next move to make, which
// the player turns part of the way over and over (a quarter turn to about
// 45°, a half turn to about 135°). A turn made on the cube is played to its
// end from where the hint stood. Pure, so scripts/verify-smart-cube.mts can
// check it against cubing.js's own 3x3x3.

import { applyTurn, FACES, stateEquals, type Amount, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { rotateFrame, userNotation, type Frame } from '@/lib/smart-cube/holding';
import { axisTurnLeft, type GuideProgress, type SetupPlan } from '@/lib/smart-cube/setup-guide';

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
    const rest = axisTurnLeft(step, progress.acc);
    if (axis && rest) return { frame: rotateFrame(frame, axis.axis, axis.dir * rest.done), alg: rest.move };
    const left = (Object.entries(step.turns) as [Face, number][])
      .map(([face, n]) => [face, mod4(n - (progress.acc[face] ?? 0))] as const)
      .filter(([, n]) => n !== 0)
      .map(([face, n]) => userNotation(frame, face, n as Amount));
    return { frame, alg: left.join(' ') };
  }
  const last = progress.step === plan.steps.length - 1;
  return { frame: step.leadFrame, alg: last && plan.trailing ? `${step.moves} ${plan.trailing}` : step.moves };
}

/** The face turn (cube frame) that takes `from` to `to`; null when no one turn does (a resync, or turns that came together). */
export function turnBetween(from: CubeState, to: CubeState): { face: Face; amount: Amount } | null {
  for (const face of FACES) {
    for (const amount of [1, 3, 2] as const) if (stateEquals(applyTurn(from, face, amount), to)) return { face, amount };
  }
  return null;
}

/** cubing.js eases each move with smootherstep: the share of the turn made at a share of the move's time. */
export const smootherStep = (x: number) => x * x * x * (10 - x * (15 - 6 * x));

/** The share of a move's time at which cubing.js has turned it `share` of the way (smootherstep inverted). */
export function moveTimeAt(share: number): number {
  if (share <= 0) return 0;
  if (share >= 1) return 1;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (smootherStep(mid) < share) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** How far the hint turns a move, as a share of it: a quarter turn to 45°, a half turn to 135°. */
export const HINT_SHARE = { quarter: 0.5, half: 0.75 } as const;

const isRotation = (token: string) => /^[xyz]/.test(token);
const isHalf = (token: string) => /2'?$/.test(token);
/** cubing.js's time for a move: 1000 ms a quarter turn, 1500 a half turn, played one after another. */
const moveDuration = (token: string) => (isHalf(token) ? 1500 : 1000);
const tokensOf = (alg: string) => alg.split(/\s+/).filter(Boolean);

export interface GuideHint {
  /** Timeline time (cubing.js's ms) where the last move starts: any rotations before it are played in full. */
  lastStart: number;
  lastDuration: number;
  /** Share of the last move's turn shown: 0.5 for a quarter turn (45°), 0.75 for a half turn (135°); 1 when the alg ends in a rotation (all of it is shown). */
  share: number;
}

/** Where the hint for `alg` stops; null for no move. */
export function guideHint(alg: string): GuideHint | null {
  const tokens = tokensOf(alg);
  if (!tokens.length) return null;
  const last = tokens[tokens.length - 1];
  const lastDuration = moveDuration(last);
  const lastStart = tokens.slice(0, -1).reduce((sum, token) => sum + moveDuration(token), 0);
  const share = isRotation(last) ? 1 : isHalf(last) ? HINT_SHARE.half : HINT_SHARE.quarter;
  return { lastStart, lastDuration, share };
}

/** A move's face letter and turn in quarter turns, clockwise positive: "R'" is R, -1; "R2" is R, 2. */
function signedTurn(token: string): { face: string; quarters: number } {
  const quarters = isHalf(token) ? (token.endsWith("'") ? -2 : 2) : token.endsWith("'") ? -1 : 1;
  return { face: token.replace(/[2']/g, ''), quarters };
}

/**
 * Where to start playing `move` (a turn made on the cube) as a share of it:
 * from the angle the hint had reached when the hint was that face turned
 * the same way, else from the start. A half-turn hint past 90° finishes a
 * quarter turn at once.
 */
export function completionStart(hint: { alg: string; share: number } | null, move: string): number {
  if (!hint) return 0;
  const tokens = tokensOf(hint.alg);
  if (tokens.length !== 1 || isRotation(tokens[0])) return 0;
  const shown = signedTurn(tokens[0]);
  const made = signedTurn(move);
  if (shown.face !== made.face || Math.sign(shown.quarters) !== Math.sign(made.quarters)) return 0;
  const degrees = hint.share * Math.abs(shown.quarters) * 90;
  return Math.min(1, degrees / (Math.abs(made.quarters) * 90));
}
