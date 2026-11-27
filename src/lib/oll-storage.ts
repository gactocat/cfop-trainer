import { readStoredValue } from '@/lib/persistence';
import { createLocalStore } from '@/lib/local-store';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { OLL_IDS, type OLLAlgorithmRecord, type OLLId } from '@/types/oll';
import { AUFS } from '@/types/pll';
import { splitAuf } from '@/lib/auf-from-algorithm';

const STORAGE_KEY = 'pll-app:oll-algorithms:v1';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeRecord(raw: unknown): OLLAlgorithmRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<OLLAlgorithmRecord>;
  if (typeof r.id !== 'string' || !OLL_IDS.includes(r.ollId as OLLId) || typeof r.algorithm !== 'string' || !r.algorithm.trim()) return null;
  return {
    id: r.id,
    ollId: r.ollId as OLLId,
    auf: r.auf && AUFS.includes(r.auf) ? r.auf : 'U0',
    algorithm: r.algorithm,
    times: Array.isArray(r.times) ? r.times : [],
    isStarred: r.isStarred === true,
    createdAt: r.createdAt ?? new Date(0).toISOString(),
    updatedAt: r.updatedAt ?? new Date(0).toISOString(),
  };
}

export const { getSnapshot, getServerSnapshot, subscribe, mutate } = createLocalStore<OLLAlgorithmRecord[]>(
  STORAGE_KEY,
  [],
  (raw) => Array.isArray(raw)
    ? raw.map(normalizeRecord).filter((r): r is OLLAlgorithmRecord => r !== null)
    : [],
  { normalize: enforceStarInvariant },
);

// Enforce: each OLL with at least one algorithm has exactly one starred entry.
// Preserves an existing star if there is one; otherwise stars the first record.
export function enforceStarInvariant(records: OLLAlgorithmRecord[]): OLLAlgorithmRecord[] {
  const byOLL = new Map<OLLId, OLLAlgorithmRecord[]>();
  for (const r of records) {
    const list = byOLL.get(r.ollId) ?? [];
    list.push(r);
    byOLL.set(r.ollId, list);
  }
  const fixedIds = new Map<string, boolean>();
  for (const [, list] of byOLL) {
    if (list.length === 0) continue;
    const stars = list.filter((r) => r.isStarred);
    let starredId: string;
    if (stars.length === 1) {
      starredId = stars[0].id;
    } else if (stars.length === 0) {
      starredId = list[0].id;
    } else {
      // Multiple stars: keep the most recently updated one.
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

// On first visit (storage key never written), seed every OLL with the first
// preset algorithm, splitting any leading "(U)" / "(U2)" / "(U')" into the AUF
// field. An explicit `[]` is treated as an intentional clear and left alone.
export function seedDefaultsIfMissing(): void {
  if (typeof window === 'undefined') return;
  if (readStoredValue(STORAGE_KEY) !== null) return;
  const now = nowIso();
  const seeded: OLLAlgorithmRecord[] = [];
  for (const ollId of OLL_IDS) {
    const presets = OLL_PRESET_ALGORITHMS[ollId];
    if (!presets || presets.length === 0) continue;
    const { auf, rest } = splitAuf(presets[0]);
    seeded.push({
      id: newId(),
      ollId,
      auf,
      algorithm: rest,
      times: [],
      isStarred: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  mutate(() => seeded);
}
