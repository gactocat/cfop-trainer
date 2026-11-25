// Kociemba's two-phase algorithm for the 3x3x3, on the cubie model of
// smart-cube/cube-state.ts (faces U R F D L B, Kociemba's piece order).
// Phase 1 brings a state into the subgroup H = <U, D, R2, L2, F2, B2>: every
// piece oriented and the four E-slice edges in the E slice. Phase 2 solves it
// with moves of H only. Each phase is an IDA* search bounded by pruning
// tables; once a solution is found the search goes on for shorter ones until
// it reaches the target length or runs out of time.
//
// The tables (about 4.5 MB) are built on first use, in a few hundred
// milliseconds, so callers in the browser run this in a worker.
//
// Moves are numbered face * 3 + (quarter turns - 1), faces in FACES order:
// 0 U, 1 U2, 2 U', 3 R, ... 17 B'.

import { applyTurn, FACES, SOLVED, type Amount, type CubeState, type Face } from '@/lib/smart-cube/cube-state';

export interface SolverMove {
  face: Face;
  amount: Amount;
}

// --- Coordinates

const N_TWIST = 2187; // 3^7 corner orientations
const N_FLIP = 2048; // 2^11 edge orientations
const N_SLICE = 495; // C(12, 4) places of the E-slice edges
const N_SLICE_SORTED = 11880; // places and order of the E-slice edges
const N_PERM8 = 40320; // 8!
const N_SLICE_PERM = 24; // 4!
const N_MOVES = 18;
/** Phase 2 moves: U U2 U' R2 F2 D D2 D' L2 B2. */
const P2_MOVES = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];
const IN_P2 = Array.from({ length: N_MOVES }, (_, m) => P2_MOVES.includes(m));

const choose = (() => {
  const c: number[][] = [];
  for (let n = 0; n <= 12; n++) {
    c.push([]);
    for (let k = 0; k <= 12; k++) c[n].push(k === 0 ? 1 : n === 0 ? 0 : c[n - 1][k - 1] + (k <= n - 1 ? c[n - 1][k] : 0));
  }
  return (n: number, k: number) => (k > n || n < 0 ? 0 : c[n][k]);
})();

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

/** Lehmer rank of a permutation of 0..n-1 (identity is 0). */
function permRank(p: ArrayLike<number>, n: number): number {
  let rank = 0;
  for (let i = 0; i < n - 1; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) smaller++;
    rank += smaller * FACTORIAL[n - 1 - i];
  }
  return rank;
}

function permUnrank(rank: number, n: number, out: number[]): void {
  // Lehmer digits first, then turn them into the values left to right.
  for (let i = 0; i < n; i++) {
    const f = FACTORIAL[n - 1 - i];
    out[i] = Math.floor(rank / f);
    rank -= out[i] * f;
  }
  for (let i = n - 2; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) if (out[j] >= out[i]) out[j]++;
  }
}

function twistOf(co: ArrayLike<number>): number {
  let t = 0;
  for (let i = 0; i < 7; i++) t = t * 3 + co[i];
  return t;
}

function setTwist(t: number, co: number[]): void {
  let sum = 0;
  for (let i = 6; i >= 0; i--) {
    co[i] = t % 3;
    sum += co[i];
    t = Math.floor(t / 3);
  }
  co[7] = (3 - (sum % 3)) % 3;
}

function flipOf(eo: ArrayLike<number>): number {
  let f = 0;
  for (let i = 0; i < 11; i++) f = f * 2 + eo[i];
  return f;
}

function setFlip(f: number, eo: number[]): void {
  let sum = 0;
  for (let i = 10; i >= 0; i--) {
    eo[i] = f % 2;
    sum += eo[i];
    f = Math.floor(f / 2);
  }
  eo[11] = sum % 2;
}

const isSliceEdge = (e: number) => e >= 8;

/**
 * Where the E-slice edges (FR FL BL BR, pieces 8-11) are and in which order:
 * 24 * (their places, 0 when in the E slice) + (their order there).
 */
function sliceSortedOf(ep: ArrayLike<number>): number {
  let a = 0;
  let x = 0;
  const order: number[] = [];
  for (let j = 11; j >= 0; j--) {
    if (isSliceEdge(ep[j])) {
      a += choose(11 - j, x + 1);
      order.unshift(ep[j] - 8);
      x++;
    }
  }
  return a * 24 + permRank(order, 4);
}

/** Edges for a slice-sorted coordinate; the other places get -1. */
function setSliceSorted(index: number, ep: number[]): void {
  let a = Math.floor(index / 24);
  const order: number[] = [];
  permUnrank(index % 24, 4, order);
  let x = 3;
  let k = 0;
  for (let j = 0; j < 12; j++) {
    if (x >= 0 && a - choose(11 - j, x + 1) >= 0) {
      ep[j] = order[k++] + 8;
      a -= choose(11 - j, x + 1);
      x--;
    } else {
      ep[j] = -1;
    }
  }
}

