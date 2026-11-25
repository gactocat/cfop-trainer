// Where a CFOP solve on a smart cube went from one step to the next: cross,
// the four F2L pairs, OLL and PLL. The cube reports its state after every
// turn; each step ends at the first turn after which the cube is at least
// that far (cross with n pairs, last layer one colour, solved). Steps that
// end on the same turn (an X-cross, an OLL or PLL skip) take no time and no
// moves.
//
// The cross may be on any face (colour neutral): the face whose F2L was
// finished first, which in a CFOP solve is the face the solver built on. On
// a tie (F2L and the last layer finished on one turn) the bottom face of the
// user's holding wins.
//
// States are in the cube's own frame (white U, green F). Rotations of the
// whole cube are not turns, so they never count.

import { FACES, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { mergeTurns } from '@/lib/smart-cube/solve-record';

export const CFOP_STAGES = ['cross', 'f2l1', 'f2l2', 'f2l3', 'f2l4', 'oll', 'pll'] as const;
export type CfopStage = (typeof CFOP_STAGES)[number];

/** Where each stage ended. */
export interface CfopSplit {
  /** Cube-frame face the cross was built on. */
  cross: Face;
  /**
   * For each stage reached, in order, the index of the turn that completed
   * it; -1 when it was already complete before the first turn. Shorter than
   * the stages when the solve stopped before the cube was solved.
   */
  ends: number[];
}

export const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

// Kociemba's facelet numbers: U1-U9 are 0-8, then R, F, D, L, B.
const CORNER_FACELETS = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const EDGE_FACELETS = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
// The faces of each corner and edge, as in cube-state.ts.
const CORNER_FACES: Face[][] = [['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'], ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B']];
const EDGE_FACES: Face[][] = [['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R']];

/** The 54 stickers, each as the face whose colour it has (centres fixed, in Kociemba's order). */
export function facelets(state: CubeState): Face[] {
  const out = new Array<Face>(54);
  FACES.forEach((face, i) => { out[i * 9 + 4] = face; });
  for (let i = 0; i < 8; i++) {
    for (let n = 0; n < 3; n++) out[CORNER_FACELETS[i][(n + state.co[i]) % 3]] = CORNER_FACES[state.cp[i]][n];
  }
  for (let i = 0; i < 12; i++) {
    for (let n = 0; n < 2; n++) out[EDGE_FACELETS[i][(n + state.eo[i]) % 2]] = EDGE_FACES[state.ep[i]][n];
  }
  return out;
}

interface FaceParts {
  crossEdges: number[];
  /** The F2L pairs around the face: a corner on it and the edge beside it. */
  slots: { corner: number; edge: number }[];
}

const PARTS: Record<Face, FaceParts> = Object.fromEntries(FACES.map((face) => {
  const crossEdges = EDGE_FACES.flatMap((faces, e) => (faces.includes(face) ? [e] : []));
  const slots = CORNER_FACES.flatMap((faces, corner) => {
    if (!faces.includes(face)) return [];
    const sides = faces.filter((f) => f !== face);
    const edge = EDGE_FACES.findIndex((ef) => ef.length === 2 && sides.every((s) => ef.includes(s)));
    return [{ corner, edge }];
  });
  return [face, { crossEdges, slots }];
})) as Record<Face, FaceParts>;

const edgeHome = (s: CubeState, e: number) => s.ep[e] === e && s.eo[e] === 0;
const cornerHome = (s: CubeState, c: number) => s.cp[c] === c && s.co[c] === 0;

function isSolved(s: CubeState): boolean {
  for (let c = 0; c < 8; c++) if (!cornerHome(s, c)) return false;
  for (let e = 0; e < 12; e++) if (!edgeHome(s, e)) return false;
  return true;
}

/**
 * How far a CFOP solve with the cross on `cross` has got: 0 no cross, 1 the
 * cross, 2-5 the cross and 1-4 F2L pairs, 6 the last layer one colour, 7 solved.
 */
export function cfopLevel(state: CubeState, cross: Face): number {
  const parts = PARTS[cross];
  if (!parts.crossEdges.every((e) => edgeHome(state, e))) return 0;
  const pairs = parts.slots.filter(({ corner, edge }) => cornerHome(state, corner) && edgeHome(state, edge)).length;
  if (pairs < 4) return 1 + pairs;
  if (isSolved(state)) return 7;
  const top = OPPOSITE[cross];
  const offset = FACES.indexOf(top) * 9;
  const stickers = facelets(state);
  for (let k = 0; k < 9; k++) if (stickers[offset + k] !== top) return 5;
  return 6;
}

/**
 * Split a solve into its stages. `states` are the states after each turn;
 * `start` the state before the first. `preferred` is the cross face to use on
 * a tie (the bottom of the user's holding).
 */
export function splitCfop(start: CubeState, states: readonly CubeState[], preferred: Face): CfopSplit {
  const all = [start, ...states];
  // For each face, where each level was first reached (index into `all`).
  const firstReached = (face: Face) => {
    const first: (number | undefined)[] = new Array(8).fill(undefined);
    all.forEach((state, i) => {
      const level = cfopLevel(state, face);
      for (let l = 1; l <= level; l++) first[l] ??= i;
    });
    return first;
  };
  const byFace = new Map(FACES.map((face) => [face, firstReached(face)]));
  const order = [preferred, ...FACES.filter((f) => f !== preferred)];
  const highest = (face: Face) => {
    const first = byFace.get(face)!;
    let level = 0;
    while (level < 7 && first[level + 1] !== undefined) level++;
    return level;
  };
  // The face whose F2L was done first; without one, the furthest along.
  let cross = order[0];
  let bestKey: [number, number, number] | null = null;
  for (const face of order) {
    const first = byFace.get(face)!;
    const level = highest(face);
    const key: [number, number, number] = level >= 5
      ? [0, first[5]!, first[1]!]
      : [1, -level, level > 0 ? first[level]! : Infinity];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      bestKey = key;
      cross = face;
    }
  }
  const first = byFace.get(cross)!;
  const ends: number[] = [];
  for (let level = 1; level <= highest(cross); level++) ends.push(first[level]! - 1);
  return { cross, ends };
}

/** A recorded turn: cube-frame face, a quarter turn either way, ms since the first turn. */
export interface TimedTurn {
  face: Face;
  amount: 1 | 3;
  t: number;
}

export interface StageResult {
  stage: CfopStage;
  ms: number;
  /** Moves as the smart cube counts them (consecutive turns of one face merged). */
  moves: number;
  tps: number | null;
  /** Finished on the same turn as the stage before (or before the first turn). */
  skipped: boolean;
  /** The stage's turns, merged, still in the cube's frame. */
  turns: { face: Face; amount: 1 | 2 | 3 }[];
}

const tpsOf = (moves: number, ms: number) => (ms > 0 ? Math.round((moves / (ms / 1000)) * 100) / 100 : null);

/** Time, moves and TPS of each stage reached. Turns after the last stage reached are left out. */
export function cfopStages(turns: readonly TimedTurn[], split: CfopSplit): StageResult[] {
  const timeAt = (index: number) => (index < 0 ? 0 : turns[index].t);
  return split.ends.map((end, i) => {
    const from = i === 0 ? -1 : split.ends[i - 1];
    const merged = mergeTurns(turns.slice(from + 1, end + 1));
    const ms = timeAt(end) - timeAt(from);
    return { stage: CFOP_STAGES[i], ms, moves: merged.length, tps: tpsOf(merged.length, ms), skipped: end === from, turns: merged };
  });
}

/**
 * Moves of a whole solve: the stages' moves added up, so the total matches
 * the table (a turn split by a stage boundary counts once in each), plus any
 * turns after the last stage reached.
 */
export function cfopMoveCount(turns: readonly TimedTurn[], split: CfopSplit): number {
  const last = split.ends.length > 0 ? split.ends[split.ends.length - 1] : -1;
  const rest = mergeTurns(turns.slice(last + 1)).length;
  return cfopStages(turns, split).reduce((sum, stage) => sum + stage.moves, 0) + rest;
}

export const solveTps = tpsOf;
