'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/i18n/messages';
import { getServerSnapshot, getSnapshot, setLocale, subscribe } from '@/lib/locale-store';

export interface UseLocaleResult {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export function useLocale(): UseLocaleResult {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { locale, setLocale };
}
