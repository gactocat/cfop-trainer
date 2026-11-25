'use client';

import { useSyncExternalStore } from 'react';
import { getScrambleServerSnapshot, getScrambleSnapshot, nextScramble, subscribeScramble } from '@/lib/solve/scramble-client';

/** The random-state scramble on screen (null while it is being made) and the way to the next one. */
export function useScramble() {
  const snapshot = useSyncExternalStore(subscribeScramble, getScrambleSnapshot, getScrambleServerSnapshot);
  return { ...snapshot, next: nextScramble };
}
