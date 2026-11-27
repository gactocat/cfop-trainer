'use client';

import { useMemo } from 'react';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { FACE_COLOUR } from '@/lib/smart-cube/holding';
import type { CfopStage } from '@/lib/solve/cfop-split';
import { modeRecordStages, readModeRecord } from '@/lib/solve/mode-record';
import type { SolveRecord } from '@/lib/solve/solve-record';
import { formatSolveTime } from '@/lib/solve/solve-stats';
import { CubeColourMark } from './CubeColourMark';

const STAGE_LABEL: Record<CfopStage, MessageKey> = {
  cross: 'solve.stage.cross',
  f2l1: 'solve.stage.f2l1',
  f2l2: 'solve.stage.f2l2',
  f2l3: 'solve.stage.f2l3',
  f2l4: 'solve.stage.f2l4',
  oll: 'solve.stage.oll',
  pll: 'solve.stage.pll',
};

/** Recognition and execution cut to the hundredth, as the stage's time is, so they add up as shown. */
const seconds = (ms: number) => formatSolveTime(ms);

// A cube solve stage by stage, the stages of its kind (CFOP: the cross, each
// F2L pair, OLL and PLL; a part on its own: its own stages): its
// time, then in small type recognition (from the stage before to its first
// turn) and execution, moves and TPS, and its moves in the user's notation,
// held as for the solve (the cross at the bottom). Beside Cross, the colour
// the solve was built on. Stages that ended on the same turn as the one
// before are marked as skipped. The same on a result and in the records.
export function SolveStages({ record, className = '' }: { record: SolveRecord; className?: string }) {
  const { t } = useT();
  const reading = useMemo(() => readModeRecord(record), [record]);
  const stages = useMemo(() => modeRecordStages(record) ?? [], [record]);
  if (!reading || stages.length === 0) return null;
  const crossColour = FACE_COLOUR[reading.split.cross];
  return (
    <ol aria-label={t('solve.stage.title')} className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${className}`}>
      {stages.map((stage) => (
        <li key={stage.stage} className={`py-2 ${stage.skipped ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              {t(STAGE_LABEL[stage.stage])}
              {stage.stage === 'cross' && <CubeColourMark colour={crossColour} />}
              {stage.skipped && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {t('solve.stage.skip')}
                </span>
              )}
            </span>
            <span className="font-mono text-base font-semibold tabular-nums">{formatSolveTime(stage.ms)}</span>
          </div>
          {!stage.skipped && (
            <>
              <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                <span>{t('solve.stage.recognition')} {seconds(stage.recognitionMs)}</span>
                <span>{t('solve.stage.execution')} {seconds(stage.executionMs)}</span>
                <span>{t('smartCube.solve.summary', { moves: stage.moves, tps: stage.tps === null ? '-' : stage.tps.toFixed(2) })}</span>
              </p>
              <p className="mt-1 font-mono text-xs leading-5 break-words text-zinc-700 dark:text-zinc-300">{stage.notation}</p>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
