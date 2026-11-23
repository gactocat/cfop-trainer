// One solve timed by a smart cube, as kept on the device (smart-solve-store),
// and the helpers that turn its raw cube turns into what the UI shows.

import type { Amount, Face } from '@/lib/smart-cube/cube-state';
import { holdingFrame, userNotation, type CubeHolding } from '@/lib/smart-cube/holding';
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
  /** Moves after merging consecutive turns of one face (R R -> R2, R R' -> nothing). */
  moveCount: number;
  /** moveCount per second of execution, two decimals. */
  tps: number;
}

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

/** The solve as moves in the user's notation for the holding, e.g. "R U R' U'". */
export function solveNotation(turns: readonly { face: Face; amount: number }[], holding: CubeHolding): string {
  const frame = holdingFrame(holding);
  return mergeTurns(turns).map((m) => userNotation(frame, m.face, m.amount)).join(' ');
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
}): SmartSolveRecord {
  const start = input.turns[0]?.cubeTime ?? 0;
  const moveCount = mergeTurns(input.turns).length;
  return {
    id: input.id,
    version: 1,
    practice: input.practice,
    caseId: input.caseId,
    recordedAt: input.recordedAt,
    holding: input.holding,
    scramble: input.scramble,
    startCubeTime: start,
    turns: input.turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - start })),
    recognitionMs: input.recognitionMs,
    executionMs: input.executionMs,
    moveCount,
    tps: turnsPerSecond(moveCount, input.executionMs),
  };
}
