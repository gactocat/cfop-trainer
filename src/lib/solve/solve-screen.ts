// A solve from a scramble moves through three screens: the scramble (turn it
// on the cube), the timer (inspection, a press held to get ready, the
// solve) and the result (time, figures, stages; Retry or Next). Which one
// is on and what the timer shows follow from the solve's state, worked out
// here so the moves between them can be checked on their own
// (scripts/verify-solve.mts). The screens are the same for every kind of
// solve; only what the result lists differs.

import { toneOf, type HoldPhase, type TimerTone } from '@/lib/hold-timer';

export type SolveScreen = 'scramble' | 'timer' | 'result';

export interface SolveFlow {
  /** A result is on screen (until Retry, Next or Undo). */
  result: boolean;
  /** The solve is being timed (by hand or by the cube). */
  timing: boolean;
  /** performance.now() when the inspection began (by a tap without a cube, by the cube reaching the scramble with one); null without one. */
  inspectionSince: number | null;
  /** The press on the screen, without a cube (see hold-timer.ts). */
  hold: HoldPhase;
  /** With a cube: it is in the scrambled state, waiting for its first turn. */
  cubeReady: boolean;
}

/**
 * The screen a solve is on. The timer takes over as soon as there is
 * something to time: a press held (red, then green), the inspection, a
 * cube ready to start, or the solve.
 */
export function solveScreenOf(flow: SolveFlow): SolveScreen {
  if (flow.result) return 'result';
  if (flow.timing || flow.inspectionSince !== null || flow.cubeReady) return 'timer';
  return flow.hold === 'pressed' || flow.hold === 'armed' || flow.hold === 'running' ? 'timer' : 'scramble';
}

/**
 * What the timer screen's digits show. running: the solve, from `since`.
 * inspection: the inspection counting up from `since`. zero: 0.00, red
 * while a press is held too briefly to start, green once letting go starts
 * the solve, else as the other digits.
 */
export type TimerFace =
  | { kind: 'running'; since: number }
  | { kind: 'inspection'; since: number }
  | { kind: 'zero'; tone: TimerTone };

/**
 * The timer screen's digits. A press held during the inspection shows 0.00
 * in its colour (the inspection carries on below it); otherwise the
 * inspection counts up, then the solve runs.
 */
export function timerFaceOf(flow: Pick<SolveFlow, 'inspectionSince' | 'hold'> & { timingSince: number | null }): TimerFace {
  if (flow.timingSince !== null) return { kind: 'running', since: flow.timingSince };
  const tone = toneOf(flow.hold);
  if (flow.inspectionSince !== null && tone === 'plain') return { kind: 'inspection', since: flow.inspectionSince };
  return { kind: 'zero', tone };
}
