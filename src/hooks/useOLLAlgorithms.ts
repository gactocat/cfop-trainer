'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  seedDefaultsIfMissing,
  subscribe,
} from '@/lib/oll-storage';
import { useMounted } from '@/hooks/useMounted';
import { usePersistence } from '@/hooks/usePersistence';
import { canWriteData } from '@/lib/persistence';
import type { Auf, TimeRecord } from '@/types/pll';
import type {
  OLLAlgorithmRecord,
  OLLId,
} from '@/types/oll';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface UseOLLAlgorithmsResult {
  ready: boolean;
  all: OLLAlgorithmRecord[];
  forOLL: (ollId: OLLId, auf?: Auf) => OLLAlgorithmRecord[];
  starredFor: (ollId: OLLId) => OLLAlgorithmRecord | null;
  add: (input: { ollId: OLLId; auf: Auf; algorithm: string }) => OLLAlgorithmRecord;
  update: (
    id: string,
    patch: Partial<Pick<OLLAlgorithmRecord, 'algorithm' | 'auf'>>,
  ) => void;
  setStar: (id: string) => void;
  remove: (id: string) => void;
  addTime: (algorithmId: string, seconds: number) => void;
  removeTime: (algorithmId: string, timeId: string) => void;
}

export function useOLLAlgorithms(): UseOLLAlgorithmsResult {
  const records = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Store snapshots differ between server and client, so `ready` must flip
  // only after hydration (a `typeof window` check would mismatch the SSR markup).
  const ready = useMounted();

  const persistence = usePersistence();
  const writable = persistence.mode === 'guest' || (persistence.mode === 'account' && persistence.online && !persistence.error);
  useEffect(() => {
    if (canWriteData()) seedDefaultsIfMissing();
  }, [writable]);

  const forOLL = useCallback(
    (ollId: OLLId, auf?: Auf) =>
      records.filter(
        (r) => r.ollId === ollId && (auf === undefined || r.auf === auf),
      ),
    [records],
  );

  const starredFor = useCallback(
    (ollId: OLLId): OLLAlgorithmRecord | null =>
      records.find((r) => r.ollId === ollId && r.isStarred) ?? null,
    [records],
  );

  const add = useCallback<UseOLLAlgorithmsResult['add']>((input) => {
    const created: OLLAlgorithmRecord = {
      id: newId(),
      ollId: input.ollId,
      auf: input.auf,
      algorithm: input.algorithm.trim(),
      times: [],
      isStarred: false, // will be auto-promoted by enforceStarInvariant if it's the first algo
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mutate((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback<UseOLLAlgorithmsResult['update']>((id, patch) => {
    mutate((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              algorithm:
                patch.algorithm !== undefined
                  ? patch.algorithm.trim()
                  : r.algorithm,
              updatedAt: nowIso(),
            }
          : r,
      ),
    );
  }, []);

  const setStar = useCallback((id: string) => {
    mutate((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const now = nowIso();
      return prev.map((r) => {
        if (r.ollId !== target.ollId) return r;
        const want = r.id === id;
        if (r.isStarred === want) return r;
        return { ...r, isStarred: want, updatedAt: now };
      });
    });
  }, []);

  const remove = useCallback((id: string) => {
    mutate((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addTime = useCallback((algorithmId: string, seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const t: TimeRecord = {
      id: newId(),
      seconds,
      recordedAt: nowIso(),
    };
    mutate((prev) =>
      prev.map((r) =>
        r.id === algorithmId
          ? { ...r, times: [t, ...r.times], updatedAt: nowIso() }
          : r,
      ),
    );
  }, []);

  const removeTime = useCallback((algorithmId: string, timeId: string) => {
    mutate((prev) =>
      prev.map((r) =>
        r.id === algorithmId
          ? {
              ...r,
              times: r.times.filter((t) => t.id !== timeId),
              updatedAt: nowIso(),
            }
          : r,
      ),
    );
  }, []);

  return useMemo(
    () => ({
      ready,
      all: records,
      forOLL,
      starredFor,
      add,
      update,
      setStar,
      remove,
      addTime,
      removeTime,
    }),
    [
      ready,
      records,
      forOLL,
      starredFor,
      add,
      update,
      setStar,
      remove,
      addTime,
      removeTime,
    ],
  );
}
