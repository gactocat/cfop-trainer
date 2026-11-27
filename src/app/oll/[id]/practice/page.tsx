import { notFound } from 'next/navigation';
import { CasePracticePage } from '@/components/CasePracticePage';
import { OLL_IDS, type OLLId } from '@/types/oll';

// The practice of one of a case's algorithms (named in the query, see
// lib/practice-pages.ts), one page per case, all prerendered.
export function generateStaticParams() {
  return OLL_IDS.map((id) => ({ id }));
}

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OLLPracticePage({ params }: PageProps) {
  const { id } = await params;
  if (!OLL_IDS.includes(id as OLLId)) notFound();
  return <CasePracticePage practice="oll" caseId={id} />;
}
