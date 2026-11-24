'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { PracticeLog } from '@/lib/practice-log';

/** This practice session's solves on a smart cube; see PracticeLog. */
export function usePracticeLog() {
  const [log] = useState(() => new PracticeLog());
  const snapshot = useSyncExternalStore(log.subscribe, log.getSnapshot, log.getSnapshot);
  useEffect(() => () => log.clearSettle(), [log]);
  return { log, ...snapshot };
}
