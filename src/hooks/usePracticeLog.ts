'use client';

import { useState, useSyncExternalStore } from 'react';
import { usePracticeSession } from '@/components/KeptScreen';
import { PracticeLog } from '@/lib/practice-log';

/**
 * This practice session's solves; see PracticeLog. The practice's layout
 * keeps it (KeptScreen), so its session page shows it and going there and
 * back keeps it; a trainer outside one keeps its own.
 */
export function usePracticeLog() {
  const session = usePracticeSession();
  const [own] = useState(() => (session ? null : new PracticeLog()));
  const log = session?.log ?? own!;
  const snapshot = useSyncExternalStore(log.subscribe, log.getSnapshot, log.getSnapshot);
  return { log, ...snapshot };
}
