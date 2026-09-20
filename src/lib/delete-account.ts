import type { MessageKey } from '@/i18n/messages';
import { getSupabase } from '@/lib/supabase';
import { signOutAccount } from '@/lib/account-session';
import { getPersistenceSnapshot, lockSession } from '@/lib/persistence';

export class AccountDeletionError extends Error {
  readonly messageKey: MessageKey;
  constructor(messageKey: MessageKey) { super(messageKey); this.messageKey = messageKey; }
}

export async function deleteCurrentAccount(password: string, expectedUserId: string) {
  const client = getSupabase();
  if (!client) throw new AccountDeletionError('account.unavailable');
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId || getPersistenceSnapshot().userId !== expectedUserId) {
    throw new AccountDeletionError('account.deleteSession');
  }
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(45000),
    headers: {
      'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ password, confirm: true }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const key = result.code === 'password_invalid' ? 'account.deletePasswordWrong'
      : response.status === 401 ? 'account.deleteSession'
      : response.status === 429 ? 'account.rateLimited' : 'account.deleteFailed';
    throw new AccountDeletionError(key);
  }
  if (getPersistenceSnapshot().userId !== expectedUserId) return;
  try { await signOutAccount(); }
  catch {
    lockSession();
    throw new AccountDeletionError('account.deleteCleanup');
  }
}
