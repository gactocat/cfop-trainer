// Scrambles for each kind of solve (solve-modes.ts), made as CFOP's are: a
// state drawn uniformly from the states the kind starts from, solved with the
// two-phase algorithm, and the solution turned around.
//
//   cfop   any legal state (scramble.ts)
//   cross  any legal state with no cross solved or one turn away
//   f2l    the cross on one face solved; every other piece anywhere, any way round
//   ll     the first two layers around that cross solved; the last layer's
//          pieces anywhere in it, any way round (OLL, PLL and the AUF)
//
// Only legal states are drawn (twists and flips add up, corner and edge
// permutations have the same parity), and none where the kind's goal is
// reached already or by one turn (solve-goal.ts): no solved cube, no last
// layer that only needs an AUF.
//
// States are drawn in the scramble's own notation: `face` is the face, as the
// scramble is written, whose cross is left solved. Turned holding the cube
// as set for the scramble, the cross is on the colour at that face; so for a
// white cross, `face` is where white is in the scramble orientation (U for
// white top, green front). `scrambleCrossFace` works it out.

import { applyTurn, SOLVED, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { colourFace, colourFrame, userFace, type ColourHolding, type CubeColour } from '@/lib/smart-cube/holding';
import { OPPOSITE } from '@/lib/solve/cfop-split';
import { generateScramble, SCRAMBLE_MAX_MOVES } from '@/lib/solve/scramble';
import { CROSS_GOAL, goalWithinOneTurn, SOLVED_GOAL, type SolveGoal } from '@/lib/solve/solve-goal';
import type { SolveMode } from '@/lib/solve/solve-modes';
import { cryptoRandom, invertMoves, movesToString, randomCubeState, solveTwoPhase } from '@/lib/solver/two-phase';

/**
 * The search stops at the first solution this short, as CFOP's does at 21
 * moves. A last-layer state has much shorter ones than the first found
 * (about 18 moves): looking for up to 60 ms brings it to about 15. For the
 * other kinds a longer look saves a move at most.
 */
const SEARCH: Record<Exclude<SolveMode, 'cfop'>, { targetLength: number; timeLimitMs: number }> = {
  cross: { targetLength: SCRAMBLE_MAX_MOVES, timeLimitMs: 5000 },
  f2l: { targetLength: SCRAMBLE_MAX_MOVES, timeLimitMs: 5000 },
  ll: { targetLength: 12, timeLimitMs: 60 },
};

/** The corners and edges on a face (the pieces a turn of it moves), by position. */
function piecesOn(face: Face): { corners: number[]; edges: number[] } {
  const turned = applyTurn(SOLVED, face, 1);
  return {
    corners: turned.cp.flatMap((p, i) => (p !== i ? [i] : [])),
    edges: turned.ep.flatMap((p, i) => (p !== i ? [i] : [])),
  };
}

/** A uniform integer in [0, n). */
const below = (n: number, random: () => number) => Math.min(n - 1, Math.floor(random() * n));

function parity(p: readonly number[]): number {
  let swaps = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) swaps++;
  return swaps % 2;
}

/** The pieces at `places` moved among those places in a uniformly random order. */
function shuffleAt(perm: number[], places: readonly number[], random: () => number): void {
  const pieces = [...places];
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = below(i + 1, random);
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  places.forEach((place, k) => { perm[place] = pieces[k]; });
}

/** Random twists (mod 3) or flips (mod 2) at `places`, adding up to a multiple of `mod`. */
function orientAt(orientation: number[], places: readonly number[], mod: number, random: () => number): void {
  let sum = 0;
  places.forEach((place, k) => {
    orientation[place] = k < places.length - 1 ? below(mod, random) : (mod - (sum % mod)) % mod;
    sum += orientation[place];
  });
}

/**
 * A legal state drawn uniformly from those with every piece outside `free`
 * home and the right way round. Swapping two free edges when the parities
 * disagree maps two draws onto each legal state, so the result is uniform.
 */
