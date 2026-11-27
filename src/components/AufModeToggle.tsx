'use client';

import { useMounted } from '@/hooks/useMounted';
import { useAufDisplay } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { AufDisplay } from '@/lib/practice-settings-store';
import type { Practice } from '@/types/practice';
import { InfoTip } from './InfoTip';
import { ChoiceHelp, Segmented } from './ui';

const OPTIONS: { value: AufDisplay; label: MessageKey; title: MessageKey; help: MessageKey }[] = [
  { value: 'cube', label: 'settings.aufDisplay.onCube', title: 'settings.aufDisplay.onCubeTitle', help: 'settings.aufDisplay.onCubeHelp' },
  { value: 'prefix', label: 'settings.aufDisplay.inAlgorithm', title: 'settings.aufDisplay.inAlgorithmTitle', help: 'settings.aufDisplay.inAlgorithmHelp' },
];

// One list's AUF display, shown while selecting its cases.
export function AufModeToggle({ practice }: { practice: Practice }) {
  const { aufDisplay, setAufDisplay } = useAufDisplay(practice);
  const { t } = useT();
  const mounted = useMounted();
  return (
    <Segmented
      label={t('settings.aufDisplay.aria')}
      value={mounted ? aufDisplay : null}
      onChange={setAufDisplay}
      options={OPTIONS.map((option) => ({ value: option.value, label: t(option.label), title: t(option.title) }))}
    />
  );
}

// The AUF display setting as a list's selection tools show it: its name,
// what the choices mean, and the choice.
export function AufDisplaySetting({ practice, className = '' }: { practice: Practice; className?: string }) {
  const { t } = useT();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1 text-sm font-medium">
        {t('settings.aufDisplay.title')}
        <InfoTip>
          <span className="block">{t('settings.aufDisplay.help')}</span>
          <ChoiceHelp items={OPTIONS.map((option) => ({ label: t(option.label), text: t(option.help) }))} />
          <span className="block">{t('settings.aufDisplay.scope')}</span>
        </InfoTip>
      </span>
      <AufModeToggle practice={practice} />
    </div>
  );
}
