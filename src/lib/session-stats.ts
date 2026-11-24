// Per-case figures for one practice session on a smart cube: recognition and
// solving, each as a mean and a best, over the solves that were kept.

export interface SessionSolve {
  caseId: string;
  name: string;
  seconds: number;
  /** Null when the attempt had no recognition time (started by hand). */
  recognitionMs: number | null;
  /** Taken back with undo. */
  undone: boolean;
}

export interface MeanBest {
  mean: number;
  best: number;
}

export interface CaseSummary {
  caseId: string;
  name: string;
  count: number;
  /** Seconds; null when none of the case's solves had a recognition time. */
  recognition: MeanBest | null;
  /** Seconds. */
  solve: MeanBest;
}

function meanBest(values: number[]): MeanBest | null {
  if (values.length === 0) return null;
  return { mean: values.reduce((a, v) => a + v, 0) / values.length, best: Math.min(...values) };
}

/**
 * Summarise `results` (newest first) case by case, the most recently solved
 * case first. Undone solves do not count; a case with none left is dropped.
 */
export function summarizeByCase(results: readonly SessionSolve[]): CaseSummary[] {
  const order: string[] = [];
  const byCase = new Map<string, { name: string; seconds: number[]; recognition: number[] }>();
  for (const result of results) {
    if (result.undone) continue;
    let entry = byCase.get(result.caseId);
    if (!entry) {
      entry = { name: result.name, seconds: [], recognition: [] };
      byCase.set(result.caseId, entry);
      order.push(result.caseId);
    }
    entry.seconds.push(result.seconds);
    if (result.recognitionMs !== null) entry.recognition.push(result.recognitionMs / 1000);
  }
  return order.map((caseId) => {
    const entry = byCase.get(caseId)!;
    return {
      caseId,
      name: entry.name,
      count: entry.seconds.length,
      recognition: meanBest(entry.recognition),
      solve: meanBest(entry.seconds)!,
    };
  });
}
