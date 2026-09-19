'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { FullScreenModal } from './FullScreenModal';
import { OLLGrid } from './OLLGrid';
import { OLLRandomTrainer } from './OLLRandomTrainer';
import { ShuffleIcon } from './ShuffleIcon';

export function OLLHome() {
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

      <OLLGrid />

      <FullScreenModal
        open={training}
        onClose={() => setTraining(false)}
        title={t('trainer.ollTitle')}
      >
        <OLLRandomTrainer />
      </FullScreenModal>
    </div>
  );
}
