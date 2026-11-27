'use client';

import { useState, type FormEvent } from 'react';
import { F2L_PRESET_ALGORITHMS } from '@/data/f2l-preset-algorithms';
import { useT } from '@/hooks/useT';
import { buttonClass, INPUT, Segmented } from '@/components/ui';
import { splitF2LAuf } from '@/lib/f2l-auf';
import type { F2LId } from '@/types/f2l';
import { AUFS, type Auf } from '@/types/pll';

interface F2LAlgorithmFormProps {
  f2lId?: F2LId;
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

export function F2LAlgorithmForm({
  f2lId,
  initialValue = '',
  initialAuf = 'U0',
  submitLabel,
  placeholder,
  onSubmit,
  onCancel,
}: F2LAlgorithmFormProps) {
  const { t } = useT();
  const [value, setValue] = useState(initialValue);
  const [auf, setAuf] = useState<Auf>(initialAuf);
  const presets = f2lId ? F2L_PRESET_ALGORITHMS[f2lId] : undefined;

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
      const { auf: parsedAuf, rest } = splitF2LAuf(v);
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
            htmlFor="f2l-preset-picker"
            className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
          >
            {t('algForm.presets', { count: presets.length })}
          </label>
          <select
            id="f2l-preset-picker"
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
          placeholder={placeholder ?? t('algForm.placeholderF2l')}
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
