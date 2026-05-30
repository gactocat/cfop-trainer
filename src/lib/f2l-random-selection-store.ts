import { F2L_IDS, type F2LId } from '@/types/f2l';

// Which F2L cases are eligible for the Random trainer's draw. Persisted as the
// array of *selected* ids. When the key is absent (first run) every case is
// selected by default.
const STORAGE_KEY = 'pll-app:f2l-random-selection:v1';

let cached: Set<F2LId> | null = null;
const listeners = new Set<() => void>();

function allSelected(): Set<F2LId> {
  return new Set(F2L_IDS);
}

function readFromStorage(): Set<F2LId> {
  if (typeof window === 'undefined') return allSelected();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return allSelected();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return allSelected();
    const valid = parsed.filter((id): id is F2LId =>
      (F2L_IDS as string[]).includes(id as string),
    );
    return new Set(valid);
  } catch {
    return allSelected();
  }
}

function writeToStorage(selected: Set<F2LId>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
}

const EMPTY: Set<F2LId> = new Set();

export function getSnapshot(): Set<F2LId> {
  if (typeof window === 'undefined') return EMPTY;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): Set<F2LId> {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mutate(updater: (prev: Set<F2LId>) => Set<F2LId>): void {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) return;
  cached = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}
