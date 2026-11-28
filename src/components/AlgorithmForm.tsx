'use client';

import { useState, type FormEvent } from 'react';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { useT } from '@/hooks/useT';
import { buttonClass, INPUT, Segmented } from '@/components/ui';
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
    <form data-ui="AlgorithmForm" onSubmit={handleSubmit} className="space-y-2">
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="preset-picker"
            className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
          >
            {t('algForm.presets', { count: presets.length })}
          </label>
          <select
            id="preset-picker"
            onChange={handlePresetChange}
            defaultValue=""
            className={`${INPUT} flex-1 font-mono`}
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

      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <fieldset className="shrink-0">
          <legend className="sr-only">{t('algForm.startingOrientation')}</legend>
          <Segmented label={t('algForm.startingOrientationAuf')} value={auf} onChange={setAuf} mono
            options={AUFS.map((a) => ({ value: a, label: AUF_LABEL[a] }))} />
        </fieldset>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? t('algForm.placeholderPll')}
          className={`${INPUT} flex-1 font-mono`}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className={buttonClass('primary')}
          >
            {submitLabel ?? t('common.save')}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={buttonClass('secondary')}
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
