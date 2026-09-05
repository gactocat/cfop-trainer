'use client';

import { useLocale } from '@/hooks/useLocale';
import { useT } from '@/hooks/useT';
import { LOCALES, LOCALE_LABELS } from '@/i18n/messages';

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const { t } = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language.title')}
      className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
    >
      {LOCALES.map((value) => {
        const active = value === locale;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={value}
            onClick={() => setLocale(value)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {LOCALE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
