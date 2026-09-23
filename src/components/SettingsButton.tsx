'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePersistence } from '@/hooks/usePersistence';
import { closeAppDialog, getAppDialog, getAppDialogServerSnapshot, openAccountDialog, openAppDialog, subscribeAppDialog } from '@/lib/app-dialog';
import { AccountPanel } from './AccountPanel';
import { AppModal } from './AppModal';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { AlgorithmTransfer } from './AlgorithmTransfer';
import { AufModeToggle } from './AufModeToggle';
import { RandomAufToggle } from './RandomAufToggle';
import { TrainerModeToggle } from './TrainerModeToggle';
import { LocaleToggle } from './LocaleToggle';
import { WritableArea } from './AccountBoundary';
import { useColorTheme } from '@/hooks/useColorTheme';
import { canWriteData } from '@/lib/persistence';
import { PublicLinks } from './PublicLinks';
import { InfoTip } from './InfoTip';

function GearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  info,
  children,
}: {
  title: MessageKey;
  info?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1 text-sm font-medium">
        {t(title)}
        {info && <InfoTip>{info}</InfoTip>}
      </h3>
      {children}
    </section>
  );
}

// "Label — explanation" help line inside a section's tooltip.
function Help({ label, text }: { label: MessageKey; text: MessageKey }) {
  const { t } = useT();
  return (
    <span className="block">
      <span className="font-medium text-zinc-800 dark:text-zinc-100">{t(label)}</span> — {t(text)}
    </span>
  );
}

const Divider = () => <div className="border-t border-zinc-200 dark:border-zinc-800" />;
const MENU_ITEMS = ['account', 'data', 'settings'] as const;
function MenuIcon({ item }: { item: (typeof MENU_ITEMS)[number] }) {
  if (item === 'settings') return <GearIcon size={16} />;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {item === 'account' ? <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
      </> : <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" />
      </>}
    </svg>
  );
}

const DIALOG_TITLES = {
  account: 'account.title',
  settings: 'settings.title',
  data: 'common.data',
} as const satisfies Record<(typeof MENU_ITEMS)[number], MessageKey>;

export function SettingsButton() {
  const { t } = useT();
  const state = usePersistence();
  const { dark, toggle } = useColorTheme();
  const pathname = usePathname();
  const dialog = useSyncExternalStore(subscribeAppDialog, getAppDialog, getAppDialogServerSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const firstItem = useRef(0);

  useEffect(() => {
    if (pathname === '/account' || pathname === '/account/') openAccountDialog();
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    items.current[firstItem.current]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [menuOpen]);

  const choose = (target: (typeof MENU_ITEMS)[number]) => {
    setMenuOpen(false);
    trigger.current?.focus();
    openAppDialog(target);
  };

  return <>
    <div ref={container} className="relative ml-auto shrink-0"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
      <button ref={trigger} type="button"
        // Keep focus inside the menu until click, including browsers that blur
        // the active menu item without focusing a pointer-clicked button.
        onPointerDown={(event) => { if (menuOpen) event.preventDefault(); }}
        onClick={() => { firstItem.current = 0; trigger.current?.focus(); setMenuOpen((open) => !open); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            firstItem.current = event.key === 'ArrowUp' ? MENU_ITEMS.length : 0;
            setMenuOpen(true);
          }
        }}
        aria-label={t('common.menu')} title={t('common.menu')} aria-haspopup="menu"
        aria-expanded={menuOpen} aria-controls={menuOpen ? 'header-menu' : undefined}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
        <GearIcon />
      </button>
      {menuOpen && <div id="header-menu" role="menu" aria-label={t('common.menu')} data-app-overlay
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            setMenuOpen(false); trigger.current?.focus();
          } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const index = items.current.indexOf(document.activeElement as HTMLButtonElement);
            const count = MENU_ITEMS.length + 1;
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
            items.current[next]?.focus();
          }
        }}
        className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        {MENU_ITEMS.map((target, index) => <button key={target}
          ref={(element) => { items.current[index] = element; }} type="button" role="menuitem" tabIndex={-1}
          onClick={() => choose(target)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800">
          <MenuIcon item={target} />
          {t(DIALOG_TITLES[target])}
        </button>)}
        <div role="separator" className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
        <button ref={(element) => { items.current[MENU_ITEMS.length] = element; }}
          type="button" role="menuitemcheckbox" aria-checked={dark} aria-disabled={!canWriteData()}
          tabIndex={-1} onClick={() => { if (canWriteData()) { try { toggle(); } catch { /* StorageStatus reports the failure. */ } } }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none aria-disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z" /></svg>
          <span className="flex-1">{t('settings.darkMode')}</span>
          <span aria-hidden="true" className={`flex h-5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${dark ? 'bg-emerald-600' : 'bg-zinc-300'}`}>
            <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${dark ? 'translate-x-3' : ''}`} />
          </span>
        </button>
      </div>}
    </div>
    {dialog && <AppModal key={dialog}
      title={t(DIALOG_TITLES[dialog])}
      onClose={closeAppDialog}>
      {dialog === 'account' ? <AccountPanel key={state.generation} /> : dialog === 'data' ? (
        <WritableArea><AlgorithmTransfer key={state.generation} /></WritableArea>
      ) : (
        <>
        <WritableArea>
          <div className="space-y-4">
            <Section title="settings.language.title">
              <LocaleToggle />
            </Section>

            <Divider />

            <Section title="settings.aufDisplay.title" info={<>
              <span className="block">{t('settings.aufDisplay.help')}</span>
              <Help label="settings.aufDisplay.onCube" text="settings.aufDisplay.onCubeHelp" />
              <Help label="settings.aufDisplay.inAlgorithm" text="settings.aufDisplay.inAlgorithmHelp" />
            </>}>
              <AufModeToggle />
            </Section>

            <Divider />

            <Section title="settings.trainerMode.title" info={<>
              <span className="block">{t('settings.trainerMode.help')}</span>
              <Help label="settings.trainerMode.standard" text="settings.trainerMode.standardHelp" />
              <Help label="settings.trainerMode.inverse" text="settings.trainerMode.inverseHelp" />
            </>}>
              <TrainerModeToggle />
              <RandomAufToggle />
            </Section>

          </div>
        </WritableArea>
        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800"><PublicLinks onNavigate={closeAppDialog} /></div>
        </>
      )}
    </AppModal>}
  </>;
}
