'use client';

import { lazy, Suspense } from 'react';
import { useDevMode } from '@/hooks/useDevMode';
import { useMounted } from '@/hooks/useMounted';

// Loaded only for a developer with developer mode on, so nobody else
// downloads the note tools (or the screenshot library).
const DevNoteLayer = lazy(() => import('./DevNoteLayer'));

/** Developer mode's pen and note tools, over every page while it is on. */
export function DevMode() {
  const mounted = useMounted();
  const { active } = useDevMode();
  if (!mounted || !active) return null;
  return <Suspense fallback={null}><DevNoteLayer /></Suspense>;
}
