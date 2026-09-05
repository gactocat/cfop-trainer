import { ALL_F2LS } from '@/data/f2l-definitions';
import { splitF2LAuf } from '@/lib/f2l-auf';
import { ImportError } from '@/lib/import-error';
import type { F2LAlgorithmRecord, F2LId } from '@/types/f2l';
import type { Auf } from '@/types/pll';

const VALID_AUFS: Auf[] = ['U0', 'U', 'U2', "U'"];

const STORAGE_KEY = 'pll-app:f2l-algorithms:v1';
const EXPORT_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let cached: F2LAlgorithmRecord[] | null = null;
const listeners = new Set<() => void>();

function normalizeRecord(raw: unknown): F2LAlgorithmRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<F2LAlgorithmRecord>;
  if (!r.id || !r.f2lId || !r.algorithm) return null;
  // Records written before AUF existed have no `auf` and keep the leading U
  // turn in the body. Migrate them by splitting that turn off on read.
  let auf: Auf;
  let algorithm: string;
  if (r.auf && VALID_AUFS.includes(r.auf)) {
    auf = r.auf;
    algorithm = r.algorithm;
  } else {
    const split = splitF2LAuf(r.algorithm);
    auf = split.auf;
    algorithm = split.rest;
  }
  return {
    id: r.id,
    f2lId: r.f2lId,
    auf,
    algorithm,
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

// On first visit (storage key never written), seed every F2L case with its
// primary algorithm marked as starred. An explicit `[]` is treated as an
// intentional clear and left alone.
export function seedDefaultsIfMissing(): void {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(STORAGE_KEY) !== null) return;
  const now = nowIso();
  const seeded: F2LAlgorithmRecord[] = ALL_F2LS.map((def) => {
    const { auf, rest } = splitF2LAuf(def.primaryAlg);
    return {
      id: newId(),
      f2lId: def.id,
      auf,
      algorithm: rest,
      times: [],
      isStarred: true,
      createdAt: now,
      updatedAt: now,
    };
  });
  cached = seeded;
  writeToStorage(seeded);
  listeners.forEach((l) => l());
}

interface F2LExportEntry {
  f2lId: F2LId;
  auf: Auf;
  algorithm: string;
  isStarred: boolean;
}

interface F2LExportFile {
  type: 'f2l';
  version: number;
  exportedAt: string;
  algorithms: F2LExportEntry[];
}

// Serialize the current F2L algorithms to a JSON string. Practice times are
// intentionally omitted; only algorithm body, AUF and star flag are kept.
export function exportF2LAlgorithms(): string {
  const algorithms: F2LExportEntry[] = getSnapshot().map((r) => ({
    f2lId: r.f2lId,
    auf: r.auf,
    algorithm: r.algorithm,
    isStarred: r.isStarred,
  }));
  const file: F2LExportFile = {
    type: 'f2l',
    version: EXPORT_VERSION,
    exportedAt: nowIso(),
    algorithms,
  };
  return JSON.stringify(file, null, 2);
}

// Parse an exported JSON string and replace all F2L algorithms with it.
// Throws on malformed JSON or wrong `type`. Invalid individual entries are
// skipped. Returns the number of imported records.
export function importF2LAlgorithms(json: string): { imported: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('invalid-json');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ImportError('unrecognized');
  }
  const file = parsed as Partial<F2LExportFile>;
  if (file.type !== 'f2l') {
    throw new ImportError('wrong-kind');
  }
  if (!Array.isArray(file.algorithms)) {
    throw new ImportError('unrecognized');
  }
  const validIds = new Set<string>(ALL_F2LS.map((d) => d.id));
  const validAufs = new Set<string>(VALID_AUFS);
  const now = nowIso();
  const next: F2LAlgorithmRecord[] = [];
  for (const raw of file.algorithms) {
    if (typeof raw !== 'object' || raw === null) continue;
    const e = raw as Partial<F2LExportEntry>;
    if (typeof e.f2lId !== 'string' || !validIds.has(e.f2lId)) continue;
    if (typeof e.auf !== 'string' || !validAufs.has(e.auf)) continue;
    if (typeof e.algorithm !== 'string' || e.algorithm.trim() === '') continue;
    next.push({
      id: newId(),
      f2lId: e.f2lId as F2LId,
      auf: e.auf as Auf,
      algorithm: e.algorithm,
      times: [],
      isStarred: e.isStarred === true,
      createdAt: now,
      updatedAt: now,
    });
  }
  mutate(() => next);
  return { imported: next.length };
}
