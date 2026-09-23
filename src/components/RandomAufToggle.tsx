'use client';

import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import { InfoTip } from './InfoTip';

export function RandomAufToggle() {
  const { settings, update } = usePracticeSettings();
  const { t } = useT();
  return (
    <div className="flex items-center gap-1">
    <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none">
      <input
        type="checkbox"
        checked={settings.randomAuf}
        onChange={(e) => update({ randomAuf: e.target.checked })}
        className="h-3.5 w-3.5 accent-emerald-600"
      />
      {t('settings.trainerMode.randomAufLabel')}
    </label>
    <InfoTip>{t('settings.trainerMode.randomAuf')}</InfoTip>
    </div>
  );
}
