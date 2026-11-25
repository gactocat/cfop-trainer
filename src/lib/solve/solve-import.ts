// Whether a user's device solves go into their account, kept on this device
// per user. The first sign-in's import choice (persistence.ts) sets it, so
// choosing to import device data there brings the solves in too.

import type { ImportDecision } from '@/lib/solve/solve-library';

export const SOLVE_IMPORT_KEY = 'cfop:solve-import:v1';

export function rememberSolveImport(userId: string, decision: ImportDecision) {
  if (typeof window === 'undefined') return;
  try {
    const all = JSON.parse(window.localStorage.getItem(SOLVE_IMPORT_KEY) ?? '{}') as Record<string, ImportDecision>;
    // An import already made stays made.
    if (all[userId] === 'imported' && decision !== 'imported') return;
    all[userId] = decision;
    window.localStorage.setItem(SOLVE_IMPORT_KEY, JSON.stringify(all));
  } catch { /* blocked storage: the offer shows again next time */ }
}
