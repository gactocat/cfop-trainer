'use client';

import { useState } from 'react';
import { useTrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { F2LGrid } from './F2LGrid';
import { F2LRandomTrainer } from './F2LRandomTrainer';
import { FullScreenModal } from './FullScreenModal';
import { PracticeSession } from './PracticeSession';

export function F2LHome() {
  const [training, setTraining] = useState(false);
  const { t } = useT();
  const mode = useTrainerMode();

  return (
    <div className="space-y-6">
      <F2LGrid onRandom={() => setTraining(true)} />

      <FullScreenModal
        open={training}
        onClose={() => setTraining(false)}
        title={t('trainer.f2lTitle')}
        info={<>
          <span className="block">{t(mode === 'no-scramble' ? 'trainer.hint.noScramble' : mode === 'inverse' || mode === 'smart-setup' ? 'trainer.hint.f2lSetup' : 'trainer.f2l.hidden')}</span>
          <span className="block">{t('trainer.hint.selection')}</span>
        </>}
      >
        <PracticeSession>
          <F2LRandomTrainer />
        </PracticeSession>
      </FullScreenModal>
    </div>
  );
}
