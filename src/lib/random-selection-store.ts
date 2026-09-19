import { createLocalStore } from '@/lib/local-store';

export function createRandomSelectionStore<Id extends string>(storageKey: string, ids: readonly Id[]) {
  const valid = new Set<string>(ids);
  return createLocalStore<Set<Id>>(
    storageKey,
    new Set(),
    (raw) => Array.isArray(raw)
      ? new Set(raw.filter((id): id is Id => typeof id === 'string' && valid.has(id)))
      : new Set(ids),
    { missing: () => new Set(ids), encode: (selected) => [...selected] },
  );
}
