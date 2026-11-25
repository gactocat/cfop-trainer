// Best single and averages of a list of solve times, as the WCA counts them.
// A +2 adds two seconds; a DNF counts as slower than any time (Infinity).
// An average of 5 drops the best and the worst time and means the other
// three; an average of 12 does the same with one best and one worst (the
// usual 5 % trim, rounded up). A DNF is dropped as the worst; with two or
// more DNFs the average is a DNF too. Times are milliseconds, newest first.

import type { Penalty } from '@/lib/solve/solve-record';

/** A DNF, as a time: slower than any. */
export const DNF = Infinity;

/** The time that counts: +2 adds two seconds, a DNF is DNF. */
export function countedMs({ ms, penalty }: { ms: number; penalty?: Penalty }): number {
  return penalty === 'dnf' ? DNF : penalty === 'plus2' ? ms + 2000 : ms;
}

/** Mean of the latest `n` times without the best and the worst; null with fewer than `n`, DNF with two DNFs. */
export function averageOf(times: readonly number[], n: number, from = 0): number | null {
  if (times.length - from < n || n < 3) return null;
  const middle = times.slice(from, from + n).sort((a, b) => a - b).slice(1, n - 1);
  if (middle.some((t) => t === DNF)) return DNF;
  return middle.reduce((sum, t) => sum + t, 0) / middle.length;
}

/** The best average of `n` consecutive times anywhere in the list (DNF when every one is). */
export function bestAverageOf(times: readonly number[], n: number): number | null {
  let best: number | null = null;
  for (let from = 0; from + n <= times.length; from++) {
    const average = averageOf(times, n, from)!;
    if (best === null || average < best) best = average;
  }
  return best;
}

export interface SolveStats {
  count: number;
  /** The fastest time that is not a DNF; null when there is none. */
  best: number | null;
  ao5: number | null;
  ao12: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
}

/** Figures for counted times (see countedMs), newest first. */
export function solveStats(times: readonly number[]): SolveStats {
  const finished = times.filter((t) => t !== DNF);
  return {
    count: times.length,
    best: finished.length ? Math.min(...finished) : null,
    ao5: averageOf(times, 5),
    ao12: averageOf(times, 12),
    bestAo5: bestAverageOf(times, 5),
    bestAo12: bestAverageOf(times, 12),
  };
}

/**
 * A time as a timer shows it: seconds with hundredths, minutes when longer
 * ("1:05.32"), DNF as "DNF". Singles are cut to the hundredth as the WCA
 * does; averages are rounded. Null shows as a dash.
 */
export function formatSolveTime(ms: number | null, { average = false }: { average?: boolean } = {}): string {
  if (ms === DNF) return 'DNF';
  if (ms === null || !Number.isFinite(ms)) return '-';
  const cs = average ? Math.round(ms / 10) : Math.floor(ms / 10);
  const minutes = Math.floor(cs / 6000);
  const rest = cs - minutes * 6000;
  const seconds = `${Math.floor(rest / 100)}.${String(rest % 100).padStart(2, '0')}`;
  return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds;
}

/** A solve's time with its penalty: "8.90+" for a +2 (two seconds added), "DNF" for a DNF. */
export function formatRecordTime(record: { ms: number; penalty?: Penalty }): string {
  if (record.penalty === 'dnf') return 'DNF';
  if (record.penalty === 'plus2') return `${formatSolveTime(record.ms + 2000)}+`;
  return formatSolveTime(record.ms);
}