function randomStateWithFree(free: { corners: readonly number[]; edges: readonly number[] }, random: () => number): CubeState {
  const cp = [0, 1, 2, 3, 4, 5, 6, 7];
  const ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const co = new Array<number>(8).fill(0);
  const eo = new Array<number>(12).fill(0);
  shuffleAt(cp, free.corners, random);
  shuffleAt(ep, free.edges, random);
  if (parity(cp) !== parity(ep)) {
    const [a, b] = free.edges.slice(-2);
    [ep[a], ep[b]] = [ep[b], ep[a]];
  }
  orientAt(co, free.corners, 3, random);
  orientAt(eo, free.edges, 2, random);
  return { cp, co, ep, eo };
}

/** A state with the cross on `face` solved and every other piece random. */
export function randomCrossSolvedState(face: Face, random: () => number): CubeState {
  const cross = piecesOn(face).edges;
  return randomStateWithFree({
    corners: [0, 1, 2, 3, 4, 5, 6, 7],
    edges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((e) => !cross.includes(e)),
  }, random);
}

/** A state with the first two layers around the cross on `face` solved and the last layer (the face opposite) random. */
export function randomLastLayerState(face: Face, random: () => number): CubeState {
  return randomStateWithFree(piecesOn(OPPOSITE[face]), random);
}

/**
 * The goal of a mode's solve on a state in the scramble's notation, for a
 * cross on `face` there (solve-goal.ts takes cube faces; the scramble is
 * drawn before it is turned in a holding).
 */
function goalFor(mode: SolveMode, face: Face): SolveGoal {
  return mode === 'cross' ? CROSS_GOAL : mode === 'f2l' ? { kind: 'f2l', cross: face } : SOLVED_GOAL;
}

/**
 * The state a mode's scramble is made for, in the scramble's notation, with
 * the cross (f2l) or the first two layers (ll) left solved around `face`.
 */
export function randomModeState(mode: SolveMode, face: Face, random: () => number): CubeState {
  const goal = goalFor(mode, face);
  for (;;) {
    const state = mode === 'f2l' ? randomCrossSolvedState(face, random)
      : mode === 'll' ? randomLastLayerState(face, random)
        : randomCubeState(random);
    if (mode === 'cfop' || !goalWithinOneTurn(goal, state)) return state;
  }
}

/**
 * A scramble for a mode: face turns, never one face twice in a row, at most
 * 21 moves. For f2l and ll, `face` is where the cross is left solved, as the
 * scramble is written (U unless asked otherwise: white for white top, green
 * front). CFOP's scramble is scramble.ts's, unchanged.
 */
export function generateModeScramble(mode: SolveMode, face: Face = 'U', random: () => number = cryptoRandom): string {
  if (mode === 'cfop') return generateScramble(random);
  for (;;) {
    const state = randomModeState(mode, face, random);
    // Time up before any solution (a slow device): the first one within 21 moves.
    const solution = solveTwoPhase(state, { ...SEARCH[mode], maxLength: SCRAMBLE_MAX_MOVES })
      ?? solveTwoPhase(state, { targetLength: SCRAMBLE_MAX_MOVES, timeLimitMs: 5000, maxLength: SCRAMBLE_MAX_MOVES });
    if (solution && solution.length > 0) return movesToString(invertMoves(solution));
  }
}

/**
 * Where, as a scramble is written, the cross of `cross` must be left so
 * that turning it holding the cube as `scrambleHolding` leaves the cross on
 * that colour: U for a white cross from white top, green front; D from
 * yellow top. Null when the holding is not one (a front beside no top).
 */
export function scrambleCrossFace(scrambleHolding: ColourHolding, cross: CubeColour): Face | null {
  const frame = colourFrame(scrambleHolding);
  return frame && userFace(frame, colourFace(cross));
}

