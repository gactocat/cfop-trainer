'use client';

import { useT } from '@/hooks/useT';
import { SETTLE_MS, type NoScrambleResult, type useNoScrambleTrainer } from '@/hooks/useNoScrambleTrainer';
import type { MessageKey } from '@/i18n/messages';
import { openAppDialog } from '@/lib/app-dialog';
import type { CubeHolding } from '@/lib/smart-cube/holding';
import { averageOfN, averageSeconds, bestSeconds, formatSeconds } from '@/lib/stats';
import { VirtualCube } from './VirtualCube';

type TrainerState = 'idle' | 'running' | 'stopped';
type Trainer = ReturnType<typeof useNoScrambleTrainer>;

const HOLDING: Record<CubeHolding, MessageKey> = {
  'yellow-blue': 'smartCube.holding.yellowBlue',
  'yellow-green': 'smartCube.holding.yellowGreen',
  'white-green': 'smartCube.holding.whiteGreen',
};

// The cube's frame says what the trainer is doing; the rest of the screen stays calm.
const RING: Record<TrainerState, string> = {
  idle: 'ring-emerald-400/80 dark:ring-emerald-500/70',
  running: 'ring-rose-400 dark:ring-rose-500',
  stopped: 'ring-amber-400 dark:ring-amber-500',
};

const SHOWN_RESULTS = 8;

// No-scramble practice, driven by the cube alone: the virtual cube in the
// middle, what to do or the result beside it, and this session's solves.
// The cube's frame keeps its place in every state, so the same player (and
// WebGL context) stays mounted and nothing moves under the solver's eyes.
export function NoScrambleStage({ state, trainer, elapsed, selectedNote }: {
  state: TrainerState;
  trainer: Trainer;
  elapsed: number;
  selectedNote: string;
}) {
  const { t } = useT();
  const { view, connected, results, settle } = trainer;
  const latest = state === 'stopped' ? results[0] : undefined;

  return (
    <div className="w-full flex-1 min-h-[280px] rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950/60 flex flex-col items-center justify-start gap-6 xl:flex-row xl:items-center xl:justify-center select-none">
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-zinc-200/80 px-2.5 py-1 dark:bg-zinc-800">
              {view ? t(HOLDING[view.holding]) : ' '}
            </span>
            {connected && state !== 'stopped' && (
              <button type="button" onClick={trainer.reset} className="rounded px-1 py-1 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                {t('trainer.noScramble.reset')}
              </button>
            )}
          </div>
          <div className={`shrink-0 rounded-xl bg-zinc-100 p-2 ring-4 transition-colors dark:bg-zinc-900 w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] ${RING[state]}`}>
            {view && (
              <VirtualCube
                practice={view.practice}
                holding={view.holding}
                setupAlg={view.setupAlg}
                moves={view.moves}
                resetKey={view.resetKey}
                className="w-full h-full"
              />
            )}
          </div>
        </div>

        {/* As tall as the cube, so changing what it shows never moves the cube. */}
        <div className="flex w-full max-w-sm min-h-[300px] flex-col items-center justify-center gap-3 text-center md:w-80 md:min-h-[332px]">
          {!connected ? (
            <>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t('trainer.noScramble.connect')}</p>
              <button
                type="button"
                onClick={() => openAppDialog('smartCube')}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {t('trainer.noScramble.connectButton')}
              </button>
            </>
          ) : state === 'idle' ? (
            <>
              <div className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {t('trainer.noScramble.firstTurn')}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.anyState')}</p>
            </>
          ) : state === 'running' ? (
            <button
              type="button"
              onPointerDown={trainer.stopByHand}
              aria-label={t('trainer.tapToStopAria')}
              className="flex flex-col items-center gap-2 rounded-md px-4 py-2 touch-none"
            >
              <span className="font-mono text-6xl sm:text-7xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50" aria-live="polite">
                {elapsed.toFixed(3)}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">{t('smartCube.trainer.autoStop')}</span>
              <span className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.resetHint')}</span>
            </button>
          ) : (
            <Result result={latest} elapsed={elapsed} settle={settle} onNext={trainer.next} onUndo={trainer.undo} />
          )}
        </div>
      </div>

      <Session results={results} note={selectedNote} />
    </div>
  );
}

function Result({ result, elapsed, settle, onNext, onUndo }: {
  result: NoScrambleResult | undefined;
  elapsed: number;
  settle: { key: number } | null;
  onNext: () => void;
  onUndo: (key: number) => void;
}) {
  const { t } = useT();
  const details = result && [
    result.recognitionMs !== null && t('smartCube.trainer.recognition', { seconds: (result.recognitionMs / 1000).toFixed(2) }),
    result.moveCount !== null && result.tps !== null && t('smartCube.solve.summary', { moves: result.moveCount, tps: result.tps.toFixed(2) }),
  ].filter(Boolean).join(' · ');
  return (
    <>
      {result && (
        <div className="text-sm font-semibold tracking-wide text-amber-700 dark:text-amber-300">{result.name}</div>
      )}
      <div className={`font-mono text-6xl sm:text-7xl font-bold tabular-nums leading-none ${
        result?.undone ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-50'
      }`}>
        {(result?.seconds ?? elapsed).toFixed(3)}
      </div>
      {details && <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{details}</div>}
      {result?.solution && (
        <p className="max-w-xs font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">{result.solution}</p>
      )}
      <div className="mt-1 flex w-full max-w-xs flex-col items-center gap-2">
        {settle && (
          <>
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
              <div
                key={settle.key}
                className="h-full origin-left bg-emerald-500"
                style={{ animation: `no-scramble-settle ${SETTLE_MS}ms linear forwards` }}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.settle')}</p>
          </>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t('trainer.noScramble.next')}
            <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Space</kbd>
          </button>
          {result && !result.undone && (
            <button
              type="button"
              onClick={() => onUndo(result.key)}
              className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {t('trainer.noScramble.undo')}
              <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Esc</kbd>
            </button>
          )}
        </div>
        {result?.undone && <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.undone')}</p>}
      </div>
    </>
  );
}

function Session({ results, note }: { results: readonly NoScrambleResult[]; note: string }) {
  const { t } = useT();
  const kept = results.filter((r) => !r.undone).map((r) => ({ id: String(r.key), seconds: r.seconds, recordedAt: '' }));
  const stats: [MessageKey, string][] = [
    ['trainer.noScramble.solves', String(kept.length)],
    ['trainer.noScramble.mean', formatSeconds(averageSeconds(kept))],
    ['trainer.noScramble.ao5', formatSeconds(averageOfN(kept, 5))],
    ['trainer.noScramble.best', formatSeconds(bestSeconds(kept))],
  ];
  return (
    <aside className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 xl:w-64">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.session')}</h3>
      <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] text-zinc-500 dark:text-zinc-400">{t(label)}</dt>
            <dd className="font-mono text-xs font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {results.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.empty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {results.slice(0, SHOWN_RESULTS).map((r) => (
            <li key={r.key} className={`flex items-baseline justify-between gap-3 py-1 ${r.undone ? 'opacity-50 line-through' : ''}`}>
              <span className="truncate text-xs text-zinc-600 dark:text-zinc-300">{r.name}</span>
              <span className="font-mono text-xs tabular-nums">{r.seconds.toFixed(3)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">{note}</p>
    </aside>
  );
}
