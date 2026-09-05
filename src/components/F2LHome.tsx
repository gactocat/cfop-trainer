'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { F2LGrid } from './F2LGrid';
import { F2LRandomTrainer } from './F2LRandomTrainer';
import { FullScreenModal } from './FullScreenModal';
import { ShuffleIcon } from './ShuffleIcon';

export function F2LHome() {
  const [training, setTraining] = useState(false);
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setTraining(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 font-medium"
        >
          <ShuffleIcon />
          {t('common.randomTraining')}
        </button>
      </div>

      <F2LGrid />

      <FullScreenModal
        open={training}
        onClose={() => setTraining(false)}
        title={t('trainer.f2lTitle')}
      >
        <F2LRandomTrainer />
      </FullScreenModal>
    </div>
  );
}
