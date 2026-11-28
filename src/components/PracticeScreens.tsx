'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { useHoldTimer } from '@/hooks/useHoldTimer';
import { useMounted } from '@/hooks/useMounted';
import type { NoScrambleView } from '@/hooks/useNoScrambleTrainer';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { toneOf } from '@/lib/hold-timer';
import type { PracticeResult } from '@/lib/practice-log';
import { isCubeFlavor, type TrainerFlavor } from '@/lib/practice-mode';
import { practicePageOf, practiceSessionPath } from '@/lib/practice-pages';
import { practiceScreenOf, type TrainerState } from '@/lib/practice-screen';
import { displayRotation, holdingFrame } from '@/lib/smart-cube/holding';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import { formatSolveTime } from '@/lib/solve/solve-stats';
import { setTimerFocus } from '@/lib/timer-focus';
import { Figure } from './Figure';
import { useUpLink } from './HeaderTitle';
import { HeaderPageLink } from './HeaderPageLink';
import { InfoTip } from './InfoTip';
import { useScreenHidden } from './KeptScreen';
import { PracticeSettingsButton, type PracticeScope } from './PracticeSettings';
import { SessionStats } from './SessionStats';
import { setupStatusKey } from './SmartCubeSetupGuide';
import { DigitsArea, ScrambleHead, SolveFrame, useNow } from './SolveScreens';
import { CubeConnection } from './SolveToolbar';
import { TimerDigits } from './TimerDigits';
import { buttonClass, Icon, iconButtonClass } from './ui';
import { VirtualCube } from './VirtualCube';

const seconds = (value: number) => formatSolveTime(value * 1000);

/** What a practice runs on, as its (i) says: with or without setup, a smart cube, one case or the selection. */
function hintOf(practice: TrainerPractice, flavor: TrainerFlavor, scope: PracticeScope): MessageKey {
  if (flavor === 'no-scramble') return 'trainer.hint.noScramble';
  if (flavor === 'inverse' || flavor === 'smart-setup') return practice === 'f2l' ? 'trainer.hint.f2lSetup' : 'trainer.hint.lastLayerSolved';
  if (scope === 'case') return 'trainer.hint.case';
  return practice === 'f2l' ? 'trainer.f2l.hidden' : practice === 'oll' ? 'trainer.oll.hidden' : 'trainer.pll.hidden';
}

function SessionIcon() {
  return <Icon><path d="M3 3v18h18" /><path d="M8 17v-5M13 17V8M18 17v-8" /></Icon>;
}

/** The recognition counting up from `since` (performance.now()), until the first turn. */
function RecognitionCount({ since }: { since: number }) {
  const { t } = useT();
  const now = useNow(true);
  return (
    <dl aria-live="off">
      <Figure size="sm" label={t('trainer.cube.recognition')} value={formatSolveTime(Math.max(0, now - since))} />
    </dl>
  );
}

/** The case screen's controls: the smart cube (connect, or its battery) and the practice's settings. */
function PracticeToolbar({ scope }: { scope: PracticeScope }) {
  return (
    <div data-ui="PracticeToolbar" className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <span className="mr-1"><CubeConnection /></span>
      <PracticeSettingsButton scope={scope} className={iconButtonClass()} />
    </div>
  );
}

/**
 * The result, laid out as a solve's: the time where the timer was, then
 * small the recognition (with a cube), moves, TPS, the case and the
 * algorithm; the same case again or Next (Space), Undo (Esc) in the corner.
 */
