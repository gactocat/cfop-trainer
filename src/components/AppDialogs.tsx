'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { usePersistence } from '@/hooks/usePersistence';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { closeAppDialog, getAppDialog, getAppDialogServerSnapshot, openAccountDialog, subscribeAppDialog, type AppDialog } from '@/lib/app-dialog';
import { AccountPanel } from './AccountPanel';
import { AppModal } from './AppModal';
import { SmartCubePanel } from './SmartCubePanel';

const DIALOG_TITLES = {
  account: 'account.title',
  smartCube: 'smartCube.title',
} as const satisfies Record<NonNullable<AppDialog>, MessageKey>;

// The account and smart cube dialogs, opened from the top page's settings and
// from anywhere else that needs them (a practice's cube prompt, an email link
// to /account, the iOS app).
export function AppDialogs() {
  const { t } = useT();
  const state = usePersistence();
  const pathname = usePathname();
  const dialog = useSyncExternalStore(subscribeAppDialog, getAppDialog, getAppDialogServerSnapshot);

  useEffect(() => {
    if (pathname === '/account' || pathname === '/account/') openAccountDialog();
  }, [pathname]);

  if (!dialog) return null;
  return (
    <AppModal key={dialog} title={t(DIALOG_TITLES[dialog])} onClose={closeAppDialog}>
      {dialog === 'account' ? <AccountPanel key={state.generation} /> : <SmartCubePanel />}
    </AppModal>
  );
}
