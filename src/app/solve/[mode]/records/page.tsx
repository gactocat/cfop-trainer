import { notFound } from 'next/navigation';
import { SolveRecords } from '@/components/SolveRecords';
import { modeOfSlug } from '@/lib/solve/solve-modes';

// A kind of solve's records: /solve/cfop/records.
export default async function SolveRecordsPage({ params }: { params: Promise<{ mode: string }> }) {
  const mode = modeOfSlug((await params).mode);
  if (!mode) notFound();
  return <SolveRecords mode={mode} className="mx-auto w-full max-w-2xl" />;
}
