'use client';

import type { ReactNode } from 'react';
import { useColorTheme } from '@/hooks/useColorTheme';
import { useMounted } from '@/hooks/useMounted';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { ThemeChoice } from '@/lib/display-hint';
import { canWriteData } from '@/lib/persistence';
import { Icon, Segmented } from './ui';

const OPTIONS: { value: ThemeChoice; name: MessageKey; icon: ReactNode }[] = [
  { value: 'system', name: 'settings.theme.system', icon: <Icon><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon> },
  { value: 'light', name: 'settings.theme.light', icon: <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon> },
  { value: 'dark', name: 'settings.theme.dark', icon: <Icon><path d="M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a6.6 6.6 0 0 0 10.6 10.6z" /></Icon> },
];

// The theme: the system's (the default, following it as it changes), light
// or dark, each an icon named for screen readers and in its tooltip.
export function ThemeToggle() {
  const { t } = useT();
  const mounted = useMounted();
  const { choice, setChoice } = useColorTheme();
  return (
    <Segmented
      label={t('settings.theme')}
      value={mounted ? choice : null}
      onChange={(next) => { if (canWriteData()) { try { setChoice(next); } catch { /* StorageStatus reports the failure. */ } } }}
      options={OPTIONS.map((option) => ({ value: option.value, icon: option.icon, name: t(option.name) }))}
    />
  );
}
