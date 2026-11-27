// When a solve on a smart cube is finished: the cube solved (CFOP and the
// last layer), a cross of any colour (the cross on its own), or the first
// two layers around a given cross (F2L on its own). States are in the cube's
// own frame (white U, green F); a goal's face is a cube face.

import { applyFaceTurns, applyTurn, FACES, SOLVED, stateEquals, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { colourFace, type CubeColour } from '@/lib/smart-cube/holding';
import { cfopLevel } from '@/lib/solve/cfop-split';
import { DEFAULT_MODE_CROSS, SOLVE_MODE, type SolveMode } from '@/lib/solve/solve-modes';

export type SolveGoal =
  | { kind: 'solved' }
  /** A cross of any colour: colour neutral. */
  | { kind: 'cross' }
  /** The cross on `cross` and its four pairs. */
  | { kind: 'f2l'; cross: Face };

export const SOLVED_GOAL: SolveGoal = { kind: 'solved' };
export const CROSS_GOAL: SolveGoal = { kind: 'cross' };

/** The cross on `face`: its four edges home (beside their centres) and the right way round. */
export const crossSolved = (state: CubeState, face: Face): boolean => cfopLevel(state, face) >= 1;

/** The faces whose cross is solved, `preferred` first, then in FACES order. */
export function solvedCrosses(state: CubeState, preferred?: Face): Face[] {
  const order = preferred ? [preferred, ...FACES.filter((f) => f !== preferred)] : FACES;
  return order.filter((face) => crossSolved(state, face));
}

/**
 * What stops a mode's solve on a smart cube. `cross` is the colour an F2L
 * scramble left the cross in (white unless chosen); the other modes do not
 * need it.
 */
export function modeGoal(mode: SolveMode, cross: CubeColour = DEFAULT_MODE_CROSS): SolveGoal {
  const goal = SOLVE_MODE[mode].goal;
  return goal === 'cross' ? CROSS_GOAL : goal === 'f2l' ? { kind: 'f2l', cross: colourFace(cross) } : SOLVED_GOAL;
}

export function goalReached(goal: SolveGoal, state: CubeState): boolean {
  switch (goal.kind) {
    case 'solved':
      return stateEquals(state, SOLVED);
    case 'cross':
      return FACES.some((face) => crossSolved(state, face));
    case 'f2l':
      return cfopLevel(state, goal.cross) >= 5;
  }
}

/**
 * The goal is reached now or by a single face turn. Scrambles avoid such
 * states: a solve would be over before it started, and a smart cube solve
 * starts on its first turn, so it could not stop on that same turn.
 */
export function goalWithinOneTurn(goal: SolveGoal, state: CubeState): boolean {
  if (goalReached(goal, state)) return true;
  return FACES.some((face) => [1, 2, 3].some((amount) => goalReached(goal, applyTurn(state, face, amount))));
}

/**
 * Whether `scramble`, turned as written from solved, leaves what its mode's
 * scrambles leave (mode-scramble.ts): for the cross, no cross within one
 * turn; for F2L, the cross on `face`; for the last layer, the first two
 * layers around it. CFOP's scrambles fit any state. The scramble client
 * checks the worker's answers with it, so a worker left from an earlier
 * deploy (one that knew only CFOP) is caught.
 */
export function scrambleFitsMode(mode: SolveMode, scramble: string, face: Face = 'U'): boolean {
  let state: CubeState;
  try {
    state = applyFaceTurns(SOLVED, scramble);
  } catch {
    return false;
  }
  switch (SOLVE_MODE[mode].solvedBefore) {
    case 'nothing': return mode !== 'cross' || !goalWithinOneTurn(CROSS_GOAL, state);
    case 'cross': return cfopLevel(state, face) >= 1;
    case 'f2l': return cfopLevel(state, face) >= 5;
  }
}
