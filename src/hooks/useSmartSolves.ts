'use client';

import { useEffect, useState } from 'react';
import type { SmartSolveRecord } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import { countSmartSolves, smartSolvesAvailable, smartSolvesFor, subscribeSmartSolves } from '@/lib/smart-solve-store';

/** Smart cube solves for one case, newest first; null until loaded (and on the server). */
export function useSmartSolves(practice: TrainerPractice, caseId: string): SmartSolveRecord[] | null {
  const key = `${practice}:${caseId}`;
  const [loaded, setLoaded] = useState<{ key: string; records: SmartSolveRecord[] } | null>(null);
  useEffect(() => {
    if (!smartSolvesAvailable()) return;
    let active = true;
    const load = () => {
      smartSolvesFor(practice, caseId)
        .then((records) => { if (active) setLoaded({ key, records }); })
        .catch(() => { if (active) setLoaded({ key, records: [] }); });
    };
    load();
    const unsubscribe = subscribeSmartSolves(load);
    return () => { active = false; unsubscribe(); };
  }, [practice, caseId, key]);
  return loaded?.key === key ? loaded.records : null;
}

/** Number of smart cube solves kept on this device; null until loaded. */
export function useSmartSolveCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!smartSolvesAvailable()) return;
    let active = true;
    const load = () => {
      countSmartSolves()
        .then((n) => { if (active) setCount(n); })
        .catch(() => { if (active) setCount(0); });
    };
    load();
    const unsubscribe = subscribeSmartSolves(load);
    return () => { active = false; unsubscribe(); };
  }, []);
  return count;
}
