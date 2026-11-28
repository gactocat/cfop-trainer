'use client';

import { useCallback, useState } from 'react';
import type { TrainerFlavor } from '@/lib/practice-mode';

/**
 * Recognition timed without a cube, when the practice measures it: from the
 * case being in sight to letting go to start. With no setup the case shows
 * as it is drawn (`shownAt`, performance.now()), so recognition runs from
 * there; with a setup, the case is made by hand, so a tap once it is made
 * starts it (as a tap starts a solve's inspection). Starting the attempt
 * (`begin`) keeps the recognition up to then; the solve's time runs from the
 * start. `restart` begins again: the same case again, or an attempt dropped.
 */
export function useHandRecognition({ on, flavor, shownAt }: {
  on: boolean;
  flavor: TrainerFlavor;
  /** When the case on screen was drawn; null before one is. */
  shownAt: number | null;
}) {
  const [tappedAt, setTappedAt] = useState<number | null>(null);
  const [restartedAt, setRestartedAt] = useState<number | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const byHand = on && (flavor === 'standard' || flavor === 'inverse');
  // A case drawn after a restart counts from its own showing.
  const since = !byHand ? null
    : flavor === 'standard' ? (shownAt === null ? null : Math.max(shownAt, restartedAt ?? -Infinity))
      : tappedAt;
  const restart = useCallback(() => {
    setTappedAt(null);
    setMeasured(null);
    setRestartedAt(performance.now());
  }, []);
  return {
    /** Measured by hand in this flavor. */
    byHand,
    /** performance.now() recognition started; null when it is not running (or not measured). */
    since,
    /** With a setup: waiting for the tap that says the case is made. */
    awaitingTap: byHand && flavor === 'inverse' && tappedAt === null,
    tap: useCallback(() => setTappedAt(performance.now()), []),
    cancelTap: useCallback(() => setTappedAt(null), []),
    /** The attempt starts: keeps and returns the recognition up to now (null when not measured). */
    begin: useCallback((): number | null => {
      const ms = since === null ? null : Math.max(0, performance.now() - since);
      setMeasured(ms);
      return ms;
    }, [since]),
    /** The recognition kept at the start of the attempt. */
    measured,
    restart,
  };
}
