import type { F2LRandomSolve } from '@/types/f2l';

const STORAGE_KEY = 'pll-app:f2l-random-solves:v1';

let cached: F2LRandomSolve[] | null = null;
const listeners = new Set<() => void>();

function normalizeRecord(raw: unknown): F2LRandomSolve | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<F2LRandomSolve>;
  if (!r.id || !r.f2lId) return null;
  if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds)) return null;
  return {
    id: r.id,
    f2lId: r.f2lId,
    seconds: r.seconds,
    recordedAt: r.recordedAt ?? new Date(0).toISOString(),
  };
}

function readFromStorage(): F2LRandomSolve[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRecord)
      .filter((r): r is F2LRandomSolve => r !== null);
  } catch {
    return [];
  }
}

function writeToStorage(records: F2LRandomSolve[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

const EMPTY: F2LRandomSolve[] = [];

export function getSnapshot(): F2LRandomSolve[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): F2LRandomSolve[] {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mutate(
  updater: (prev: F2LRandomSolve[]) => F2LRandomSolve[],
): void {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) return;
  cached = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}
