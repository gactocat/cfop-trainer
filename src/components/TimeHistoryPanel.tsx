'use client';

import { useState, type FormEvent } from 'react';
import { useT } from '@/hooks/useT';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import type { TimeRecord } from '@/types/pll';

interface TimeHistoryPanelProps {
  times: TimeRecord[];
  onAdd: (seconds: number) => void;
  onRemove: (timeId: string) => void;
}

function formatRecordedAt(iso: string, intl: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(intl, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function TimeHistoryPanel({
  times,
  onAdd,
  onRemove,
}: TimeHistoryPanelProps) {
  const { t, intl } = useT();
  const [input, setInput] = useState('');

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const seconds = Number.parseFloat(input);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    onAdd(seconds);
    setInput('');
  };

  const best = bestSeconds(times);
  const ao5 = averageOfN(times, 5);

  return (
    <div className="rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <Stat label={t('common.best')} value={formatSeconds(best)} accent="emerald" />
        <Stat label={t('common.ao5')} value={formatSeconds(ao5)} />
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('times.placeholder')}
          className="flex-1 min-w-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 font-medium"
        >
          {t('common.record')}
        </button>
      </form>

      {times.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-2">{t('times.none')}</p>
      ) : (
        <ul className="max-h-48 overflow-auto divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
          {times.map((rec) => (
            <li
              key={rec.id}
              className="flex items-center justify-between py-1.5 gap-2"
            >
              <span className="font-mono tabular-nums">
                {rec.seconds.toFixed(3)}
              </span>
              <span className="text-xs text-zinc-500">
                {formatRecordedAt(rec.recordedAt, intl)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(rec.id)}
                className="text-xs text-zinc-400 hover:text-rose-500"
                aria-label={t('times.deleteEntry')}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald';
}) {
  const valueColor = accent === 'emerald'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`font-mono text-base font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
