'use client';

import { useSyncExternalStore } from 'react';
import {
  aufDisplayOf, getSnapshot, getServerSnapshot, setAufDisplay, subscribe, update,
} from '@/lib/practice-settings-store';
import type { Practice } from '@/types/practice';

export function usePracticeSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { settings, update };
}

/** One list's AUF display (see aufDisplayOf) and the way to change it. */
export function useAufDisplay(practice: Practice) {
  const { settings } = usePracticeSettings();
  return {
    aufDisplay: aufDisplayOf(settings, practice),
    setAufDisplay: (display: Parameters<typeof setAufDisplay>[1]) => setAufDisplay(practice, display),
  };
}
