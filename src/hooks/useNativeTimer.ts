'use client';

import { useEffect } from 'react';
import { isNativeApp, NativeBridge } from '@/lib/native';

let activeTimers = 0;

// Stop at interruption, leaving the result for the user to record or discard.
export function useNativeTimer(running: boolean, stop: () => void) {
  useEffect(() => {
    if (!running || !isNativeApp()) return;
    activeTimers += 1;
    void NativeBridge.keepAwake({ enabled: true }).catch(() => {});
    window.addEventListener('cfop:pause', stop);
    return () => {
      window.removeEventListener('cfop:pause', stop);
      activeTimers -= 1;
      void NativeBridge.keepAwake({ enabled: activeTimers > 0 }).catch(() => {});
    };
  }, [running, stop]);
}
