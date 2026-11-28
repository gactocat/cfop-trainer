'use client';
import { Fragment, useEffect, type ReactNode } from 'react';
import { usePersistence } from '@/hooks/usePersistence';
import { useT } from '@/hooks/useT';
import { startAccountSession } from '@/lib/account-session';
import { reloadAccount } from '@/lib/persistence';
import { openAccountDialog } from '@/lib/app-dialog';
import { usePathname } from 'next/navigation';
import { LINK } from './ui';

export function AccountSession() {
  useEffect(() => { void startAccountSession(); }, []);
  return null;
}
// Problems with the account, and its loading. Saving says nothing: it runs in
// the background and retries by itself, and only saves failing for a while
// are mentioned. Over a page it floats at the bottom (`floating`), so coming
// and going it moves nothing; in the account dialog it is in line.
export function StorageStatus({ floating = false }: { floating?: boolean }) {
  const { t } = useT();
  const state = usePersistence();
  const message = state.error ? `account.error.${state.error}` as const
    : state.mode === 'boot' || state.mode === 'loading' ? 'account.loading'
    : state.mode === 'guest' ? null
    : state.stalled && state.online ? 'account.stalled'
    : state.mode === 'choice' ? 'account.choose'
    : !state.online ? 'account.offline' : null;
  if (!message) return null;
  return (
    <div data-ui="StorageStatus" role={state.error ? 'alert' : 'status'} className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 ${floating
      ? 'fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md shadow-lg'
      : ''}`}>
      <p>{t(message)}</p>
      {(state.error === 'load' || state.error === 'conflict') && (
        <button disabled={!state.online} onClick={() => {
          if (!state.dirty || window.confirm(t('account.discardWarning'))) void reloadAccount();
        }} className={`${LINK} mt-1`}>{t('account.reload')}</button>
      )}
    </div>
  );
}
export function WritableArea({ children }: { children: ReactNode }) {
  const state = usePersistence();
  const disabled = state.mode !== 'guest' && (state.mode !== 'account' || !state.online || !!state.error);
  return <fieldset disabled={disabled} className="min-w-0 contents" onClickCapture={(event) => {
    // Custom trainer surfaces use divs; fieldset only disables native inputs.
    if (disabled && !(event.target as HTMLElement).closest('a, [data-readonly-allowed]')) {
      event.preventDefault(); event.stopPropagation();
    }
  }}>{children}</fieldset>;
}
export function AccountBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = usePersistence();
  const { t } = useT();
  const ready = state.mode === 'guest' || state.mode === 'account';
  // Public pages remain available even when account access fails. /account is
  // the top page with the account dialog open. Solves from a scramble keep
  // their records on the device, so they never wait for the account either.
  if (['/', '/account', '/account/', '/privacy', '/privacy/', '/support', '/support/'].includes(pathname) || pathname.startsWith('/solve/')) return children;
  return <>
    <StorageStatus floating />
    <Fragment key={state.generation}>
      {ready ? <WritableArea>{children}</WritableArea> : (
        <button className={`${LINK} text-sm`} onClick={openAccountDialog}>{t('account.open')}</button>
      )}
    </Fragment>
  </>;
}
