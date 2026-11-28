'use client';

import type { ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { usePersistence } from '@/hooks/usePersistence';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { openAccountDialog, openAppDialog } from '@/lib/app-dialog';
import { WritableArea } from './AccountBoundary';
import { LocaleToggle } from './LocaleToggle';
import { ThemeToggle } from './ThemeToggle';
import { ChevronIcon, Icon, SettingRow, SettingsGroup } from './ui';

// A setting kept in its own dialog: its name, what it is now, and an arrow.
// As tall as a SettingRow; the second line is there from the start, so the
// row keeps its height when what it is now becomes known in the browser.
function DialogRow({ icon, label, detail, onClick }: { icon: ReactNode; label: MessageKey; detail: ReactNode; onClick: () => void }) {
  const { t } = useT();
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60">
      <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t(label)}</span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{detail || ' '}</span>
      </span>
      <ChevronIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
    </button>
  );
}

/**
 * One of the top page's sections (the algorithms, the solves, the settings):
 * its name at the top inside a light panel that shows where it begins and
 * ends; what is inside keeps its own cards, on a fainter border.
 */
export function HomeSection({ id, title, as: Tag = 'section', children }: {
  id: string;
  title: ReactNode;
  as?: 'section' | 'nav';
  children: ReactNode;
}) {
  return (
    <Tag id={id} aria-labelledby={`${id}-heading`}
      className="rounded-2xl border border-zinc-200 bg-zinc-100/70 p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/25">
      <h2 id={`${id}-heading`} className="mb-2.5 px-1 text-sm font-semibold text-zinc-700 sm:mb-3 dark:text-zinc-300">{title}</h2>
      {children}
    </Tag>
  );
}

export const CUBE_ICON = <Icon><path d="M12 2 21 7v10l-9 5-9-5V7z" /><path d="M3 7l9 5 9-5M12 12v10" /></Icon>;
const ACCOUNT_ICON = <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></Icon>;

// The app's settings, on the top page below the F2L / OLL / PLL entries:
// language and theme in place, and the smart cube and the account in their
// dialogs. Each list keeps its own AUF display, changed while selecting its
// cases (see ListHeaderActions).
export function HomeSettings() {
  const { t } = useT();
  const mounted = useMounted();
  const state = usePersistence();
  const cube = useSmartCube();
  const account = state.mode === 'account' ? state.email
    : state.mode === 'guest' ? t('home.settings.guest') : null;
  return (
    <HomeSection id="settings" title={t('settings.title')}>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <WritableArea>
          <SettingsGroup>
            <SettingRow label={t('settings.language.title')}><LocaleToggle /></SettingRow>
            <SettingRow label={t('settings.theme')}><ThemeToggle /></SettingRow>
          </SettingsGroup>
        </WritableArea>
        <SettingsGroup className="overflow-hidden">
          <DialogRow icon={CUBE_ICON} label="smartCube.title" onClick={() => openAppDialog('smartCube')}
            detail={mounted && t(cube.status === 'connected' ? 'smartCube.status.connected' : 'smartCube.status.idle')} />
          <DialogRow icon={ACCOUNT_ICON} label="account.title" onClick={openAccountDialog} detail={mounted && account} />
        </SettingsGroup>
      </div>
    </HomeSection>
  );
}