// --- Moves on the cubie model

interface MoveCubie { cp: number[]; co: number[]; ep: number[]; eo: number[] }

const MOVE_CUBIES: MoveCubie[] = [];
for (const face of FACES) {
  for (let q = 1; q <= 3; q++) {
    const s = applyTurn(SOLVED, face, q);
    MOVE_CUBIES.push({ cp: [...s.cp], co: [...s.co], ep: [...s.ep], eo: [...s.eo] });
  }
}

// `a` followed by move m, part by part (see multiply in cube-state.ts).
function moveCorners(cp: number[], co: number[], m: number, outP: number[], outO: number[]): void {
  const mv = MOVE_CUBIES[m];
  for (let i = 0; i < 8; i++) {
    outP[i] = cp[mv.cp[i]];
    outO[i] = (co[mv.cp[i]] + mv.co[i]) % 3;
  }
}

function moveEdges(ep: number[], eo: number[], m: number, outP: number[], outO: number[]): void {
  const mv = MOVE_CUBIES[m];
  for (let i = 0; i < 12; i++) {
    outP[i] = ep[mv.ep[i]];
    outO[i] = (eo[mv.ep[i]] + mv.eo[i]) % 2;
  }
}

// --- Tables

interface Tables {
  twistMove: Uint16Array;
  flipMove: Uint16Array;
  sliceSortedMove: Uint16Array;
  cornerMove: Uint16Array;
  /** Phase 2 only: indexed by position in P2_MOVES. */
  edge8Move: Uint16Array;
  /** Phase 1 distance of (twist, slice) and (flip, slice). */
  twistSlicePrune: Uint8Array;
  flipSlicePrune: Uint8Array;
  /** Phase 2 distance of (corners, slice order) and (U/D edges, slice order). */
  cornerSlicePrune: Uint8Array;
  edgeSlicePrune: Uint8Array;
}

let tables: Tables | null = null;

/** A move table: `decode` sets up coordinate c, `next` gives the coordinate after move m. */
function buildMoveTable(size: number, moves: readonly number[], decode: (coord: number) => void, next: (move: number) => number): Uint16Array {
  const table = new Uint16Array(size * moves.length);
  for (let c = 0; c < size; c++) {
    decode(c);
    for (let k = 0; k < moves.length; k++) table[c * moves.length + k] = next(moves[k]);
  }
  return table;
}

/**
 * Breadth-first distances over a pair of coordinates (a, b), from (0, 0).
 * `moveA` and `moveB` are move tables over the same `moveCount` moves.
 */
function buildPrune(sizeA: number, sizeB: number, moveCount: number, moveA: Uint16Array, moveB: Uint16Array): Uint8Array {
  const total = sizeA * sizeB;
  const dist = new Uint8Array(total).fill(255);
  const queue = new Uint32Array(total);
  dist[0] = 0;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const index = queue[head++];
    const a = (index / sizeB) | 0;
    const rowA = a * moveCount;
    const rowB = (index - a * sizeB) * moveCount;
    const d = dist[index] + 1;
    for (let k = 0; k < moveCount; k++) {
      const n = moveA[rowA + k] * sizeB + moveB[rowB + k];
      if (dist[n] === 255) {
        dist[n] = d;
        queue[tail++] = n;
      }
    }
  }
  return dist;
}

/** The columns of an 18-move table for the given moves. */
function columns(table: Uint16Array, size: number, moves: readonly number[]): Uint16Array {
  const out = new Uint16Array(size * moves.length);
  for (let c = 0; c < size; c++) for (let k = 0; k < moves.length; k++) out[c * moves.length + k] = table[c * N_MOVES + moves[k]];
  return out;
}

