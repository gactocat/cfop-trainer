// A practice moves through the same three screens as a solve
// (solve-screen.ts): the case (its setup to make, or the case to solve),
// the timer, and the result (Next, or the same case again). Which one is on
// follows from the trainer's state, worked out here so the moves between
// them can be checked on their own (scripts/verify-practice.mts).

import type { HoldPhase } from '@/lib/hold-timer';

export type PracticeScreen = 'case' | 'timer' | 'result';

/** The trainer's own state: waiting on a case, timing it, or its result on screen. */
export type TrainerState = 'idle' | 'running' | 'stopped';

/**
 * The screen a practice is on. Without a cube the timer takes over once a
 * press is held (red, then green) as on the solve; with one, from the first
 * turn, since the case has to stay in view while it is recognised (with no
 * setup, the case is only on the screen's cube).
 */
export function practiceScreenOf({ state, hold }: { state: TrainerState; hold: HoldPhase }): PracticeScreen {
  if (state === 'stopped') return 'result';
  if (state === 'running') return 'timer';
  return hold === 'pressed' || hold === 'armed' ? 'timer' : 'case';
}
