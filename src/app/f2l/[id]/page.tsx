import { notFound } from 'next/navigation';
import { F2LDetail } from '@/components/F2LDetail';
import { F2L_IDS, type F2LId } from '@/types/f2l';

export function generateStaticParams() {
  return F2L_IDS.map((id) => ({ id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function F2LDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!F2L_IDS.includes(id as F2LId)) {
    notFound();
  }
  return <F2LDetail f2lId={id as F2LId} />;
}
