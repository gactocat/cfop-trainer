// Figures for one practice session: the whole session (mean time, moves and
// TPS) and case by case (recognition and solving as a mean and a best, moves
// and TPS), over the solves that were kept.

export interface SessionSolve {
  caseId: string;
  name: string;
  seconds: number;
  /** Null when the attempt had no recognition time (started by hand). */
  recognitionMs: number | null;
  /** Null when the moves are unknown (no algorithm for the case). */
  moveCount: number | null;
  tps: number | null;
  /** Taken back with undo. */
  undone: boolean;
}

export interface MeanBest {
  mean: number;
  best: number;
  /** How many solves the mean is over (a mean of one is that solve). */
  count: number;
}

export interface SessionTotals {
  count: number;
  /** Seconds; null before the first solve. */
  meanSeconds: number | null;
  /** Over the solves whose moves are known; null when none are. */
  meanMoves: number | null;
  /** The mean of each solve's TPS; null when none is known. */
  meanTps: number | null;
}

export interface CaseSummary {
  caseId: string;
  name: string;
  count: number;
  /** Seconds; null when none of the case's solves had a recognition time. */
  recognition: MeanBest | null;
  /** Seconds. */
  solve: MeanBest;
  moves: number | null;
  tps: number | null;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, v) => a + v, 0) / values.length : null);

function meanBest(values: number[]): MeanBest | null {
  if (values.length === 0) return null;
  return { mean: mean(values)!, best: Math.min(...values), count: values.length };
}

const kept = (results: readonly SessionSolve[]) => results.filter((r) => !r.undone);
const known = (values: (number | null)[]) => values.filter((v): v is number => v !== null);

/** The whole session: undone solves do not count. */
export function summarizeSession(results: readonly SessionSolve[]): SessionTotals {
  const solves = kept(results);
  return {
    count: solves.length,
    meanSeconds: mean(solves.map((r) => r.seconds)),
    meanMoves: mean(known(solves.map((r) => r.moveCount))),
    meanTps: mean(known(solves.map((r) => r.tps))),
  };
}

/**
 * Summarise `results` (newest first) case by case, the most recently solved
 * case first. Undone solves do not count; a case with none left is dropped.
 */
export function summarizeByCase(results: readonly SessionSolve[]): CaseSummary[] {
  const order: string[] = [];
  const byCase = new Map<string, SessionSolve[]>();
  for (const result of kept(results)) {
    let entry = byCase.get(result.caseId);
    if (!entry) {
      entry = [];
      byCase.set(result.caseId, entry);
      order.push(result.caseId);
    }
    entry.push(result);
  }
  return order.map((caseId) => {
    const solves = byCase.get(caseId)!;
    return {
      caseId,
      name: solves[0].name,
      count: solves.length,
      recognition: meanBest(known(solves.map((r) => (r.recognitionMs === null ? null : r.recognitionMs / 1000)))),
      solve: meanBest(solves.map((r) => r.seconds))!,
      moves: mean(known(solves.map((r) => r.moveCount))),
      tps: mean(known(solves.map((r) => r.tps))),
    };
  });
}
