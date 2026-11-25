'use client';

import { useAufDisplay } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { AufDisplay } from '@/lib/practice-settings-store';
import type { Practice } from '@/types/practice';
import { InfoTip } from './InfoTip';

const OPTIONS: { value: AufDisplay; label: MessageKey; title: MessageKey }[] = [
  { value: 'cube', label: 'settings.aufDisplay.onCube', title: 'settings.aufDisplay.onCubeTitle' },
  {
    value: 'prefix',
    label: 'settings.aufDisplay.inAlgorithm',
    title: 'settings.aufDisplay.inAlgorithmTitle',
  },
];

// One list's AUF display, shown while selecting its cases.
export function AufModeToggle({ practice }: { practice: Practice }) {
  const { aufDisplay: mode, setAufDisplay } = useAufDisplay(practice);
  const { t } = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.aufDisplay.aria')}
      className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(opt.title)}
            onClick={() => setAufDisplay(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}

// "Label — explanation" line inside the setting's tooltip.
function Help({ label, text }: { label: MessageKey; text: MessageKey }) {
  const { t } = useT();
  return (
    <span className="block">
      <span className="font-medium text-zinc-800 dark:text-zinc-100">{t(label)}</span> — {t(text)}
    </span>
  );
}

// The AUF display setting as a list's selection tools show it: its name,
// what the choices mean, and the choice.
export function AufDisplaySetting({ practice, className = '' }: { practice: Practice; className?: string }) {
  const { t } = useT();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
        {t('settings.aufDisplay.title')}
        <InfoTip>
          <span className="block">{t('settings.aufDisplay.help')}</span>
          <Help label="settings.aufDisplay.onCube" text="settings.aufDisplay.onCubeHelp" />
          <Help label="settings.aufDisplay.inAlgorithm" text="settings.aufDisplay.inAlgorithmHelp" />
          <span className="block">{t('settings.aufDisplay.scope')}</span>
        </InfoTip>
      </span>
      <AufModeToggle practice={practice} />
    </div>
  );
}
