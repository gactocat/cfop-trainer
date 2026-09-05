'use client';

import { useF2LTrainerMode } from '@/hooks/useF2LTrainerMode';
import type { F2LTrainerMode } from '@/lib/f2l-trainer-mode-store';

const OPTIONS: { value: F2LTrainerMode; label: string; title: string }[] = [
  { value: 'standard', label: 'Standard', title: 'Pick a hidden case and start timing immediately' },
  {
    value: 'inverse',
    label: 'Inverse setup',
    title: 'Show a setup scramble first so you can bring your own cube into the case, then START to time',
  },
];

export function F2LTrainerModeToggle() {
  const { mode, setMode } = useF2LTrainerMode();
  return (
    <div
      role="radiogroup"
      aria-label="Random trainer mode"
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
            title={opt.title}
            onClick={() => setMode(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
