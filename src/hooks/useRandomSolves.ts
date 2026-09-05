'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/random-solves-store';
import { useMounted } from '@/hooks/useMounted';
import { averageOfN, bestSeconds } from '@/lib/stats';
import type { PllId, RandomSolve, TimeRecord } from '@/types/pll';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Adapt RandomSolve list to the TimeRecord-shaped input that stats helpers
// expect. Most-recent-first ordering matches addSolve's prepend behavior.
function asTimeRecords(solves: RandomSolve[]): TimeRecord[] {
  return solves.map((s) => ({
    id: s.id,
    seconds: s.seconds,
    recordedAt: s.recordedAt,
  }));
}

export interface UseRandomSolvesResult {
  ready: boolean;
  all: RandomSolve[];
  solvesFor: (pllId: PllId) => RandomSolve[];
  bestFor: (pllId: PllId) => number | null;
  ao5For: (pllId: PllId) => number | null;
  add: (pllId: PllId, seconds: number) => void;
  remove: (id: string) => void;
  resetForPll: (pllId: PllId) => void;
}

export function useRandomSolves(): UseRandomSolvesResult {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Store snapshots differ between server and client, so `ready` must flip
  // only after hydration (a `typeof window` check would mismatch the SSR markup).
  const ready = useMounted();

  const solvesFor = useCallback(
    (pllId: PllId) => all.filter((s) => s.pllId === pllId),
    [all],
  );

  const bestFor = useCallback(
    (pllId: PllId) => bestSeconds(asTimeRecords(all.filter((s) => s.pllId === pllId))),
    [all],
  );

  const ao5For = useCallback(
    (pllId: PllId) => averageOfN(asTimeRecords(all.filter((s) => s.pllId === pllId)), 5),
    [all],
  );

  const add = useCallback((pllId: PllId, seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const created: RandomSolve = {
      id: newId(),
      pllId,
      seconds,
      recordedAt: nowIso(),
    };
    mutate((prev) => [created, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    mutate((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetForPll = useCallback((pllId: PllId) => {
    mutate((prev) => prev.filter((s) => s.pllId !== pllId));
  }, []);

  return useMemo(
    () => ({ ready, all, solvesFor, bestFor, ao5For, add, remove, resetForPll }),
    [ready, all, solvesFor, bestFor, ao5For, add, remove, resetForPll],
  );
}
