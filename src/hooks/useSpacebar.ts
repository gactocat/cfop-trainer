'use client';

import { useEffect } from 'react';
import { canWriteData } from '@/lib/persistence';

// Fire `handler` when the user presses Space anywhere on the page, EXCEPT
// while focus is in a text-entry control (input/textarea/select/content-
// editable) so typing an algorithm or a seconds value still works normally.
// Auto-repeat presses are ignored to avoid double-fires when the user holds
// the key down.
export function useSpacebar(handler: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat || !canWriteData() || document.querySelector('[aria-modal="true"][aria-labelledby="settings-title"]')) return;
      const target = e.target as (HTMLElement & { isContentEditable?: boolean }) | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler, active]);
}
