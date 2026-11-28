'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, type ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { useSolveSettings } from '@/hooks/useSolveSettings';
import { useSolves } from '@/hooks/useSolves';
import { useT } from '@/hooks/useT';
import { FACE_COLOUR, colourFrame } from '@/lib/smart-cube/holding';
import { deleteSolve } from '@/lib/solve-store';
import { solveTps } from '@/lib/solve/cfop-split';
import { modeMoveCount, readModeRecord } from '@/lib/solve/mode-record';
import { scrambleState } from '@/lib/solve/scramble';
import type { SolveMode } from '@/lib/solve/solve-modes';
import { RECORD_PARAM, solveRecordsPath } from '@/lib/solve/solve-pages';
import type { SolveRecord } from '@/lib/solve/solve-record';
import { goUp } from './HeaderTitle';
import { PenaltyButtons, RecordTime } from './SolvePenalty';
import { TimerBadge, useRecordedAt } from './SolveRecords';
import { SolveFigures } from './SolveScreens';
import { SolveStages } from './SolveStages';
import { buttonClass, CARD, LABEL } from './ui';
import { VirtualCube } from './VirtualCube';

/** One part of the page: a card with its small heading. More parts go in as more of them. */
function Part({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section data-ui="Part" className={`${CARD} space-y-3 p-4 sm:p-5`}>
      {label && <h2 className={LABEL}>{label}</h2>}
      {children}
    </section>
  );
}

/** The cube as the scramble leaves it, held as it was for the scramble. */
function ScrambledCube({ record, mode }: { record: SolveRecord; mode: SolveMode }) {
  // Solves timed by hand do not keep how the cube was held: the setting now.
  const settings = useSolveSettings(mode);
  const frame = (record.scrambleHolding && colourFrame(record.scrambleHolding)) ?? settings.frame;
  const state = useMemo(() => {
    try { return scrambleState(record.scramble, frame); } catch { return null; }
  }, [record.scramble, frame]);
  if (!state) return null;
  return (
    <div className="mx-auto size-56 overflow-hidden rounded-xl sm:size-64">
      <VirtualCube practice={null} holding={null} guide={{ state, move: { frame, alg: '' } }} still className="h-full w-full" />
    </div>
  );
}

function RecordView({ mode, record }: { mode: SolveMode; record: SolveRecord }) {
  const { t } = useT();
  const router = useRouter();
  const when = useRecordedAt(record, 'long');
  const moves = modeMoveCount(record);
  const reading = readModeRecord(record);
  const remove = () => {
    if (!window.confirm(t('solve.history.confirmDelete'))) return;
    void deleteSolve(mode, record.id).catch(() => {});
    goUp(router, solveRecordsPath(mode));
  };
  return (
    <div data-ui="RecordView" className="mx-auto w-full max-w-2xl space-y-3">
      <Part>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">{when}</span>
            <TimerBadge record={record} />
          </div>
          <RecordTime record={record} className="font-mono text-5xl font-bold tabular-nums sm:text-6xl" small="text-sm" />
          <SolveFigures record={record} moves={moves} tps={moves === undefined ? null : solveTps(moves, record.ms)}
            crossColour={mode === 'll' ? undefined : reading ? FACE_COLOUR[reading.split.cross] : null} />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <PenaltyButtons record={record} />
            <button type="button" onClick={remove} className={buttonClass('danger', 'sm')}>{t('common.delete')}</button>
          </div>
        </div>
      </Part>
      <Part label={t('solve.scramble')}>
        <p className="text-center font-mono text-base leading-7 font-semibold break-words text-zinc-800 dark:text-zinc-100">{record.scramble}</p>
        <ScrambledCube record={record} mode={mode} />
      </Part>
      {reading && (
        <Part label={t('solve.detail.stages')}>
          <SolveStages record={record} />
        </Part>
      )}
    </div>
  );
}

function RecordById({ mode }: { mode: SolveMode }) {
  const { t } = useT();
  const id = useSearchParams().get(RECORD_PARAM);
  const { solves, status } = useSolves(mode);
  const record = solves.find((s) => s.id === id);
  if (record) return <RecordView mode={mode} record={record} />;
  return (
    <p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
      {t(status === 'loading' ? 'common.loading' : 'solve.detail.missing')}
    </p>
  );
}

// One solve of a kind's records, a page under them
// (/solve/cfop/records/detail?id=…): its time with any penalty, when, its
// figures (moves, TPS, inspection, cross colour, as on the result), +2, DNF
// and delete; the scramble with the cube it leaves; and with a smart cube
// its stages. Each part is a card of its own, so more can be added. The solve
// is named in the query, which is only known in the browser.
export function SolveRecordPage({ mode }: { mode: SolveMode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <RecordById mode={mode} />
    </Suspense>
  );
}
