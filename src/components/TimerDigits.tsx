'use client';

import type { ReactNode } from 'react';
import type { TimerTone } from '@/lib/hold-timer';

const TONE: Record<TimerTone, string> = {
  held: 'text-rose-600 dark:text-rose-400',
  ready: 'text-emerald-600 dark:text-emerald-400',
  plain: 'text-zinc-900 dark:text-zinc-50',
};

// The big timer digits, the same wherever a timer runs (practice and
// solves): red while a press is held too briefly to start, green once
// letting go starts, plain while running and after.
export function TimerDigits({ tone = 'plain', className = '', children }: { tone?: TimerTone; className?: string; children: ReactNode }) {
  return (
    <div data-ui="TimerDigits" className={`font-mono text-6xl font-bold tabular-nums leading-none transition-colors sm:text-8xl ${TONE[tone]} ${className}`} aria-live="off">
      {children}
    </div>
  );
}
