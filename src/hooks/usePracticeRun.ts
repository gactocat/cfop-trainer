'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
import { getServerSnapshot, getSnapshot, setEachOnce, subscribe } from '@/lib/practice-options-store';

/** What a started practice runs with besides its flavor, and the way back to its options. */
export interface PracticeRun {
  /** Each selected case once, then the session's figures (random practice only). */
  eachOnce: boolean;
  /** Back to the practice options; the next start is a new session. */
  finish: () => void;
}

export const PracticeRunContext = createContext<PracticeRun>({ eachOnce: false, finish: () => {} });
export const usePracticeRun = () => useContext(PracticeRunContext);

/** The options kept on this device (see practice-options-store.ts). */
export function usePracticeOptions() {
  const options = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...options, setEachOnce };
}
