'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// `false` during SSR and the hydration render, `true` once the component is
// running on the client. Replaces the `useEffect(() => setMounted(true), [])`
// pattern, which the react-hooks/set-state-in-effect lint rule rejects.
// Implemented with useSyncExternalStore so React swaps the server snapshot for
// the client one in the same commit that hydrates, with no extra effect pass.
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
