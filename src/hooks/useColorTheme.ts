'use client';

import { useSyncExternalStore } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { usePersistence } from '@/hooks/usePersistence';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { readDisplayHint, type ThemeChoice } from '@/lib/display-hint';

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
  const { mode } = usePersistence();
  const mounted = useMounted();
  // Until the settings are loaded (account sign-in, the iOS app's storage),
  // the theme last shown on this device stands in for the stored choice, so
  // the page does not switch to the system theme and back.
  const loaded = mode === 'guest' || mode === 'account';
  const choice: ThemeChoice = settings.colorTheme
    ?? (loaded || !mounted ? 'system' : readDisplayHint().theme ?? 'system');
  const dark = choice === 'system' ? systemDark : choice === 'dark';
  return { dark, choice, loaded, toggle: () => update({ colorTheme: dark ? 'light' : 'dark' }) };
}
