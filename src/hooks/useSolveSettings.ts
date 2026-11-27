'use client';

import { useMemo } from 'react';
import { usePersistence } from '@/hooks/usePersistence';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { canWriteData } from '@/lib/persistence';
import { setSolveSettings, solveSettingsOf, type SolveSettings } from '@/lib/practice-settings-store';
import { colourFrame, holdingFrame, type CubeColour, type Frame } from '@/lib/smart-cube/holding';
import type { SolveEvent } from '@/lib/solve/solve-record';

/**
 * One kind of solve's settings, kept with the practice settings (so in the
 * account when signed in): how the cube is held for the scramble (white top,
 * green front until chosen), the cross colour (white) and inspection (on).
 */
export function useSolveSettings(event: SolveEvent): SolveSettings & {
  /** The scramble's holding as a frame. */
  frame: Frame;
  /** False while the settings cannot be saved (an account offline). */
  writable: boolean;
  set: (patch: Partial<SolveSettings>) => void;
} {
  const { settings } = usePracticeSettings();
  usePersistence();
  const resolved = solveSettingsOf(settings, event);
  const { top, front, cross, inspection } = resolved;
  const frame = useMemo(() => colourFrame({ top, front }) ?? holdingFrame('white-green'), [top, front]);
  return {
    top, front, cross, inspection, frame,
    writable: canWriteData(),
    set: (patch) => setSolveSettings(event, { top, front, cross, inspection }, patch),
  };
}

/** The cross colour set for a kind of solve: older records are read with it. */
export function useCrossColour(event: SolveEvent): CubeColour {
  const { settings } = usePracticeSettings();
  return solveSettingsOf(settings, event).cross;
}
