// The timer without a smart cube, as cube timer apps run it: hold to get
// ready, let go to start, press again to stop. Pure, so the moves between
// states can be checked on their own (scripts/verify-practice.mts).

/** How long a press must last before letting go starts the timer. */
export const HOLD_MS = 300;

/**
 * idle: waiting. pressed: held, not long enough yet (letting go now does not
 * start). armed: held long enough; letting go starts. running: timing.
 * stopped: the result is on screen.
 */
export type HoldPhase = 'idle' | 'pressed' | 'armed' | 'running' | 'stopped';

/** press / release: a finger, the mouse or Space. held: HOLD_MS passed since the press. cancel: Escape, or the touch was taken away. */
export type HoldInput = 'press' | 'release' | 'held' | 'cancel';

/** What the trainer does on the way: start or stop timing, drop the attempt, or go on from the result. */
export type HoldEffect = 'start' | 'stop' | 'abort' | 'next' | null;

export function holdStep(
  phase: HoldPhase,
  input: HoldInput,
  /** On the result screen, a press goes on and starts holding at once (no setup to make first). */
  { pressOnNext = false }: { pressOnNext?: boolean } = {},
): { phase: HoldPhase; effect: HoldEffect } {
  const stay = { phase, effect: null };
  switch (phase) {
    case 'idle':
      return input === 'press' ? { phase: 'pressed', effect: null } : stay;
    case 'pressed':
      if (input === 'held') return { phase: 'armed', effect: null };
      if (input === 'release' || input === 'cancel') return { phase: 'idle', effect: null };
      return stay;
    case 'armed':
      if (input === 'release') return { phase: 'running', effect: 'start' };
      if (input === 'cancel') return { phase: 'idle', effect: null };
      return stay;
    case 'running':
      if (input === 'press') return { phase: 'stopped', effect: 'stop' };
      if (input === 'cancel') return { phase: 'idle', effect: 'abort' };
      return stay;
    case 'stopped':
      return input === 'press' ? { phase: pressOnNext ? 'pressed' : 'idle', effect: 'next' } : stay;
  }
}

/** The timer digits' colour: red while held too briefly to start, green once letting go starts, otherwise plain (running too). */
export type TimerTone = 'held' | 'ready' | 'plain';

export const toneOf = (phase: HoldPhase): TimerTone => (phase === 'pressed' ? 'held' : phase === 'armed' ? 'ready' : 'plain');
