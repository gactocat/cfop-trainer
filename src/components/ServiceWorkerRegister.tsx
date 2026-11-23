'use client';

import { useEffect } from 'react';
import { isNativeApp } from '@/lib/native';

// Registers /sw.js after the page becomes interactive, in production builds
// only. The dev server keeps its chunk names across edits, so a cached copy
// would mix old and new code (new screens showing old, missing messages);
// there any earlier registration is removed instead.
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isNativeApp() || process.env.NEXT_PUBLIC_NATIVE_APP === '1') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }

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
