'use client';

import { useSyncExternalStore } from 'react';
import { getSnapshot, getServerSnapshot, subscribe, update } from '@/lib/practice-settings-store';

export function usePracticeSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { settings, update };
}
