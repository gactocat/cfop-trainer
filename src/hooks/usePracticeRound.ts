'use client';

import { useState, useSyncExternalStore } from 'react';
import type { PracticeResult } from '@/lib/practice-log';
import { getServerSnapshot, getSnapshot, setEachOnce, subscribe } from '@/lib/practice-options-store';
import { doneCases, nextRoundCase, roundPosition, shuffled } from '@/lib/practice-round';

/** The options kept on this device (see practice-options-store.ts). */
export function usePracticeOptions() {
  const options = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...options, setEachOnce };
}

/** A round of "each selected case once": its order, and the session's solves before it began. */
export interface PracticeRound<Id extends string> {
  order: readonly Id[];
  /** The key of the session's latest solve when the round began; later ones count. */
  after: number;
}

/**
 * "Each selected case once" over a practice session: while `on`, the
 * selected cases are dealt once each in a shuffled order. A round begins or
 * ends only between cases (`idle`), so switching it on mid-attempt starts it
 * with the next case; its solves are the session's from then on, so the
 * session's figures carry on across rounds. `restart` deals a new round.
 * The trainer redraws its case when `round` changes (compare by identity).
 */
export function usePracticeRound<Id extends string>({ on, pool, results, idle }: {
  on: boolean;
  pool: readonly Id[];
  results: readonly PracticeResult[];
  idle: boolean;
}) {
  const [round, setRound] = useState<PracticeRound<Id> | null>(null);
  const deal = (): PracticeRound<Id> => ({ order: shuffled(pool), after: results[0]?.key ?? 0 });
  // Adjusted during render, so the first case of a round already comes from it.
  if (idle && on !== (round !== null)) setRound(on ? deal() : null);
  const roundResults = round ? results.filter((r) => r.key > round.after) : [];
  const nextCase = round ? nextRoundCase(round.order, roundResults) : null;
  return {
    round,
    /** The round's next case; null once every case is done (or without a round). */
    nextCase,
    /** Every case of the round is done, and no attempt is on. */
    complete: round !== null && idle && nextCase === null,
    /** The round's solves, newest first. */
    results: roundResults,
    /** Which case of the round is on screen, e.g. 3/21; undefined without a round. */
    position: (showingKeptResult: boolean) => round
      ? { n: roundPosition(doneCases(round.order, roundResults).size, round.order.length, showingKeptResult), total: round.order.length }
      : undefined,
    restart: () => setRound(deal()),
  };
}
