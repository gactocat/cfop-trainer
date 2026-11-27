'use client';

import { useSyncExternalStore } from 'react';
import { useT } from '@/hooks/useT';
import { usePracticeSession } from './KeptScreen';
import { SessionStats } from './SessionStats';

// A practice's session, a page under it (/pll/random/session): this
// session's figures and each case's, read from the practice kept behind it
// (KeptScreen). Random practice keeps them for the session only; a case's
// practice also records its times to the algorithm.
export function PracticeSessionPage() {
  const { t } = useT();
  const session = usePracticeSession();
  const log = session?.log;
  const snapshot = useSyncExternalStore(
    (listener) => log?.subscribe(listener) ?? (() => {}),
    () => log?.getSnapshot() ?? null,
    () => null,
  );
  return (
    <SessionStats
      results={snapshot?.results ?? []}
      note={session?.scope === 'random' ? t('trainer.session.notKept') : undefined}
      heading={false}
      className="mx-auto max-w-2xl"
    />
  );
}
