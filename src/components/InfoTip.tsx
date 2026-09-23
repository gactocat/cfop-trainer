'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useT } from '@/hooks/useT';

const GAP = 6;
const MARGIN = 8;
const MAX_WIDTH = 288;

// Where to draw the bubble: below the icon unless it is in the lower part of
// the viewport, clamped horizontally so it never leaves the screen.
function placeFor(button: HTMLElement): CSSProperties {
  const rect = button.getBoundingClientRect();
  const width = Math.min(MAX_WIDTH, window.innerWidth - MARGIN * 2);
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - width / 2, MARGIN),
    window.innerWidth - width - MARGIN,
  );
  return rect.bottom > window.innerHeight * 0.6
    ? { left, width, bottom: window.innerHeight - rect.top + GAP }
    : { left, width, top: rect.bottom + GAP };
}

// An (i) button that shows `children` in a tooltip. Mouse hover previews it;
// a click or tap pins it open until the next outside tap, Escape, or scroll.
// The bubble is position: fixed and rendered in place (not portaled), so it
// is not clipped by scrolling modals and stays in a <dialog>'s top layer.
export function InfoTip({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { t } = useT();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const [pinned, setPinned] = useState(false);

  const show = () => { if (button.current) setPlace(placeFor(button.current)); };
  const hide = useCallback(() => { setPlace(null); setPinned(false); }, []);

  useEffect(() => {
    if (!place) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Close only the tooltip, not the modal around it.
      event.preventDefault();
      event.stopPropagation();
      hide();
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [place, hide]);

  return (
    <span ref={root} className={`inline-flex align-middle ${className}`}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse' && !place) show(); }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse' && !pinned) setPlace(null); }}>
      <button ref={button} type="button" data-readonly-allowed
        aria-label={t('common.moreInfo')} aria-expanded={!!place}
        aria-describedby={place ? id : undefined}
        onClick={() => {
          if (pinned) hide();
          else { show(); setPinned(true); }
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-zinc-500 dark:hover:text-zinc-200">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-5M12 8h.01" />
        </svg>
      </button>
      {place && (
        <span id={id} role="tooltip" style={place}
          className="fixed z-[60] block space-y-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {children}
        </span>
      )}
    </span>
  );
}
