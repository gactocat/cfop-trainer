'use client';

import { useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  setMode,
  subscribe,
  type F2LAufDisplayMode,
} from '@/lib/f2l-auf-display-store';

export interface UseF2LAufDisplayResult {
  mode: F2LAufDisplayMode;
  setMode: (mode: F2LAufDisplayMode) => void;
}

export function useF2LAufDisplay(): UseF2LAufDisplayResult {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { mode, setMode };
}
