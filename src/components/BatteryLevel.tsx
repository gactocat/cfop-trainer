'use client';

import { useT } from '@/hooks/useT';

/** Fifths of the battery drawn filled: 1 to 20% is one, 81 to 100% all five; 0% none. */
export function batteryBars(level: number): number {
  return Math.min(5, Math.max(0, Math.ceil(level / 20)));
}

/** At this level or below the fill turns red. */
const LOW = 20;

// A battery that fills by fifths, red when low, and the level beside it.
// Screen readers hear "Battery 87%" (just "87%" where a label already says battery).
export function BatteryLevel({ level, labelled = false, className = '' }: { level: number; labelled?: boolean; className?: string }) {
  const { t } = useT();
  const bars = batteryBars(level);
  const low = level <= LOW;
  return (
    <span title={t('practice.cube.battery', { level })} className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <svg viewBox="0 0 26 14" aria-hidden="true" className="h-[0.9em] w-[1.67em] shrink-0">
        <rect x="0.75" y="0.75" width="21.5" height="12.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="23.25" y="4.5" width="2" height="5" rx="1" fill="currentColor" />
        {bars > 0 && (
          <rect x="3" y="3" width={(17 * bars) / 5} height="8" rx="1.25"
            className={low ? 'fill-rose-500 dark:fill-rose-400' : 'fill-current'} />
        )}
      </svg>
      {!labelled && <span className="sr-only">{t('smartCube.battery')} </span>}
      <span>{level}%</span>
    </span>
  );
}
