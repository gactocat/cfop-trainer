'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { F2LAufModeToggle } from './F2LAufModeToggle';
import { F2LTrainerModeToggle } from './F2LTrainerModeToggle';
import { AlgorithmTransfer } from './AlgorithmTransfer';

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        aria-haspopup="dialog"
        title="Settings"
        className="ml-auto inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <GearIcon />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 id="settings-title" className="text-base font-semibold">
                Settings
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close settings"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <section className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium">AUF display (F2L)</h3>
                  <p className="text-xs text-zinc-500">
                    How an algorithm&apos;s AUF is shown.
                  </p>
                </div>
                <F2LAufModeToggle />
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      On cube
                    </span>{' '}
                    — rotate the displayed cube; the algorithm shows just its body.
                  </li>
                  <li>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      In algorithm
                    </span>{' '}
                    — show the raw case; the AUF appears as the algorithm&apos;s
                    leading turn.
                  </li>
                </ul>
              </section>

              <div className="border-t border-zinc-200 dark:border-zinc-800" />

              <section className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium">Random trainer mode (F2L)</h3>
                  <p className="text-xs text-zinc-500">
                    How the random trainer sets up each case.
                  </p>
                </div>
                <F2LTrainerModeToggle />
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Standard
                    </span>{' '}
                    — a hidden case appears and timing starts immediately.
                  </li>
                  <li>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Inverse setup
                    </span>{' '}
                    — the inverse algorithm is shown first so you can scramble your
                    own cube into the case, then START to time.
                  </li>
                </ul>
              </section>

              <div className="border-t border-zinc-200 dark:border-zinc-800" />

              <AlgorithmTransfer />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
