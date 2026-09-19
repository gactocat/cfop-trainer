'use client';
import { useSyncExternalStore } from 'react';
import { getPersistenceServerSnapshot, getPersistenceSnapshot, subscribePersistence } from '@/lib/persistence';
export function usePersistence() {
  return useSyncExternalStore(subscribePersistence, getPersistenceSnapshot, getPersistenceServerSnapshot);
}
