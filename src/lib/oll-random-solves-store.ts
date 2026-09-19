import { createLocalStore } from '@/lib/local-store';
import { OLL_IDS, type OLLId, type OLLRandomSolve } from '@/types/oll';

const STORAGE_KEY = 'pll-app:oll-random-solves:v1';

function normalizeRecord(raw: unknown): OLLRandomSolve | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<OLLRandomSolve>;
  if (typeof r.id !== 'string' || !OLL_IDS.includes(r.ollId as OLLId)) return null;
  if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds) || r.seconds <= 0) return null;
  return {
    id: r.id,
    ollId: r.ollId as OLLId,
    seconds: r.seconds,
    recordedAt: r.recordedAt ?? new Date(0).toISOString(),
  };
}

export const { getSnapshot, getServerSnapshot, subscribe, mutate } = createLocalStore<OLLRandomSolve[]>(
  STORAGE_KEY,
  [],
  (raw) => Array.isArray(raw)
    ? raw.map(normalizeRecord).filter((r): r is OLLRandomSolve => r !== null)
    : [],
);
