'use client';

import { useEffect } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useMounted } from '@/hooks/useMounted';
import { usePersistence } from '@/hooks/usePersistence';
import { LOCALE_PENDING_ATTRIBUTE, writeDisplayHint } from '@/lib/display-hint';

// Keeps <html lang> on the chosen language. The head script set it (and hid
// the prerendered English when another language was chosen) before the first
// paint; once the client has rendered in that language, the page is shown and
// the language is recorded for the next load's first paint.
export function HtmlLang(): null {
  const { locale } = useLocale();
  const mounted = useMounted();
  const { mode } = usePersistence();
  const loaded = mode === 'guest' || mode === 'account';
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    html.lang = locale;
    html.removeAttribute(LOCALE_PENDING_ATTRIBUTE);
    if (loaded) writeDisplayHint({ locale });
  }, [mounted, locale, loaded]);
  return null;
}
