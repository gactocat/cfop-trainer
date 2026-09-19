import { createLocalStore } from '@/lib/local-store';
import type { F2LRandomSolve } from '@/types/f2l';

const STORAGE_KEY = 'pll-app:f2l-random-solves:v1';

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

export const { getSnapshot, getServerSnapshot, subscribe, mutate } = createLocalStore<F2LRandomSolve[]>(
  STORAGE_KEY,
  [],
  (raw) => Array.isArray(raw)
    ? raw.map(normalizeRecord).filter((r): r is F2LRandomSolve => r !== null)
    : [],
);
