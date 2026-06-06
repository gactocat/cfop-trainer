'use client';

import { useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  setMode,
  subscribe,
  type F2LTrainerMode,
} from '@/lib/f2l-trainer-mode-store';

export interface UseF2LTrainerModeResult {
  mode: F2LTrainerMode;
  setMode: (mode: F2LTrainerMode) => void;
}

export function useF2LTrainerMode(): UseF2LTrainerModeResult {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { mode, setMode };
}
