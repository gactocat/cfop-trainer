'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { AlgorithmTransfer } from './AlgorithmTransfer';
import { F2LAufModeToggle } from './F2LAufModeToggle';
import { F2LScrambleSettings } from './F2LScrambleSettings';
import { F2LTrainerModeToggle } from './F2LTrainerModeToggle';
import { LocaleToggle } from './LocaleToggle';

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

function Section({
  title,
  description,
  children,
}: {
  title: MessageKey;
  description: MessageKey;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-medium">{t(title)}</h3>
        <p className="text-xs text-zinc-500">{t(description)}</p>
      </div>
      {children}
    </section>
  );
}

// "Label — explanation" help line under a toggle.
function Help({ label, text }: { label: MessageKey; text: MessageKey }) {
  const { t } = useT();
  return (
    <li>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{t(label)}</span> — {t(text)}
    </li>
  );
}

const Divider = () => <div className="border-t border-zinc-200 dark:border-zinc-800" />;

export function SettingsButton() {
  const { t } = useT();
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
        aria-label={t('common.settings')}
        aria-haspopup="dialog"
        title={t('common.settings')}
        className="ml-auto inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <GearIcon />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
            // Cap the height and scroll inside: a fixed overlay adds nothing to
            // the page's scroll height, so without this the settings are simply
            // cut off on small screens.
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 id="settings-title" className="text-base font-semibold">
                {t('settings.title')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('settings.closeAria')}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <Section title="settings.language.title" description="settings.language.description">
                <LocaleToggle />
              </Section>

              <Divider />

              <Section
                title="settings.aufDisplay.title"
                description="settings.aufDisplay.description"
              >
                <F2LAufModeToggle />
                <ul className="text-xs text-zinc-500 space-y-1">
                  <Help label="settings.aufDisplay.onCube" text="settings.aufDisplay.onCubeHelp" />
                  <Help
                    label="settings.aufDisplay.inAlgorithm"
                    text="settings.aufDisplay.inAlgorithmHelp"
                  />
                </ul>
              </Section>

              <Divider />

              <Section
                title="settings.trainerMode.title"
                description="settings.trainerMode.description"
              >
                <F2LTrainerModeToggle />
                <ul className="text-xs text-zinc-500 space-y-1">
                  <Help
                    label="settings.trainerMode.standard"
                    text="settings.trainerMode.standardHelp"
                  />
                  <Help
                    label="settings.trainerMode.inverse"
                    text="settings.trainerMode.inverseHelp"
                  />
                </ul>
              </Section>

              <Divider />

              <Section title="settings.scramble.title" description="settings.scramble.description">
                <F2LScrambleSettings />
                <ul className="text-xs text-zinc-500 space-y-1">
                  <Help label="settings.scramble.varied" text="settings.scramble.variedHelp" />
                  <Help label="settings.scramble.inverse" text="settings.scramble.inverseHelp" />
                </ul>
              </Section>

              <Divider />

              <AlgorithmTransfer />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
