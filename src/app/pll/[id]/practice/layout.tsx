import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CasePracticePage } from '@/components/CasePracticePage';
import { PracticeShell } from '@/components/ScreenShells';
import { PLL_IDS, type PllId } from '@/types/pll';

// The practice of one of a case's algorithms (named in the query, see
// lib/practice-pages.ts), one page per case, all prerendered, and its
// session page under it; the practice is the layout's, so it stays as it is
// behind that page (see KeptScreen).
export function generateStaticParams() {
  return PLL_IDS.map((id) => ({ id }));
}

export const dynamicParams = false;

export default async function PllPracticeLayout({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  const { id } = await params;
  if (!PLL_IDS.includes(id as PllId)) notFound();
  return <PracticeShell scope="case" screen={<CasePracticePage practice="pll" caseId={id} />}>{children}</PracticeShell>;
}
