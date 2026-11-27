'use client';

import { useMemo } from 'react';
import { useCrossColour } from '@/hooks/useSolveSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { STICKER_COLOURS } from '@/lib/cube-colors';
import { FACE_COLOUR } from '@/lib/smart-cube/holding';
import { cfopStages, type CfopStage } from '@/lib/solve/cfop-split';
import { readRecord, type SolveRecord } from '@/lib/solve/solve-record';
import { formatSolveTime } from '@/lib/solve/solve-stats';

const STAGE_LABEL: Record<CfopStage, MessageKey> = {
  cross: 'solve.stage.cross',
  f2l1: 'solve.stage.f2l1',
  f2l2: 'solve.stage.f2l2',
  f2l3: 'solve.stage.f2l3',
  f2l4: 'solve.stage.f2l4',
  oll: 'solve.stage.oll',
  pll: 'solve.stage.pll',
};

const COLOUR_LABEL: Record<keyof typeof STICKER_COLOURS, MessageKey> = {
  white: 'solve.colour.white',
  yellow: 'solve.colour.yellow',
  red: 'solve.colour.red',
  orange: 'solve.colour.orange',
  green: 'solve.colour.green',
  blue: 'solve.colour.blue',
};

const tps2 = (value: number | null) => (value === null ? '-' : value.toFixed(2));

// A cube solve stage by stage: time, moves and TPS of the cross, each F2L
// pair, OLL and PLL, with stages that ended on the same turn marked as
// skipped; then, folded, the turns of each stage in the user's notation,
// held as for the solve (the cross at the bottom). Records from before the
// cross colour was set apart are read with the colour set now.
export function SolveStages({ record, className = '' }: { record: SolveRecord; className?: string }) {
  const { t } = useT();
  const cross = useCrossColour(record.event);
  const reading = useMemo(() => readRecord(record, cross), [record, cross]);
  const stages = useMemo(
    () => (reading && record.turns ? cfopStages(record.turns, reading.split, reading.frame) : []),
    [record, reading],
  );
  if (!reading || stages.length === 0) return null;
  const crossColour = FACE_COLOUR[reading.split.cross];
  const th = 'px-2 py-1.5 font-medium';
  return (
    <div className={className}>
      <table className="w-full table-fixed text-right text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className={`${th} w-[34%] text-left`}>{t('solve.stage.title')}</th>
            <th className={th}>{t('solve.time')}</th>
            <th className={th}>{t('solve.moves')}</th>
            <th className={th}>TPS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 font-mono tabular-nums dark:divide-zinc-800">
          {stages.map((stage) => (
            <tr key={stage.stage} className={stage.skipped ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'}>
              <td className="px-2 py-1.5 text-left font-sans">
                <span className="inline-flex items-center gap-1.5">
                  {t(STAGE_LABEL[stage.stage])}
                  {stage.stage === 'cross' && (
                    <span
                      role="img"
                      aria-label={t(COLOUR_LABEL[crossColour])}
                      title={t(COLOUR_LABEL[crossColour])}
                      className="inline-block size-2.5 rounded-sm ring-1 ring-zinc-300 dark:ring-zinc-600"
                      style={{ backgroundColor: STICKER_COLOURS[crossColour] }}
                    />
                  )}
                  {stage.skipped && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {t('solve.stage.skip')}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-2 py-1.5">{formatSolveTime(stage.ms)}</td>
              <td className="px-2 py-1.5">{stage.moves}</td>
              <td className="px-2 py-1.5">{tps2(stage.tps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300 [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-90">
            <path d="m9 6 6 6-6 6" />
          </svg>
          {t('solve.solution')}
        </summary>
        <dl className="mt-2 space-y-1.5 text-sm">
          {stages.filter((stage) => !stage.skipped).map((stage) => (
            <div key={stage.stage} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">{t(STAGE_LABEL[stage.stage])}</dt>
              <dd className="font-mono leading-6 break-words text-zinc-800 dark:text-zinc-200">
                {stage.notation}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
