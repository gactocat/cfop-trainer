import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CasePracticePage } from '@/components/CasePracticePage';
import { PracticeShell } from '@/components/ScreenShells';
import { F2L_IDS, type F2LId } from '@/types/f2l';

// The practice of one of a case's algorithms (named in the query, see
// lib/practice-pages.ts), one page per case, all prerendered, and its
// session page under it; the practice is the layout's, so it stays as it is
// behind that page (see KeptScreen).
export function generateStaticParams() {
  return F2L_IDS.map((id) => ({ id }));
}

export const dynamicParams = false;

export default async function F2LPracticeLayout({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  const { id } = await params;
  if (!F2L_IDS.includes(id as F2LId)) notFound();
  return <PracticeShell scope="case" screen={<CasePracticePage practice="f2l" caseId={id} />}>{children}</PracticeShell>;
}
