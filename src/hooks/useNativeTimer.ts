'use client';

import { useEffect } from 'react';
import { isNativeApp, NativeBridge } from '@/lib/native';

let activeTimers = 0;

// Keep the screen on while anything needs it; one counter for every caller.
function holdAwake(): () => void {
  activeTimers += 1;
  void NativeBridge.keepAwake({ enabled: true }).catch(() => {});
  return () => {
    activeTimers -= 1;
    void NativeBridge.keepAwake({ enabled: activeTimers > 0 }).catch(() => {});
  };
}

// Stop at interruption, leaving the result for the user to record or discard.
export function useNativeTimer(running: boolean, stop: () => void) {
  useEffect(() => {
    if (!running || !isNativeApp()) return;
    const release = holdAwake();
    window.addEventListener('cfop:pause', stop);
    return () => {
      window.removeEventListener('cfop:pause', stop);
      release();
    };
  }, [running, stop]);
}

/** Keep the app's screen on while `enabled`, e.g. while practising without touching it. */
export function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isNativeApp()) return;
    return holdAwake();
  }, [enabled]);
}
