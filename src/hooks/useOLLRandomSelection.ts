'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  mutate,
  subscribe,
} from '@/lib/oll-random-selection-store';
import { useMounted } from '@/hooks/useMounted';
import { OLL_IDS, type OLLId } from '@/types/oll';

export interface UseOLLRandomSelectionResult {
  ready: boolean;
  selected: Set<OLLId>;
  count: number;
  isSelected: (id: OLLId) => boolean;
  toggle: (id: OLLId) => void;
  selectAll: () => void;
  clear: () => void;
  // Replace the whole selection (used to load a saved set).
  replace: (ids: Iterable<OLLId>) => void;
}

export function useOLLRandomSelection(): UseOLLRandomSelectionResult {
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Store snapshots differ between server and client, so `ready` must flip
  // only after hydration (a `typeof window` check would mismatch the SSR markup).
  const ready = useMounted();

  const isSelected = useCallback((id: OLLId) => selected.has(id), [selected]);

  const toggle = useCallback((id: OLLId) => {
    mutate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    mutate(() => new Set(OLL_IDS));
  }, []);

  const clear = useCallback(() => {
    mutate(() => new Set());
  }, []);

  const replace = useCallback((ids: Iterable<OLLId>) => {
    mutate(() => new Set(ids));
  }, []);

  return useMemo(
    () => ({ ready, selected, count: selected.size, isSelected, toggle, selectAll, clear, replace }),
    [ready, selected, isSelected, toggle, selectAll, clear, replace],
  );
}
