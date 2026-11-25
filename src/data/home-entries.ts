// The top page's entries, in groups: the algorithms of each CFOP stage, and
// solves from a scramble. Another kind of solve (F2L only, the last layer)
// is one more entry in the solve group.

import type { MessageKey } from '@/i18n/messages';
import { F2L_IDS } from '@/types/f2l';
import { OLL_IDS } from '@/types/oll';
import { PLL_IDS } from '@/types/pll';

/** What the entry's cube drawing highlights: a stage's stickers, or the whole cube. */
export type HomeEntryArt = 'f2l' | 'oll' | 'pll' | 'solve';

export interface HomeEntry {
  id: string;
  href: string;
  name: string;
  art: HomeEntryArt;
  detail: { key: MessageKey; params?: Record<string, number> };
}

export interface HomeGroup {
  id: string;
  title: MessageKey;
  entries: readonly HomeEntry[];
}

const cases = (count: number) => ({ key: 'landing.caseCount' as const, params: { count } });

export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    id: 'algorithms',
    title: 'landing.group.algorithms',
    entries: [
      { id: 'f2l', href: '/f2l', name: 'F2L', art: 'f2l', detail: cases(F2L_IDS.length) },
      { id: 'oll', href: '/oll', name: 'OLL', art: 'oll', detail: cases(OLL_IDS.length) },
      { id: 'pll', href: '/pll', name: 'PLL', art: 'pll', detail: cases(PLL_IDS.length) },
    ],
  },
  {
    id: 'solve',
    title: 'landing.group.solve',
    entries: [
      { id: 'cfop', href: '/solve/cfop', name: 'CFOP', art: 'solve', detail: { key: 'landing.solve.cfop' } },
    ],
  },
];
