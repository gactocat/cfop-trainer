'use client';

import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { aufStartOf, aufStartPatch, type AufStart } from '@/lib/auf-start';
import { InfoTip } from './InfoTip';

export const AUF_START_LABEL: Record<AufStart, MessageKey> = {
  fixed: 'practice.auf.fixed',
  random: 'practice.auf.random',
  algorithm: 'practice.auf.algorithm',
};
const HELP: Record<AufStart, MessageKey> = {
  fixed: 'practice.auf.fixedHelp',
  random: 'practice.auf.randomHelp',
  algorithm: 'practice.auf.algorithmHelp',
};
const OPTIONS: AufStart[] = ['fixed', 'random', 'algorithm'];

// How each case is turned before it is shown (see AufStart).
export function AufStartToggle() {
  const { settings, update } = usePracticeSettings();
  const { t } = useT();
  const current = aufStartOf(settings);
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1 text-sm font-medium">
        {t('practice.auf.title')}
        <InfoTip>
          {OPTIONS.map((option) => (
            <span key={option} className="block">
              <span className="font-medium text-zinc-800 dark:text-zinc-100">{t(AUF_START_LABEL[option])}</span> — {t(HELP[option])}
            </span>
          ))}
        </InfoTip>
      </h4>
      <div role="radiogroup" aria-label={t('practice.auf.title')} className="inline-flex flex-wrap rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5">
        {OPTIONS.map((option) => {
          const active = option === current;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update(aufStartPatch(option))}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t(AUF_START_LABEL[option])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
