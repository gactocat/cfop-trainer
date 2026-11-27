'use client';

import { useLocale } from '@/hooks/useLocale';
import { useMounted } from '@/hooks/useMounted';
import { useT } from '@/hooks/useT';
import { LOCALES, LOCALE_LABELS } from '@/i18n/messages';
import { Segmented } from './ui';

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const { t } = useT();
  const mounted = useMounted();
  return (
    <Segmented
      label={t('settings.language.title')}
      value={mounted ? locale : null}
      onChange={setLocale}
      options={LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value], lang: value }))}
    />
  );
}