/** Build the tables now (they are otherwise built by the first solve). */
export function initTwoPhase(): void {
  if (tables) return;
  const all = Array.from({ length: N_MOVES }, (_, m) => m);
  const p = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const p2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const o2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const identity8 = [0, 1, 2, 3, 4, 5, 6, 7];

  const twistMove = buildMoveTable(N_TWIST, all, (t) => setTwist(t, o), (m) => {
    moveCorners(identity8, o, m, p2, o2);
    return twistOf(o2);
  });
  const flipMove = buildMoveTable(N_FLIP, all, (f) => setFlip(f, o), (m) => {
    moveEdges(p, o, m, p2, o2);
    return flipOf(o2);
  });
  o.fill(0);
  const sliceSortedMove = buildMoveTable(N_SLICE_SORTED, all, (c) => setSliceSorted(c, p), (m) => {
    moveEdges(p, o, m, p2, o2);
    return sliceSortedOf(p2);
  });
  const cornerMove = buildMoveTable(N_PERM8, all, (c) => permUnrank(c, 8, p), (m) => {
    moveCorners(p, o, m, p2, o2);
    return permRank(p2, 8);
  });
  const edge8Move = buildMoveTable(N_PERM8, P2_MOVES, (c) => {
    permUnrank(c, 8, p);
    for (let i = 8; i < 12; i++) p[i] = i;
  }, (m) => {
    moveEdges(p, o, m, p2, o2);
    return permRank(p2, 8);
  });

  const sliceMove = new Uint16Array(N_SLICE * N_MOVES);
  for (let c = 0; c < N_SLICE; c++) for (let m = 0; m < N_MOVES; m++) sliceMove[c * N_MOVES + m] = (sliceSortedMove[c * 24 * N_MOVES + m] / 24) | 0;
  const twistSlicePrune = buildPrune(N_TWIST, N_SLICE, N_MOVES, twistMove, sliceMove);
  const flipSlicePrune = buildPrune(N_FLIP, N_SLICE, N_MOVES, flipMove, sliceMove);
  const slicePermMove = columns(sliceSortedMove, N_SLICE_PERM, P2_MOVES);
  const cornerSlicePrune = buildPrune(N_PERM8, N_SLICE_PERM, P2_MOVES.length, columns(cornerMove, N_PERM8, P2_MOVES), slicePermMove);
  const edgeSlicePrune = buildPrune(N_PERM8, N_SLICE_PERM, P2_MOVES.length, edge8Move, slicePermMove);

  tables = { twistMove, flipMove, sliceSortedMove, cornerMove, edge8Move, twistSlicePrune, flipSlicePrune, cornerSlicePrune, edgeSlicePrune };
}

export const twoPhaseReady = () => tables !== null;

// --- Search

export interface SolveOptions {
  /** Stop as soon as a solution this short is found. 0 searches for the shortest until the time runs out. */
  targetLength?: number;
  /** Give up looking for shorter solutions after this long (the first solution is always returned). */
  timeLimitMs?: number;
  /** Longest solution worth returning; null when none this short is found in time. */
  maxLength?: number;
}

// Long phase 2 searches cost more than they save: a longer phase 1 usually
// leads to a shorter total (Kociemba's solvers cap phase 2 the same way).
const MAX_PHASE2 = 10;

const FACE_OF = (m: number) => Math.floor(m / 3);
// Successive moves: never the same face, and on one axis only in U R F before D L B order.
const allowedAfter = (last: number, m: number) => {
  if (last < 0) return true;
  const diff = FACE_OF(last) - FACE_OF(m);
  return diff !== 0 && diff !== 3;
};

/**
 * Moves that take `state` to solved, or null when the state is not a legal
 * cube or no solution within `maxLength` turned up in time. Face turns only;
 * consecutive moves never turn the same face.
 */
