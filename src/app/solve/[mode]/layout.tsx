import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SolveShell } from '@/components/ScreenShells';
import { modeOfSlug, SOLVE_MODE, SOLVE_MODES } from '@/lib/solve/solve-modes';

// One kind of solve (/solve/cfop, /solve/cross, /solve/f2l, /solve/ll) and
// the pages under it (its records, one solve of them), all prerendered, the
// iOS export included. The solve is the layout's, so it stays as it is
// behind those pages (see KeptScreen).
export function generateStaticParams() {
  return SOLVE_MODES.map((mode) => ({ mode: SOLVE_MODE[mode].slug }));
}

export const dynamicParams = false;

export default async function SolveLayout({ params, children }: { params: Promise<{ mode: string }>; children: ReactNode }) {
  const mode = modeOfSlug((await params).mode);
  if (!mode) notFound();
  return <SolveShell mode={mode}>{children}</SolveShell>;
}
