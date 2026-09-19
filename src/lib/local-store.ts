import { canWriteData, readStoredValue, subscribeData, writeStoredValue } from '@/lib/persistence';

// The same cached useSyncExternalStore contract for all practice stores.
// Decoders retain each practice's persisted schema and legacy migrations.
export function createLocalStore<T>(
  storageKey: string,
  empty: T,
  decode: (raw: unknown) => T,
  options: {
    missing?: () => T;
    encode?: (value: T) => unknown;
    normalize?: (value: T) => T;
  } = {},
) {
  let cached: T | null = null;
  const listeners = new Set<() => void>();
  subscribeData(() => {
    cached = null;
    listeners.forEach((listener) => listener());
  });
  const read = (): T => {
    try {
      const raw = readStoredValue(storageKey);
      return raw === null ? (options.missing?.() ?? empty) : decode(JSON.parse(raw));
    } catch {
      return options.missing?.() ?? empty;
    }
  };
  const getSnapshot = (): T => {
    if (typeof window === 'undefined') return empty;
    if (cached === null) cached = read();
    return cached;
  };
  const mutate = (updater: (prev: T) => T): void => {
    if (!canWriteData()) throw new Error('Storage is read-only');
    const prev = getSnapshot();
    const updated = updater(prev);
    const next = options.normalize ? options.normalize(updated) : updated;
    if (next === prev) return;
    if (typeof window !== 'undefined') {
      writeStoredValue(storageKey, JSON.stringify(options.encode ? options.encode(next) : next));
    }
    cached = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot,
    getServerSnapshot: () => empty,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    mutate,
  };
}
