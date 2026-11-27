import type { PracticeSettings } from '@/lib/practice-settings-store';
import { AUFS, type Auf } from '@/types/pll';

/**
 * How each case is turned before it is shown, from its usual orientation
 * (the one its algorithm's AUF and body solve): by that AUF, so the body
 * can start straight away; not at all, so the AUF is turned as part of the
 * algorithm; or by a random U turn (to practise recognising the AUF).
 * None depends on how the list shows the AUF.
 */
export type AufStart = 'pre-applied' | 'in-algorithm' | 'random';

/**
 * Read the choice from the synced settings (randomAuf predates alignAuf).
 * Neither flag, once "as set", reads as the AUF in the algorithm.
 */
export function aufStartOf(settings: Pick<PracticeSettings, 'randomAuf' | 'alignAuf'>): AufStart {
  if (settings.alignAuf) return 'pre-applied';
  return settings.randomAuf ? 'random' : 'in-algorithm';
}

/** The settings that store `choice`; versions before alignAuf read "pre-applied" as "as set", not random. */
export function aufStartPatch(choice: AufStart): Pick<PracticeSettings, 'randomAuf' | 'alignAuf'> {
  return { randomAuf: choice === 'random', alignAuf: choice === 'pre-applied' };
}

/** The U turn added on top of a case's usual orientation, given its algorithm's AUF. */
export function caseOffset(choice: AufStart, auf: Auf, random: () => number = Math.random): Auf {
  if (choice === 'random') return AUFS[Math.floor(random() * AUFS.length)];
  return choice === 'pre-applied' ? auf : 'U0';
}
