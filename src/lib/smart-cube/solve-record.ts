// One solve timed by a smart cube, as kept on the device (smart-solve-store),
// and the helpers that turn its raw cube turns into what the UI shows.

import type { Amount, Face } from '@/lib/smart-cube/cube-state';
import { holdingFrame, type CubeHolding, type Frame } from '@/lib/smart-cube/holding';
import { planSetup } from '@/lib/smart-cube/setup-guide';
import { readTurns, type ReportedTurn, type TurnReading } from '@/lib/smart-cube/slice-moves';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

/** A reported quarter turn in the cube's frame; `t` is ms since the first solving turn (cube clock). */
export interface RecordedTurn {
  face: Face;
  amount: 1 | 3;
  t: number;
}

export interface SmartSolveRecord {
  id: string;
  version: 1;
  practice: TrainerPractice;
  caseId: string;
  /** ISO time the solve was recorded. */
  recordedAt: string;
  holding: CubeHolding;
  /** The setup shown for the attempt, in the user's notation. */
  scramble: string;
  /** Cube clock of the first solving turn. */
  startCubeTime: number;
  turns: RecordedTurn[];
  /** Ready to first turn; null when unknown. */
  recognitionMs: number | null;
  /** First to last solving turn: the time recorded for the solve. */
  executionMs: number;
  /**
   * Moves as read (slice-moves.ts): consecutive turns of one face merged
   * (R R -> R2, R R' -> nothing), a slice one move. Records from before
   * slices were read count a slice as two; the screens count again from `turns`.
   */
  moveCount: number;
  /** moveCount per second of execution, two decimals. */
  tps: number;
  /** How the case was presented; absent in records from before no-scramble mode. */
  mode?: SmartSolveMode;
}

/** inverse: set up on the physical cube. no-scramble: solved on a virtual cube. */
export type SmartSolveMode = 'inverse' | 'no-scramble';

/** Merge consecutive turns of one face, dropping those that cancel. */
export function mergeTurns(turns: readonly { face: Face; amount: number }[]): { face: Face; amount: Amount }[] {
  const out: { face: Face; amount: number }[] = [];
  for (const turn of turns) {
    const last = out[out.length - 1];
    if (last && last.face === turn.face) {
      last.amount = (last.amount + turn.amount) % 4;
      if (last.amount === 0) out.pop();
    } else {
      out.push({ face: turn.face, amount: turn.amount % 4 });
    }
  }
  return out as { face: Face; amount: Amount }[];
}

/** The frame the solving turns were made in: the holding, turned by any rotation the setup leaves. */
export function solveFrame(holding: CubeHolding, scramble: string): Frame {
  return planSetup(scramble, holding)?.finalFrame ?? holdingFrame(holding);
}

/** A solve's turns read as moves (slices included) in the frame it was solved in. */
export function readSolve(solve: { holding: CubeHolding; scramble: string; turns: readonly ReportedTurn[] }): TurnReading {
  return readTurns(solve.turns, solveFrame(solve.holding, solve.scramble));
}

/** The solve as moves in the user's notation, e.g. "R U R' U'" or "M2 U M U2 M' U M2". */
export const solveNotation = (solve: { holding: CubeHolding; scramble: string; turns: readonly ReportedTurn[] }): string =>
  readSolve(solve).moves.map((m) => m.move).join(' ');

/** Moves of a solve a trainer has just timed (its turns on the cube's own clock), counted as `moveCount` is. */
export function timedMoveCount(solve: { holding: CubeHolding; scramble: string; turns: readonly { face: Face; amount: 1 | 3; cubeTime: number }[] }): number {
  return readSolve({ ...solve, turns: solve.turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime })) }).moves.length;
}

export function turnsPerSecond(moveCount: number, executionMs: number): number {
  if (executionMs <= 0) return 0;
  return Math.round((moveCount / (executionMs / 1000)) * 100) / 100;
}

export function buildSmartSolve(input: {
  id: string;
  recordedAt: string;
  practice: TrainerPractice;
  caseId: string;
  holding: CubeHolding;
  scramble: string;
  /** Solving turns with absolute cube times, first to last. */
  turns: readonly { face: Face; amount: 1 | 3; cubeTime: number }[];
  recognitionMs: number | null;
  executionMs: number;
  mode?: SmartSolveMode;
}): SmartSolveRecord {
  const start = input.turns[0]?.cubeTime ?? 0;
  const turns = input.turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - start }));
  const moveCount = readSolve({ ...input, turns }).moves.length;
  return {
    id: input.id,
    version: 1,
    practice: input.practice,
    caseId: input.caseId,
    recordedAt: input.recordedAt,
    holding: input.holding,
    scramble: input.scramble,
    startCubeTime: start,
    turns,
    recognitionMs: input.recognitionMs,
    executionMs: input.executionMs,
    moveCount,
    tps: turnsPerSecond(moveCount, input.executionMs),
    mode: input.mode ?? 'inverse',
  };
}
