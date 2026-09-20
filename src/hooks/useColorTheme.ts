'use client';

import { useSyncExternalStore } from 'react';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';

const query = '(prefers-color-scheme: dark)';
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => false;

export function useColorTheme() {
  const systemDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { settings, update } = usePracticeSettings();
  const dark = settings.colorTheme ? settings.colorTheme === 'dark' : systemDark;
  return { dark, toggle: () => update({ colorTheme: dark ? 'light' : 'dark' }) };
}
