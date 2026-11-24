'use client';

import { createContext, useContext } from 'react';
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

/** How a practice started now would run: the mode, and whether a smart cube is connected. */
export function useLiveTrainerFlavor(): TrainerFlavor {
  const mode = usePracticeMode();
  const connected = useSmartCube().status === 'connected';
  return trainerFlavor(mode, connected);
}

/**
 * The flavor a started practice runs with, fixed at its start: a cube that
 * drops mid-session leaves no-scramble asking to reconnect instead of turning
 * it into the tap timer (whose result screen would record the solve again).
 */
export const TrainerFlavorContext = createContext<TrainerFlavor | null>(null);

/** How the trainer runs: as started inside a practice, or the live value outside one. */
export function useTrainerMode(): TrainerFlavor {
  const started = useContext(TrainerFlavorContext);
  const live = useLiveTrainerFlavor();
  return started ?? live;
}
