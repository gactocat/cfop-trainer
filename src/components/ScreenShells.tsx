'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ALGORITHM_PARAM, practicePageOf } from '@/lib/practice-pages';
import { solvePageOf } from '@/lib/solve/solve-pages';
import type { SolveMode } from '@/lib/solve/solve-modes';
import { KeptScreen } from './KeptScreen';
import { ModeSolve } from './ModeSolve';
import type { PracticeScope } from './PracticeSettings';

// The layouts' part in the browser: which screen stays behind which pages
// (see KeptScreen).

/** A kind of solve, kept behind its records and one solve of them. */
export function SolveShell({ mode, children }: { mode: SolveMode; children: ReactNode }) {
  const hidden = solvePageOf(usePathname() ?? '')?.kind !== 'solve';
  return <KeptScreen hidden={hidden} screen={<ModeSolve mode={mode} />}>{children}</KeptScreen>;
}

/** A case practice's session starts again with another algorithm (named in the query). */
function ByAlgorithm({ hidden, screen, children }: { hidden: boolean; screen: ReactNode; children: ReactNode }) {
  const algorithm = useSearchParams().get(ALGORITHM_PARAM) ?? '';
  return <KeptScreen key={algorithm} hidden={hidden} screen={screen} scope="case">{children}</KeptScreen>;
}

/** A practice, kept behind its session page, which shows its session. */
export function PracticeShell({ scope, screen, children }: { scope: PracticeScope; screen: ReactNode; children: ReactNode }) {
  const hidden = practicePageOf(usePathname() ?? '')?.session ?? false;
  if (scope === 'random') return <KeptScreen hidden={hidden} screen={screen} scope="random">{children}</KeptScreen>;
  return <Suspense fallback={null}><ByAlgorithm hidden={hidden} screen={screen}>{children}</ByAlgorithm></Suspense>;
}
