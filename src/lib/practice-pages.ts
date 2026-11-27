// Practice has pages of its own, under each list: random practice of the
// cases ticked in the list, and the practice of one algorithm under its
// case. Every one is prerendered (the iOS export included), so the
// algorithm practised goes in the query rather than the path. Pure, see
// scripts/verify-practice.mts.

import type { Practice } from '@/types/practice';

const PRACTICES: readonly Practice[] = ['f2l', 'oll', 'pll'];
const isPractice = (segment: string | undefined): segment is Practice => PRACTICES.includes(segment as Practice);

/** The query key naming the algorithm a case practice uses (its record id). */
export const ALGORITHM_PARAM = 'alg';

/** Random practice of a list's ticked cases: /pll/random. */
export const randomPracticePath = (practice: Practice) => `/${practice}/random`;

/** The practice of one algorithm, under its case: /pll/T/practice?alg=<id>. */
export const casePracticePath = (practice: Practice, caseId: string, algorithmId: string) =>
  `/${practice}/${encodeURIComponent(caseId)}/practice?${ALGORITHM_PARAM}=${encodeURIComponent(algorithmId)}`;

export type PracticePage =
  | { kind: 'random'; practice: Practice }
  | { kind: 'case'; practice: Practice; caseId: string };

/** The practice page at `pathname` (the iOS export's trailing slash too), or null for any other page. */
export function practicePageOf(pathname: string): PracticePage | null {
  const [practice, second, third, ...rest] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!isPractice(practice) || !second || rest.length > 0) return null;
  if (second === 'random' && third === undefined) return { kind: 'random', practice };
  if (third === 'practice') return { kind: 'case', practice, caseId: second };
  return null;
}
