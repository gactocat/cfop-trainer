// The top page's entries, in groups: the algorithms of each CFOP stage, and
// solves from a scramble: CFOP, then the cross, F2L and the last layer on
// their own (SOLVE_MODE_ENTRIES, from lib/solve/solve-modes.ts). CFOP is the
// solve, so it is featured: it takes the whole row of its group.

import type { MessageKey } from '@/i18n/messages';
import { SOLVE_MODE, SOLVE_MODES, type SolveMode } from '@/lib/solve/solve-modes';

/** What the entry's cube drawing highlights: a stage's stickers (the cross, the first two layers, the last layer), or the whole cube. */
export type HomeEntryArt = 'f2l' | 'oll' | 'pll' | 'solve' | 'cross';

export interface HomeEntry {
  id: string;
  href: string;
  name: string;
  art: HomeEntryArt;
  /** Takes the whole row of its group, tinted (the same tile otherwise). */
  featured?: boolean;
}

export interface HomeGroup {
  id: 'algorithms' | 'solve';
  title: MessageKey;
  entries: readonly HomeEntry[];
}

// The last layer lights up as PLL's drawing does: the top face and the top
// row of the sides.
const MODE_ART: Record<SolveMode, HomeEntryArt> = { cfop: 'solve', cross: 'cross', f2l: 'f2l', ll: 'pll' };

/** An entry for each kind of solve (lib/solve/solve-modes.ts), CFOP first and featured. */
export const SOLVE_MODE_ENTRIES: readonly HomeEntry[] = SOLVE_MODES.map((mode) => ({
  id: mode,
  href: SOLVE_MODE[mode].href,
  name: SOLVE_MODE[mode].label,
  art: MODE_ART[mode],
  ...(mode === 'cfop' ? { featured: true } : {}),
}));

export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    id: 'algorithms',
    title: 'landing.group.algorithms',
    entries: [
      { id: 'f2l', href: '/f2l', name: 'F2L', art: 'f2l' },
      { id: 'oll', href: '/oll', name: 'OLL', art: 'oll' },
      { id: 'pll', href: '/pll', name: 'PLL', art: 'pll' },
    ],
  },
  { id: 'solve', title: 'landing.group.solve', entries: SOLVE_MODE_ENTRIES },
];
