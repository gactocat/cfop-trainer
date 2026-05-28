'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/f2l-random-solves-store';
import { averageOfN, bestSeconds } from '@/lib/stats';
import type { F2LId, F2LRandomSolve } from '@/types/f2l';
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

function asTimeRecords(solves: F2LRandomSolve[]): TimeRecord[] {
  return solves.map((s) => ({
    id: s.id,
    seconds: s.seconds,
    recordedAt: s.recordedAt,
  }));
}

export interface UseF2LRandomSolvesResult {
  ready: boolean;
  all: F2LRandomSolve[];
  solvesFor: (f2lId: F2LId) => F2LRandomSolve[];
  bestFor: (f2lId: F2LId) => number | null;
  ao5For: (f2lId: F2LId) => number | null;
  add: (f2lId: F2LId, seconds: number) => void;
  remove: (id: string) => void;
  resetFor: (f2lId: F2LId) => void;
}

export function useF2LRandomSolves(): UseF2LRandomSolvesResult {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = typeof window !== 'undefined';

  const solvesFor = useCallback(
    (f2lId: F2LId) => all.filter((s) => s.f2lId === f2lId),
    [all],
  );

  const bestFor = useCallback(
    (f2lId: F2LId) => bestSeconds(asTimeRecords(all.filter((s) => s.f2lId === f2lId))),
    [all],
  );

  const ao5For = useCallback(
    (f2lId: F2LId) => averageOfN(asTimeRecords(all.filter((s) => s.f2lId === f2lId)), 5),
    [all],
  );

  const add = useCallback((f2lId: F2LId, seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const created: F2LRandomSolve = {
      id: newId(),
      f2lId,
      seconds,
      recordedAt: nowIso(),
    };
    mutate((prev) => [created, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    mutate((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetFor = useCallback((f2lId: F2LId) => {
    mutate((prev) => prev.filter((s) => s.f2lId !== f2lId));
  }, []);

  return useMemo(
    () => ({ ready, all, solvesFor, bestFor, ao5For, add, remove, resetFor }),
    [ready, all, solvesFor, bestFor, ao5For, add, remove, resetFor],
  );
}
