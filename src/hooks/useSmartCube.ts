'use client';

import { useSyncExternalStore } from 'react';
import * as cube from '@/lib/smart-cube-store';
import * as settings from '@/lib/smart-cube-settings-store';

/** The smart cube connection: status, battery, model and tracked state. */
export function useSmartCube() {
  return useSyncExternalStore(cube.subscribe, cube.getSnapshot, cube.getServerSnapshot);
}

/** Device-local smart cube preferences (holding, remembered MAC addresses). */
export function useSmartCubeSettings() {
  return useSyncExternalStore(settings.subscribe, settings.getSnapshot, settings.getServerSnapshot);
}
