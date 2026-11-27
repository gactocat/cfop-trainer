'use client';

import { useState } from 'react';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { practiceModeFrom, trainerFlavor, type PracticeMode, type TrainerFlavor } from '@/lib/practice-mode';

export { choosePracticeMode } from '@/lib/practice-mode';
export type { PracticeMode, TrainerFlavor };

/** The practice mode (no setup or with setup), shared by random and single-case practice. */
export function usePracticeMode(): PracticeMode {
  const { settings } = usePracticeSettings();
  const { noScramble } = useSmartCubeSettings();
  return practiceModeFrom(settings.trainerMode, noScramble);
}

/** How a practice would run now: the mode, and whether a smart cube is connected. */
export function useLiveTrainerFlavor(): TrainerFlavor {
  const mode = usePracticeMode();
  const connected = useSmartCube().status === 'connected';
  return trainerFlavor(mode, connected);
}

/**
 * How a practice runs: as the settings and the cube say while it waits on
 * a case, and as it was when an attempt started until the next case
 * (`busy`: timing, or the result on screen). A cube that drops mid-attempt
 * leaves it on the cube, where a press still stops it, instead of turning
 * it into the tap timer (whose result screen would record the solve again);
 * changed settings take effect with the next case.
 */
export function usePracticeFlavor(busy: boolean): TrainerFlavor {
  const live = useLiveTrainerFlavor();
  const [held, setHeld] = useState<TrainerFlavor | null>(null);
  if (busy && held === null) setHeld(live);
  if (!busy && held !== null) setHeld(null);
  return busy ? held ?? live : live;
}
