import { DATA_KEYS, type AccountData, parseAccountData } from '@/lib/account-data';
import { readGuestValue, writeGuestValue } from '@/lib/guest-storage';

export type PersistenceState = {
  mode: 'boot' | 'guest' | 'loading' | 'choice' | 'account';
  userId: string | null;
  email: string | null;
  online: boolean;
  saving: boolean;
  dirty: boolean;
  error: 'load' | 'save' | 'conflict' | 'session' | 'local' | null;
  generation: number;
};
export interface AccountBackend {
  load: (userId: string) => Promise<{ data: AccountData; revision: number } | null>;
  save: (data: AccountData, revision: number, writeId: string, expectedUserId: string) => Promise<number>;
}
const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const initial: PersistenceState = {
  mode: configured || process.env.NEXT_PUBLIC_NATIVE_APP === '1' ? 'boot' : 'guest', userId: null, email: null, online: true,
  saving: false, dirty: false, error: null, generation: 0,
};
let state = initial;
let data: AccountData = {};
let revision = 0;
let backend: AccountBackend | null = null;
let pending: { data: AccountData; revision: number; writeId: string } | null = null;
const listeners = new Set<() => void>();
const dataListeners = new Set<() => void>();
function update(patch: Partial<PersistenceState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
function invalidate() { dataListeners.forEach((listener) => listener()); }
export const getPersistenceSnapshot = () => state;
export const getPersistenceServerSnapshot = () => initial;
export function subscribePersistence(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function subscribeData(listener: () => void) {
  dataListeners.add(listener);
  return () => { dataListeners.delete(listener); };
}
export function canWriteData() {
  return state.mode === 'guest' || (state.mode === 'account' && state.online && !state.error);
}
export function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  if (state.mode === 'guest') return readGuestValue(key);
  return data[key] ?? null;
}
export function writeStoredValue(key: string, value: string) {
  if (!canWriteData()) throw new Error('Storage is read-only');
  if (state.mode === 'guest') {
    try {
      const generation = state.generation;
      const write = writeGuestValue(key, value);
      if (write) {
        void write.then(() => {
          if (state.generation === generation && state.error === 'local') update({ error: null });
        }).catch(() => {
          if (state.generation === generation && state.mode === 'guest') update({ error: 'local' });
        });
      } else if (state.error === 'local') update({ error: null });
    }
    catch (error) { update({ error: 'local' }); throw error; }
  } else {
    data = { ...data, [key]: value };
    update({ dirty: true });
    // Batch all synchronous mutations (including first-visit presets).
    queueMicrotask(() => { void flushAccount(); });
  }
}
export function activateGuestStorage() {
  data = {};
  pending = null;
  backend = null;
  revision = 0;
  update({ mode: 'guest', userId: null, email: null, dirty: false, saving: false, error: null,
    generation: state.generation + 1 });
  invalidate();
}
export function reportGuestStorageError() { update({ mode: 'boot', error: 'local' }); }
export function lockSession() {
  data = {};
  pending = null;
  update({ mode: 'boot', error: 'session', dirty: false, saving: false, generation: state.generation + 1 });
  invalidate();
}
export async function activateAccountStorage(userId: string, email: string | null, remote: AccountBackend) {
  if (state.userId === userId && state.mode !== 'boot') return;
  data = {};
  pending = null;
  revision = 0;
  backend = remote;
  update({ mode: 'loading', userId, email, dirty: false, saving: false, error: null,
    generation: state.generation + 1 });
  invalidate();
  await reloadAccount();
}
export async function reloadAccount() {
  if (!backend || !state.userId || state.saving) return;
  const current = ++loadSequence;
  const generation = state.generation;
  const userId = state.userId;
  update({ mode: 'loading', error: null });
  try {
    const row = await backend.load(userId);
    if (generation !== state.generation || current !== loadSequence) return;
    data = row ? parseAccountData(row.data) : {};
    revision = row?.revision ?? 0;
    pending = null;
    update({ mode: row ? 'account' : 'choice', dirty: false, error: null });
    invalidate();
  } catch {
    if (generation === state.generation && current === loadSequence) update({ error: 'load' });
  }
}
let loadSequence = 0;
export async function initializeAccount(importGuest: boolean) {
  if (state.mode !== 'choice' || !state.online || state.saving) return;
  const imported: AccountData = {};
  if (importGuest) {
    try {
      for (const key of DATA_KEYS) {
        const value = readGuestValue(key);
        if (value !== null) imported[key] = value;
      }
    } catch { update({ error: 'local' }); return; }
  }
  data = imported;
  update({ dirty: true, error: null });
  await flushAccount();
}
export async function flushAccount() {
  if (!backend || !state.userId || !state.online || state.saving || !state.dirty || state.error) return;
  const generation = state.generation;
  const remote = backend;
  const userId = state.userId;
  pending ??= { data, revision, writeId: crypto.randomUUID() };
  const attempt = pending;
  update({ saving: true });
  try {
    const nextRevision = await remote.save(attempt.data, attempt.revision, attempt.writeId, userId);
    if (generation !== state.generation) return;
    revision = nextRevision;
    pending = null;
    update({ mode: 'account', saving: false, dirty: data !== attempt.data, error: null });
    invalidate();
    if (state.dirty) void flushAccount();
  } catch (error) {
    if (generation !== state.generation) return;
    const conflict = typeof error === 'object' && error !== null && 'code' in error && error.code === 'PT409';
    update({ saving: false, error: conflict ? 'conflict' : 'save' });
  }
}
export function retryAccountSave() {
  if (state.error !== 'save') return;
  update({ error: null });
  void flushAccount();
}
export function setStorageOnline(online: boolean) {
  update({ online });
  // Resume only edits made before the connection dropped. Failed saves still
  // require an explicit retry; offline edits never enter a queue.
  if (online && state.dirty && !state.error) void flushAccount();
}
export function notifyGuestStorageChanged() {
  if (state.mode === 'guest') invalidate();
}
