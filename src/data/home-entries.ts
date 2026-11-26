// The top page's entries, in groups: the algorithms of each CFOP stage, and
// solves from a scramble. Another kind of solve (F2L only, the last layer)
// is one more entry in the solve group.

import type { MessageKey } from '@/i18n/messages';

/** What the entry's cube drawing highlights: a stage's stickers, or the whole cube. */
export type HomeEntryArt = 'f2l' | 'oll' | 'pll' | 'solve';

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
