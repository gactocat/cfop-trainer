'use client';

import { useEffect } from 'react';
import { useLocale } from '@/hooks/useLocale';

// Keeps <html lang> in sync with the chosen UI language. The server renders
// lang="en"; this flips it on the client once the stored locale is known.
export function HtmlLang(): null {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
