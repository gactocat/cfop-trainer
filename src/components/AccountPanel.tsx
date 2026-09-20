'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { usePersistence } from '@/hooks/usePersistence';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { getSupabase, isAuthConfigured } from '@/lib/supabase';
import { finishRecovery, getCallbackError, getRecoveryServerSnapshot, getRecoverySnapshot, signOutAccount, subscribeRecovery } from '@/lib/account-session';
import { initializeAccount, reloadAccount } from '@/lib/persistence';
import { StorageStatus } from './AccountBoundary';
import { authRedirectUrl } from '@/lib/native';
import { AccountDeletionError, deleteCurrentAccount } from '@/lib/delete-account';
import { PublicLinks } from './PublicLinks';
import { closeAppDialog } from '@/lib/app-dialog';

type Mode = 'signIn' | 'signUp' | 'reset';
const button = 'inline-flex items-center justify-center rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700';
const input = 'mt-1 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-base font-normal text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const textAction = 'text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100';
function authError(error: unknown): MessageKey {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'invalid_credentials') return 'account.invalidCredentials';
  if (code === 'email_not_confirmed') return 'account.unconfirmed';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'account.rateLimited';
  if (code === 'weak_password' || code === 'same_password') return 'account.passwordRejected';
  return 'account.authFailed';
}
export function AccountPanel() {
  const { t } = useT();
  const state = usePersistence();
  const recovery = useSyncExternalStore(subscribeRecovery, getRecoverySnapshot, getRecoveryServerSnapshot);
  const callbackError = useSyncExternalStore(subscribeRecovery, getCallbackError, getRecoveryServerSnapshot);
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const confirmDelete = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !state.userId || !state.online) return;
    setBusy(true); setError(null); setNotice(null);
    try { await deleteCurrentAccount(deletePassword, state.userId); }
    catch (error) { setError(error instanceof AccountDeletionError ? error.messageKey : 'account.deleteFailed'); }
    finally { setBusy(false); setDeletePassword(''); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const client = getSupabase();
    if (!client || busy) return;
    setError(null); setNotice(null);
    if ((mode === 'signUp' || recovery) && password !== confirmPassword) {
      setError('account.passwordMismatch'); return;
    }
    setBusy(true);
    try {
      const redirectTo = authRedirectUrl();
      if (recovery) {
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        finishRecovery(); setNotice('account.passwordUpdated');
      } else if (mode === 'signIn') {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
      } else if (mode === 'signUp') {
        const result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (result.error) throw result.error;
        if (!result.data.session) setNotice('account.confirmEmail');
      } else {
        const result = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (result.error) throw result.error;
        setNotice('account.resetSent');
      }
      setPassword(''); setConfirmPassword('');
    } catch (error) { setError(authError(error)); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    if (state.dirty && !window.confirm(t('account.discardWarning'))) return;
    setBusy(true); setError(null); setNotice(null);
    try { await signOutAccount(); }
    catch { setError('account.authFailed'); }
    finally { setBusy(false); }
  };
  const signedIn = !!state.userId && state.mode !== 'boot';
  return <div className="space-y-4">
    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.description')}</p>
    <StorageStatus />
    {!isAuthConfigured ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.unavailable')}</p> : <>
      {signedIn && !recovery ? <div className="space-y-3">
        <p className="break-all text-sm font-medium">{state.email}</p>
        {state.mode === 'choice' && <section className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h3 className="text-sm font-medium">{t('account.firstLogin')}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.importDescription')}</p>
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || state.saving || state.dirty || !state.online} onClick={() => { void initializeAccount(true); }}>{t('account.importGuest')}</button>
            <button className={button} disabled={busy || state.saving || state.dirty || !state.online} onClick={() => { void initializeAccount(false); }}>{t('account.startFresh')}</button>
          </div>
        </section>}
        {state.mode === 'account' && <button className={textAction} disabled={busy || !state.online || state.saving} onClick={() => {
          if (!state.dirty || window.confirm(t('account.discardWarning'))) void reloadAccount();
        }}>{t('account.reload')}</button>}
        <div><button className={button} disabled={busy || state.saving} onClick={() => { void signOut(); }}>{t('account.signOut')}</button></div>
        <section className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {deleting ? <form onSubmit={(event) => { void confirmDelete(event); }} className="space-y-3">
            <h3 className="text-sm font-medium">{t('account.delete')}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.deleteWarning')}</p>
            <label className="block text-sm font-medium">{t('account.deletePassword')}
              <input type="password" autoComplete="current-password" required maxLength={1024} disabled={busy}
                value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className={input} />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy || !state.online || !deletePassword} className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600">{t(busy ? 'common.loading' : 'account.deleteConfirm')}</button>
              <button type="button" className={textAction} disabled={busy} onClick={() => { setDeleting(false); setDeletePassword(''); setError(null); }}>{t('common.cancel')}</button>
            </div>
          </form> : <button type="button" disabled={busy || !state.online} className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400" onClick={() => { setDeleting(true); setError(null); setNotice(null); }}>{t('account.delete')}</button>}
        </section>
      </div> : <>
        {(recovery || mode !== 'signIn') && <h3 className="text-sm font-medium">{t(recovery ? 'account.newPassword' : `account.${mode}`)}</h3>}
        <form onSubmit={(event) => { void submit(event); }} className="space-y-3">
          {!recovery && <label className="block text-sm font-medium">{t('account.email')}
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={input} />
          </label>}
          {(mode !== 'reset' || recovery) && <label className="block text-sm font-medium">{t('account.password')}
            <input type="password" autoComplete={mode === 'signIn' && !recovery ? 'current-password' : 'new-password'} minLength={mode === 'signIn' && !recovery ? undefined : 8} required value={password} onChange={(event) => setPassword(event.target.value)} className={input} />
          </label>}
          {(mode === 'signUp' || recovery) && <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.passwordHint')}</p>
            <label className="block text-sm font-medium">{t('account.confirmPassword')}
              <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={input} />
            </label>
          </>}
          <button className={button} disabled={busy || !state.online || (state.mode === 'boot' && !state.error)}>{t(busy ? 'common.loading' : recovery ? 'account.updatePassword' : `account.${mode}`)}</button>
        </form>
        {!recovery && <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {(['signIn', 'signUp', 'reset'] as const).filter((item) => item !== mode).map((item) => <button key={item} disabled={busy} className={textAction} onClick={() => {
            setMode(item); setPassword(''); setConfirmPassword(''); setError(null); setNotice(null);
          }}>{t(`account.${item}`)}</button>)}
        </div>}
        {(recovery || state.error === 'session') && <button className={textAction} disabled={busy} onClick={() => { void signOut(); }}>{t('account.signOut')}</button>}
      </>}
      {notice && <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">{t(notice)}</p>}
      {(error || callbackError) && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t(error ?? 'account.authFailed')}</p>}
    </>}
    <PublicLinks onNavigate={closeAppDialog} />
  </div>;
}
