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

/** A practice's session (its solves this time), a page under it: /pll/random/session, /pll/T/practice/session?alg=<id>. */
export const SESSION_SEGMENT = 'session';

export type PracticePage =
  | { kind: 'random'; practice: Practice; session: boolean }
  | { kind: 'case'; practice: Practice; caseId: string; session: boolean };

/**
 * The practice page at `pathname` (the iOS export's trailing slash too),
 * its session page included (`session`), or null for any other page.
 */
export function practicePageOf(pathname: string): PracticePage | null {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const session = segments[segments.length - 1] === SESSION_SEGMENT;
  const [practice, second, third, ...rest] = session ? segments.slice(0, -1) : segments;
  if (!isPractice(practice) || !second || rest.length > 0) return null;
  if (second === 'random' && third === undefined) return { kind: 'random', practice, session };
  if (third === 'practice') return { kind: 'case', practice, caseId: second, session };
  return null;
}

/** The practice page itself, from its page or its session page: the path without the session. */
export function practicePathOf(page: PracticePage): string {
  return page.kind === 'random' ? randomPracticePath(page.practice)
    : `/${page.practice}/${encodeURIComponent(page.caseId)}/practice`;
}

/** The practice's session page (the query, naming the algorithm, goes with it). */
export const practiceSessionPath = (page: PracticePage) => `${practicePathOf(page)}/${SESSION_SEGMENT}`;
