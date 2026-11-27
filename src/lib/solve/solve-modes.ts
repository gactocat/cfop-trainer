// The kinds of solve from a scramble: a whole CFOP solve, or one of its
// parts on its own. A part's scramble leaves the stages before it solved,
// and the solve ends when its own stages are done:
//
//   cfop   a random state                            -> solved
//   cross  a random state                            -> a cross of any colour
//   f2l    the cross solved, everything else random  -> the cross and its four pairs
//   ll     the first two layers solved, LL random    -> solved (the last AUF included)
//
// Each kind keeps its own records (`event`), so its best, ao5 and ao12 are
// its own, and its own settings (`solves` in the practice settings). The
// cross of an F2L or last-layer scramble is white unless asked otherwise;
// the cross alone may be of any colour.
//
// Type imports only: the top page can read these without the solver.

import type { MessageKey } from '@/i18n/messages';
import type { CubeColour } from '@/lib/smart-cube/holding';
import type { CfopStage } from '@/lib/solve/cfop-split';
import type { SolveEvent } from '@/lib/solve/solve-record';

export type SolveMode = SolveEvent;

export interface SolveModeDefinition {
  id: SolveMode;
  /** The records' kind (`event` in SolveRecord and the `solves` table). */
  event: SolveEvent;
  /** The page is /solve/<slug>. */
  slug: string;
  href: string;
  /** The short name as written on the top page, e.g. "F2L" (stage names are not translated). */
  label: string;
  /** The name to show elsewhere, translated. */
  name: MessageKey;
  /** One line on what the mode is, translated. */
  description: MessageKey;
  /** The stages timed, in order (a part of CFOP_STAGES). */
  stages: readonly CfopStage[];
  /** What the scramble leaves solved. */
  solvedBefore: 'nothing' | 'cross' | 'f2l';
  /** When a smart cube stops the timer (see solve-goal.ts). */
  goal: 'solved' | 'cross' | 'f2l';
  /** The scramble leaves a cross of a set colour (white unless asked otherwise). */
  setsCross: boolean;
}

export const SOLVE_MODES: readonly SolveMode[] = ['cfop', 'cross', 'f2l', 'll'];

export const SOLVE_MODE: Readonly<Record<SolveMode, SolveModeDefinition>> = {
  cfop: {
    id: 'cfop', event: 'cfop', slug: 'cfop', href: '/solve/cfop', label: 'CFOP',
    name: 'solve.mode.cfop.name', description: 'solve.mode.cfop.description',
    stages: ['cross', 'f2l1', 'f2l2', 'f2l3', 'f2l4', 'oll', 'pll'],
    solvedBefore: 'nothing', goal: 'solved', setsCross: false,
  },
  cross: {
    id: 'cross', event: 'cross', slug: 'cross', href: '/solve/cross', label: 'Cross',
    name: 'solve.mode.cross.name', description: 'solve.mode.cross.description',
    stages: ['cross'],
    solvedBefore: 'nothing', goal: 'cross', setsCross: false,
  },
  f2l: {
    id: 'f2l', event: 'f2l', slug: 'f2l', href: '/solve/f2l', label: 'F2L',
    name: 'solve.mode.f2l.name', description: 'solve.mode.f2l.description',
    stages: ['f2l1', 'f2l2', 'f2l3', 'f2l4'],
    solvedBefore: 'cross', goal: 'f2l', setsCross: true,
  },
  ll: {
    id: 'll', event: 'll', slug: 'll', href: '/solve/ll', label: 'LL',
    name: 'solve.mode.ll.name', description: 'solve.mode.ll.description',
    stages: ['oll', 'pll'],
    solvedBefore: 'f2l', goal: 'solved', setsCross: true,
  },
};

/** The cross an F2L or last-layer scramble leaves, unless asked otherwise. */
export const DEFAULT_MODE_CROSS: CubeColour = 'white';

export const isSolveMode = (value: unknown): value is SolveMode => SOLVE_MODES.includes(value as SolveMode);

/** The mode a page's slug names, or null. */
export const modeOfSlug = (slug: string): SolveMode | null => SOLVE_MODES.find((mode) => SOLVE_MODE[mode].slug === slug) ?? null;
