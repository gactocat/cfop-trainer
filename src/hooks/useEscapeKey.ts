'use client';

import { useEffect } from 'react';

// Fire `handler` when the user presses Escape, while `active`. Listens in the
// capture phase and stops the event there, so an enclosing dialog that closes
// on Escape (FullScreenModal, the settings dialog) does not also react: on
// the trainer's result screen Escape means "discard this time", not "leave".
// Ignored while focus is in a text-entry control.
export function useEscapeKey(handler: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return;
      const target = e.target as (HTMLElement & { isContentEditable?: boolean }) | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      handler();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handler, active]);
}
