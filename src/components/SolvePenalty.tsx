'use client';

import { useT } from '@/hooks/useT';
import { saveSolve } from '@/lib/solve-store';
import { withPenalty, type Penalty, type SolveRecord } from '@/lib/solve/solve-record';
import { formatRecordTime, formatSolveTime } from '@/lib/solve/solve-stats';
import { buttonClass } from './ui';

/** A solve's time with its penalty ("8.90+", "DNF"), and under a DNF the time it would have been. */
export function RecordTime({ record, className = '', small = 'text-[11px]' }: { record: SolveRecord; className?: string; small?: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className={className}>{formatRecordTime(record)}</span>
      {record.penalty === 'dnf' && (
        <span className={`mt-1 font-mono tabular-nums text-zinc-500 dark:text-zinc-400 ${small}`}>({formatSolveTime(record.ms)})</span>
      )}
    </span>
  );
}

// +2 and DNF, each set or taken off with a tap (one at a time). Cube data
// stays as it is either way.
export function PenaltyButtons({ record }: { record: SolveRecord }) {
  const { t } = useT();
  const toggle = (penalty: Penalty) => {
    void saveSolve(withPenalty(record, record.penalty === penalty ? null : penalty)).catch(() => {});
  };
  const button = (penalty: Penalty, label: string, aria: string) => {
    const on = record.penalty === penalty;
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={aria}
        title={aria}
        onClick={() => toggle(penalty)}
        className={`${buttonClass(on ? 'pressed' : 'secondary', 'sm')} font-mono tabular-nums`}
      >
        {label}
      </button>
    );
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      {button('plus2', '+2', t('solve.penalty.plus2Aria'))}
      {button('dnf', 'DNF', t('solve.penalty.dnfAria'))}
    </span>
  );
}
