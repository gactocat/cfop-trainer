'use client';

import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import type { F2LAufDisplayMode } from '@/lib/f2l-auf-display-store';

const OPTIONS: { value: F2LAufDisplayMode; label: string; title: string }[] = [
  { value: 'cube', label: 'On cube', title: 'Show the AUF by rotating the displayed cube' },
  { value: 'prefix', label: 'In algorithm', title: 'Show the AUF as a leading turn in the algorithm' },
];

export function F2LAufModeToggle() {
  const { mode, setMode } = useF2LAufDisplay();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">AUF:</span>
      <div
        role="radiogroup"
        aria-label="How to show the AUF"
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
    </div>
  );
}
