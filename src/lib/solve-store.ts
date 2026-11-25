// Timed solves from a scramble, kept in IndexedDB on this device only, like
// the smart cube's solves (smart-solve-store.ts): nothing here enters the
// account document. Same store contract as the app's other stores: the
// solves of each event, newest first, read through useSyncExternalStore.

import type { SolveEvent, SolveRecord } from '@/lib/solve/solve-record';

const DB_NAME = 'cfop-solves';
const SOLVES = 'solves';

export interface SolvesSnapshot {
  status: 'loading' | 'ready' | 'unavailable';
  /** Newest first. */
  solves: readonly SolveRecord[];
}

const LOADING: SolvesSnapshot = { status: 'loading', solves: [] };
const snapshots = new Map<SolveEvent, SolvesSnapshot>();
const listeners = new Set<() => void>();
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

function set(event: SolveEvent, snapshot: SolvesSnapshot) {
  snapshots.set(event, snapshot);
  listeners.forEach((l) => l());
}

const newestFirst = (a: SolveRecord, b: SolveRecord) => b.recordedAt.localeCompare(a.recordedAt);

async function load(event: SolveEvent) {
  try {
    const db = await open();
    const records = await new Promise<SolveRecord[]>((resolve, reject) => {
      const range = IDBKeyRange.bound([event, ''], [event, '￿']);
      const request = db.transaction(SOLVES, 'readonly').objectStore(SOLVES).index('event').getAll(range);
      request.onsuccess = () => resolve(request.result as SolveRecord[]);
      request.onerror = () => reject(request.error);
    });
    // Solves added while loading are already in the snapshot.
    const added = snapshots.get(event)?.solves ?? [];
    const ids = new Set(added.map((s) => s.id));
    set(event, { status: 'ready', solves: [...added, ...records.filter((r) => !ids.has(r.id))].sort(newestFirst) });
  } catch {
    set(event, { status: 'unavailable', solves: snapshots.get(event)?.solves ?? [] });
  }
}

export function getSolvesSnapshot(event: SolveEvent): SolvesSnapshot {
  let snapshot = snapshots.get(event);
  if (!snapshot) {
    snapshot = LOADING;
    snapshots.set(event, snapshot);
    if (typeof indexedDB === 'undefined') snapshots.set(event, { status: 'unavailable', solves: [] });
    else void load(event);
  }
  return snapshots.get(event)!;
}

export const getSolvesServerSnapshot = () => LOADING;

export function subscribeSolves(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Keep a solve. It shows at once; if it cannot be stored it stays for this visit only. */
export async function addSolve(record: SolveRecord): Promise<void> {
  const current = getSolvesSnapshot(record.event);
  set(record.event, { ...current, solves: [record, ...current.solves].sort(newestFirst) });
  const db = await open();
  const tx = db.transaction(SOLVES, 'readwrite');
  tx.objectStore(SOLVES).put(record);
  await done(tx);
}

export async function deleteSolve(event: SolveEvent, id: string): Promise<void> {
  const current = getSolvesSnapshot(event);
  set(event, { ...current, solves: current.solves.filter((s) => s.id !== id) });
  const db = await open();
  const tx = db.transaction(SOLVES, 'readwrite');
  tx.objectStore(SOLVES).delete(id);
  await done(tx);
}
