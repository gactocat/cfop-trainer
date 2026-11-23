'use client';

import { useMounted } from '@/hooks/useMounted';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import { unsupportedReason } from '@/lib/smart-cube-store';

export type TrainerMode = 'standard' | 'inverse' | 'no-scramble';

/**
 * The random trainer's mode. Standard and inverse come from the synced
 * practice settings; no-scramble is a device-local choice layered on top,
 * and only counts where a smart cube can be connected.
 */
export function useTrainerMode(): TrainerMode {
  const { settings } = usePracticeSettings();
  const { noScramble } = useSmartCubeSettings();
  const mounted = useMounted();
  if (mounted && noScramble && unsupportedReason() === null) return 'no-scramble';
  return settings.trainerMode;
}
