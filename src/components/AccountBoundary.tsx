'use client';
import { Fragment, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePersistence } from '@/hooks/usePersistence';
import { useT } from '@/hooks/useT';
import { startAccountSession } from '@/lib/account-session';
import { reloadAccount, retryAccountSave } from '@/lib/persistence';

export function AccountSession() {
  useEffect(() => { startAccountSession(); }, []);
  return null;
}
export function AccountLink() {
  const { t } = useT();
  const state = usePersistence();
  const label = t(state.userId ? 'account.title' : 'account.signIn');
  return <Link href="/account" aria-label={label} title={label}
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  </Link>;
}
export function StorageStatus() {
  const { t } = useT();
  const state = usePersistence();
  const message = state.error ? `account.error.${state.error}` as const
    : state.mode === 'boot' || state.mode === 'loading' ? 'account.loading'
    : state.mode === 'choice' ? 'account.choose'
    : state.mode === 'guest' ? 'account.guest'
    : !state.online ? 'account.offline'
    : state.saving || state.dirty ? 'account.saving' : null;
  if (!message) return null;
  return (
    <div role={state.error ? 'alert' : 'status'} className="mb-4 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <p>{t(message)}</p>
      {state.error === 'save' && <button disabled={!state.online || state.saving} onClick={retryAccountSave} className="mt-2 underline disabled:opacity-50">{t('account.retry')}</button>}
      {(state.error === 'load' || state.error === 'conflict') && (
        <button disabled={!state.online} onClick={() => {
          if (!state.dirty || window.confirm(t('account.discardWarning'))) void reloadAccount();
        }} className="mt-2 underline disabled:opacity-50">{t('account.reload')}</button>
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
  const state = usePersistence();
  const { t } = useT();
  const accountPage = usePathname() === '/account';
  const ready = state.mode === 'guest' || state.mode === 'account';
  return <>
    {!accountPage && <StorageStatus />}
    <Fragment key={state.generation}>
      {accountPage ? children : ready ? <WritableArea>{children}</WritableArea> : (
        <Link className="text-sm underline" href="/account">{t('account.open')}</Link>
      )}
    </Fragment>
  </>;
}
