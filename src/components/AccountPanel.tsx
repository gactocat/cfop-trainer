'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { usePersistence } from '@/hooks/usePersistence';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { getSupabase, isAuthConfigured } from '@/lib/supabase';
import { finishRecovery, getRecoveryServerSnapshot, getRecoverySnapshot, signOutAccount, subscribeRecovery } from '@/lib/account-session';
import { initializeAccount, reloadAccount } from '@/lib/persistence';
import { StorageStatus } from './AccountBoundary';

type Mode = 'signIn' | 'signUp' | 'reset';
const button = 'rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
const input = 'mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
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
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
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
      const redirectTo = `${window.location.origin}/account`;
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
  return <div className="mx-auto max-w-md space-y-5">
    <div>
      <h1 className="text-2xl font-semibold">{t('account.title')}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('account.description')}</p>
    </div>
    <StorageStatus />
    {!isAuthConfigured ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('account.unavailable')}</p> : <>
      {signedIn && !recovery ? <div className="space-y-4">
        <p className="break-all text-sm">{state.email}</p>
        {state.mode === 'choice' && <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium">{t('account.firstLogin')}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('account.importDescription')}</p>
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || state.saving || state.dirty || !state.online} onClick={() => { void initializeAccount(true); }}>{t('account.importGuest')}</button>
            <button className={button} disabled={busy || state.saving || state.dirty || !state.online} onClick={() => { void initializeAccount(false); }}>{t('account.startFresh')}</button>
          </div>
        </section>}
        {state.mode === 'account' && <button className="text-sm underline disabled:opacity-50" disabled={!state.online || state.saving} onClick={() => {
          if (!state.dirty || window.confirm(t('account.discardWarning'))) void reloadAccount();
        }}>{t('account.reload')}</button>}
        <div><button className={button} disabled={busy || state.saving} onClick={() => { void signOut(); }}>{t('account.signOut')}</button></div>
      </div> : <>
        <h2 className="font-medium">{t(recovery ? 'account.newPassword' : `account.${mode}`)}</h2>
        <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
          {!recovery && <label className="block text-sm">{t('account.email')}
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={input} />
          </label>}
          {(mode !== 'reset' || recovery) && <label className="block text-sm">{t('account.password')}
            <input type="password" autoComplete={mode === 'signIn' && !recovery ? 'current-password' : 'new-password'} minLength={mode === 'signIn' && !recovery ? undefined : 8} required value={password} onChange={(event) => setPassword(event.target.value)} className={input} />
          </label>}
          {(mode === 'signUp' || recovery) && <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('account.passwordHint')}</p>
            <label className="block text-sm">{t('account.confirmPassword')}
              <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={input} />
            </label>
          </>}
          <button className={button} disabled={busy || !state.online || (state.mode === 'boot' && !state.error)}>{t(busy ? 'common.loading' : recovery ? 'account.updatePassword' : `account.${mode}`)}</button>
        </form>
        {!recovery && <div className="flex flex-wrap gap-4 text-sm">
          {(['signIn', 'signUp', 'reset'] as const).filter((item) => item !== mode).map((item) => <button key={item} disabled={busy} className="underline" onClick={() => {
            setMode(item); setPassword(''); setConfirmPassword(''); setError(null); setNotice(null);
          }}>{t(`account.${item}`)}</button>)}
        </div>}
        {(recovery || state.error === 'session') && <button className="text-sm underline" disabled={busy} onClick={() => { void signOut(); }}>{t('account.signOut')}</button>}
      </>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{t(notice)}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(error)}</p>}
    </>}
    <Link href="/" className="inline-block text-sm underline">{t('account.back')}</Link>
  </div>;
}
