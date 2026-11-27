// Where a CFOP solve on a smart cube went from one step to the next: cross,
// the four F2L pairs, OLL and PLL. The cube reports its state after every
// turn; each step ends at the first turn after which the cube is at least
// that far (cross with n pairs, last layer one colour, solved). Steps that
// end on the same turn (an X-cross, an OLL or PLL skip) take no time and no
// moves.
//
// The cross may be of any colour (colour neutral): solvers often start from
// whichever cross is easiest after the scramble and turn the cube over to
// put it at the bottom. The solve is read on each face, and the face it was
// built on is the one it stood furthest along on over the whole solve
// (`crossFace`); the last layer is the face opposite.
//
// States are in the cube's own frame (white U, green F). Rotations of the
// whole cube are not turns, so they never count. Each stage's turns are read
// as moves (slice-moves.ts): a slice is one move, and the stages after it are
// read in the frame it left.

import { FACES, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { holdingFrame, type Frame } from '@/lib/smart-cube/holding';
import { readTurns } from '@/lib/smart-cube/slice-moves';

export const CFOP_STAGES = ['cross', 'f2l1', 'f2l2', 'f2l3', 'f2l4', 'oll', 'pll'] as const;
export type CfopStage = (typeof CFOP_STAGES)[number];

/** Where each stage ended. */
export interface CfopSplit {
  /** Cube-frame face the cross was built on (in records from before colour-neutral reading, the face set for it). */
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
 * Split a solve into its stages, with the cross on cube face `cross`.
 * `states` are the states after each turn; `start` the state before the first.
 */
export function splitOnFace(start: CubeState, states: readonly CubeState[], cross: Face): CfopSplit {
  const ends: number[] = [];
  [start, ...states].forEach((state, i) => {
    const level = cfopLevel(state, cross);
    while (ends.length < level) ends.push(i - 1);
  });
  return { cross, ends };
}

/** Levels compared, most telling first, when two faces went equally far: F2L, then 3, 2, 1 pairs, then the cross. */
const TELLING_LEVELS = [5, 4, 3, 2, 1];

/**
 * The face a CFOP solve was built on, read from its states: the face on
 * which the solve, read as CFOP, stood furthest along over the whole solve
 * (its level, 0 to 7, after every turn, added up). The face built on keeps
 * its cross, then its pairs, then its last layer for most of the solve; a
 * cross of another colour made along the way lasts a few turns, and other
 * faces reach their two layers only in the last turns, when the whole cube
 * is nearly solved (one R turn from solved, the left face's two layers are
 * done). So a cross built, broken and built again, an X-cross, skips and a
 * stray cross of another colour all go to the face built on. Two faces
 * that went equally far go to the one whose first two layers were done
 * first, then three pairs, and so on down to the cross; then to
 * `preferred`, then to the faces in their order.
 */
export function crossFace(start: CubeState, states: readonly CubeState[], preferred: Face): Face {
  const all = [start, ...states];
  const reading = (face: Face) => {
    const first = new Array<number>(8).fill(Infinity);
    let total = 0;
    all.forEach((state, i) => {
      const level = cfopLevel(state, face);
      total += level;
      for (let l = 1; l <= level; l++) if (first[l] === Infinity) first[l] = i;
    });
    return [-total, ...TELLING_LEVELS.map((l) => first[l])];
  };
  const before = (a: number[], b: number[]) => {
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
    return false;
  };
  let best = preferred;
  let bestKey = reading(preferred);
  for (const face of FACES) {
    if (face === preferred) continue;
    const key = reading(face);
    if (before(key, bestKey)) {
      best = face;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Split a solve into its stages on the face it was built on (`crossFace`;
 * `preferred` wins a tie). `states` are the states after each turn; `start`
 * the state before the first.
 */
export function splitCfop(start: CubeState, states: readonly CubeState[], preferred: Face): CfopSplit {
  return splitOnFace(start, states, crossFace(start, states, preferred));
}

/** A recorded turn: cube-frame face, a quarter turn either way, ms since the first turn. */
export interface TimedTurn {
  face: Face;
  amount: 1 | 3;
  t: number;
}

export interface StageResult {
  stage: CfopStage;
  /** From the end of the stage before (the first turn, for the first stage) to this stage's end: recognition and execution. */
  ms: number;
  /** From the end of the stage before to this stage's first turn; 0 for the first stage, which starts the timer. */
  recognitionMs: number;
  /** From this stage's first turn to its last. */
  executionMs: number;
  /** Moves as read (consecutive turns of one face merged, a slice one move). */
  moves: number;
  /** Moves per second of execution, as practice counts it; null without execution time. */
  tps: number | null;
  /** Finished on the same turn as the stage before (or before the first turn). */
  skipped: boolean;
  /** The stage's moves in the user's notation, e.g. "R U R' U'" or "M2 U M U2 M' U M2". */
  notation: string;
}

const tpsOf = (moves: number, ms: number) => (ms > 0 ? Math.round((moves / (ms / 1000)) * 100) / 100 : null);

/**
 * Time (recognition and execution apart), moves and TPS of each stage
 * reached, with its moves read from `frame` (how the cube was held at the
 * first turn), and the frame after them. Turns after the last stage reached
 * are left out.
 */
function readStages(turns: readonly TimedTurn[], split: CfopSplit, frame: Frame): { stages: StageResult[]; frame: Frame } {
  const timeAt = (index: number) => (index < 0 ? 0 : turns[index].t);
  let current = frame;
  const stages = split.ends.map((end, i): StageResult => {
    const from = i === 0 ? -1 : split.ends[i - 1];
    const reading = readTurns(turns.slice(from + 1, end + 1), current);
    current = reading.frame;
    const ms = timeAt(end) - timeAt(from);
    const skipped = end === from;
    const recognitionMs = skipped ? 0 : turns[from + 1].t - timeAt(from);
    const executionMs = ms - recognitionMs;
    const moves = reading.moves.length;
    return {
      stage: CFOP_STAGES[i], ms, recognitionMs, executionMs, moves, tps: tpsOf(moves, executionMs), skipped,
      notation: reading.moves.map((m) => m.move).join(' '),
    };
  });
  return { stages, frame: current };
}

/** Time, moves and TPS of each stage reached, its moves read from `frame`. Turns after the last stage reached are left out. */
export const cfopStages = (turns: readonly TimedTurn[], split: CfopSplit, frame: Frame): StageResult[] => readStages(turns, split, frame).stages;

/**
 * Moves of a whole solve: the stages' moves added up, so the total matches
 * the table (a turn split by a stage boundary counts once in each), plus any
 * turns after the last stage reached. The count does not depend on how the
 * cube was held.
 */
export function cfopMoveCount(turns: readonly TimedTurn[], split: CfopSplit): number {
  const last = split.ends.length > 0 ? split.ends[split.ends.length - 1] : -1;
  const { stages, frame } = readStages(turns, split, holdingFrame('white-green'));
  return stages.reduce((sum, stage) => sum + stage.moves, 0) + readTurns(turns.slice(last + 1), frame).moves.length;
}

export const solveTps = tpsOf;