export function solveTwoPhase(state: CubeState, options: SolveOptions = {}): SolverMove[] | null {
  if (!isSolvable(state)) return null;
  initTwoPhase();
  const tb = tables!;
  const { targetLength = 21, timeLimitMs = 1000, maxLength = 30, maxPhase2 = MAX_PHASE2 } = options as SolveOptions & { maxPhase2?: number };
  const deadline = Date.now() + timeLimitMs;

  const twist0 = twistOf(state.co);
  const flip0 = flipOf(state.eo);
  const slice0 = sliceSortedOf(state.ep);
  const corner0 = permRank(state.cp, 8);
  const ep0 = [...state.ep];

  const path1: number[] = [];
  const path2: number[] = [];
  let best: number[] | null = null;
  let bestLength = maxLength + 1;
  let done = false;
  let nodes = 0;
  const timeUp = () => {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) done = true;
    return done;
  };

  const phase1Distance = (twist: number, flip: number, sliceSorted: number) => {
    const slice = Math.floor(sliceSorted / 24);
    return Math.max(tb.twistSlicePrune[twist * N_SLICE + slice], tb.flipSlicePrune[flip * N_SLICE + slice]);
  };

  const edgesAfterPhase1 = () => {
    let ep = ep0;
    const next = new Array<number>(12);
    const eo = new Array<number>(12).fill(0);
    const eo2 = new Array<number>(12);
    for (const m of path1) {
      moveEdges(ep, eo, m, next, eo2);
      ep = [...next];
    }
    return permRank(ep, 8);
  };

  const phase2 = (corner: number, edge: number, slice: number, togo: number, last: number): boolean => {
    if (togo === 0) return corner === 0 && edge === 0 && slice === 0;
    if (timeUp()) return false;
    for (let k = 0; k < P2_MOVES.length; k++) {
      const m = P2_MOVES[k];
      if (!allowedAfter(last, m)) continue;
      const c = tb.cornerMove[corner * N_MOVES + m];
      const e = tb.edge8Move[edge * P2_MOVES.length + k];
      const s = tb.sliceSortedMove[slice * N_MOVES + m];
      if (Math.max(tb.cornerSlicePrune[c * N_SLICE_PERM + s], tb.edgeSlicePrune[e * N_SLICE_PERM + s]) >= togo) continue;
      path2.push(m);
      if (phase2(c, e, s, togo - 1, m)) return true;
      path2.pop();
    }
    return false;
  };

  const phase1 = (twist: number, flip: number, slice: number, corner: number, dist: number, togo: number, last: number) => {
    if (done) return;
    if (togo === 0) {
      // In H: try to finish within the length still worth having.
      const room = Math.min(bestLength - 1 - path1.length, maxPhase2);
      const cornerDist = tb.cornerSlicePrune[corner * N_SLICE_PERM + slice];
      if (cornerDist > room) return;
      const edge = edgesAfterPhase1();
      const start = Math.max(cornerDist, tb.edgeSlicePrune[edge * N_SLICE_PERM + slice]);
      for (let d2 = start; d2 <= room && !done; d2++) {
        path2.length = 0;
        if (phase2(corner, edge, slice, d2, last)) {
          best = [...path1, ...path2];
          bestLength = best.length;
          if (bestLength <= targetLength) done = true;
          return;
        }
      }
      return;
    }
    if (timeUp()) return;
    for (let m = 0; m < N_MOVES; m++) {
      if (!allowedAfter(last, m)) continue;
      // From inside H, phase 2 covers what moves of H would do here.
      if (dist === 0 && togo < 5 && IN_P2[m]) continue;
      const t = tb.twistMove[twist * N_MOVES + m];
      const f = tb.flipMove[flip * N_MOVES + m];
      const s = tb.sliceSortedMove[slice * N_MOVES + m];
      const d = phase1Distance(t, f, s);
      if (d >= togo) continue;
      path1.push(m);
      phase1(t, f, s, tb.cornerMove[corner * N_MOVES + m], d, togo - 1, m);
      path1.pop();
      if (done) return;
    }
  };

  const start = phase1Distance(twist0, flip0, slice0);
  for (let d1 = start; d1 < bestLength && !done; d1++) {
    phase1(twist0, flip0, slice0, corner0, start, d1, -1);
  }
  if (!best) return null;
  return (best as number[]).map((m) => ({ face: FACES[FACE_OF(m)], amount: ((m % 3) + 1) as Amount }));
}

/** Pieces form a cube that can be solved: permutation parities agree, twist and flip add up. */
export function isSolvable(state: CubeState): boolean {
  const isPerm = (a: readonly number[], n: number) => a.length === n && new Set(a).size === n && a.every((x) => x >= 0 && x < n);
  if (!isPerm(state.cp, 8) || !isPerm(state.ep, 12)) return false;
  if (state.co.reduce((s, v) => s + v, 0) % 3 !== 0) return false;
  if (state.eo.reduce((s, v) => s + v, 0) % 2 !== 0) return false;
  return parity(state.cp) === parity(state.ep);
}

function parity(p: readonly number[]): number {
  let swaps = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) swaps++;
  return swaps % 2;
}

// --- Random states

/** A uniform integer in [0, n), from a source of uniform numbers in [0, 1). */
const below = (n: number, random: () => number) => Math.min(n - 1, Math.floor(random() * n));

function shuffle(n: number, random: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = below(i + 1, random);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A state drawn uniformly from every legal cube state. Swapping two edges
 * when the parities disagree maps two draws onto each legal state, so the
 * result stays uniform.
 */
export function randomCubeState(random: () => number): CubeState {
  const cp = shuffle(8, random);
  const ep = shuffle(12, random);
  if (parity(cp) !== parity(ep)) [ep[10], ep[11]] = [ep[11], ep[10]];
  const co = Array.from({ length: 8 }, () => 0);
  setTwist(below(N_TWIST, random), co);
  const eo = Array.from({ length: 12 }, () => 0);
  setFlip(below(N_FLIP, random), eo);
  return { cp, co, ep, eo };
}

/** Uniform numbers in [0, 1) from the platform's cryptographic generator. */
export function cryptoRandom(): number {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  // 53 random bits.
  return ((words[0] >>> 5) * 67108864 + (words[1] >>> 6)) / 9007199254740992;
}

const SUFFIX: Record<Amount, string> = { 1: '', 2: '2', 3: "'" };

/** Moves written in standard notation, e.g. "R U2 F'". */
export const movesToString = (moves: readonly SolverMove[]) => moves.map((m) => `${m.face}${SUFFIX[m.amount]}`).join(' ');

/** The moves that undo `moves`. */
export const invertMoves = (moves: readonly SolverMove[]): SolverMove[] =>
  [...moves].reverse().map((m) => ({ face: m.face, amount: (4 - m.amount) as Amount }));
