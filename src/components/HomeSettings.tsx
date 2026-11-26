'use client';

import type { ReactNode } from 'react';
import { useColorTheme } from '@/hooks/useColorTheme';
import { useMounted } from '@/hooks/useMounted';
import { usePersistence } from '@/hooks/usePersistence';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { openAccountDialog, openAppDialog } from '@/lib/app-dialog';
import { canWriteData } from '@/lib/persistence';
import { WritableArea } from './AccountBoundary';
import { LocaleToggle } from './LocaleToggle';

const CARD = 'divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900';

// A setting changed in place: its name on the left, the control on the right
// (below the name when the row is too narrow).
function Setting({ label, children }: { label: MessageKey; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <span className="text-sm font-medium">{t(label)}</span>
      {children}
    </div>
  );
}

// A setting kept in its own dialog: its name, what it is now, and an arrow.
function DialogRow({ icon, label, detail, onClick }: { icon: ReactNode; label: MessageKey; detail: ReactNode; onClick: () => void }) {
  const { t } = useT();
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60">
      <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t(label)}</span>
        {detail && <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{detail}</span>}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}

const icon = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CUBE_ICON = icon(<><path d="M12 2 21 7v10l-9 5-9-5V7z" /><path d="M3 7l9 5 9-5M12 12v10" /></>);
const ACCOUNT_ICON = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></>);

// The app's settings, on the top page below the F2L / OLL / PLL entries:
// language and dark mode in place, and the smart cube and the account in
// their dialogs. Each list keeps its own AUF display, changed while selecting
// its cases (see ListHeaderActions).
export function HomeSettings() {
  const { t } = useT();
  const mounted = useMounted();
  const state = usePersistence();
  const cube = useSmartCube();
  const { dark, toggle } = useColorTheme();
  const account = state.mode === 'account' ? state.email
    : state.mode === 'guest' ? t('home.settings.guest') : null;
  return (
    <section aria-labelledby="settings-heading" className="mt-10 sm:mt-14">
      <h2 id="settings-heading" className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">{t('settings.title')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <WritableArea>
          <div className={CARD}>
            <Setting label="settings.language.title"><LocaleToggle /></Setting>
            <Setting label="settings.darkMode">
              <button type="button" role="switch" aria-checked={mounted && dark} aria-label={t('settings.darkMode')}
                onClick={() => { if (canWriteData()) { try { toggle(); } catch { /* StorageStatus reports the failure. */ } } }}
                className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${mounted && dark ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${mounted && dark ? 'translate-x-4' : ''}`} />
              </button>
            </Setting>
          </div>
        </WritableArea>
        <div className={CARD}>
          <DialogRow icon={CUBE_ICON} label="smartCube.title" onClick={() => openAppDialog('smartCube')}
            detail={mounted && t(cube.status === 'connected' ? 'smartCube.status.connected' : 'smartCube.status.idle')} />
          <DialogRow icon={ACCOUNT_ICON} label="account.title" onClick={openAccountDialog} detail={mounted && account} />
        </div>
      </div>
    </section>
  );
}
