'use client';

import { useSyncExternalStore } from 'react';
import { scrambleFeed, type ScrambleSpec } from '@/lib/solve/scramble-client';

const CFOP: ScrambleSpec = { mode: 'cfop' };

/**
 * The scramble on screen for a kind of solve (CFOP unless given; null while
 * it is being made) and the way to the next one. For f2l and ll, `face` is
 * where the scramble leaves the cross (scrambleCrossFace).
 */
export function useScramble(spec: ScrambleSpec = CFOP) {
  const feed = scrambleFeed(spec);
  const snapshot = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getServerSnapshot);
  return { ...snapshot, next: feed.next };
}
