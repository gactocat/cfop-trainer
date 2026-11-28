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
import { Note } from './ui';

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
// F2L pair, OLL and PLL; a part on its own: its own stages), as a table:
// its time, recognition (from the stage before to its first turn) and
// execution, moves and TPS, and under them its moves in the user's
// notation, held as for the solve (the cross at the bottom). Beside Cross,
// the colour the solve was built on. Stages that ended on the same turn as
// the one before are marked as skipped. The same on a result and on the
// solve's page in the records.
export function SolveStages({ record, className = '' }: { record: SolveRecord; className?: string }) {
  const { t } = useT();
  const reading = useMemo(() => readModeRecord(record), [record]);
  const stages = useMemo(() => modeRecordStages(record) ?? [], [record]);
  if (!reading || stages.length === 0) return null;
  const crossColour = FACE_COLOUR[reading.split.cross];
  const th = 'px-1 pb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400';
  const td = 'px-1 py-1.5 font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300';
  return (
    <table aria-label={t('solve.stage.title')} className={`w-full table-fixed text-right ${className}`}>
      <thead>
        <tr>
          <th scope="col" className={`${th} w-[28%] text-left`}>{t('solve.stage.title')}</th>
          <th scope="col" className={th}>{t('solve.time')}</th>
          <th scope="col" className={th}>{t('solve.stage.recognition')}</th>
          <th scope="col" className={th}>{t('solve.stage.execution')}</th>
          <th scope="col" className={th}>{t('solve.moves')}</th>
          <th scope="col" className={th}>TPS</th>
        </tr>
      </thead>
      {stages.map((stage) => (
        <tbody key={stage.stage} className={`border-t border-zinc-100 dark:border-zinc-800 ${stage.skipped ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
          <tr>
            <th scope="row" className="px-1 pt-2 pb-1 text-left text-sm font-medium">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {t(STAGE_LABEL[stage.stage])}
                {stage.stage === 'cross' && <CubeColourMark colour={crossColour} />}
                {stage.skipped && (
                  <Note>{t('solve.stage.skip')}</Note>
                )}
              </span>
            </th>
            <td className="px-1 pt-2 pb-1 font-mono text-sm font-semibold tabular-nums">{formatSolveTime(stage.ms)}</td>
            <td className={td}>{stage.skipped ? '-' : seconds(stage.recognitionMs)}</td>
            <td className={td}>{stage.skipped ? '-' : seconds(stage.executionMs)}</td>
            <td className={td}>{stage.skipped ? '-' : stage.moves}</td>
            <td className={td}>{stage.skipped || stage.tps === null ? '-' : stage.tps.toFixed(2)}</td>
          </tr>
          {!stage.skipped && (
            <tr>
              <td colSpan={6} className="px-1 pb-2 text-left font-mono text-xs leading-5 break-words text-zinc-600 dark:text-zinc-300">{stage.notation}</td>
            </tr>
          )}
        </tbody>
      ))}
    </table>
  );
}
