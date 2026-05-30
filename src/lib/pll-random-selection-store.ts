import { PLL_IDS, type PllId } from '@/types/pll';

// Which PLL cases are eligible for the Random trainer's draw. Persisted as the
// array of *selected* ids. When the key is absent (first run) every case is
// selected by default.
const STORAGE_KEY = 'pll-app:pll-random-selection:v1';

let cached: Set<PllId> | null = null;
const listeners = new Set<() => void>();

function allSelected(): Set<PllId> {
  return new Set(PLL_IDS);
}

function readFromStorage(): Set<PllId> {
  if (typeof window === 'undefined') return allSelected();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return allSelected();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return allSelected();
    const valid = parsed.filter((id): id is PllId =>
      (PLL_IDS as string[]).includes(id as string),
    );
    return new Set(valid);
  } catch {
    return allSelected();
  }
}

function writeToStorage(selected: Set<PllId>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
}

const EMPTY: Set<PllId> = new Set();

export function getSnapshot(): Set<PllId> {
  if (typeof window === 'undefined') return EMPTY;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): Set<PllId> {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mutate(updater: (prev: Set<PllId>) => Set<PllId>): void {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) return;
  cached = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}
