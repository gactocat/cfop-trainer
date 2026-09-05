'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSpacebar } from '@/hooks/useSpacebar';
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

type StopwatchState = 'idle' | 'running' | 'stopped';

function Stopwatch({ onRecord }: { onRecord: (seconds: number) => void }) {
  const { t } = useT();
  const [state, setState] = useState<StopwatchState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'running') return;
    const tick = () => {
      setElapsed((Date.now() - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [state]);

  const start = useCallback(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, []);
  const stop = useCallback(() => {
    setElapsed((Date.now() - startRef.current) / 1000);
    setState('stopped');
  }, []);
  const record = () => {
    if (elapsed > 0) onRecord(elapsed);
    setState('idle');
    setElapsed(0);
  };
  const discard = () => {
    setState('idle');
    setElapsed(0);
  };

  // Spacebar mirrors the tap action: idle → start, running → stop. Stopped
  // state is intentionally inert so a stray press doesn't lose a captured
  // time before the user picks Record / Discard.
  const onSpace = useCallback(() => {
    if (state === 'idle') start();
    else if (state === 'running') stop();
  }, [state, start, stop]);
  useSpacebar(onSpace);

  // Big tap-anywhere surface for idle/running. Stopped state shrinks the
  // surface and shows explicit Record/Discard buttons.
  const surfaceClasses =
    state === 'running'
      ? 'bg-rose-500 hover:bg-rose-600 text-white'
      : 'bg-emerald-500 hover:bg-emerald-600 text-white';

  if (state === 'stopped') {
    return (
      <div className="rounded-md border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center gap-4 select-none">
        <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
          {elapsed.toFixed(3)}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={record}
            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 font-semibold"
          >
            ✓ {t('common.record')}
          </button>
          <button
            type="button"
            onClick={discard}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✗ {t('common.discard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={state === 'idle' ? start : stop}
      className={`w-full min-h-[220px] rounded-md flex flex-col items-center justify-center gap-3 transition-colors select-none touch-none ${surfaceClasses}`}
      aria-label={state === 'idle' ? t('stopwatch.tapToStartAria') : t('stopwatch.tapToStopAria')}
    >
      <div
        className="font-mono text-6xl sm:text-7xl font-bold tabular-nums leading-none"
        aria-live="polite"
      >
        {elapsed.toFixed(3)}
      </div>
      <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
        {state === 'idle' ? t('stopwatch.tapToStart') : t('stopwatch.tapToStop')}
      </div>
    </button>
  );
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

      <Stopwatch onRecord={onAdd} />

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
