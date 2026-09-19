import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { parseAccountData } from '@/lib/account-data';
import {
  getPersistenceSnapshot, lockSession, notifyGuestStorageChanged, setStorageOnline,
  activateAccountStorage, activateGuestStorage, type AccountBackend,
} from '@/lib/persistence';

let started = false;
let explicitSignOut = false;
let recovery = false;
const listeners = new Set<() => void>();
export const getRecoverySnapshot = () => recovery;
export const getRecoveryServerSnapshot = () => false;
export function subscribeRecovery(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function finishRecovery() {
  recovery = false;
  listeners.forEach((listener) => listener());
}
export function startAccountSession() {
  if (started) return;
  started = true;
  setStorageOnline(navigator.onLine);
  window.addEventListener('online', () => setStorageOnline(true));
  window.addEventListener('offline', () => setStorageOnline(false));
  window.addEventListener('storage', notifyGuestStorageChanged);
  window.addEventListener('beforeunload', (event) => {
    if (!getPersistenceSnapshot().dirty) return;
    event.preventDefault();
  });
  const client = getSupabase();
  if (!client) { activateGuestStorage(); return; }
  const remote: AccountBackend = {
    load: async (userId) => {
      const { data, error } = await client.from('account_data').select('data, revision').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data ? { data: parseAccountData(data.data), revision: data.revision as number } : null;
    },
    save: async (data, revision, writeId, expectedUserId) => {
      const { data: result, error } = await client.rpc('save_account_data', {
        p_data: data, p_revision: revision, p_write_id: writeId, p_expected_user_id: expectedUserId,
      });
      if (error) throw error;
      if (typeof result !== 'number') throw new Error('Invalid save response');
      return result;
    },
  };
  const acceptSession = (session: Session | null) => {
    if (session) void activateAccountStorage(session.user.id, session.user.email ?? null, remote);
    else if (!getPersistenceSnapshot().userId || explicitSignOut) activateGuestStorage();
    else lockSession();
  };
  // Keep this callback synchronous: Supabase holds its auth lock here.
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovery = true;
      listeners.forEach((listener) => listener());
    }
    if (event === 'SIGNED_OUT') finishRecovery();
    queueMicrotask(() => acceptSession(session));
  });
  void client.auth.getSession().then(({ data, error }) => {
    if (getPersistenceSnapshot().mode !== 'boot') return;
    if (error) lockSession();
    else acceptSession(data.session);
  }).catch(() => lockSession());
}
export async function signOutAccount() {
  const client = getSupabase();
  if (!client) return;
  explicitSignOut = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    finishRecovery();
    activateGuestStorage();
  } finally { explicitSignOut = false; }
}
