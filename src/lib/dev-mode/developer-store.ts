import { getPersistenceSnapshot, subscribePersistence } from '@/lib/persistence';
import { isMissingOnServer } from '@/lib/solve/solve-library';
import { getSupabase } from '@/lib/supabase';

// Whether the signed-in account is one of the app's developers. The database
// decides (`dev_users`, asked through `is_developer()`, see
// supabase/migrations/20261128000000_dev_notes.sql); the app never names
// anyone. It is asked once per account after its data has loaded. Guests,
// other accounts and a database without the function (its migration not
// applied) get no developer mode; a failed question is asked again a minute
// later, on the next change of the account's state.

export interface DeveloperState {
  /** The account the answer is for. */
  userId: string | null;
  developer: boolean;
}

const NONE: DeveloperState = { userId: null, developer: false };
const RETRY_MS = 60_000;
let state = NONE;
let asking: string | null = null;
let failedAt = 0;
let started = false;
const listeners = new Set<() => void>();

function set(next: DeveloperState) {
  if (next.userId === state.userId && next.developer === state.developer) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function refresh() {
  const { mode, userId, online } = getPersistenceSnapshot();
  // While an account reloads its data it stays what it was.
  if (!userId || mode === 'guest') {
    set(NONE);
    return;
  }
  if (state.userId !== userId && state.userId !== null) set(NONE);
  if (mode !== 'account' || !online || state.userId === userId || asking === userId) return;
  if (Date.now() - failedAt < RETRY_MS) return;
  const client = getSupabase();
  if (!client) return;
  asking = userId;
  void (async () => {
    try {
      const { data, error } = await client.rpc('is_developer');
      if (error && !isMissingOnServer(error)) throw error;
      if (getPersistenceSnapshot().userId === userId) set({ userId, developer: !error && data === true });
    } catch {
      failedAt = Date.now();
    } finally {
      if (asking === userId) asking = null;
    }
    refresh();
  })();
}

export const getDeveloperSnapshot = () => state;
export const getDeveloperServerSnapshot = () => NONE;
export function subscribeDeveloper(listener: () => void) {
  if (!started) {
    started = true;
    subscribePersistence(refresh);
    refresh();
  }
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Whether `userId` is a developer, as last answered (false until it is). */
export function isDeveloper(userId: string | null): boolean {
  return !!userId && state.userId === userId && state.developer;
}
