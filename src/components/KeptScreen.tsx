'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { PracticeLog } from '@/lib/practice-log';
import type { PracticeScope } from './PracticeSettings';

interface KeptScreenState {
  /** A page under the screen is open: the screen stays on, out of sight. */
  hidden: boolean;
  /** A practice's session, shared with its session page. */
  session: { log: PracticeLog; scope: PracticeScope } | null;
}

const KeptScreenContext = createContext<KeptScreenState>({ hidden: false, session: null });

/** Whether the screen is behind a page of its own (its records, its session). */
export const useScreenHidden = () => useContext(KeptScreenContext).hidden;

/** The practice's session kept by its layout, when there is one. */
export const usePracticeSession = () => useContext(KeptScreenContext).session;

/**
 * A screen kept on while the pages under it are open: a solve behind its
 * records and one solve of them, a practice behind its session. The pages
 * are routes of their own (with the header's back button and title), but
 * the screen is their layout's, so it is not unmounted: going back finds
 * the scramble, the result, the case and the session as they were left, and
 * a smart cube stays connected. While a page is open the screen is hidden,
 * and the page is marked as an overlay, which holds the screen's timers,
 * keys and cube starts back as a dialog does.
 */
export function KeptScreen({ hidden, screen, children, scope }: {
  hidden: boolean;
  screen: ReactNode;
  children: ReactNode;
  /** A practice: its session's solves, which its session page shows. */
  scope?: PracticeScope;
}) {
  const [log] = useState(() => (scope ? new PracticeLog() : null));
  const value = { hidden, session: log && scope ? { log, scope } : null };
  return (
    <KeptScreenContext.Provider value={value}>
      <div className={hidden ? 'hidden' : 'contents'}>{screen}</div>
      {hidden ? <div data-app-overlay className="contents">{children}</div> : children}
    </KeptScreenContext.Provider>
  );
}
