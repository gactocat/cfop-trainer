'use client';

import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';

export function RandomAufToggle() {
  const { settings, update } = usePracticeSettings();
  const { t } = useT();
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none">
      <input
        type="checkbox"
        checked={settings.randomAuf}
        onChange={(e) => update({ randomAuf: e.target.checked })}
        className="h-3.5 w-3.5 accent-emerald-600"
      />
      {t('settings.trainerMode.randomAuf')}
    </label>
  );
}
