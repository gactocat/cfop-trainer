// Smart cube solves (turns, recognition, execution, TPS) kept in IndexedDB on
// this device only. Deliberately outside the persistence layer: nothing here
// enters the account document or its allow-list, and the existing time
// records (RandomSolve) keep their shape, so older app versions are unaffected.

import type { SmartSolveRecord } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

const DB_NAME = 'cfop-smart-cube';
const SOLVES = 'solves';
/** Oldest solves are removed beyond this many. */
export const MAX_SMART_SOLVES = 2000;

let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

export const smartSolvesAvailable = () => typeof indexedDB !== 'undefined';

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(SOLVES, { keyPath: 'id' });
      store.createIndex('case', ['practice', 'caseId']);
      store.createIndex('recordedAt', 'recordedAt');
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

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const notify = () => listeners.forEach((l) => l());

export function subscribeSmartSolves(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Keep a solve, then drop the oldest ones beyond MAX_SMART_SOLVES. */
export async function addSmartSolve(record: SmartSolveRecord): Promise<void> {
  const db = await open();
  const tx = db.transaction(SOLVES, 'readwrite');
  const store = tx.objectStore(SOLVES);
  store.put(record);
  const count = await result(store.count());
  if (count > MAX_SMART_SOLVES) {
    // Primary keys in recordedAt order, oldest first.
    const keys = await result(store.index('recordedAt').getAllKeys(null, count - MAX_SMART_SOLVES));
    for (const key of keys) store.delete(key);
  }
  await done(tx);
  notify();
}

/** Solves for one case, newest first. */
export async function smartSolvesFor(practice: TrainerPractice, caseId: string): Promise<SmartSolveRecord[]> {
  const db = await open();
  const tx = db.transaction(SOLVES, 'readonly');
  const records = await result(tx.objectStore(SOLVES).index('case').getAll([practice, caseId]) as IDBRequest<SmartSolveRecord[]>);
  return records.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function countSmartSolves(): Promise<number> {
  const db = await open();
  return result(db.transaction(SOLVES, 'readonly').objectStore(SOLVES).count());
}

export async function deleteSmartSolve(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(SOLVES, 'readwrite');
  tx.objectStore(SOLVES).delete(id);
  await done(tx);
  notify();
}

/** Delete one case's solves, or every solve when no case is given. */
export async function clearSmartSolves(target?: { practice: TrainerPractice; caseId: string }): Promise<void> {
  const db = await open();
  const tx = db.transaction(SOLVES, 'readwrite');
  const store = tx.objectStore(SOLVES);
  if (!target) {
    store.clear();
  } else {
    const keys = await result(store.index('case').getAllKeys([target.practice, target.caseId]));
    for (const key of keys) store.delete(key);
  }
  await done(tx);
  notify();
}
