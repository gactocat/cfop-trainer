// The top page's entries, in groups: the algorithms of each CFOP stage, and
// solves from a scramble. Another kind of solve (the cross, F2L or the last
// layer on its own) is one more entry in the solve group: SOLVE_MODE_ENTRIES
// has them, ready for when their pages exist.

import type { MessageKey } from '@/i18n/messages';
import { SOLVE_MODE, SOLVE_MODES, type SolveMode } from '@/lib/solve/solve-modes';

/**
 * What the entry's cube drawing highlights: a stage's stickers, or the whole
 * cube. `cross` is for the cross on its own, which the drawing does not
 * show yet.
 */
export type HomeEntryArt = 'f2l' | 'oll' | 'pll' | 'solve' | 'cross';

export interface HomeEntry {
  id: string;
  href: string;
  name: string;
  art: HomeEntryArt;
}

export interface HomeGroup {
  id: string;
  title: MessageKey;
  entries: readonly HomeEntry[];
}

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
  {
    id: 'solve',
    title: 'landing.group.solve',
    entries: [
      { id: 'cfop', href: '/solve/cfop', name: 'CFOP', art: 'solve' },
    ],
  },
];

// The last layer lights up as PLL's drawing does: the top face and the top
// row of the sides.
const MODE_ART: Record<SolveMode, HomeEntryArt> = { cfop: 'solve', cross: 'cross', f2l: 'f2l', ll: 'pll' };

/** An entry for each kind of solve (lib/solve/solve-modes.ts), CFOP first. */
export const SOLVE_MODE_ENTRIES: readonly HomeEntry[] = SOLVE_MODES.map((mode) => ({
  id: mode,
  href: SOLVE_MODE[mode].href,
  name: SOLVE_MODE[mode].label,
  art: MODE_ART[mode],
}));
