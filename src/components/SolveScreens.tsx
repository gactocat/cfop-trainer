'use client';

import { Fragment, useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { CubeSolveScreen } from '@/hooks/useCubeSolve';
import { useMounted } from '@/hooks/useMounted';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { CubeColour } from '@/lib/smart-cube/holding';
import { inspectionCall, inspectionShown } from '@/lib/solve/inspection';
import type { SolveRecord } from '@/lib/solve/solve-record';
import type { TimerFace } from '@/lib/solve/solve-screen';
import { formatRecordTime, formatSolveTime } from '@/lib/solve/solve-stats';
import { CubeColourMark } from './CubeColourMark';
import { Figure } from './Figure';
import { InfoTip } from './InfoTip';
import { PROBLEM } from './SmartCubePanel';
import { PenaltyButtons } from './SolvePenalty';
import { TimerDigits } from './TimerDigits';
import { buttonClass, CARD, LABEL } from './ui';

// The three screens of a solve from a scramble (scramble, timer, result),
// built from the app's parts so every kind of solve looks and works the
// same; the page wires them to its solve (ModeSolve). Practice is built
// from the same parts (PracticeScreens).


// The cube's place and size: large in the room left on the scramble screen,
// small under the timer (medium where it is the thing to solve: a practice
// case shown as the timer starts).
const CUBE_PLACE = {
  large: 'flex w-full flex-1 items-center justify-center',
  medium: 'flex justify-center',
  small: 'flex justify-center',
  hidden: 'hidden',
} as const;
const CUBE_SIZE = {
  large: 'size-64 sm:size-80',
  medium: 'size-56 sm:size-64',
  small: 'size-36 sm:size-44',
  hidden: '',
} as const;

/** Buttons and links keep their own presses; the rest of the screen is what is pressed. */
const ownPress = (target: EventTarget | null) => !!(target as Element | null)?.closest?.('button, a, input, select, textarea, label, [data-own-press]');

/** Redraws every frame while `on`; returns performance.now(). */
export function useNow(on: boolean): number {
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

/**
 * The scramble's tokens, those already turned dimmed and the next
 * underlined. Turns to take back (`undo`, with a cube) take the next token's
 * place, in red, until they are made, so no line of their own comes and goes.
 */
export function Tokens({ tokens, done, undo = '' }: { tokens: readonly string[]; done: number | null; undo?: string }) {
  const shown = undo && done !== null
    ? [...tokens.slice(0, done), undo, ...tokens.slice(done + 1)]
    : tokens;
  return (
    <>
      {shown.map((token, i) => {
        const fix = undo && done !== null && i === done;
        return (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className={done === null ? '' : i < done ? 'opacity-35'
              : i === done ? `underline decoration-2 underline-offset-[6px] ${fix ? 'text-rose-600 dark:text-rose-400' : ''}` : ''}>
              {token}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * The line under the scramble, its height kept whether or not there is
 * something to say, so nothing moves when there is: why the smart cube is not
 * connected (when something went wrong), else `children` (what the cube
 * needs before the scramble can be followed). Two lines at most; the whole
 * of a longer one is in its tooltip and in the smart cube dialog.
 */
export function StatusLine({ children }: { children?: ReactNode }) {
  const { t } = useT();
  const mounted = useMounted();
  const { problem, status } = useSmartCube();
  const problemKey = mounted && problem && status !== 'connected' ? PROBLEM[problem] : null;
  const text = problemKey ? t(problemKey) : children;
  return (
    <div aria-live="polite" className="flex h-10 w-full items-center justify-center text-center text-sm leading-5">
      {text && (
        <p role={problemKey ? 'alert' : undefined} title={typeof text === 'string' ? text : undefined}
          className={`line-clamp-2 ${problemKey ? 'text-amber-800 dark:text-amber-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {text}
        </p>
      )}
    </div>
  );
}

/** What the smart cube needs before its scramble can be followed: nothing while the turns go as shown. */
export function cubeSolveStatus(screen: CubeSolveScreen | null, synced: boolean): MessageKey | null {
  if (!synced || !screen) return 'solve.cube.syncing';
  if (screen.routeFailed) return 'solve.cube.routeFailed';
  if (screen.routeKind === null) return 'solve.cube.routing';
  return null;
}

/**
 * The scramble screen's top: its controls, then the scramble (or, with a
 * cube elsewhere, the turns to it: its title takes the lead's place) and the
 * status line. A practice's case screen has the same top, with its setup for
 * the scramble (none without a setup: `scramble` undefined) and `lead` at the
 * left. Every part keeps its place before the page knows what goes in it
 * (the controls come in the browser, the scramble from its worker).
 */
export function ScrambleHead({ toolbar, lead, scramble, failed = false, tokens, done, undo, rerouted = false, status, lines = 2 }: {
  toolbar: ReactNode;
  lead?: ReactNode;
  scramble: string | null | undefined;
  failed?: boolean;
  tokens: readonly string[];
  /** Turns done (with a cube); null without one. */
  done: number | null;
  /** Turns to take back, shown in the next token's place. */
  undo?: string;
  /** The tokens are a route worked out from where the cube is. */
  rerouted?: boolean;
  status?: ReactNode;
  /** Lines kept for the scramble on a phone before it comes (a solve's is longer than a case's setup). */
  lines?: 2 | 3;
}) {
  const { t } = useT();
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex min-h-9 items-start justify-between gap-3">
        {rerouted && scramble ? (
          <h2 className={`${LABEL} flex min-w-0 items-center gap-1 pt-2`}>
            {t('solve.cube.routeTitle')}
            <InfoTip>
              <span className="block">{t('solve.cube.reroute')}</span>
              <span className="block font-mono">{t('solve.cube.scrambleWas', { scramble })}</span>
            </InfoTip>
          </h2>
        ) : lead ?? <span />}
        {toolbar}
      </div>
      {scramble !== undefined && (
        <p aria-live="polite" className={`relative w-full text-center font-mono text-xl font-semibold leading-relaxed tracking-wide break-words text-zinc-900 sm:min-h-[3.25em] sm:text-2xl dark:text-zinc-50 ${lines === 3 ? 'min-h-[4.875em]' : 'min-h-[3.25em]'}`}>
          {scramble ? (
            <>
              {/* The tokens as written hold the height; what is shown goes over them. */}
              <span aria-hidden className="invisible"><Tokens tokens={tokens} done={null} /></span>
              <span className="absolute inset-0"><Tokens tokens={tokens} done={done} undo={undo} /></span>
            </>
          ) : (
            <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">{t(failed ? 'solve.scramble.failed' : 'solve.scramble.making')}</span>
          )}
        </p>
      )}
      <StatusLine>{status}</StatusLine>
    </div>
  );
}

/** Where the timer's digits sit, on the timer screen and the result alike, so the result's time takes the timer's place. */
export function DigitsArea({ children, under }: { children: ReactNode; under: ReactNode }) {
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
      className={`${buttonClass('secondary', 'sm')} font-mono`}>
      DNF
    </button>
  );
}

/**
 * A solve's figures in a row: its moves, TPS, inspection and cross colour
 * (left out when `crossColour` is undefined), the same on the result and on
 * the solve's page in the records.
 */
export function SolveFigures({ record, moves, tps, crossColour }: {
  record: SolveRecord;
  moves: number | undefined;
  tps: number | null;
  /** Null: not known (a solve timed by hand); undefined: not shown (the last layer). */
  crossColour?: CubeColour | null;
}) {
  const { t } = useT();
  return (
    <dl className="flex flex-wrap justify-center gap-x-7 gap-y-2 sm:gap-x-10">
      <Figure size="sm" label={t('solve.moves')} value={moves === undefined ? '-' : String(moves)} />
      <Figure size="sm" label="TPS" value={tps === null ? '-' : tps.toFixed(2)} />
      <Figure size="sm" label={t('solve.inspection')} value={record.inspectionMs === undefined ? '-' : (record.inspectionMs / 1000).toFixed(2)} />
      {crossColour !== undefined && (
        <Figure size="sm" label={t('solve.stage.cross')} value={crossColour ? <CubeColourMark colour={crossColour} className="my-1 size-4" /> : '-'} />
      )}
    </dl>
  );
}

/**
 * The result: the time where the timer was (with its penalty: 8.90+, or DNF
 * and the time measured), its moves, TPS, inspection and cross colour (left
 * out when `crossColour` is undefined), the scramble, Retry (the same
 * scramble again) and Next (a new one, or Space). +2, DNF and Undo sit
 * quietly in the corner.
 */
export function ResultHead({ record, moves, tps, crossColour, onRetry, onNext, onUndo }: {
  record: SolveRecord;
  moves: number | undefined;
  tps: number | null;
  /** Null: not known (a solve timed by hand); undefined: not shown (the last layer). */
  crossColour?: CubeColour | null;
  onRetry: () => void;
  onNext: () => void;
  onUndo: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-4 sm:top-4">
        <PenaltyButtons record={record} />
        <button type="button" onClick={onUndo} className={buttonClass('secondary', 'sm')}>
          {t('solve.result.undo')}
        </button>
      </div>
      <DigitsArea under={record.penalty === 'dnf' && (
        <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">({formatSolveTime(record.ms)})</span>
      )}>
        <TimerDigits>{formatRecordTime(record)}</TimerDigits>
      </DigitsArea>
      <SolveFigures record={record} moves={moves} tps={tps} crossColour={crossColour} />
      <p className="max-w-xl text-center font-mono text-xs leading-5 break-words text-zinc-500 dark:text-zinc-400">{record.scramble}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRetry} className={buttonClass('secondary')}>{t('solve.result.retry')}</button>
        <button type="button" onClick={onNext} className={buttonClass('primary')}>
          {t('trainer.noScramble.next')}
          <kbd className="ml-2 hidden font-mono text-[10px] font-normal opacity-70 sm:inline">Space</kbd>
        </button>
      </div>
    </div>
  );
}
