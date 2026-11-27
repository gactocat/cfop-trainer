// Reading a smart cube's reported turns as the moves the user made.
//
// The cube reports outer face turns only, relative to its centres. A slice
// turns the centres instead: M arrives as R and L' (M' as R' and L, M2 as
// both faces twice), E as U and D', S as F' and B, each pair a few
// milliseconds apart and in either order, and once it is done the centres
// sit elsewhere in the user's hands. So two quarter turns of opposite faces
// that turn the same way about their axis, close together on the cube clock
// with nothing on another axis between them, are read as one slice quarter,
// and the turns after it are read in the frame the slice left (after M, the
// face the cube reports where U was is still the user's U).
//
// Both faces really turned at once (R L' made together) looks the same and
// is read as a slice too. A wide turn reports only its opposite face (r as
// L), so it cannot be seen and leaves the frame as it was, as do rotations.

import type { Amount, Face } from '@/lib/smart-cube/cube-state';
import { rotateFrame, userFace, userNotation, type Frame } from '@/lib/smart-cube/holding';

/**
 * Two quarter turns of opposite faces at most this far apart (cube clock, ms)
 * make a slice. A slice turns both faces against the centres in one motion,
 * so they should come within a few milliseconds of each other; turns made one
 * after the other came 37 ms apart at the closest in a recording of T perms
 * on a GAN i4, overlapping at speed.
 */
export const SLICE_WINDOW_MS = 60;

/** A reported quarter turn: cube-frame face, 1 clockwise or 3 counter-clockwise, cube clock ms. */
export interface ReportedTurn {
  face: Face;
  amount: number;
  t: number;
}

export interface ReadMove {
  /** As the user made it, in the frame the cube was held in: "R", "U2", "M'". */
  move: string;
  /** Index of the last reported turn it is made of. */
  end: number;
}

export interface TurnReading {
  moves: ReadMove[];
  /** The frame after the turns: the frame read from, turned by the slices. */
  frame: Frame;
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const SUFFIX = ['', '', '2', "'"];
const sameAxis = (a: Face, b: Face) => a === b || OPPOSITE[a] === b;

// For each user position of the face turning +n: the slice and its amount
// per quarter of that face, and the rotation each slice quarter makes
// (M = R L' x', E = U D' y', S = F' B z, as in setup-guide.ts).
const SLICE_OF: Record<Face, { slice: 'M' | 'E' | 'S'; sign: 1 | -1 }> = {
  R: { slice: 'M', sign: 1 }, L: { slice: 'M', sign: -1 },
  U: { slice: 'E', sign: 1 }, D: { slice: 'E', sign: -1 },
  B: { slice: 'S', sign: 1 }, F: { slice: 'S', sign: -1 },
};
const SLICE_ROTATION = { M: ['x', -1], E: ['y', -1], S: ['z', 1] } as const;

/** One move in the cube's frame: an outer face turn, or a slice that turns `face` by `amount` and its opposite back. */
interface Unit {
  slice: boolean;
  face: Face;
  amount: number;
  end: number;
}

/** For each turn, the index of the turn it makes a slice with, or -1. */
function pairSlices(turns: readonly ReportedTurn[], windowMs: number): number[] {
  const candidates: [number, number][] = [];
  for (let i = 0; i < turns.length; i++) {
    for (let j = i + 1; j < turns.length && sameAxis(turns[i].face, turns[j].face); j++) {
      if (turns[j].t - turns[i].t > windowMs) break;
      if (turns[j].face === OPPOSITE[turns[i].face] && mod4(turns[i].amount + turns[j].amount) === 0) candidates.push([i, j]);
    }
  }
  // Closest pairs first: in an M2 the faces' second quarters come together as well.
  candidates.sort((a, b) => (turns[a[1]].t - turns[a[0]].t) - (turns[b[1]].t - turns[b[0]].t) || a[0] - b[0]);
  const partner = turns.map(() => -1);
  for (const [i, j] of candidates) {
    if (partner[i] < 0 && partner[j] < 0) {
      partner[i] = j;
      partner[j] = i;
    }
  }
  return partner;
}

function units(turns: readonly ReportedTurn[], merge: boolean, windowMs: number): Unit[] {
  const partner = pairSlices(turns, windowMs);
  const out: Unit[] = [];
  turns.forEach((turn, i) => {
    if (partner[i] >= 0 && partner[i] < i) return;
    const unit: Unit = { slice: partner[i] > i, face: turn.face, amount: mod4(turn.amount), end: Math.max(i, partner[i]) };
    const last = out[out.length - 1];
    // Consecutive turns of one face merge, as do slices on one axis; those that add up to nothing drop out.
    if (merge && last && last.slice === unit.slice && (unit.slice ? sameAxis(last.face, unit.face) : last.face === unit.face)) {
      last.amount = mod4(last.amount + (last.face === unit.face ? unit.amount : -unit.amount));
      last.end = unit.end;
      if (last.amount === 0) out.pop();
      return;
    }
    out.push(unit);
  });
  return out;
}

/**
 * Read reported turns as moves in the user's notation, starting from `frame`.
 * With `merge` (the default) consecutive turns of one face and slices on one
 * axis are joined (R R as R2, R R' as nothing); without it each quarter
 * stays a move of its own, as a live view animates them.
 */
export function readTurns(
  turns: readonly ReportedTurn[],
  frame: Frame,
  { merge = true, windowMs = SLICE_WINDOW_MS }: { merge?: boolean; windowMs?: number } = {},
): TurnReading {
  let current = frame;
  const moves = units(turns, merge, windowMs).map((unit): ReadMove => {
    if (!unit.slice) return { move: userNotation(current, unit.face, unit.amount as Amount), end: unit.end };
    const { slice, sign } = SLICE_OF[userFace(current, unit.face)];
    const n = mod4(sign * unit.amount);
    const [axis, dir] = SLICE_ROTATION[slice];
    current = rotateFrame(current, axis, dir * n);
    return { move: `${slice}${SUFFIX[n]}`, end: unit.end };
  });
  return { moves, frame: current };
}

/** The moves as one string, e.g. "M2 U M U2 M' U M2". */
export const readNotation = (turns: readonly ReportedTurn[], frame: Frame): string =>
  readTurns(turns, frame).moves.map((m) => m.move).join(' ');

/** Moves as read: a slice is one move, like a face turn, and consecutive turns of one face are one. */
export const readMoveCount = (turns: readonly ReportedTurn[], frame: Frame): number => readTurns(turns, frame).moves.length;

/**
 * Quarter turns on the cube's own clock, as a trainer holds them, read move by
 * move for a live view: each quarter is a move ("R", "R" for R2; "M", "M" for
 * M2), and a quarter shown alone becomes its slice once the other face comes.
 */
export const liveMoves = (turns: readonly { face: Face; amount: number; cubeTime: number }[], frame: Frame): string[] =>
  readTurns(turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime })), frame, { merge: false }).moves.map((m) => m.move);
