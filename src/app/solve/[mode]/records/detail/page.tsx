import { notFound } from 'next/navigation';
import { SolveRecordPage } from '@/components/SolveRecordPage';
import { modeOfSlug } from '@/lib/solve/solve-modes';

// One solve of a kind's records: /solve/cfop/records/detail?id=<record id>.
export default async function SolveRecordDetailPage({ params }: { params: Promise<{ mode: string }> }) {
  const mode = modeOfSlug((await params).mode);
  if (!mode) notFound();
  return <SolveRecordPage mode={mode} />;
}
