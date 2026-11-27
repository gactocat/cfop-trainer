'use client';

import { useId, type ReactNode } from 'react';
import { InfoTip } from './InfoTip';

// The app's controls, one of each kind, so every screen has the same sizes,
// corners, colours and spacing. Heights: a main action and a choice are 36 px
// (md), a small action in a row or toolbar 32 px (sm).

/** A card: the top page's groups, a solve's screens, a list's cases. */
export const CARD = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

/** The small label above a figure or a block on a card. */
export const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

const FIELD = 'min-w-0 rounded-md border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
/** A text box or select, as tall as a md button (16 px text on a phone, so it does not zoom). */
export const INPUT = `${FIELD} h-9 w-full px-3 text-base sm:text-sm`;
/** A select among sm buttons in a toolbar. */
export const INPUT_SM = `${FIELD} h-8 px-2 text-xs`;

const BUTTON_BASE = 'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:pointer-events-none disabled:opacity-50';
const BUTTON_SIZE = { md: 'h-9 px-4 text-sm', sm: 'h-8 px-3 text-xs' } as const;
const BUTTON_VARIANT = {
  /** The screen's action: Next, Save, Connect. One per place. */
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  /** Beside the primary, or an action of its own: Retry, Undo, Cancel. */
  secondary: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
  /** An action among others in a row (a list item's Edit). */
  ghost: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
  /** The row's own action among ghost ones (a list item's Practice). */
  ghostAccent: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
  /** Delete among ghost ones. */
  ghostDanger: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50',
  /** A secondary button that stays pressed (a penalty set). */
  pressed: 'border border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900',
  /** Deletes or ends something for good. */
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/50',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;

/** A button's (or a link's) classes. */
export function buttonClass(variant: ButtonVariant, size: keyof typeof BUTTON_SIZE = 'md'): string {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]}`;
}

/** A word that acts, in running text or under a setting. */
export const LINK = 'font-medium text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:text-emerald-300';

const ICON_VARIANT = {
  /** In the app header, as a button among buttons. */
  outline: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
  /** In a card's corner or a dialog's title bar. */
  ghost: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
} as const;

const ICON_PRESSED = 'border border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300';

/**
 * A button that is only an icon (its name in aria-label and title);
 * `pressed` while what it turns on is on; `sm` inside a list's row.
 */
export function iconButtonClass(variant: keyof typeof ICON_VARIANT = 'ghost', pressed = false, size: 'md' | 'sm' = 'md'): string {
  return `relative inline-flex ${size === 'sm' ? 'size-8' : 'size-9'} shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:pointer-events-none disabled:opacity-40 ${pressed ? ICON_PRESSED : ICON_VARIANT[variant]}`;
}

/** The icons' common frame: 24 px drawing, 2 px strokes, drawn at 18 px unless told. */
export function Icon({ children, className = 'size-4.5' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={`shrink-0 ${className}`}>
      {children}
    </svg>
  );
}

export const CloseIcon = () => <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const ChevronIcon = ({ className = 'size-4' }: { className?: string }) => <Icon className={className}><path d="m9 6 6 6-6 6" /></Icon>;

export interface SegmentedOption<T extends string> {
  value: T;
  /** Shown; for an icon-only option, `name` gives its name. */
  label?: ReactNode;
  icon?: ReactNode;
  /** The option's name for screen readers and its tooltip, when the label is an icon or short. */
  name?: string;
  title?: string;
  disabled?: boolean;
  lang?: string;
}

/**
 * One choice among a few, side by side (language, theme, AUF, setup on or
 * off). The chosen one is filled. `value` null shows none chosen (before the
 * stored choice is known in the browser). `vertical` stacks long options.
 */
export function Segmented<T extends string>({ label, value, options, onChange, vertical = false, mono = false, className = '' }: {
  /** The choice's name, for screen readers. */
  label: string;
  value: T | null;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  vertical?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label}
      className={`${vertical ? 'flex w-full flex-col' : 'inline-flex max-w-full flex-wrap'} gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        const iconOnly = option.icon && option.label === undefined;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.name}
            title={option.title ?? option.name}
            lang={option.lang}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 ${
              iconOnly ? 'w-10 justify-center' : vertical ? 'justify-start px-3' : 'justify-center px-3'
            } ${mono ? 'font-mono' : ''} ${active
              ? 'bg-emerald-600 text-white'
              : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100'}`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** On or off (inspection, the next case by itself). */
export function Switch({ checked, onChange, label, labelledBy, disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Its name, unless `labelledBy` points at it. */
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-labelledby={labelledBy}
      disabled={disabled} onClick={() => onChange(!checked)}
      className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
      <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

/** Settings as one card, a row each (SettingRow), on the top page and in the settings dialogs alike. */
export function SettingsGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${CARD} ${className}`}>{children}</div>;
}

/**
 * One setting: its name (with its (i) and, under it, what it is now when
 * that needs saying) on the left, the control on the right, or under the
 * name when the row is too narrow or `stacked` (a control as wide as the row).
 * `children` gets the name's id, for a switch named by it.
 */
export function SettingRow({ label, info, detail, stacked = false, children }: {
  label: ReactNode;
  info?: ReactNode;
  detail?: ReactNode;
  stacked?: boolean;
  children?: ReactNode | ((labelId: string) => ReactNode);
}) {
  const id = useId();
  return (
    <div className={`flex min-h-14 gap-x-4 gap-y-2 px-4 py-3 ${stacked ? 'flex-col' : 'flex-wrap items-center justify-between'}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-sm font-medium">
          <span id={id}>{label}</span>
          {info && <InfoTip>{info}</InfoTip>}
        </div>
        {detail !== undefined && <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{detail}</div>}
      </div>
      {typeof children === 'function' ? children(id) : children}
    </div>
  );
}

/** "Name — what it does" lines in a setting's (i), one per choice. */
export function ChoiceHelp({ items }: { items: readonly { label: ReactNode; text: ReactNode }[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={i} className="block">
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{item.label}</span> — {item.text}
        </span>
      ))}
    </>
  );
}
