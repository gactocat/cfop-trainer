'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/oll-random-solves-store';
import { useMounted } from '@/hooks/useMounted';
import { averageOfN, bestSeconds } from '@/lib/stats';
import type { OLLId, OLLRandomSolve } from '@/types/oll';
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

// Adapt OLLRandomSolve list to the TimeRecord-shaped input that stats helpers
// expect. Most-recent-first ordering matches addSolve's prepend behavior.
function asTimeRecords(solves: OLLRandomSolve[]): TimeRecord[] {
  return solves.map((s) => ({
    id: s.id,
    seconds: s.seconds,
    recordedAt: s.recordedAt,
  }));
}

export interface UseOLLRandomSolvesResult {
  ready: boolean;
  all: OLLRandomSolve[];
  solvesFor: (ollId: OLLId) => OLLRandomSolve[];
  bestFor: (ollId: OLLId) => number | null;
  ao5For: (ollId: OLLId) => number | null;
  add: (ollId: OLLId, seconds: number) => void;
  remove: (id: string) => void;
  resetForOLL: (ollId: OLLId) => void;
}

export function useOLLRandomSolves(): UseOLLRandomSolvesResult {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Store snapshots differ between server and client, so `ready` must flip
  // only after hydration (a `typeof window` check would mismatch the SSR markup).
  const ready = useMounted();

  const solvesFor = useCallback(
    (ollId: OLLId) => all.filter((s) => s.ollId === ollId),
    [all],
  );

  const bestFor = useCallback(
    (ollId: OLLId) => bestSeconds(asTimeRecords(all.filter((s) => s.ollId === ollId))),
    [all],
  );

  const ao5For = useCallback(
    (ollId: OLLId) => averageOfN(asTimeRecords(all.filter((s) => s.ollId === ollId)), 5),
    [all],
  );

  const add = useCallback((ollId: OLLId, seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const created: OLLRandomSolve = {
      id: newId(),
      ollId,
      seconds,
      recordedAt: nowIso(),
    };
    mutate((prev) => [created, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    mutate((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetForOLL = useCallback((ollId: OLLId) => {
    mutate((prev) => prev.filter((s) => s.ollId !== ollId));
  }, []);

  return useMemo(
    () => ({ ready, all, solvesFor, bestFor, ao5For, add, remove, resetForOLL }),
    [ready, all, solvesFor, bestFor, ao5For, add, remove, resetForOLL],
  );
}
