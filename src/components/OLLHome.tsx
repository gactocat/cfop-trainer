'use client';

import { useState } from 'react';
import { useTrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { FullScreenModal } from './FullScreenModal';
import { PracticeSession } from './PracticeSession';
import { OLLGrid } from './OLLGrid';
import { OLLRandomTrainer } from './OLLRandomTrainer';

export function OLLHome() {
  const [training, setTraining] = useState(false);
  const { t } = useT();
  const mode = useTrainerMode();

  return (
    <div className="space-y-6">
      <OLLGrid onRandom={() => setTraining(true)} />

      <FullScreenModal
        open={training}
        onClose={() => setTraining(false)}
        title={t('trainer.ollTitle')}
        info={<>
          <span className="block">{t(mode === 'no-scramble' ? 'trainer.hint.noScramble' : mode === 'inverse' || mode === 'smart-setup' ? 'trainer.hint.lastLayerSolved' : 'trainer.oll.hidden')}</span>
          <span className="block">{t('trainer.hint.selection')}</span>
        </>}
      >
        <PracticeSession>
          <OLLRandomTrainer />
        </PracticeSession>
      </FullScreenModal>
    </div>
  );
}
