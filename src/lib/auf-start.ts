import type { PracticeSettings } from '@/lib/practice-settings-store';
import { AUFS, type Auf } from '@/types/pll';

/**
 * How each case is turned before it is shown: as defined, by a random U
 * turn (to practise recognising the AUF), or by its algorithm's AUF, so the
 * algorithm can start straight away.
 */
export type AufStart = 'fixed' | 'random' | 'algorithm';

/** Read the choice from the synced settings (randomAuf predates alignAuf). */
export function aufStartOf(settings: Pick<PracticeSettings, 'randomAuf' | 'alignAuf'>): AufStart {
  if (settings.alignAuf) return 'algorithm';
  return settings.randomAuf ? 'random' : 'fixed';
}

/** The settings that store `choice`; older versions read "algorithm" as fixed. */
export function aufStartPatch(choice: AufStart): Pick<PracticeSettings, 'randomAuf' | 'alignAuf'> {
  return { randomAuf: choice === 'random', alignAuf: choice === 'algorithm' };
}

/**
 * The U turn added on top of a case's setup. `aligned` is the turn that
 * leaves the case ready for its algorithm without the AUF.
 */
export function caseOffset(choice: AufStart, aligned: Auf, random: () => number = Math.random): Auf {
  if (choice === 'random') return AUFS[Math.floor(random() * AUFS.length)];
  return choice === 'algorithm' ? aligned : 'U0';
}
