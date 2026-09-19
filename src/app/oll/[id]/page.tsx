import { notFound } from 'next/navigation';
import { OLLDetail } from '@/components/OLLDetail';
import { OLL_IDS, type OLLId } from '@/types/oll';

export function generateStaticParams() {
  return OLL_IDS.map((id) => ({ id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OLLDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!OLL_IDS.includes(id as OLLId)) {
    notFound();
  }
  return <OLLDetail ollId={id as OLLId} />;
}
