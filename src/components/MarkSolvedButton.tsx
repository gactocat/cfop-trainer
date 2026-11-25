'use client';

import { useEffect, useState } from 'react';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import { markSolved } from '@/lib/smart-cube-store';

// "Mark as solved": when the screen no longer matches the cube in hand and
// that cube is solved, reset what the cube and the app take its state to be.
// `button` in the smart cube dialog, `link` beside a cube's name or on a
// practice screen. Shown only while a cube is connected.
export function MarkSolvedButton({ variant }: { variant: 'button' | 'link' }) {
  const { t } = useT();
  const connected = useSmartCube().status === 'connected';
  const [result, setResult] = useState<'done' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 2500);
    return () => clearTimeout(timer);
  }, [result]);
  if (!connected) return null;

  const press = async () => {
    setBusy(true);
    const ok = await markSolved();
    setBusy(false);
    setResult(ok ? 'done' : 'failed');
  };
  const message = result && (
    <span role="status" className={result === 'done' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200'}>
      {t(result === 'done' ? 'smartCube.markSolved.done' : 'smartCube.markSolved.failed')}
    </span>
  );

  // Small, beside a cube: the message takes the link's place for a moment.
  if (variant === 'link') {
    return result ? <span className="whitespace-nowrap py-1">{message}</span> : (
      <button type="button" disabled={busy} onClick={() => void press()}
        className="whitespace-nowrap rounded px-1 py-1 underline hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100">
        {t('smartCube.markSolved')}
      </button>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => void press()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
          {t('smartCube.markSolved')}
        </button>
        {message}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('smartCube.markSolved.help')}</p>
    </div>
  );
}
