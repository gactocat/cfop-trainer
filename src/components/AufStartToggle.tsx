'use client';

import { useMounted } from '@/hooks/useMounted';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { aufStartOf, aufStartPatch, type AufStart } from '@/lib/auf-start';
import { ChoiceHelp, Segmented } from './ui';

export const AUF_START_LABEL: Record<AufStart, MessageKey> = {
  'pre-applied': 'practice.auf.preApplied',
  'in-algorithm': 'practice.auf.inAlgorithm',
  random: 'practice.auf.random',
};
const HELP: Record<AufStart, MessageKey> = {
  'pre-applied': 'practice.auf.preAppliedHelp',
  'in-algorithm': 'practice.auf.inAlgorithmHelp',
  random: 'practice.auf.randomHelp',
};
const OPTIONS: AufStart[] = ['pre-applied', 'in-algorithm', 'random'];

/** What each choice of how a case is turned before it is shown means, for the setting's (i). */
export function AufStartHelp() {
  const { t } = useT();
  return <ChoiceHelp items={OPTIONS.map((option) => ({ label: t(AUF_START_LABEL[option]), text: t(HELP[option]) }))} />;
}

// How each case is turned before it is shown (see AufStart).
export function AufStartToggle() {
  const { settings, update } = usePracticeSettings();
  const { t } = useT();
  const mounted = useMounted();
  return (
    <Segmented
      label={t('practice.auf.title')}
      value={mounted ? aufStartOf(settings) : null}
      onChange={(option) => update(aufStartPatch(option))}
      options={OPTIONS.map((option) => ({ value: option, label: t(AUF_START_LABEL[option]) }))}
    />
  );
}
