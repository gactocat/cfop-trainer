'use client';

import { useEffect } from 'react';
import { useColorTheme } from '@/hooks/useColorTheme';
import { isNativeApp, NativeBridge } from '@/lib/native';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';

export function ColorTheme() {
  const { dark } = useColorTheme();
  const { settings } = usePracticeSettings();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (isNativeApp()) void NativeBridge.setAppearance({ theme: settings.colorTheme ?? 'system' }).catch(() => {});
  }, [dark, settings.colorTheme]);
  return null;
}
