'use client';

import { useLastLayerSettings } from '@/hooks/useLastLayerSettings';
import { useT } from '@/hooks/useT';
import type { LastLayerPractice } from '@/lib/last-layer-settings-store';

const buttonClass = (active: boolean) => `px-2.5 py-1 text-xs font-medium rounded transition-colors ${
  active ? 'bg-emerald-600 text-white' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
}`;

export function LastLayerSettings({ practice }: { practice: LastLayerPractice }) {
  const { t } = useT();
  const { settings, update } = useLastLayerSettings(practice);
  const kind = practice.toUpperCase();
  return (
    <section className="space-y-3" aria-label={t('settings.lastLayer.title', { kind })}>
      <h3 className="text-sm font-medium">{t('settings.lastLayer.title', { kind })}</h3>
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">{t('settings.lastLayer.aufDescription')}</p>
        <div role="radiogroup" aria-label={t('settings.lastLayer.aufAria', { kind })} className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5">
          {(['cube', 'prefix'] as const).map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={settings.aufDisplay === mode}
              onClick={() => update({ aufDisplay: mode })} className={buttonClass(settings.aufDisplay === mode)}>
              {t(mode === 'cube' ? 'settings.aufDisplay.onCube' : 'settings.aufDisplay.inAlgorithm')}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{t(settings.aufDisplay === 'cube' ? 'settings.aufDisplay.onCubeHelp' : 'settings.aufDisplay.inAlgorithmHelp')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">{t('settings.trainerMode.description')}</p>
        <div role="radiogroup" aria-label={t('settings.lastLayer.modeAria', { kind })} className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5">
          {(['standard', 'inverse'] as const).map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={settings.trainerMode === mode}
              onClick={() => update({ trainerMode: mode })} className={buttonClass(settings.trainerMode === mode)}>
              {t(mode === 'standard' ? 'settings.trainerMode.standard' : 'settings.trainerMode.inverse')}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{t(settings.trainerMode === 'standard' ? 'settings.trainerMode.standardHelp' : 'settings.lastLayer.inverseHelp')}</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none">
        <input type="checkbox" checked={settings.randomAuf} onChange={(e) => update({ randomAuf: e.target.checked })} className="h-3.5 w-3.5 accent-emerald-600" />
        {t('settings.trainerMode.randomAuf')}
      </label>
    </section>
  );
}
