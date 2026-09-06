'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/f2l-random-selection-store';
import { useMounted } from '@/hooks/useMounted';
import { F2L_IDS, type F2LId } from '@/types/f2l';

export interface UseF2LRandomSelectionResult {
  ready: boolean;
  selected: Set<F2LId>;
  count: number;
  isSelected: (id: F2LId) => boolean;
  toggle: (id: F2LId) => void;
  selectAll: () => void;
  clear: () => void;
  // Replace the whole selection (used to load a saved set).
  replace: (ids: Iterable<F2LId>) => void;
}

export function useF2LRandomSelection(): UseF2LRandomSelectionResult {
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Store snapshots differ between server and client, so `ready` must flip
  // only after hydration (a `typeof window` check would mismatch the SSR markup).
  const ready = useMounted();

  const isSelected = useCallback((id: F2LId) => selected.has(id), [selected]);

  const toggle = useCallback((id: F2LId) => {
    mutate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    mutate(() => new Set(F2L_IDS));
  }, []);

  const clear = useCallback(() => {
    mutate(() => new Set());
  }, []);

  const replace = useCallback((ids: Iterable<F2LId>) => {
    mutate(() => new Set(ids));
  }, []);

  return useMemo(
    () => ({ ready, selected, count: selected.size, isSelected, toggle, selectAll, clear, replace }),
    [ready, selected, isSelected, toggle, selectAll, clear, replace],
  );
}
