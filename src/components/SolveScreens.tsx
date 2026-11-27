'use client';

import { Fragment, useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { CubeSolveScreen } from '@/hooks/useCubeSolve';
import { useT } from '@/hooks/useT';
import type { CubeColour } from '@/lib/smart-cube/holding';
import { inspectionCall, inspectionShown } from '@/lib/solve/inspection';
import type { SolveRecord } from '@/lib/solve/solve-record';
import type { TimerFace } from '@/lib/solve/solve-screen';
import { formatRecordTime, formatSolveTime } from '@/lib/solve/solve-stats';
import { CubeColourMark } from './CubeColourMark';
import { Figure } from './Figure';
import { PenaltyButtons } from './SolvePenalty';
import { TimerDigits } from './TimerDigits';

// The three screens of a solve from a scramble (scramble, timer, result),
// built from the app's parts so every kind of solve looks and works the
// same; the page wires them to its solve (CfopSolve).

const CARD = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const PRIMARY = 'rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700';
const OUTLINE = 'rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800';
const QUIET = 'rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

// The cube's place and size: large in the room left on the scramble screen, small under the timer.
const CUBE_PLACE = {
  large: 'flex w-full flex-1 items-center justify-center',
  small: 'flex justify-center',
  hidden: 'hidden',
} as const;
const CUBE_SIZE = {
  large: 'size-64 sm:size-80',
  small: 'size-36 sm:size-44',
  hidden: '',
} as const;

/** Buttons and links keep their own presses; the rest of the screen is what is pressed. */
const ownPress = (target: EventTarget | null) => !!(target as Element | null)?.closest?.('button, a, input, select, textarea, label, [data-own-press]');

/** Redraws every frame while `on`; returns performance.now(). */
function useNow(on: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on]);
  return now;
}

/**
 * One screen of a solve: what is on it (`head`), the 3D cube in the same
 * place on every screen so one player (one WebGL context) stays mounted
 * (large while scrambling, small while timing, hidden on the result), and
 * what goes below it. Pressing the screen outside its buttons calls `onPress`.
 */
export function SolveFrame({ label, head, cube, cubeSize, tail, onPress }: {
  label: string;
  head: ReactNode;
  cube: ReactNode;
  cubeSize: keyof typeof CUBE_SIZE;
  tail?: ReactNode;
  onPress?: (event: ReactPointerEvent) => void;
}) {
  return (
    <section
      aria-label={label}
      onPointerDown={onPress ? (event) => { if (!ownPress(event.target)) onPress(event); } : undefined}
      onContextMenu={onPress ? (event) => event.preventDefault() : undefined}
      className={`${CARD} relative mx-auto flex w-full max-w-3xl flex-col items-center gap-4 p-4 sm:p-6 ${onPress
        ? 'min-h-[calc(100dvh-9rem)] cursor-pointer select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none]'
        : 'min-h-[calc(100dvh-9rem)]'}`}
    >
      {head}
      <div className={CUBE_PLACE[cubeSize]}>
        <div className={`shrink-0 overflow-hidden rounded-xl ${CUBE_SIZE[cubeSize]}`}>{cube}</div>
      </div>
      {tail}
    </section>
  );
}

/** The scramble's tokens, those already turned dimmed and the next underlined. */
function Tokens({ tokens, done }: { tokens: readonly string[]; done: number | null }) {
  return (
    <>
      {tokens.map((token, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className={done === null ? '' : i < done ? 'opacity-35' : i === done ? 'underline decoration-2 underline-offset-[6px]' : ''}>{token}</span>
        </Fragment>
      ))}
    </>
  );
}

