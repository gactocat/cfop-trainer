'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  seedDefaultsIfMissing,
  subscribe,
} from '@/lib/f2l-storage';
import type {
  F2LAlgorithmRecord,
  F2LId,
} from '@/types/f2l';
import type { TimeRecord } from '@/types/pll';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface UseF2LAlgorithmsResult {
  ready: boolean;
  all: F2LAlgorithmRecord[];
  forF2L: (f2lId: F2LId) => F2LAlgorithmRecord[];
  starredFor: (f2lId: F2LId) => F2LAlgorithmRecord | null;
  add: (input: { f2lId: F2LId; algorithm: string }) => F2LAlgorithmRecord;
  update: (
    id: string,
    patch: Partial<Pick<F2LAlgorithmRecord, 'algorithm'>>,
  ) => void;
  setStar: (id: string) => void;
  remove: (id: string) => void;
  addTime: (algorithmId: string, seconds: number) => void;
  removeTime: (algorithmId: string, timeId: string) => void;
}

export function useF2LAlgorithms(): UseF2LAlgorithmsResult {
  const records = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = typeof window !== 'undefined';

  useEffect(() => {
    seedDefaultsIfMissing();
  }, []);

  const forF2L = useCallback(
    (f2lId: F2LId) => records.filter((r) => r.f2lId === f2lId),
    [records],
  );

  const starredFor = useCallback(
    (f2lId: F2LId): F2LAlgorithmRecord | null =>
      records.find((r) => r.f2lId === f2lId && r.isStarred) ?? null,
    [records],
  );

  const add = useCallback<UseF2LAlgorithmsResult['add']>((input) => {
    const created: F2LAlgorithmRecord = {
      id: newId(),
      f2lId: input.f2lId,
      algorithm: input.algorithm.trim(),
      times: [],
      isStarred: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mutate((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback<UseF2LAlgorithmsResult['update']>((id, patch) => {
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
        if (r.f2lId !== target.f2lId) return r;
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
      forF2L,
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
      forF2L,
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
