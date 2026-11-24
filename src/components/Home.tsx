'use client';

import { useState } from 'react';
import { useTrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { FullScreenModal } from './FullScreenModal';
import { PracticeSession } from './PracticeSession';
import { PllGrid } from './PllGrid';
import { RandomTrainer } from './RandomTrainer';

export function Home() {
  const [training, setTraining] = useState(false);
  const { t } = useT();
  const mode = useTrainerMode();

  return (
    <div className="space-y-6">
      <PllGrid onRandom={() => setTraining(true)} />

      <FullScreenModal
        open={training}
        onClose={() => setTraining(false)}
        title={t('trainer.pllTitle')}
        info={<>
          <span className="block">{t(mode === 'no-scramble' ? 'trainer.hint.noScramble' : mode === 'inverse' || mode === 'smart-setup' ? 'trainer.hint.lastLayerSolved' : 'trainer.pll.hidden')}</span>
          <span className="block">{t('trainer.hint.selection')}</span>
        </>}
      >
        <PracticeSession>
          <RandomTrainer />
        </PracticeSession>
      </FullScreenModal>
    </div>
  );
}
