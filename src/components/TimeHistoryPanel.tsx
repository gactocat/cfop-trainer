'use client';

import { useState, type FormEvent } from 'react';
import { useT } from '@/hooks/useT';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import type { TimeRecord } from '@/types/pll';
import { Figure } from './Figure';
import { buttonClass, CloseIcon, iconButtonClass, INPUT } from './ui';

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
    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
      <dl className="grid grid-cols-2 gap-2">
        <Figure label={t('common.best')} value={formatSeconds(best)} />
        <Figure label={t('common.ao5')} value={formatSeconds(ao5)} />
      </dl>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('times.placeholder')}
          className={`${INPUT} flex-1 font-mono`}
        />
        <button
          type="submit"
          className={buttonClass('primary')}
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
              className="flex items-center justify-between py-0.5 gap-2"
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
                className={iconButtonClass('ghost', false, 'sm')}
                aria-label={t('times.deleteEntry')}
                title={t('times.deleteEntry')}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
