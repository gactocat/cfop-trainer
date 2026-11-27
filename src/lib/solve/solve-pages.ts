// A kind of solve's pages: its solve (/solve/cfop), its records
// (/solve/cfop/records) and one solve of them
// (/solve/cfop/records/detail?id=<record id>). All are prerendered (the iOS
// export included), so the solve goes in the query rather than the path.
// The solve page stays on screen behind the other two (its layout), so
// going back to it finds the scramble, the result and the cube as left.
// Pure, see scripts/verify-solve-modes.mts.

import { modeOfSlug, SOLVE_MODE, type SolveMode } from '@/lib/solve/solve-modes';

/** The query key naming the solve shown (its record id). */
export const RECORD_PARAM = 'id';

export const solveRecordsPath = (mode: SolveMode) => `${SOLVE_MODE[mode].href}/records`;
export const solveRecordPath = (mode: SolveMode, id: string) => `${solveRecordsPath(mode)}/detail?${RECORD_PARAM}=${encodeURIComponent(id)}`;

export type SolvePage = { mode: SolveMode; kind: 'solve' | 'records' | 'record' };

/** The solve page at `pathname` (the iOS export's trailing slash too), or null for any other page. */
export function solvePageOf(pathname: string): SolvePage | null {
  const [first, slug, ...rest] = pathname.split('/').filter(Boolean);
  const mode = first === 'solve' && slug ? modeOfSlug(slug) : null;
  if (!mode) return null;
  const sub = rest.join('/');
  const kind = sub === '' ? 'solve' : sub === 'records' ? 'records' : sub === 'records/detail' ? 'record' : null;
  return kind && { mode, kind };
}
