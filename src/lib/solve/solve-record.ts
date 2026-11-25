// One timed solve from a scramble, as kept on the device (solve-store.ts).
// A solve timed by hand has its time only; one timed by a smart cube also
// keeps its turns and where each CFOP stage ended.

import type { CubeState, Face } from '@/lib/smart-cube/cube-state';
import { lastLayerFace, type CubeHolding } from '@/lib/smart-cube/holding';
import { cfopMoveCount, OPPOSITE, splitCfop, type CfopSplit, type TimedTurn } from '@/lib/solve/cfop-split';

/** The kind of solve. Only CFOP exists; F2L and last-layer solves are planned. */
export type SolveEvent = 'cfop';

export interface SolveRecord {
  id: string;
  version: 1;
  event: SolveEvent;
  /** ISO time the solve was recorded. */
  recordedAt: string;
  /** The scramble shown, in standard notation. */
  scramble: string;
  /** The time: on the cube's clock (first to last turn) or the screen's (start to stop). */
  ms: number;
  timer: 'hand' | 'cube';
  /** Cube solves only, as are the fields below. */
  holding?: CubeHolding;
  /** Every turn from the first to the one that solved the cube. */
  turns?: TimedTurn[];
  moveCount?: number;
  split?: CfopSplit;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function handSolve(scramble: string, ms: number, now = new Date()): SolveRecord {
  return { id: newId(), version: 1, event: 'cfop', recordedAt: now.toISOString(), scramble, ms: Math.round(ms), timer: 'hand' };
}

/** The face the cross goes on when the cube is held this way: the bottom one. */
export const bottomFace = (holding: CubeHolding): Face => OPPOSITE[lastLayerFace(holding)];

export function cubeSolve(input: {
  scramble: string;
  holding: CubeHolding;
  /** The scrambled state the solve started from. */
  start: CubeState;
  /** Turns with absolute cube times, and the state after each. */
  turns: readonly { face: Face; amount: 1 | 3; cubeTime: number; state: CubeState }[];
  now?: Date;
}): SolveRecord {
  const first = input.turns[0]?.cubeTime ?? 0;
  const turns: TimedTurn[] = input.turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - first }));
  const split = splitCfop(input.start, input.turns.map((t) => t.state), bottomFace(input.holding));
  return {
    id: newId(),
    version: 1,
    event: 'cfop',
    recordedAt: (input.now ?? new Date()).toISOString(),
    scramble: input.scramble,
    ms: turns.length ? turns[turns.length - 1].t : 0,
    timer: 'cube',
    holding: input.holding,
    turns,
    moveCount: cfopMoveCount(turns, split),
    split,
  };
}
