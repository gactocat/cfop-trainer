import { notFound } from 'next/navigation';
import { ModeSolve } from '@/components/ModeSolve';
import { modeOfSlug, SOLVE_MODE, SOLVE_MODES } from '@/lib/solve/solve-modes';

// One page per kind of solve (/solve/cfop, /solve/cross, /solve/f2l,
// /solve/ll), all prerendered, the iOS export included.
export function generateStaticParams() {
  return SOLVE_MODES.map((mode) => ({ mode: SOLVE_MODE[mode].slug }));
}

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ mode: string }>;
}

export default async function SolvePage({ params }: PageProps) {
  const mode = modeOfSlug((await params).mode);
  if (!mode) notFound();
  return <ModeSolve mode={mode} />;
}
