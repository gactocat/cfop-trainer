'use client';

import { useState } from 'react';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import { F2LGrid } from './F2LGrid';
import { F2LRandomTrainer } from './F2LRandomTrainer';
import { FullScreenModal } from './FullScreenModal';
import { ShuffleIcon } from './ShuffleIcon';

export function F2LHome() {
  const [training, setTraining] = useState(false);
  const { t } = useT();
  const { settings: { trainerMode: mode } } = usePracticeSettings();

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
        info={mode === 'inverse'
          ? `${t('trainer.hint.varied')} — ${t('trainer.hint.f2lSolvedEnough')}`
          : t('trainer.f2l.hidden')}
        title={t('trainer.f2lTitle')}
      >
        <F2LRandomTrainer />
      </FullScreenModal>
    </div>
  );
}
