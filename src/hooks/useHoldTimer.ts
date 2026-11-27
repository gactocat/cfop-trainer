'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { HOLD_MS, holdStep, type HoldInput, type HoldPhase } from '@/lib/hold-timer';
import { canWriteData } from '@/lib/persistence';
import { setTimerFocus } from '@/lib/timer-focus';

type TrainerState = 'idle' | 'running' | 'stopped';

const typing = (target: EventTarget | null) => {
  const element = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  const tag = element?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!element?.isContentEditable;
};
const isSpace = (event: KeyboardEvent) => event.code === 'Space' || event.key === ' ';

/**
 * Hold to start, let go to go, press to stop (see hold-timer.ts), from a
 * finger or the mouse on the press area (`pressProps`), or Space. While the
 * timer runs, a press anywhere stops it. Escape drops a hold or a running
 * attempt. While armed or running, everything but the timer steps aside
 * (timer-focus.ts).
 */
export function useHoldTimer({ active, state, pressOnNext, onStart, onStop, onAbort, onNext }: {
  active: boolean;
  /** The trainer's own state: running and stopped come from it. */
  state: TrainerState;
  /** On the result screen, Space goes on and starts holding at once. */
  pressOnNext: boolean;
  onStart: () => void;
  onStop: () => void;
  onAbort: () => void;
  onNext: () => void;
}): {
  phase: HoldPhase;
  pressProps: {
    onPointerDown: (event: ReactPointerEvent) => void;
    onContextMenu: (event: { preventDefault: () => void }) => void;
  };
} {
  const [press, setPress] = useState<'idle' | 'pressed' | 'armed'>('idle');
  // A hold left over when the timer is switched off (the press on the last
  // result that ends a round) must not come back with it.
  if (!active && press !== 'idle') setPress('idle');
  const phase: HoldPhase = !active ? 'idle' : state === 'running' ? 'running' : state === 'stopped' ? 'stopped' : press;
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; });
  const callbacks = useRef({ pressOnNext, onStart, onStop, onAbort, onNext });
  useEffect(() => { callbacks.current = { pressOnNext, onStart, onStop, onAbort, onNext }; });
  // The finger holding, so a second one does not count as letting go.
  const pointerRef = useRef<number | null>(null);

  const input = useCallback((what: HoldInput) => {
    const { phase: next, effect } = holdStep(phaseRef.current, what, { pressOnNext: callbacks.current.pressOnNext });
    phaseRef.current = next;
    setPress(next === 'pressed' || next === 'armed' ? next : 'idle');
    if (effect === 'start') callbacks.current.onStart();
    else if (effect === 'stop') callbacks.current.onStop();
    else if (effect === 'abort') callbacks.current.onAbort();
    else if (effect === 'next') callbacks.current.onNext();
  }, []);

  // Held long enough: letting go now starts.
  useEffect(() => {
    if (phase !== 'pressed') return;
    const timer = setTimeout(() => input('held'), HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, input]);

  // Space holds and lets go; Escape drops a hold or the attempt (and only
  // then, so on other screens it still closes or takes back as before).
  useEffect(() => {
    if (!active) return;
    const blocked = (event: KeyboardEvent) =>
      typing(event.target) || !canWriteData() || !!document.querySelector('[data-app-overlay]');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!['pressed', 'armed', 'running'].includes(phaseRef.current) || blocked(event)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        input('cancel');
        return;
      }
      if (!isSpace(event) || blocked(event)) return;
      event.preventDefault();
      if (!event.repeat) input('press');
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isSpace(event) || typing(event.target)) return;
      event.preventDefault();
      input('release');
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [active, input]);

  // Letting go of the press area (wherever the finger ends up), and, while
  // running, a press anywhere to stop.
  const holding = phase === 'pressed' || phase === 'armed';
  const running = phase === 'running';
  useEffect(() => {
    if (!holding && !running) return;
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerRef.current) return;
      pointerRef.current = null;
      input(event.type === 'pointercancel' ? 'cancel' : 'release');
    };
    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      event.preventDefault();
      event.stopPropagation();
      input('press');
      // The result appears under the finger: the click that ends this press
      // must not land on its Next or Undo.
      const swallow = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true), 700);
    };
    if (holding) {
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    } else {
      window.addEventListener('pointerdown', onDown, true);
    }
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [holding, running, input]);

  // Everything but the timer steps aside while armed or running.
  const focus = phase === 'armed' || phase === 'running';
  useEffect(() => {
    setTimerFocus(focus);
    return () => setTimerFocus(false);
  }, [focus]);

  return {
    phase,
    pressProps: {
      onPointerDown: (event) => {
        if (!event.isPrimary || event.button !== 0 || phaseRef.current !== 'idle') return;
        // No text selection, callout or magnifier from a long press.
        event.preventDefault();
        pointerRef.current = event.pointerId;
        input('press');
      },
      onContextMenu: (event) => event.preventDefault(),
    },
  };
}
