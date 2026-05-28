import type { F2LAlgorithmRecord, F2LId } from '@/types/f2l';

const STORAGE_KEY = 'pll-app:f2l-algorithms:v1';

let cached: F2LAlgorithmRecord[] | null = null;
const listeners = new Set<() => void>();

function normalizeRecord(raw: unknown): F2LAlgorithmRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<F2LAlgorithmRecord>;
  if (!r.id || !r.f2lId || !r.algorithm) return null;
  return {
    id: r.id,
    f2lId: r.f2lId,
    algorithm: r.algorithm,
    times: Array.isArray(r.times) ? r.times : [],
    isStarred: typeof r.isStarred === 'boolean' ? r.isStarred : false,
    createdAt: r.createdAt ?? new Date(0).toISOString(),
    updatedAt: r.updatedAt ?? new Date(0).toISOString(),
  };
}

function readFromStorage(): F2LAlgorithmRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRecord)
      .filter((r): r is F2LAlgorithmRecord => r !== null);
  } catch {
    return [];
  }
}

function writeToStorage(records: F2LAlgorithmRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

const EMPTY: F2LAlgorithmRecord[] = [];

export function getSnapshot(): F2LAlgorithmRecord[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): F2LAlgorithmRecord[] {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Mirrors the PLL invariant: each F2L case with at least one algorithm has
// exactly one starred entry. Promotes the first algorithm if none is starred,
// keeps the most recently updated one if multiple are.
export function enforceStarInvariant(
  records: F2LAlgorithmRecord[],
): F2LAlgorithmRecord[] {
  const byCase = new Map<F2LId, F2LAlgorithmRecord[]>();
  for (const r of records) {
    const list = byCase.get(r.f2lId) ?? [];
    list.push(r);
    byCase.set(r.f2lId, list);
  }
  const fixedIds = new Map<string, boolean>();
  for (const [, list] of byCase) {
    if (list.length === 0) continue;
    const stars = list.filter((r) => r.isStarred);
    let starredId: string;
    if (stars.length === 1) {
      starredId = stars[0].id;
    } else if (stars.length === 0) {
      starredId = list[0].id;
    } else {
      const winner = stars.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
      starredId = winner.id;
    }
    for (const r of list) fixedIds.set(r.id, r.id === starredId);
  }
  let changed = false;
  const next = records.map((r) => {
    const want = fixedIds.get(r.id) ?? r.isStarred;
    if (want === r.isStarred) return r;
    changed = true;
    return { ...r, isStarred: want };
  });
  return changed ? next : records;
}

export function mutate(
  updater: (prev: F2LAlgorithmRecord[]) => F2LAlgorithmRecord[],
): void {
  const prev = getSnapshot();
  const next = enforceStarInvariant(updater(prev));
  if (next === prev) return;
  cached = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}
