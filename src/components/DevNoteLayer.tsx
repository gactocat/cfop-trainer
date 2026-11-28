'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/hooks/useLocale';
import { useT } from '@/hooks/useT';
import { COMMENT_MAX, saveDevNote, type NewDevNote } from '@/lib/dev-mode/dev-notes';
import { areaTarget, DEV_LAYER_ATTRIBUTE, elementTarget, partAt, partName, type NoteTarget, type Rect } from '@/lib/dev-mode/note-target';
import { aroundPart, captureArea } from '@/lib/dev-mode/note-screenshot';
import { isNativeApp } from '@/lib/native';
import { getTimerFocus, getTimerFocusServerSnapshot, subscribeTimerFocus } from '@/lib/timer-focus';
import { buttonClass, CARD, Icon, iconButtonClass, TEXTAREA } from './ui';

// Developer mode's notes on the screen (loaded only while it is on). The
// pen in the bottom right corner starts choosing: a part lights up under the pointer (or
// the finger, pressed); a click or tap picks it, a drag picks an area. A box
// for the comment opens beside it; saving ends the choosing, as do Esc,
// Cancel and the pen again. Everything here floats over the page, so the
// page does not move, and steps aside while the timer runs. Over a dialog it
// moves into the dialog, the only part of the page a dialog leaves usable.

const DRAG_PX = 6;
const MIN_AREA = 8;
const BOX_HEIGHT = 150;
const GAP = 8;
const EDGE = 12;

interface Draft {
  id: string;
  target: NoteTarget;
  page: string;
  viewport: NewDevNote['viewport'];
  theme: NewDevNote['theme'];
  shot: ReturnType<typeof captureArea>;
}

type Lit = { rect: Rect; name: string };

const PenIcon = () => <Icon><path d="M21.17 6.81a1 1 0 0 0-3.99-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.36-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></Icon>;
const CheckIcon = () => <Icon><path d="M20 6 9 17l-5-5" /></Icon>;

/** The topmost modal dialog, which leaves only itself usable, or the page. */
function topHost(): HTMLElement {
  const dialogs = Array.from(document.querySelectorAll('dialog[open]')).filter((dialog) => dialog.matches(':modal'));
  return (dialogs.at(-1) as HTMLElement | undefined) ?? document.body;
}

