'use client';

import { useMemo } from 'react';
import { usePersistence } from '@/hooks/usePersistence';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { canWriteData } from '@/lib/persistence';
import { setSolveSettings, solveSettingsOf, type SolveSettings } from '@/lib/practice-settings-store';
import { colourFrame, holdingFrame, type Frame } from '@/lib/smart-cube/holding';
import type { SolveEvent } from '@/lib/solve/solve-record';

/**
 * One kind of solve's settings, kept with the practice settings (so in the
 * account when signed in): how the cube is held for the scramble (white top,
 * green front until chosen) and inspection (on). The cross colour is read
 * from each solve.
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
  const { top, front, inspection } = resolved;
  const frame = useMemo(() => colourFrame({ top, front }) ?? holdingFrame('white-green'), [top, front]);
  return {
    top, front, inspection, frame,
    writable: canWriteData(),
    set: (patch) => setSolveSettings(event, { top, front, inspection }, patch),
  };
}
