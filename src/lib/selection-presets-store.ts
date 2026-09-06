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
  let cached: SelectionPreset<Id>[] | null = null;
  const listeners = new Set<() => void>();

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

  const readFromStorage = (): SelectionPreset<Id>[] => {
    if (typeof window === 'undefined') return EMPTY;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return EMPTY;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return EMPTY;
      return parsed.map(normalize).filter((p): p is SelectionPreset<Id> => p !== null);
    } catch {
      return EMPTY;
    }
  };

  const write = (next: SelectionPreset<Id>[]): void => {
    cached = next;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
    listeners.forEach((l) => l());
  };

  const getSnapshot = (): SelectionPreset<Id>[] => {
    if (typeof window === 'undefined') return EMPTY;
    if (cached === null) cached = readFromStorage();
    return cached;
  };

  return {
    getSnapshot,
    getServerSnapshot: () => EMPTY,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
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