function useHost(): HTMLElement {
  const [host, setHost] = useState<HTMLElement>(topHost);
  useEffect(() => {
    const observer = new MutationObserver(() => setHost(topHost()));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);
  return host;
}

/** What a part is called on its frame: its mark, else its tag and the nearest mark around it. */
function nameOf(element: Element): string {
  const own = element.getAttribute('data-ui');
  if (own) return own;
  const around = element.parentElement?.closest('[data-ui]')?.getAttribute('data-ui');
  const tag = element.tagName.toLowerCase();
  return around ? `${tag} · ${around}` : tag;
}

function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Where the comment box goes: under the part, else above it, else low in the window. */
function boxPlace(rect: Rect): CSSProperties {
  const width = Math.min(320, window.innerWidth - EDGE * 2);
  const left = Math.min(Math.max(rect.x, EDGE), window.innerWidth - width - EDGE);
  if (rect.y + rect.height + GAP + BOX_HEIGHT <= window.innerHeight - EDGE) return { left, width, top: rect.y + rect.height + GAP };
  if (rect.y - GAP - BOX_HEIGHT >= EDGE) return { left, width, bottom: window.innerHeight - rect.y + GAP };
  return { left, width, bottom: EDGE };
}

function Frame({ rect, name, dashed = false }: { rect: Rect; name?: string; dashed?: boolean }) {
  return (
    <div className={`pointer-events-none absolute rounded-sm border-2 border-sky-500 bg-sky-500/10 dark:border-sky-400 ${dashed ? 'border-dashed' : ''}`}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
      {name && (
        <span className={`absolute left-0 max-w-64 truncate rounded bg-sky-600 px-1 font-mono text-[10px] leading-4 text-white ${rect.y >= 20 ? '-top-5' : 'top-0'}`}>
          {name}
        </span>
      )}
    </div>
  );
}

export default function DevNoteLayer() {
  const { t } = useT();
  const { locale } = useLocale();
  const host = useHost();
  const timerFocus = useSyncExternalStore(subscribeTimerFocus, getTimerFocus, getTimerFocusServerSnapshot);
  const [choosing, setChoosing] = useState(false);
  const [lit, setLit] = useState<Lit | null>(null);
  const [drag, setDrag] = useState<Rect | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const dragRef = useRef<Rect | null>(null);
  const frame = useRef(0);
  const overlay = useRef<HTMLDivElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = () => {
    setChoosing(false);
    setLit(null);
    setDrag(null);
    setDraft(null);
    setComment('');
    setFailed(false);
    press.current = null;
    dragRef.current = null;
  };

  // Esc ends the choosing before the page or a dialog sees it.
  useEffect(() => {
    if (!choosing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      stop();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [choosing]);

  // The page stays where it is while choosing, so the frames stay on their parts.
  useEffect(() => {
    const element = overlay.current;
    if (!choosing || !element) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.target as Element).closest('form')) event.preventDefault();
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [choosing, host]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(savedTimer.current);
  }, []);

  const light = (x: number, y: number) => {
    const element = partAt(x, y);
    if (!element) { setLit(null); return; }
    const { x: left, y: top, width, height } = element.getBoundingClientRect();
    setLit({ rect: { x: left, y: top, width, height }, name: nameOf(element) });
  };

  const choose = (target: NoteTarget, area: Rect, mark: Rect | null) => {
    setLit(null);
    setFailed(false);
    setDraft({
      id: crypto.randomUUID(),
      target,
      page: `${window.location.pathname}${window.location.search}`,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 },
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      shot: captureArea(area, mark),
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragRef.current = null;
    // A finger lights the part it presses.
    if (event.pointerType !== 'mouse') light(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = press.current;
    const { clientX: x, clientY: y } = event;
    if (start && start.id === event.pointerId) {
      if (!dragRef.current && Math.hypot(x - start.x, y - start.y) < DRAG_PX) return;
      dragRef.current = rectBetween(start, { x, y });
      setDrag(dragRef.current);
      setLit(null);
      return;
    }
    if (event.pointerType !== 'mouse' || draft) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => light(x, y));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = press.current;
    if (!start || start.id !== event.pointerId) return;
    press.current = null;
    const area = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (area) {
      if (area.width >= MIN_AREA && area.height >= MIN_AREA) choose(areaTarget(area), area, null);
      return;
    }
    const element = partAt(event.clientX, event.clientY);
    if (!element) return;
    const target = elementTarget(element);
    choose(target, aroundPart(target.rect), target.rect);
  };

  const onPointerCancel = () => {
    press.current = null;
    dragRef.current = null;
    setDrag(null);
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = comment.trim();
    if (!draft || !text || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const { screenshot, info } = await draft.shot;
      await saveDevNote({
        id: draft.id, page: draft.page, viewport: draft.viewport, theme: draft.theme, locale,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown', platform: isNativeApp() ? 'ios' : 'web',
        target: { ...draft.target, shot: info }, comment: text, screenshot,
      });
      stop();
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      console.warn('Developer note was not saved', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const shown = draft ? { rect: draft.target.rect, name: draft.target.kind === 'element' ? partName(draft.target) : undefined } : lit;
  const label = saved ? t('devMode.saved') : t('devMode.write');

  return createPortal(
    <div {...{ [DEV_LAYER_ATTRIBUTE]: '' }}>
      {choosing && (
        <div ref={overlay} data-app-overlay className="fixed inset-0 z-[60] cursor-crosshair touch-none select-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
          {shown && <Frame rect={shown.rect} name={shown.name} dashed={draft?.target.kind === 'area'} />}
          {drag && <Frame rect={drag} dashed />}
          {draft && (
            <form aria-label={t('devMode.note')} onSubmit={save} onPointerDown={(event) => event.stopPropagation()}
              className={`${CARD} fixed cursor-auto p-2.5 text-zinc-900 shadow-xl select-text dark:text-zinc-100`} style={boxPlace(draft.target.rect)}>
              <textarea autoFocus rows={3} value={comment} maxLength={COMMENT_MAX} aria-label={t('devMode.comment')}
                placeholder={t('devMode.comment')} className={TEXTAREA} disabled={saving}
                onChange={(event) => { setComment(event.target.value); setFailed(false); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save();
                }} />
              <div className="mt-2 flex items-center justify-end gap-2">
                <span role="status" className="mr-auto min-w-0 truncate text-xs text-rose-600 dark:text-rose-400">{failed ? t('devMode.saveFailed') : ''}</span>
                <button type="button" onClick={stop} className={buttonClass('secondary', 'sm')}>{t('common.cancel')}</button>
                <button type="submit" disabled={!comment.trim() || saving} className={buttonClass('primary', 'sm')}>{t('common.save')}</button>
              </div>
            </form>
          )}
        </div>
      )}
      {!timerFocus && !draft && (
        // Bottom right, clear of the footer's links, and above the test cube's panel while it is out.
        <div className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom),var(--test-cube-inset,0px))] z-[61] rounded-md bg-white shadow-md dark:bg-zinc-900">
          <button type="button" aria-label={label} title={label} aria-pressed={choosing}
            onClick={() => { if (choosing) stop(); else { setSaved(false); setChoosing(true); } }}
            className={iconButtonClass('outline', choosing)}>
            {saved ? <CheckIcon /> : <PenIcon />}
          </button>
        </div>
      )}
    </div>,
    host,
  );
}