/** What the smart cube needs next, under the scramble: nothing while the turns go as shown. */
export function CubeStatus({ screen, synced }: { screen: CubeSolveScreen | null; synced: boolean }) {
  const { t } = useT();
  const chip = 'inline-block rounded-md px-3 py-1.5 text-sm font-semibold';
  if (!synced || !screen) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('solve.cube.syncing')}</p>;
  if (screen.routeFailed) return <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">{t('solve.cube.routeFailed')}</p>;
  if (screen.routeKind === null) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('solve.cube.routing')}</p>;
  if (screen.undo) return <p aria-live="polite" className={`${chip} bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200`}>{t('smartCube.trainer.undo', { moves: screen.undo })}</p>;
  if (screen.remaining) return <p aria-live="polite" className={`${chip} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>{t('smartCube.trainer.remaining', { moves: screen.remaining })}</p>;
  if (screen.routeKind === 'reroute') return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('solve.cube.reroute')}</p>;
  return null;
}

/** The scramble screen's top: its controls, then the scramble (or, with a cube elsewhere, the turns to it) and what the cube needs. */
export function ScrambleHead({ toolbar, problem, scramble, failed, tokens, done, rerouted, status }: {
  toolbar: ReactNode;
  problem?: ReactNode;
  scramble: string | null;
  failed: boolean;
  tokens: readonly string[];
  /** Turns done (with a cube); null without one. */
  done: number | null;
  /** The tokens are a route worked out from where the cube is. */
  rerouted: boolean;
  status?: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        {rerouted ? <h2 className={`${LABEL} min-w-0 pt-2`}>{t('solve.cube.routeTitle')}</h2> : <span />}
        {toolbar}
      </div>
      {problem}
      <p aria-live="polite" className="min-h-[2.5em] w-full text-center font-mono text-xl font-semibold leading-relaxed tracking-wide break-words text-zinc-900 sm:text-2xl dark:text-zinc-50">
        {scramble ? <Tokens tokens={tokens} done={done} /> : (
          <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">{t(failed ? 'solve.scramble.failed' : 'solve.scramble.making')}</span>
        )}
      </p>
      {rerouted && scramble && (
        <p className="text-center font-mono text-xs text-zinc-500 dark:text-zinc-400">{t('solve.cube.scrambleWas', { scramble })}</p>
      )}
      {status && <div className="flex justify-center text-center">{status}</div>}
    </div>
  );
}

/** Where the timer's digits sit, on the timer screen and the result alike, so the result's time takes the timer's place. */
function DigitsArea({ children, under }: { children: ReactNode; under: ReactNode }) {
  return (
    <div className="flex min-h-[26vh] w-full flex-col items-center justify-end gap-2">
      {children}
      <div className="flex h-5 items-center text-sm font-medium" aria-live="polite">{under}</div>
    </div>
  );
}

/**
 * The timer screen's digits: the solve running, the inspection counting up
 * (+2 after 15 s, DNF after 17 s, with the 8 and 12 s calls under it), or
 * 0.00 in the colour of a press held. A press held during the inspection
 * keeps its count under the digits.
 */
export function TimerHead({ face, inspectionSince }: { face: TimerFace; inspectionSince: number | null }) {
  const { t } = useT();
  const now = useNow(face.kind !== 'zero' || inspectionSince !== null);
  const inspection = inspectionSince === null ? null : inspectionShown(Math.max(0, now - inspectionSince));
  const inspectionText = inspection === null ? '' : 'seconds' in inspection ? String(inspection.seconds) : inspection.penalty === 'plus2' ? '+2' : 'DNF';
  const digits = face.kind === 'running' ? formatSolveTime(Math.max(0, now - face.since))
    : face.kind === 'inspection' ? inspectionText
      : formatSolveTime(0);
  const call = face.kind === 'inspection' ? inspectionCall(Math.max(0, now - face.since)) : null;
  const under = face.kind === 'inspection'
    ? call !== null && <span className="text-amber-700 dark:text-amber-300">{t('solve.inspection.call', { seconds: call })}</span>
    : face.kind === 'zero' && inspection !== null && <span className="text-zinc-500 dark:text-zinc-400">{t('solve.timer.inspection', { seconds: inspectionText })}</span>;
  return (
    <DigitsArea under={under}>
      <TimerDigits tone={face.kind === 'zero' ? face.tone : 'plain'}>{digits}</TimerDigits>
    </DigitsArea>
  );
}

/** Ends the solve as a DNF; quiet, so it is there without drawing the eye. */
export function DnfButton({ onDnf }: { onDnf: () => void }) {
  const { t } = useT();
  return (
    <button type="button" onClick={onDnf} aria-label={t('solve.penalty.dnfAria')} title={t('solve.penalty.dnfAria')}
      className={`${QUIET} font-mono`}>
      DNF
    </button>
  );
}

/**
 * The result: the time where the timer was (with its penalty: 8.90+, or DNF
 * and the time measured), its moves, TPS, inspection and cross colour, the
 * scramble, Retry (the same scramble again) and Next (a new one, or Space).
 * +2, DNF and Undo sit quietly in the corner.
 */
export function ResultHead({ record, moves, tps, crossColour, onRetry, onNext, onUndo }: {
  record: SolveRecord;
  moves: number | undefined;
  tps: number | null;
  crossColour: CubeColour | null;
  onRetry: () => void;
  onNext: () => void;
  onUndo: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-4 sm:top-4">
        <PenaltyButtons record={record} />
        <button type="button" onClick={onUndo}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          {t('solve.result.undo')}
        </button>
      </div>
      <DigitsArea under={record.penalty === 'dnf' && (
        <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">({formatSolveTime(record.ms)})</span>
      )}>
        <TimerDigits>{formatRecordTime(record)}</TimerDigits>
      </DigitsArea>
      <dl className="flex flex-wrap justify-center gap-x-7 gap-y-2 sm:gap-x-10">
        <Figure size="sm" label={t('solve.moves')} value={moves === undefined ? '-' : String(moves)} />
        <Figure size="sm" label="TPS" value={tps === null ? '-' : tps.toFixed(2)} />
        <Figure size="sm" label={t('solve.inspection')} value={record.inspectionMs === undefined ? '-' : (record.inspectionMs / 1000).toFixed(2)} />
        <Figure size="sm" label={t('solve.stage.cross')} value={crossColour ? <CubeColourMark colour={crossColour} className="my-1 size-4" /> : '-'} />
      </dl>
      <p className="max-w-xl text-center font-mono text-xs leading-5 break-words text-zinc-500 dark:text-zinc-400">{record.scramble}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRetry} className={OUTLINE}>{t('solve.result.retry')}</button>
        <button type="button" onClick={onNext} className={PRIMARY}>
          {t('trainer.noScramble.next')}
          <kbd className="ml-2 hidden font-mono text-[10px] font-normal opacity-70 sm:inline">Space</kbd>
        </button>
      </div>
    </div>
  );
}
