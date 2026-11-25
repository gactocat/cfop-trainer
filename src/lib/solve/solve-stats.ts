// Best single and averages of a list of solve times, as the WCA counts them:
// an average of 5 drops the best and the worst time and means the other three;
// an average of 12 does the same with one best and one worst (the usual
// 5 % trim, rounded up). Times are milliseconds, newest first.

/** Mean of the latest `n` times without the best and the worst; null with fewer than `n`. */
export function averageOf(times: readonly number[], n: number, from = 0): number | null {
  if (times.length - from < n || n < 3) return null;
  const window = times.slice(from, from + n);
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const t of window) {
    sum += t;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return (sum - min - max) / (n - 2);
}

/** The best average of `n` consecutive times anywhere in the list. */
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
  best: number | null;
  mean: number | null;
  ao5: number | null;
  ao12: number | null;
  bestAo5: number | null;
  bestAo12: number | null;
}

export function solveStats(times: readonly number[]): SolveStats {
  return {
    count: times.length,
    best: times.length ? Math.min(...times) : null,
    mean: times.length ? times.reduce((a, t) => a + t, 0) / times.length : null,
    ao5: averageOf(times, 5),
    ao12: averageOf(times, 12),
    bestAo5: bestAverageOf(times, 5),
    bestAo12: bestAverageOf(times, 12),
  };
}

/**
 * A time as a timer shows it: seconds with hundredths, minutes when longer
 * ("1:05.32"). Singles are cut to the hundredth as the WCA does; averages are
 * rounded. Null shows as a dash.
 */
export function formatSolveTime(ms: number | null, { average = false }: { average?: boolean } = {}): string {
  if (ms === null || !Number.isFinite(ms)) return '-';
  const cs = average ? Math.round(ms / 10) : Math.floor(ms / 10);
  const minutes = Math.floor(cs / 6000);
  const rest = cs - minutes * 6000;
  const seconds = `${Math.floor(rest / 100)}.${String(rest % 100).padStart(2, '0')}`;
  return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds;
}
