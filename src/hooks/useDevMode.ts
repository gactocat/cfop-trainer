'use client';

import { useSyncExternalStore } from 'react';
import { usePersistence } from '@/hooks/usePersistence';
import { getDevModeServerSnapshot, getDevModeSnapshot, setDevModeEnabled, subscribeDevMode } from '@/lib/dev-mode/dev-mode-settings';
import { getDeveloperServerSnapshot, getDeveloperSnapshot, subscribeDeveloper } from '@/lib/dev-mode/developer-store';

/**
 * Developer mode: `developer` when the signed-in account is one (only then is
 * the setting shown), `active` when it is also turned on here; `known` once
 * the database has answered for the account (or there is no account).
 */
export function useDevMode() {
  const { userId, mode } = usePersistence();
  const answer = useSyncExternalStore(subscribeDeveloper, getDeveloperSnapshot, getDeveloperServerSnapshot);
  const enabled = useSyncExternalStore(subscribeDevMode, getDevModeSnapshot, getDevModeServerSnapshot);
  const signedIn = mode !== 'guest' && !!userId;
  const developer = signedIn && answer.userId === userId && answer.developer;
  const known = mode === 'guest' || (signedIn && answer.userId === userId);
  return { developer, known, enabled, active: developer && enabled, setEnabled: setDevModeEnabled };
}
