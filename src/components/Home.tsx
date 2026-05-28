'use client';

import { useSearchParams } from 'next/navigation';
import { ModeToggle } from './ModeToggle';
import { PllGrid, type PllGridMode } from './PllGrid';
import { RandomTrainer } from './RandomTrainer';

export function Home() {
  const searchParams = useSearchParams();
  const mode: PllGridMode = searchParams.get('mode') === 'random' ? 'random' : 'all';

  return (
    <div className="space-y-6">
      <ModeToggle current={mode} basePath="/pll" allLabel="All PLLs" />
      {mode === 'random' && <RandomTrainer />}
      <PllGrid mode={mode} />
    </div>
  );
}
