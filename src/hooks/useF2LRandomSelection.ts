'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/f2l-random-selection-store';
import { F2L_IDS, type F2LId } from '@/types/f2l';

export interface UseF2LRandomSelectionResult {
  ready: boolean;
  selected: Set<F2LId>;
  count: number;
  isSelected: (id: F2LId) => boolean;
  toggle: (id: F2LId) => void;
  selectAll: () => void;
  clear: () => void;
}

export function useF2LRandomSelection(): UseF2LRandomSelectionResult {
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = typeof window !== 'undefined';

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

  return useMemo(
    () => ({ ready, selected, count: selected.size, isSelected, toggle, selectAll, clear }),
    [ready, selected, isSelected, toggle, selectAll, clear],
  );
}
