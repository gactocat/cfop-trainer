'use client';

import { useMounted } from '@/hooks/useMounted';
import { choosePracticeMode, usePracticeMode, type PracticeMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { Segmented } from './ui';

export const PRACTICE_MODE_OPTIONS: { value: PracticeMode; label: MessageKey; title: MessageKey }[] = [
  { value: 'setup', label: 'practice.mode.on', title: 'practice.mode.withSetupTitle' },
  { value: 'no-setup', label: 'practice.mode.off', title: 'practice.mode.noSetupTitle' },
];

export function TrainerModeToggle() {
  const mode = usePracticeMode();
  const { t } = useT();
  const mounted = useMounted();
  return (
    <Segmented
      label={t('practice.mode.title')}
      value={mounted ? mode : null}
      onChange={choosePracticeMode}
      options={PRACTICE_MODE_OPTIONS.map((option) => ({ value: option.value, label: t(option.label), title: t(option.title) }))}
    />
  );
}
