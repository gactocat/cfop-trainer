'use client';

import { useState, type FormEvent } from 'react';
import { F2L_PRESET_ALGORITHMS } from '@/data/f2l-preset-algorithms';
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
  submitLabel = 'Save',
  placeholder = "e.g. R U R' U' R U' R'",
  onSubmit,
  onCancel,
}: F2LAlgorithmFormProps) {
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
            className="text-xs text-zinc-500 shrink-0"
          >
            Presets ({presets.length}):
          </label>
          <select
            id="f2l-preset-picker"
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
          <legend className="sr-only">Starting orientation</legend>
          <div
            role="radiogroup"
            aria-label="Starting orientation (AUF)"
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
          placeholder={placeholder}
          className="flex-1 min-w-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 font-medium"
          >
            {submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 text-sm px-4 py-2 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
