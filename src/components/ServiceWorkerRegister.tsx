'use client';

import { useEffect } from 'react';
import { isNativeApp } from '@/lib/native';

// Registers /sw.js after the page becomes interactive. Service workers are
// skipped on http:// origins other than localhost, so this is effectively a
// no-op during local dev unless you hit the production-style build.
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isNativeApp() || process.env.NEXT_PUBLIC_NATIVE_APP === '1') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Registration failures shouldn't crash the app; surface in devtools.
        console.warn('Service worker registration failed:', err);
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
