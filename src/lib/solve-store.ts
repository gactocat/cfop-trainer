// Timed solves from a scramble: a guest's in IndexedDB on this device, a
// signed-in user's in the account (see solve/solve-library.ts for how they
// move between the two). Same store contract as the app's other stores: the
// solves of each event, newest first, read through useSyncExternalStore.

import { getPersistenceSnapshot, subscribePersistence } from '@/lib/persistence';
import {
  createSolveLibrary,
  EMPTY_OUTBOX,
  type AccountSolves,
  type DeviceSolves,
  type ImportDecision,
  type Outbox,
  type SolvesSnapshot,
  type SyncMemory,
} from '@/lib/solve/solve-library';
import { parseSolveRecord, type SolveEvent, type SolveRecord } from '@/lib/solve/solve-record';
import { rememberSolveImport, SOLVE_IMPORT_KEY } from '@/lib/solve/solve-import';
import { getSupabase, isAuthConfigured } from '@/lib/supabase';

export type { SolvesSnapshot };

const DB_NAME = 'cfop-solves';
const SOLVES = 'solves';
const OUTBOX_KEY = 'cfop:solve-outbox:v1';
/** Rows per request when loading an account's solves (the API returns at most 1000). */
const PAGE = 1000;

// --- This device: IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(SOLVES, { keyPath: 'id' });
      store.createIndex('event', ['event', 'recordedAt']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const device: DeviceSolves | null = typeof indexedDB === 'undefined' ? null : {
  async load(event) {
    const db = await open();
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const range = IDBKeyRange.bound([event, ''], [event, '￿']);
      const request = db.transaction(SOLVES, 'readonly').objectStore(SOLVES).index('event').getAll(range);
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error);
    });
    return records.map(parseSolveRecord).filter((r): r is SolveRecord => r !== null);
  },
  async put(record) {
    const db = await open();
    const tx = db.transaction(SOLVES, 'readwrite');
    tx.objectStore(SOLVES).put(record);
    await done(tx);
  },
  async remove(id) {
    const db = await open();
    const tx = db.transaction(SOLVES, 'readwrite');
    tx.objectStore(SOLVES).delete(id);
    await done(tx);
  },
};

// --- The account: the `solves` table, written through its functions

const account: AccountSolves | null = !isAuthConfigured ? null : {
  async load(userId, event) {
    const client = getSupabase()!;
    const out: SolveRecord[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error, status } = await client.from('solves').select('record')
        .eq('user_id', userId).eq('event', event)
        .order('recorded_at', { ascending: false }).order('id')
        .range(from, from + PAGE - 1);
      if (error) throw Object.assign(error, { status });
      for (const row of data ?? []) {
        const record = parseSolveRecord((row as { record: unknown }).record);
        if (record) out.push(record);
      }
      if ((data?.length ?? 0) < PAGE) return out;
    }
  },
  async save(userId, records) {
    const { error, status } = await getSupabase()!.rpc('save_solves', { p_solves: records, p_expected_user_id: userId });
    if (error) throw Object.assign(error, { status });
  },
  async remove(userId, ids) {
    const { error, status } = await getSupabase()!.rpc('delete_solves', { p_ids: ids, p_expected_user_id: userId });
    if (error) throw Object.assign(error, { status });
  },
};

// --- Notes on this device: the outbox and the import choice, per user

function readJSON<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(window.localStorage.getItem(key) ?? 'null') as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: kept in memory only */ }
}

const outboxes = new Map<string, Outbox>();

const memory: SyncMemory = {
  readOutbox(userId) {
    if (!outboxes.has(userId)) {
      const stored = readJSON<Record<string, Outbox>>(OUTBOX_KEY, {})[userId];
      const upserts = Object.fromEntries(Object.entries(stored?.upserts ?? {})
        .map(([id, raw]) => [id, parseSolveRecord(raw)] as const)
        .filter((entry): entry is readonly [string, SolveRecord] => entry[1] !== null));
      outboxes.set(userId, { upserts, deletes: Array.isArray(stored?.deletes) ? stored.deletes.filter((id) => typeof id === 'string') : [] });
    }
    return outboxes.get(userId) ?? EMPTY_OUTBOX;
  },
  writeOutbox(userId, outbox) {
    outboxes.set(userId, outbox);
    const all = readJSON<Record<string, Outbox>>(OUTBOX_KEY, {});
    if (Object.keys(outbox.upserts).length === 0 && outbox.deletes.length === 0) delete all[userId];
    else all[userId] = outbox;
    writeJSON(OUTBOX_KEY, all);
  },
  importDecision(userId) {
    return readJSON<Record<string, ImportDecision>>(SOLVE_IMPORT_KEY, {})[userId] ?? null;
  },
  setImportDecision(userId, decision) {
    rememberSolveImport(userId, decision);
  },
};

// --- The library, following sign-in and the connection

const library = createSolveLibrary({
  device,
  account,
  memory,
  online: () => typeof navigator === 'undefined' || navigator.onLine,
});

const LOADING_SNAPSHOT: SolvesSnapshot = { status: 'loading', solves: [], where: 'device', unsaved: 0, failed: false, offer: 0 };
let started = false;

function follow() {
  const state = getPersistenceSnapshot();
  library.setSource(state.mode === 'guest' ? { kind: 'device' }
    : state.mode === 'account' && state.userId ? { kind: 'account', userId: state.userId }
      : { kind: 'waiting' });
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  follow();
  subscribePersistence(follow);
  window.addEventListener('online', () => library.resume());
  // Changes the server does not have yet stay on this device; still, say so before leaving.
  window.addEventListener('beforeunload', (event) => {
    if (library.getSnapshot('cfop').unsaved > 0) event.preventDefault();
  });
}

export function getSolvesSnapshot(event: SolveEvent): SolvesSnapshot {
  start();
  return library.getSnapshot(event);
}

export const getSolvesServerSnapshot = () => LOADING_SNAPSHOT;
export const subscribeSolves = (listener: () => void) => library.subscribe(listener);

/** Keep a solve, or keep a change to one (a penalty). It shows at once. */
export const saveSolve = (record: SolveRecord) => library.save(record);
export const deleteSolve = (event: SolveEvent, id: string) => library.remove(event, id);
export const importDeviceSolves = (event: SolveEvent) => library.importDevice(event);
export const declineSolveImport = (event: SolveEvent) => library.declineImport(event);
export const retrySolveSync = (event: SolveEvent) => library.retry(event);
