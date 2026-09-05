'use client';

import { useMemo } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { MESSAGES, type Locale, type MessageKey } from '@/i18n/messages';

type Params = Record<string, string | number>;

// Keys that come in `_one` / `_other` pairs, addressed by their stem.
type PluralStem = MessageKey extends infer K
  ? K extends `${infer S}_one`
    ? S
    : never
  : never;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export interface Translator {
  locale: Locale;
  // Intl tag for date formatting.
  intl: string;
  t: (key: MessageKey, params?: Params) => string;
  // Plural-aware lookup: `tn('common.solves', 3)` -> "3 solves".
  tn: (stem: PluralStem, count: number, params?: Params) => string;
}

export function makeTranslator(locale: Locale): Translator {
  const messages = MESSAGES[locale];
  const t: Translator['t'] = (key, params) => interpolate(messages[key], params);
  const tn: Translator['tn'] = (stem, count, params) => {
    const key = `${stem}_${count === 1 ? 'one' : 'other'}` as MessageKey;
    return interpolate(messages[key], { count, ...params });
  };
  return { locale, intl: locale === 'ja' ? 'ja-JP' : 'en-US', t, tn };
}

export function useT(): Translator {
  const { locale } = useLocale();
  return useMemo(() => makeTranslator(locale), [locale]);
}
