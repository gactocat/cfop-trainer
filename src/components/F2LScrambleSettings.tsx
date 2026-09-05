'use client';

import { useF2LScrambleSettings } from '@/hooks/useF2LScrambleSettings';
import type { F2LScrambleStyle } from '@/lib/f2l-scramble';

const OPTIONS: { value: F2LScrambleStyle; label: string; title: string }[] = [
  {
    value: 'varied',
    label: 'Varied setup',
    title: 'A short setup picked at random from several routes to the case; it does not mirror your algorithm',
  },
  {
    value: 'inverse',
    label: 'Inverse algorithm',
    title: 'Your algorithm played backwards',
  },
];

export function F2LScrambleSettings() {
  const { settings, update } = useF2LScrambleSettings();
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Setup scramble style"
        className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === settings.style;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={opt.title}
              onClick={() => update({ style: opt.value })}
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
      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none">
        <input
          type="checkbox"
          checked={settings.randomAuf}
          onChange={(e) => update({ randomAuf: e.target.checked })}
          className="h-3.5 w-3.5 accent-emerald-600"
        />
        Add a random U turn so the case shows up in a random orientation
      </label>
    </div>
  );
}
