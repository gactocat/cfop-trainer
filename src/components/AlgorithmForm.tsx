'use client';

import { useState, type FormEvent } from 'react';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { useT } from '@/hooks/useT';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { AUFS, type Auf, type PllId } from '@/types/pll';

interface AlgorithmFormProps {
  pllId?: PllId;
  initialValue?: string;
  initialAuf?: Auf;
  submitLabel?: string;
  placeholder?: string;
  onSubmit: (algorithm: string, auf: Auf) => void;
  onCancel?: () => void;
}

const AUF_LABEL: Record<Auf, string> = {
  U0: 'U0',
  U: 'U',
  U2: 'U2',
  "U'": "U'",
};

export function AlgorithmForm({
  pllId,
  initialValue = '',
  initialAuf = 'U0',
  submitLabel,
  placeholder,
  onSubmit,
  onCancel,
}: AlgorithmFormProps) {
  const { t } = useT();
  const [value, setValue] = useState(initialValue);
  const [auf, setAuf] = useState<Auf>(initialAuf);
  const presets = pllId ? PRESET_ALGORITHMS[pllId] : undefined;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed, auf);
    if (!initialValue) {
      setValue('');
      setAuf('U0');
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v) {
      const { auf: parsedAuf, rest } = splitAuf(v);
      setValue(rest);
      setAuf(parsedAuf);
    }
    e.target.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="preset-picker"
            className="text-xs text-zinc-500 shrink-0"
          >
            {t('algForm.presets', { count: presets.length })}
          </label>
          <select
            id="preset-picker"
            onChange={handlePresetChange}
            defaultValue=""
            className="flex-1 min-w-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-base sm:text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">—</option>
            {presets.map((alg, i) => (
              <option key={i} value={alg}>
                {`${i + 1}. ${alg}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-stretch">
        <fieldset className="shrink-0">
          <legend className="sr-only">{t('algForm.startingOrientation')}</legend>
          <div
            role="radiogroup"
            aria-label={t('algForm.startingOrientationAuf')}
            className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5 h-full"
          >
            {AUFS.map((a) => {
              const active = a === auf;
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAuf(a)}
                  className={`px-2 text-xs font-mono rounded transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {AUF_LABEL[a]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? t('algForm.placeholderPll')}
          className="flex-1 min-w-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 font-medium"
          >
            {submitLabel ?? t('common.save')}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 text-sm px-4 py-2 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
