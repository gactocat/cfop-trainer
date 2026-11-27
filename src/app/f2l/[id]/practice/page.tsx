import { notFound } from 'next/navigation';
import { CasePracticePage } from '@/components/CasePracticePage';
import { F2L_IDS, type F2LId } from '@/types/f2l';

// The practice of one of a case's algorithms (named in the query, see
// lib/practice-pages.ts), one page per case, all prerendered.
export function generateStaticParams() {
  return F2L_IDS.map((id) => ({ id }));
}

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function F2LPracticePage({ params }: PageProps) {
  const { id } = await params;
  if (!F2L_IDS.includes(id as F2LId)) notFound();
  return <CasePracticePage practice="f2l" caseId={id} />;
}
