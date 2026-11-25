'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { clearHints, getHints, getServerHints, setHints, subscribeHints, type TestCubeHint } from '@/lib/test-cube-hints';
import { getServerSnapshot, getSnapshot, subscribe } from '@/lib/test-cube-store';

/** The test cube's controls: the sequence running and the grip. */
export function useTestCube() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useTestCubeHints(): readonly TestCubeHint[] {
  return useSyncExternalStore(subscribeHints, getHints, getServerHints);
}

/** Offer moves to the test cube while this screen shows them. */
export function useOfferTestCubeMoves(hints: readonly TestCubeHint[]) {
  const [owner] = useState(() => ({}));
  const key = JSON.stringify(hints);
  useEffect(() => {
    setHints(owner, JSON.parse(key) as TestCubeHint[]);
  }, [owner, key]);
  useEffect(() => () => clearHints(owner), [owner]);
}
