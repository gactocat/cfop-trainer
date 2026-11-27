import { notFound } from 'next/navigation';
import { CasePracticePage } from '@/components/CasePracticePage';
import { PLL_IDS, type PllId } from '@/types/pll';

// The practice of one of a case's algorithms (named in the query, see
// lib/practice-pages.ts), one page per case, all prerendered.
export function generateStaticParams() {
  return PLL_IDS.map((id) => ({ id }));
}

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PllPracticePage({ params }: PageProps) {
  const { id } = await params;
  if (!PLL_IDS.includes(id as PllId)) notFound();
  return <CasePracticePage practice="pll" caseId={id} />;
}
