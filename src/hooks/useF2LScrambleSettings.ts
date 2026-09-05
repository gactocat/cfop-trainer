'use client';

import { useSyncExternalStore } from 'react';
import type { F2LScrambleSettings } from '@/lib/f2l-scramble';
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  update,
} from '@/lib/f2l-scramble-settings-store';

export interface UseF2LScrambleSettingsResult {
  settings: F2LScrambleSettings;
  update: (patch: Partial<F2LScrambleSettings>) => void;
}

export function useF2LScrambleSettings(): UseF2LScrambleSettingsResult {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { settings, update };
}
