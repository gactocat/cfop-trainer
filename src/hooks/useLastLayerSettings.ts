'use client';

import { useSyncExternalStore } from 'react';
import { lastLayerSettingsStores, type LastLayerPractice } from '@/lib/last-layer-settings-store';

export function useLastLayerSettings(practice: LastLayerPractice) {
  const store = lastLayerSettingsStores[practice];
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { settings, update: store.update };
}
