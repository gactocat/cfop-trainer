'use client';

import { useSearchParams } from 'next/navigation';
import { ModeToggle } from './ModeToggle';
import { F2LGrid, type F2LGridMode } from './F2LGrid';
import { F2LRandomTrainer } from './F2LRandomTrainer';

export function F2LHome() {
  const searchParams = useSearchParams();
  const mode: F2LGridMode = searchParams.get('mode') === 'random' ? 'random' : 'all';

  return (
    <div className="space-y-6">
      <ModeToggle current={mode} basePath="/f2l" allLabel="All F2Ls" />
      {mode === 'random' && <F2LRandomTrainer />}
      <F2LGrid mode={mode} />
    </div>
  );
}
