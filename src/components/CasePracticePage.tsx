'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useT } from '@/hooks/useT';
import { ALGORITHM_PARAM } from '@/lib/practice-pages';
import type { Practice } from '@/types/practice';
import { F2LCaseTrainer } from './F2LRandomTrainer';
import { OLLCaseTrainer } from './OLLRandomTrainer';
import { PllCaseTrainer } from './RandomTrainer';

/** The algorithm named in the query is not one of this case's (deleted, or a link from elsewhere). */
function Missing() {
  const { t } = useT();
  return <p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">{t('casePractice.missing')}</p>;
}

function useAlgorithmId() {
  return useSearchParams().get(ALGORITHM_PARAM);
}

function PllPractice({ caseId }: { caseId: string }) {
  const id = useAlgorithmId();
  const { ready, all } = useAlgorithms();
  const record = all.find((r) => r.id === id && r.pllId === caseId);
  if (!ready) return null;
  return record ? <PllCaseTrainer key={record.id} record={record} /> : <Missing />;
}

function OLLPractice({ caseId }: { caseId: string }) {
  const id = useAlgorithmId();
  const { ready, all } = useOLLAlgorithms();
  const record = all.find((r) => r.id === id && r.ollId === caseId);
  if (!ready) return null;
  return record ? <OLLCaseTrainer key={record.id} record={record} /> : <Missing />;
}

function F2LPractice({ caseId }: { caseId: string }) {
  const id = useAlgorithmId();
  const { ready, all } = useF2LAlgorithms();
  const record = all.find((r) => r.id === id && r.f2lId === caseId);
  if (!ready) return null;
  return record ? <F2LCaseTrainer key={record.id} record={record} /> : <Missing />;
}

// The practice of one algorithm, opened from its case page: the same
// screens as random practice with the case fixed, its times recorded to
// the algorithm. The algorithm comes from the query, which is only known
// in the browser, so the page is prerendered without it.
export function CasePracticePage({ practice, caseId }: { practice: Practice; caseId: string }) {
  return (
    <Suspense fallback={null}>
      {practice === 'pll' ? <PllPractice caseId={caseId} />
        : practice === 'oll' ? <OLLPractice caseId={caseId} />
          : <F2LPractice caseId={caseId} />}
    </Suspense>
  );
}
