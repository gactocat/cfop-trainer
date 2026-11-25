'use client';

import type { ReactNode } from 'react';
import { useAufDisplay } from '@/hooks/usePracticeSettings';
import { useTrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { prefixAuf } from '@/lib/f2l-auf';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import type { Auf } from '@/types/pll';
import { FullScreenModal } from './FullScreenModal';
import { PracticeSession } from './PracticeSession';

// Practice of one algorithm, opened from its case page: the same options and
// trainer as random practice, with the case fixed and the times recorded to
// the algorithm.
export function CasePracticeModal({ practice, name, algorithm, onClose, children }: {
  practice: TrainerPractice;
  name: string;
  /** The algorithm practised; null keeps the modal closed. */
  algorithm: { auf: Auf; algorithm: string } | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const mode = useTrainerMode();
  const { aufDisplay } = useAufDisplay(practice);
  const hint = mode === 'no-scramble'
    ? 'trainer.hint.noScramble'
    : mode === 'inverse' || mode === 'smart-setup'
      ? practice === 'f2l' ? 'trainer.hint.f2lSetup' : 'trainer.hint.lastLayerSolved'
      : 'trainer.hint.case';
  return (
    <FullScreenModal
      open={algorithm !== null}
      onClose={onClose}
      title={t('casePractice.title', { name })}
      info={<span className="block">{t(hint)}</span>}
    >
      {algorithm && (
        <PracticeSession
          scope="case"
          subject={
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-medium">{name}</span>
              <span className="mx-1.5 text-zinc-400" aria-hidden>·</span>
              {/* The AUF as the algorithm rows show it. */}
              <span className="font-mono break-words">
                {aufDisplay === 'prefix' ? prefixAuf(algorithm.auf, algorithm.algorithm) : <>
                  <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-center align-middle">
                    {algorithm.auf}
                  </span>
                  {algorithm.algorithm}
                </>}
              </span>
            </p>
          }
        >
          {children}
        </PracticeSession>
      )}
    </FullScreenModal>
  );
}
