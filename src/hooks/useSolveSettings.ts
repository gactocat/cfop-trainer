'use client';

import { useMemo } from 'react';
import { usePersistence } from '@/hooks/usePersistence';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import { canWriteData } from '@/lib/persistence';
import { setSolveSettings, solveSettingsOf, type SolveSettings } from '@/lib/practice-settings-store';
import { colourFrame, holdingColours, holdingFrame, type Frame } from '@/lib/smart-cube/holding';
import type { SolveEvent } from '@/lib/solve/solve-record';

/**
 * One kind of solve's holding (top and front colours) and inspection, kept
 * with the practice settings (so in the account when signed in). Until
 * chosen, the holding is the smart cube's and inspection is on.
 */
export function useSolveSettings(event: SolveEvent): SolveSettings & {
  frame: Frame;
  /** False while the settings cannot be saved (an account offline). */
  writable: boolean;
  set: (patch: Partial<SolveSettings>) => void;
} {
  const { settings } = usePracticeSettings();
  const { holding } = useSmartCubeSettings();
  usePersistence();
  const resolved = solveSettingsOf(settings, event, holdingColours(holding));
  const { top, front, inspection } = resolved;
  const frame = useMemo(() => colourFrame({ top, front }) ?? holdingFrame('yellow-blue'), [top, front]);
  return {
    top, front, inspection, frame,
    writable: canWriteData(),
    set: (patch) => setSolveSettings(event, { top, front, inspection }, patch),
  };
}
