// Cubie model of a 3x3 in the smart cube's own frame: centres are fixed, so
// every turn the cube reports is one of the six outer faces. Piece and
// position order follow Kociemba (the same order as the FACELETS events):
//   corners URF UFL ULB UBR DFR DLF DBL DRB, edges UR UF UL UB DR DF DL DB FR FL BL BR.
// `cp[i]` is the piece at position i, `co[i]` its twist (0 when its U/D
// sticker faces U or D); `ep` / `eo` likewise for edges.

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Quarter turns clockwise: 1, 2 (half turn) or 3 (counter-clockwise). */
export type Amount = 1 | 2 | 3;

export interface CubeState {
  cp: readonly number[];
  co: readonly number[];
  ep: readonly number[];
  eo: readonly number[];
}

const Z8 = [0, 0, 0, 0, 0, 0, 0, 0];
const Z12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const SOLVED: CubeState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: Z8,
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: Z12,
};

// One clockwise quarter turn of each face, as the state it produces from solved.
const MOVES: Record<Face, CubeState> = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: Z8, ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: Z12 },
  R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: Z12 },
  F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: Z8, ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: Z12 },
  L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: Z12 },
  B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
};

/** `a` followed by `b`. */
export function multiply(a: CubeState, b: CubeState): CubeState {
  return {
    cp: b.cp.map((p) => a.cp[p]),
    co: b.cp.map((p, i) => (a.co[p] + b.co[i]) % 3),
    ep: b.ep.map((p) => a.ep[p]),
    eo: b.ep.map((p, i) => (a.eo[p] + b.eo[i]) % 2),
  };
}

export function applyTurn(state: CubeState, face: Face, amount: Amount | number): CubeState {
  let s = state;
  for (let i = 0; i < ((amount % 4) + 4) % 4; i++) s = multiply(s, MOVES[face]);
  return s;
}

/** Apply a sequence of plain face turns ("R U2 R'"); other tokens are rejected. */
export function applyFaceTurns(state: CubeState, moves: string): CubeState {
  let s = state;
  for (const token of moves.trim().split(/\s+/).filter(Boolean)) {
    const m = token.match(/^([URFDLB])(2|'|2')?$/);
    if (!m) throw new Error(`Not a face turn: ${token}`);
    s = applyTurn(s, m[1] as Face, m[2] === "'" ? 3 : m[2] ? 2 : 1);
  }
  return s;
}

export function stateEquals(a: CubeState, b: CubeState): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

/** Validate CP/CO/EP/EO arrays as reported by the cube. */
export function stateFromArrays(cp: number[], co: number[], ep: number[], eo: number[]): CubeState | null {
  const isPerm = (a: number[], n: number) => a.length === n && new Set(a).size === n && a.every((x) => x >= 0 && x < n);
  if (!isPerm(cp, 8) || !isPerm(ep, 12)) return null;
  if (co.length !== 8 || eo.length !== 12) return null;
  return { cp: [...cp], co: [...co], ep: [...ep], eo: [...eo] };
}

// The last layer is the U or D face of the cube's frame, depending on how the
// cube is held (yellow on top is the cube's D face).
export type LastLayerFace = 'U' | 'D';
const LL_CORNERS: Record<LastLayerFace, readonly number[]> = { U: [0, 1, 2, 3], D: [4, 5, 6, 7] };
const LL_EDGES: Record<LastLayerFace, readonly number[]> = { U: [0, 1, 2, 3], D: [4, 5, 6, 7] };

/** Every piece outside the last layer is home and untwisted. */
export function isF2LSolved(s: CubeState, ll: LastLayerFace): boolean {
  for (let p = 0; p < 8; p++) {
    if (LL_CORNERS[ll].includes(p)) continue;
    if (s.cp[p] !== p || s.co[p] !== 0) return false;
  }
  for (let p = 0; p < 12; p++) {
    if (LL_EDGES[ll].includes(p)) continue;
    if (s.ep[p] !== p || s.eo[p] !== 0) return false;
  }
  return true;
}

/** F2L is solved and the last layer face is one colour (OLL done). */
export function isLastLayerOriented(s: CubeState, ll: LastLayerFace): boolean {
  return isF2LSolved(s, ll)
    && LL_CORNERS[ll].every((p) => s.co[p] === 0)
    && LL_EDGES[ll].every((p) => s.eo[p] === 0);
}

/** Solved apart from a turn of the last layer (PLL done, final AUF ignored). */
export function isSolvedUpToLastLayerTurn(s: CubeState, ll: LastLayerFace): boolean {
  let target = SOLVED;
  for (let k = 0; k < 4; k++) {
    if (stateEquals(s, target)) return true;
    target = applyTurn(target, ll, 1);
  }
  return false;
}
