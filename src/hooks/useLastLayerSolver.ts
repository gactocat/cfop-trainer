'use client';

import { useSyncExternalStore } from 'react';
import {
  getLastLayerSolver,
  getServerLastLayerSolver,
  subscribeLastLayerSolver,
} from '@/lib/last-layer-alternatives';

// cubing.js's cube model, or null until it has loaded (and on the server).
export function useLastLayerSolver() {
  return useSyncExternalStore(subscribeLastLayerSolver, getLastLayerSolver, getServerLastLayerSolver);
}
