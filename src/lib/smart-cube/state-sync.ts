import { SOLVED, stateEquals, type CubeState } from '@/lib/smart-cube/cube-state';

// What to do with a FACELETS report, the state the cube itself keeps, against
// the state tracked here from its turns. Pure, see verify-smart-cube.mts.

/**
 * apply: take the report. skip: keep the tracked state (turns are in flight,
 * or an older report must not undo a reset). confirm-reset: the cube reports
 * the reset it was sent; keep the tracked state and count reports again.
 */
export type FaceletsDecision = 'apply' | 'skip' | 'confirm-reset';

export function faceletsDecision({ reported, serial, lastMoveSerial, confirmingReset }: {
  reported: CubeState;
  /** The cube's move counter with the report. */
  serial: number;
  /** The counter of the last turn applied here; null when none since connecting or since a reset. */
  lastMoveSerial: number | null;
  /** Shortly after "mark as solved": only the cube's solved report counts. */
  confirmingReset: boolean;
}): FaceletsDecision {
  if (confirmingReset) return stateEquals(reported, SOLVED) ? 'confirm-reset' : 'skip';
  // Turns the cube counted that have not arrived yet: they are newer than the report.
  if (lastMoveSerial !== null && serial !== lastMoveSerial) return 'skip';
  return 'apply';
}
