import { createLocalStore } from '@/lib/local-store';

// Named sets of cases for the random trainer ("saved selections"), one store
// per practice (PLL, F2L). Same shape as the other localStorage stores, built
// by a factory because the two practices only differ in id type and key.

export interface SelectionPreset<Id extends string> {
  id: string;
  name: string;
  ids: Id[];
  createdAt: string;
}

export interface SelectionPresetsStore<Id extends string> {
  getSnapshot: () => SelectionPreset<Id>[];
  getServerSnapshot: () => SelectionPreset<Id>[];
  subscribe: (listener: () => void) => () => void;
  // Saves the set under `name`; a set with the same name is replaced.
  save: (name: string, ids: Iterable<Id>) => SelectionPreset<Id>;
  remove: (presetId: string) => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createSelectionPresetsStore<Id extends string>(
  storageKey: string,
  isValidId: (value: unknown) => value is Id,
): SelectionPresetsStore<Id> {
  const EMPTY: SelectionPreset<Id>[] = [];

  const normalize = (raw: unknown): SelectionPreset<Id> | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Partial<SelectionPreset<Id>>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.ids)) return null;
    return {
      id: p.id,
      name: p.name,
      ids: p.ids.filter(isValidId),
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(0).toISOString(),
    };
  };

  const store = createLocalStore<SelectionPreset<Id>[]>(storageKey, EMPTY, (raw) =>
    Array.isArray(raw) ? raw.map(normalize).filter((p): p is SelectionPreset<Id> => p !== null) : EMPTY,
  );
  const { getSnapshot } = store;
  const write = (next: SelectionPreset<Id>[]) => store.mutate(() => next);
  return {
    ...store,
    save: (name, ids) => {
      const trimmed = name.trim();
      const prev = getSnapshot();
      const existing = prev.find((p) => p.name === trimmed);
      const preset: SelectionPreset<Id> = {
        id: existing?.id ?? newId(),
        name: trimmed,
        ids: [...new Set(ids)],
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      write(existing ? prev.map((p) => (p.id === preset.id ? preset : p)) : [...prev, preset]);
      return preset;
    },
    remove: (presetId) => {
      const prev = getSnapshot();
      if (!prev.some((p) => p.id === presetId)) return;
      write(prev.filter((p) => p.id !== presetId));
    },
  };
}