function PracticeResultHead({ result, elapsed, solution, caseStats, onRetry, onNext, onUndo }: {
  result: PracticeResult | undefined;
  elapsed: number;
  solution: ReactNode;
  caseStats?: string;
  onRetry: () => void;
  onNext: () => void;
  onUndo: (key: number) => void;
}) {
  const { t } = useT();
  const undone = result?.undone ?? false;
  return (
    <div data-ui="PracticeResultHead" className="flex w-full flex-col items-center gap-5">
      {result && !undone && (
        <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
          <button type="button" onClick={() => onUndo(result.key)} title="Esc" className={buttonClass('secondary', 'sm')}>
            {t('solve.result.undo')}
          </button>
        </div>
      )}
      <DigitsArea under={undone
        ? <span className="text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.undone')}</span>
        : caseStats && <span className="font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">{caseStats}</span>}>
        <TimerDigits className={undone ? 'line-through opacity-50' : ''}>{seconds(result?.seconds ?? elapsed)}</TimerDigits>
      </DigitsArea>
      <dl className="flex flex-wrap justify-center gap-x-7 gap-y-2 sm:gap-x-10">
        {result?.recognitionMs != null && (
          <Figure size="sm" label={t('trainer.cube.recognition')} value={formatSolveTime(result.recognitionMs)} />
        )}
        <Figure size="sm" label={t('solve.moves')} value={result?.moveCount ?? '-'} />
        <Figure size="sm" label="TPS" value={result?.tps == null ? '-' : result.tps.toFixed(2)} />
        <Figure size="sm" label={t('trainer.session.case')} value={result?.name ?? '-'} />
      </dl>
      {solution && <div className="max-w-xl text-center font-mono text-sm leading-6 break-words text-zinc-700 dark:text-zinc-300">{solution}</div>}
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

/** The end of "each selected case once": the round's figures, then another round or back to the list. */
function RoundDone({ total, results, listHref, onRestart }: {
  total: number;
  results: readonly PracticeResult[];
  listHref: string;
  onRestart: () => void;
}) {
  const { t } = useT();
  const up = useUpLink(listHref);
  return (
    <div data-ui="RoundDone" className="flex w-full flex-col items-center gap-5 py-4 text-center">
      <h2 className="text-xl font-semibold">{t('practice.round.done', { total })}</h2>
      <SessionStats results={results} heading={false} className="max-w-md" />
      <div className="flex items-center gap-2">
        <Link href={listHref} onClick={up} className={buttonClass('secondary')}>{t('practice.round.toList')}</Link>
        {/* Focused, so Space or Enter deals the next round. */}
        <button type="button" autoFocus onClick={onRestart} className={buttonClass('primary')}>{t('practice.round.again')}</button>
      </div>
    </div>
  );
}

export interface PracticeScreensProps {
  practice: TrainerPractice;
  scope: PracticeScope;
  flavor: TrainerFlavor;
  state: TrainerState;
  hold: ReturnType<typeof useHoldTimer>;
  /** Seconds of the attempt, as the trainer times it. */
  elapsed: number;
  /** The setup to make on the cube (with setup); null without one or before a case is drawn. */
  setup: string | null;
  /** The case as it looks, shown as the timer starts without a setup or cube. */
  caseLook: ReactNode;
  /** No setup with a cube: the case on the virtual cube. */
  virtual: NoScrambleView | null;
  /** With setup and a cube: the setup guided on the cube. */
  guided: SmartTrainerView | null;
  results: readonly PracticeResult[];
  /** The algorithm practised, as the result shows it. */
  solution: ReactNode;
  /** Case practice: the algorithm's best and ao5, under the result's time. */
  caseStats?: string;
  /** Which case of a round is on screen, e.g. 3/21. */
  progress?: string;
  /** Recognition is timed apart from the solve (only ever with a cube, see timesRecognition). */
  recognition: boolean;
  /** Random practice with no case ticked: why nothing comes up. */
  empty?: ReactNode;
  /** "Each selected case once" is done. */
  roundDone?: { total: number; results: readonly PracticeResult[]; listHref: string; onRestart: () => void } | null;
  onNext: () => void;
  onUndo: (key: number) => void;
  onRetry: () => void;
  onStopByHand: () => void;
  onReset: () => void;
}

// A practice's three screens, built from the solve's (SolveScreens), so
// practice looks and moves like a solve:
//
// - Case: the setup to make (with setup), the case's cube in the large
//   place, the smart cube and the gear for the settings. With setup the
//   cube shows the case to make (with a smart cube, the cube as it is,
//   turning the next move); without setup, on the virtual cube with a
//   smart cube. Without either, the case screen is the timer at 0.00, the
//   case coming below it once it starts. With a cube and recognition
//   timed, it counts under the cube once the case is ready.
// - Timer: the digits (red, then green while a press is held, as on the
//   solve), with a cube the cube small (and the recognition under the
//   digits when it is timed);
//   without a setup or cube, the case to solve below them.
// - Result: see PracticeResultHead.
//
// The session's figures are a page under the practice (an icon in the
// header, beside the (i)), the practice kept as it is behind it (KeptScreen).
export function PracticeScreens(props: PracticeScreensProps) {
  const {
    practice, scope, flavor, state, hold, elapsed, setup, caseLook, virtual, guided, results,
    solution, caseStats, progress, recognition, empty, roundDone, onNext, onUndo, onRetry, onStopByHand, onReset,
  } = props;
  const { t } = useT();
  const mounted = useMounted();
  const { holding } = useSmartCubeSettings();
  const cubeState = useSmartCube().state;
  const withCube = isCubeFlavor(flavor);
  const screen = practiceScreenOf({ state, hold: hold.phase });
  const hidden = useScreenHidden();

  // The timer screen has the page to itself: the header and the rest step
  // aside (after the hold timer's own effect, so this one has the last word).
  useEffect(() => { setTimerFocus(screen === 'timer' && !hidden); }, [screen, hold.phase, hidden]);
  useEffect(() => () => setTimerFocus(false), []);

  // The session's page, under this one (the algorithm practised goes with it in the query).
  const page = practicePageOf(usePathname() ?? '');
  const header = !hidden && page && (
    <HeaderPageLink
      label={t('trainer.noScramble.session')}
      icon={<SessionIcon />}
      href={`${practiceSessionPath(page)}${mounted ? window.location.search : ''}`}
      // Only once the session has a solve to show (one taken back does not count).
      show={results.some((result) => !result.undone)}
      lead={(
        <InfoTip className="shrink-0">
          <span className="block">{t(hintOf(practice, flavor, scope))}</span>
          {recognition && <span className="block">{t('trainer.hint.recognitionCube')}</span>}
          {scope === 'random' && <span className="block">{t('trainer.hint.selection')}</span>}
        </InfoTip>
      )}
    />
  );

  if (roundDone) {
    return (
      <>
        {header}
        <SolveFrame label={t('practice.round.done', { total: roundDone.total })} cube={null} cubeSize="hidden"
          head={<RoundDone {...roundDone} />} />
      </>
    );
  }

  const toolbar = mounted && <PracticeToolbar scope={scope} />;
  if (empty) {
    return (
      <>
        {header}
        <SolveFrame label={t('practice.screen.case')} cube={null} cubeSize="hidden"
          head={<ScrambleHead toolbar={toolbar} scramble={undefined} tokens={[]} done={null} />}
          tail={<div className="py-16 text-center">{empty}</div>} />
      </>
    );
  }

  // One cube for the case and timer screens, kept mounted (one WebGL
  // context) from the case to its result; a new one with each flavor.
  const done = guided ? guided.plan.tokens.slice(0, guided.doneTokens).join(' ') : '';
  const cube = flavor === 'no-scramble' ? virtual && (
    <VirtualCube key={flavor} practice={virtual.practice} holding={virtual.holding} setupAlg={virtual.setupAlg}
      moves={virtual.moves} resetKey={virtual.resetKey} className="h-full w-full" />
  ) : flavor === 'smart-setup' ? guided && (
    <VirtualCube
      key={flavor}
      practice={practice}
      holding={holding}
      setupAlg={`${displayRotation(holding)} ${done}`.trim()}
      moves={guided.moves}
      resetKey={0}
      guide={cubeState && (guided.phase === 'setup' || guided.phase === 'need-base')
        ? { state: cubeState, move: guided.phase === 'setup' ? guided.nextMove : { frame: holdingFrame(holding), alg: '' } }
        : null}
      className="h-full w-full"
    />
  ) : flavor === 'inverse' ? setup !== null && (
    // The case the setup makes, held as the smart cube would be.
    <VirtualCube key={flavor} practice={practice} holding={holding} setupAlg={`${displayRotation(holding)} ${setup}`.trim()} still className="h-full w-full" />
  ) : state === 'running' ? caseLook : null;
  const progressLead = progress ? <span className="pt-1.5 text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-300">{progress}</span> : undefined;

  if (screen === 'result') {
    return (
      <>
        {header}
        <SolveFrame label={t('practice.screen.result')} cube={cube} cubeSize="hidden"
          head={(
            <PracticeResultHead result={results[0]} elapsed={elapsed} solution={solution} caseStats={caseStats}
              onRetry={onRetry} onNext={onNext} onUndo={onUndo} />
          )} />
      </>
    );
  }

  // Without a cube or setup, the case screen is the timer at 0.00 (in the
  // place it runs in and the result shows the time in), the case to come
  // below it once it starts: a press held turns it red, then green, and
  // letting go starts it. The case screen's controls sit over the top,
  // out of sight while the timer is held or runs, so nothing moves.
  if (flavor === 'standard') {
    return (
      <>
        {header}
        <SolveFrame
          label={state === 'running' ? t('trainer.tapToStopAria') : t('trainer.hold.aria')}
          onPress={mounted ? hold.pressProps.onPointerDown : undefined}
          cube={cube}
          cubeSize="medium"
          head={(
            <>
              <div className={`absolute inset-x-3 top-3 sm:inset-x-4 sm:top-4 ${screen === 'timer' ? 'invisible' : ''}`}>
                <ScrambleHead toolbar={toolbar} lead={progressLead} scramble={undefined} tokens={[]} done={null} />
              </div>
              <DigitsArea under={null}>
                <TimerDigits tone={toneOf(hold.phase)}>{seconds(state === 'running' ? elapsed : 0)}</TimerDigits>
              </DigitsArea>
            </>
          )}
        />
      </>
    );
  }

  if (screen === 'timer') {
    const recognitionMs = recognition ? (flavor === 'no-scramble' ? virtual : guided)?.recognitionMs ?? null : null;
    return (
      <>
        {header}
        <SolveFrame
          label={state === 'running' ? t('trainer.tapToStopAria') : t('trainer.hold.aria')}
          // With a cube, a press stops the solve by hand; without one, the
          // press held starts it and a press anywhere stops it (useHoldTimer).
          onPress={withCube ? (state === 'running' ? onStopByHand : undefined) : hold.pressProps.onPointerDown}
          cube={cube}
          cubeSize={withCube ? 'small' : 'hidden'}
          head={(
            <DigitsArea under={withCube && recognitionMs !== null && (
              <span className="font-mono text-zinc-500 tabular-nums dark:text-zinc-400">{t('trainer.cube.recognition')} {formatSolveTime(recognitionMs)}</span>
            )}>
              <TimerDigits tone={withCube ? 'plain' : toneOf(hold.phase)}>{seconds(state === 'running' ? elapsed : 0)}</TimerDigits>
            </DigitsArea>
          )}
          tail={flavor === 'no-scramble' && state === 'running' && (
            <button type="button" onClick={onReset} className={buttonClass('secondary', 'sm')}>{t('trainer.noScramble.reset')}</button>
          )}
        />
      </>
    );
  }

  // The case screen: without a cube, pressing it holds for the timer.
  const scramble = flavor === 'inverse' ? setup ?? null
    : flavor === 'smart-setup' ? (guided ? guided.plan.tokens.join(' ') : setup ?? null)
      : undefined;
  const setupStatus = flavor === 'smart-setup' && guided ? setupStatusKey(guided, practice) : null;
  const ready = !recognition ? null
    : flavor === 'no-scramble' ? virtual?.shownAt ?? null
      : flavor === 'smart-setup' && guided?.phase === 'ready' ? guided.readySince : null;
  return (
    <>
      {header}
      <SolveFrame
        label={t('practice.screen.case')}
        onPress={withCube || !mounted ? undefined : hold.pressProps.onPointerDown}
        cube={cube}
        cubeSize="large"
        head={(
          <ScrambleHead
            toolbar={toolbar}
            lead={progressLead}
            scramble={scramble}
            tokens={guided ? guided.plan.tokens : scramble?.split(' ') ?? []}
            done={flavor === 'smart-setup' && guided ? guided.doneTokens : null}
            undo={flavor === 'smart-setup' && guided?.phase === 'setup' ? guided.undo : ''}
            status={setupStatus && t(setupStatus)}
          />
        )}
        // Its place is kept from the start, so the cube does not move when the count comes.
        tail={<div className="flex h-12 items-center">{ready !== null && <RecognitionCount key={ready} since={ready} />}</div>}
      />
    </>
  );
}
