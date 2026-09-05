'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/pll-random-selection-store';
import { useMounted } from '@/hooks/useMounted';
import { PLL_IDS, type PllId } from '@/types/pll';

export interface UsePllRandomSelectionResult {
  ready: boolean;
  selected: Set<PllId>;
  count: number;
  isSelected: (id: PllId) => boolean;
  toggle: (id: PllId) => void;
  selectAll: () => void;
  clear: () => void;
}

export function usePllRandomSelection(): UsePllRandomSelectionResult {
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Store snapshots differ between server and client, so `ready` must flip
  // only after hydration (a `typeof window` check would mismatch the SSR markup).
  const ready = useMounted();

  const isSelected = useCallback((id: PllId) => selected.has(id), [selected]);

  const toggle = useCallback((id: PllId) => {
    mutate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    mutate(() => new Set(PLL_IDS));
  }, []);

  const clear = useCallback(() => {
    mutate(() => new Set());
  }, []);

  return useMemo(
    () => ({ ready, selected, count: selected.size, isSelected, toggle, selectAll, clear }),
    [ready, selected, isSelected, toggle, selectAll, clear],
  );
}
