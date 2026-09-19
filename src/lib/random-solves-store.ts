import { createLocalStore } from '@/lib/local-store';
import type { RandomSolve } from '@/types/pll';

const STORAGE_KEY = 'pll-app:random-solves:v1';

function normalizeRecord(raw: unknown): RandomSolve | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<RandomSolve>;
  if (!r.id || !r.pllId) return null;
  if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds)) return null;
  return {
    id: r.id,
    pllId: r.pllId,
    seconds: r.seconds,
    recordedAt: r.recordedAt ?? new Date(0).toISOString(),
  };
}

export const { getSnapshot, getServerSnapshot, subscribe, mutate } = createLocalStore<RandomSolve[]>(
  STORAGE_KEY,
  [],
  (raw) => Array.isArray(raw)
    ? raw.map(normalizeRecord).filter((r): r is RandomSolve => r !== null)
    : [],
);
