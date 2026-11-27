// Random-state scrambles, as the WCA's scramble programs make them: draw a
// cube state uniformly from all legal states, solve it with the two-phase
// algorithm, and turn the solution around. Every state is equally likely,
// which a string of random moves does not give.
//
// Scrambles are face turns only (no slice, wide turn or rotation), so they
// read the same in any holding: the user turns them holding the cube as set
// for the scramble (white top, green front by default, as at a WCA
// competition), and the state the cube ends in follows from that holding
// (`scrambleState`).

import { applyTurn, SOLVED, stateEquals, type Amount, type CubeState } from '@/lib/smart-cube/cube-state';
import { toFrame, userNotation, type CubeHolding, type Frame } from '@/lib/smart-cube/holding';
import { applyPlan, planSetup } from '@/lib/smart-cube/setup-guide';
import {
  cryptoRandom,
  invertMoves,
  movesToString,
  randomCubeState,
  solveTwoPhase,
  type SolverMove,
} from '@/lib/solver/two-phase';

/** Scrambles are at most this long; random states need 18 to 21 moves at this bound in practice. */
export const SCRAMBLE_MAX_MOVES = 21;
/** Like the WCA's programs, reject states solved in fewer moves (practically never drawn). */
const SCRAMBLE_MIN_MOVES = 2;

export function generateScramble(random: () => number = cryptoRandom): string {
  for (;;) {
    const state = randomCubeState(random);
    const solution = solveTwoPhase(state, { targetLength: SCRAMBLE_MAX_MOVES, timeLimitMs: 5000 });
    if (!solution || solution.length < SCRAMBLE_MIN_MOVES || solution.length > SCRAMBLE_MAX_MOVES) continue;
    return movesToString(invertMoves(solution));
  }
}

/** The state (in the cube's own frame) a scramble turned in this holding leaves a solved cube in. */
export function scrambleState(scramble: string, holding: CubeHolding | Frame): CubeState {
  const plan = planSetup(scramble, holding);
  if (!plan) throw new Error(`Not a scramble: ${scramble}`);
  return applyPlan(SOLVED, plan);
}

/** `a` undone: the state that, followed by `a`, is solved. */
export function inverseState(a: CubeState): CubeState {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 8; i++) {
    cp[a.cp[i]] = i;
    co[a.cp[i]] = (3 - a.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    ep[a.ep[i]] = i;
    eo[a.ep[i]] = (2 - a.eo[i]) % 2;
  }
  return { cp, co, ep, eo };
}

/** `a` followed by `b` (the same product as cube-state.ts's multiply). */
function product(a: CubeState, b: CubeState): CubeState {
  return {
    cp: b.cp.map((p) => a.cp[p]),
    co: b.cp.map((p, i) => (a.co[p] + b.co[i]) % 3),
    ep: b.ep.map((p) => a.ep[p]),
    eo: b.ep.map((p, i) => (a.eo[p] + b.eo[i]) % 2),
  };
}

/**
 * Face turns (cube frame) that take the cube from `from` to `to`, as short as
 * the search finds in the time given; null when none was found (an illegal
 * state, e.g. a twisted corner).
 */
export function routeBetween(from: CubeState, to: CubeState, timeLimitMs = 200): SolverMove[] | null {
  if (stateEquals(from, to)) return [];
  // Moves M with from·M = to solve the state to⁻¹·from.
  return solveTwoPhase(product(inverseState(to), from), { targetLength: 0, timeLimitMs });
}

/** Cube-frame turns in the user's notation for a holding (face turns keep their direction). */
export function movesInHolding(moves: readonly { face: SolverMove['face']; amount: Amount }[], holding: CubeHolding | Frame): string {
  const frame = toFrame(holding);
  return moves.map((m) => userNotation(frame, m.face, m.amount)).join(' ');
}

/** Apply cube-frame turns. */
export function applyMoves(state: CubeState, moves: readonly SolverMove[]): CubeState {
  return moves.reduce((s, m) => applyTurn(s, m.face, m.amount), state);
}
