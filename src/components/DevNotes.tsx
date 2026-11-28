'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useDevMode } from '@/hooks/useDevMode';
import { usePersistence } from '@/hooks/usePersistence';
import { useT } from '@/hooks/useT';
import { listDevNotes, loadDevNoteScreenshot, NOTES_PAGE, setDevNoteStatus, type DevNote, type NoteStatus } from '@/lib/dev-mode/dev-notes';
import { partName } from '@/lib/dev-mode/note-target';
import { buttonClass, CARD, LINK, Segmented } from './ui';

// The notes a developer wrote in developer mode (/dev-notes): the open ones
// or those done, newest first, each with what it points at and its
// screenshot, and a button to mark it done or open it again. Anyone else is
// sent to the top page.

/** A note's screenshot, loaded once its place scrolls near; a tap shows it at full size. */
function NoteShot({ id }: { id: string }) {
  const { t } = useT();
  const place = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const element = place.current;
    if (!element) return;
    let live = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadDevNoteScreenshot(id).then((value) => { if (live) setSrc(value); }, () => {});
    }, { rootMargin: '300px' });
    observer.observe(element);
    return () => { live = false; observer.disconnect(); };
  }, [id]);
  return (
    // Its height is kept until the image comes, which is then as tall as it is (at most the same).
    <div ref={place} className={`mt-2 ${src ? '' : 'h-32'}`}>
      {src && (
        <button type="button" onClick={() => setLarge(!large)} aria-expanded={large} className="block max-w-full focus-visible:outline-2 focus-visible:outline-emerald-600">
          {/* A data URL from the database; there is nothing for next/image to optimise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={t('devNotes.screenshot')}
            className={`h-auto w-auto max-w-full rounded-md border border-zinc-200 dark:border-zinc-800 ${large ? '' : 'max-h-32'}`} />
        </button>
      )}
    </div>
  );
}

function NoteRow({ note, status, onMoved }: { note: DevNote; status: NoteStatus; onMoved: (status: NoteStatus) => void }) {
  const { t, intl } = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const when = new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.created_at));
  const { target, viewport } = note;
  const part = partName(target);
  const next: NoteStatus = status === 'open' ? 'done' : 'open';
  const change = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await setDevNoteStatus(note.id, next);
      onMoved(next);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <li data-ui="DevNotes.note" className={`${CARD} px-4 py-3`}>
      <p className="whitespace-pre-wrap break-words text-sm">{note.comment}</p>
      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
        {when} · <span className="font-mono">{note.page}</span>{part ? <> · <span className="font-mono">{part}</span></> : null}
      </p>
      <p className="truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
        {note.platform} · {viewport.width}×{viewport.height} · {note.theme} · {note.locale} · {note.app_version.slice(0, 7)}
      </p>
      {note.has_screenshot && <NoteShot id={note.id} />}
      <div className="mt-2 flex items-center justify-end gap-2">
        <span role="status" className="mr-auto min-w-0 truncate text-xs text-rose-600 dark:text-rose-400">{failed ? t('devNotes.changeFailed') : ''}</span>
        <button type="button" disabled={busy} onClick={() => void change()} className={buttonClass(status === 'open' ? 'ghostAccent' : 'ghost', 'sm')}>
          {t(status === 'open' ? 'devNotes.markDone' : 'devNotes.reopen')}
        </button>
      </div>
    </li>
  );
}

export function DevNotes() {
  const { t } = useT();
  const router = useRouter();
  const { userId } = usePersistence();
  const { developer, known } = useDevMode();
  const [status, setStatus] = useState<NoteStatus>('open');
  const [attempt, setAttempt] = useState(0);
  // Notes marked done or opened again here, which leave the list they were in.
  const [moved, setMoved] = useState<Readonly<Record<string, NoteStatus>>>({});
  const key = `${userId}:${status}:${attempt}`;
  const [result, setResult] = useState<{ key: string; notes: DevNote[] | null } | null>(null);

  useEffect(() => {
    if (known && !developer) router.replace('/');
  }, [known, developer, router]);

  useEffect(() => {
    if (!developer) return;
    let live = true;
    listDevNotes(status).then(
      (notes) => { if (live) setResult({ key, notes }); },
      () => { if (live) setResult({ key, notes: null }); },
    );
    return () => { live = false; };
  }, [developer, status, key]);

  if (!developer) return null;
  const loaded = result?.key === key ? result : null;
  const notes = loaded?.notes?.filter((note) => (moved[note.id] ?? note.status) === status) ?? [];
  return (
    <div data-ui="DevNotes" className="mx-auto w-full max-w-2xl space-y-3">
      <Segmented label={t('devNotes.show')} value={status} onChange={setStatus}
        options={[{ value: 'open', label: t('devNotes.open') }, { value: 'done', label: t('devNotes.done') }]} />
      {!loaded ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('common.loading')}</p>
      ) : loaded.notes === null ? (
        <p role="alert" className="text-sm text-zinc-600 dark:text-zinc-300">
          {t('devNotes.loadFailed')}{' '}
          <button type="button" onClick={() => setAttempt(attempt + 1)} className={LINK}>{t('devNotes.retry')}</button>
        </p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('devNotes.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} status={status}
              onMoved={(next) => setMoved((current) => ({ ...current, [note.id]: next }))} />
          ))}
        </ul>
      )}
      {loaded?.notes?.length === NOTES_PAGE && <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('devNotes.more', { count: NOTES_PAGE })}</p>}
    </div>
  );
}
