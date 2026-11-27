// Inspection as the WCA runs it: up to 15 seconds to look at the cube before
// starting. Starting after 15 seconds (up to 17) adds two seconds; after 17
// it is a DNF. The judge calls out 8 and 12 seconds. Pure, so the boundaries
// can be checked on their own (scripts/verify-solve.mts).

import type { Penalty } from '@/lib/solve/solve-record';

export const INSPECTION_MS = 15_000;
export const PLUS2_UNTIL_MS = 17_000;
/** When the judge calls out how long the inspection has run. */
export const INSPECTION_CALLS = [8_000, 12_000] as const;

/** The penalty for starting `ms` after the inspection began. */
export function inspectionPenalty(ms: number): Penalty | null {
  if (ms > PLUS2_UNTIL_MS) return 'dnf';
  if (ms > INSPECTION_MS) return 'plus2';
  return null;
}

/** What the inspection shows `ms` after it began, counting up: whole seconds gone (0 to 15), then +2, then DNF. */
export function inspectionShown(ms: number): { seconds: number } | { penalty: Penalty } {
  const penalty = inspectionPenalty(ms);
  if (penalty) return { penalty };
  return { seconds: Math.max(0, Math.floor(ms / 1000)) };
}

/** The latest call reached (8 or 12 seconds), or null before 8 seconds and after 15. */
export function inspectionCall(ms: number): 8 | 12 | null {
  if (ms >= INSPECTION_MS) return null;
  if (ms >= INSPECTION_CALLS[1]) return 12;
  if (ms >= INSPECTION_CALLS[0]) return 8;
  return null;
}
