// IndexedDB persistence for the /dev/gan-i4 spike, so a page reload does not
// lose a recording. Records are appended in small batches; the session is
// rebuilt from them on load.

const DB_NAME = 'gan-i4-spike';
const RECORDS = 'records';
const META = 'meta';
const META_KEY = 'session';

export interface SpikeMeta {
  /** Epoch ms that every record's `t` is relative to. */
  sessionOrigin: number;
  startedAt: string;
  /** Number of records included in the last saved JSON. */
  exportedRecords: number;
  exportedAt: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RECORDS, { autoIncrement: true });
      request.result.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

export const persistenceAvailable = () => typeof indexedDB !== 'undefined';

export async function load<T>(): Promise<{ meta: SpikeMeta | null; records: T[] }> {
  const db = await open();
  const tx = db.transaction([META, RECORDS], 'readonly');
  const meta = tx.objectStore(META).get(META_KEY);
  const records = tx.objectStore(RECORDS).getAll();
  await done(tx);
  return { meta: (meta.result as SpikeMeta | undefined) ?? null, records: records.result as T[] };
}

export async function append<T>(records: T[], meta: SpikeMeta): Promise<void> {
  const db = await open();
  const tx = db.transaction([META, RECORDS], 'readwrite');
  const store = tx.objectStore(RECORDS);
  for (const record of records) store.add(record);
  tx.objectStore(META).put(meta, META_KEY);
  await done(tx);
}

export async function reset(meta: SpikeMeta): Promise<void> {
  const db = await open();
  const tx = db.transaction([META, RECORDS], 'readwrite');
  tx.objectStore(RECORDS).clear();
  tx.objectStore(META).put(meta, META_KEY);
  await done(tx);
}
