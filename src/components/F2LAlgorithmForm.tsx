'use client';

import { useState, type FormEvent } from 'react';
import { F2L_PRESET_ALGORITHMS } from '@/data/f2l-preset-algorithms';
import type { F2LId } from '@/types/f2l';

interface F2LAlgorithmFormProps {
  f2lId?: F2LId;
  initialValue?: string;
  submitLabel?: string;
  placeholder?: string;
  onSubmit: (algorithm: string) => void;
  onCancel?: () => void;
}

export function F2LAlgorithmForm({
  f2lId,
  initialValue = '',
  submitLabel = 'Save',
  placeholder = "e.g. R U R' U' R U' R'",
  onSubmit,
  onCancel,
}: F2LAlgorithmFormProps) {
  const [value, setValue] = useState(initialValue);
  const presets = f2lId ? F2L_PRESET_ALGORITHMS[f2lId] : undefined;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    if (!initialValue) {
      setValue('');
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v) {
      setValue(v);
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
