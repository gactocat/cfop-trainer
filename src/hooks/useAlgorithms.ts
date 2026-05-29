'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  seedDefaultsIfMissing,
  subscribe,
} from '@/lib/storage';
import type {
  AlgorithmRecord,
  Auf,
  PllId,
  TimeRecord,
} from '@/types/pll';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface UseAlgorithmsResult {
  ready: boolean;
  all: AlgorithmRecord[];
  forPll: (pllId: PllId, auf?: Auf) => AlgorithmRecord[];
  starredFor: (pllId: PllId) => AlgorithmRecord | null;
  add: (input: { pllId: PllId; auf: Auf; algorithm: string }) => AlgorithmRecord;
  update: (
    id: string,
    patch: Partial<Pick<AlgorithmRecord, 'algorithm' | 'auf'>>,
  ) => void;
  setStar: (id: string) => void;
  remove: (id: string) => void;
  addTime: (algorithmId: string, seconds: number) => void;
  removeTime: (algorithmId: string, timeId: string) => void;
}

export function useAlgorithms(): UseAlgorithmsResult {
  const records = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = typeof window !== 'undefined';

  useEffect(() => {
    seedDefaultsIfMissing();
  }, []);

  const forPll = useCallback(
    (pllId: PllId, auf?: Auf) =>
      records.filter(
        (r) => r.pllId === pllId && (auf === undefined || r.auf === auf),
      ),
    [records],
  );

  const starredFor = useCallback(
    (pllId: PllId): AlgorithmRecord | null =>
      records.find((r) => r.pllId === pllId && r.isStarred) ?? null,
    [records],
  );

  const add = useCallback<UseAlgorithmsResult['add']>((input) => {
    const created: AlgorithmRecord = {
      id: newId(),
      pllId: input.pllId,
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

  const update = useCallback<UseAlgorithmsResult['update']>((id, patch) => {
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
        if (r.pllId !== target.pllId) return r;
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
      forPll,
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
      forPll,
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
