// "Each selected case once": the session deals the selected cases in a
// shuffled order, one at a time. A case is done once it has a solve that was
// kept; one taken back with undo comes again. Pure, see verify-practice.mts.

export interface RoundSolve {
  caseId: string;
  undone: boolean;
}

/** The cases in a random order (Fisher-Yates), drawn with `random`. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The cases of `order` with a kept solve in `results`. */
export function doneCases<Id extends string>(order: readonly Id[], results: readonly RoundSolve[]): Set<Id> {
  const kept = new Set(results.filter((r) => !r.undone).map((r) => r.caseId));
  return new Set(order.filter((id) => kept.has(id)));
}

/** The next case to deal: the first in `order` not done yet; null once every case is. */
export function nextRoundCase<Id extends string>(order: readonly Id[], results: readonly RoundSolve[]): Id | null {
  const done = doneCases(order, results);
  return order.find((id) => !done.has(id)) ?? null;
}

/**
 * Which case of the round is on screen, counting from 1: the cases done, plus
 * the one being solved. On a result that was kept, that case is already done.
 */
export function roundPosition(done: number, total: number, showingKeptResult: boolean): number {
  return Math.min(total, done + (showingKeptResult ? 0 : 1));
}
