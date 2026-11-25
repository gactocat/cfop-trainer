'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { getSolvesServerSnapshot, getSolvesSnapshot, subscribeSolves } from '@/lib/solve-store';
import type { SolveEvent } from '@/lib/solve/solve-record';

/** This device's solves of one kind, newest first. */
export function useSolves(event: SolveEvent) {
  const getSnapshot = useCallback(() => getSolvesSnapshot(event), [event]);
  return useSyncExternalStore(subscribeSolves, getSnapshot, getSolvesServerSnapshot);
}
