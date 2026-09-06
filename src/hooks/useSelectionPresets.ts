'use client';

import { useSyncExternalStore } from 'react';
import type { SelectionPreset, SelectionPresetsStore } from '@/lib/selection-presets-store';

export interface UseSelectionPresetsResult<Id extends string> {
  presets: SelectionPreset<Id>[];
  save: (name: string, ids: Iterable<Id>) => SelectionPreset<Id>;
  remove: (presetId: string) => void;
}

export function useSelectionPresets<Id extends string>(
  store: SelectionPresetsStore<Id>,
): UseSelectionPresetsResult<Id> {
  const presets = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { presets, save: store.save, remove: store.remove };
}
