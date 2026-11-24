'use client';

import { useEffect } from 'react';
import { useColorTheme } from '@/hooks/useColorTheme';
import { useMounted } from '@/hooks/useMounted';
import { writeDisplayHint } from '@/lib/display-hint';
import { isNativeApp, NativeBridge } from '@/lib/native';

// Keeps <html data-theme> on the chosen theme. The head script set it before
// the first paint; this takes over once the client renders (not during
// hydration, whose server values would briefly undo it) and records the
// choice for the next load's first paint.
export function ColorTheme() {
  const { dark, choice, loaded } = useColorTheme();
  const mounted = useMounted();
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (loaded) writeDisplayHint({ theme: choice });
    if (isNativeApp()) void NativeBridge.setAppearance({ theme: choice }).catch(() => {});
  }, [mounted, dark, choice, loaded]);
  return null;
}
