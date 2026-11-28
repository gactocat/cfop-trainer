import { getPersistenceSnapshot } from '@/lib/persistence';
import { getSupabase } from '@/lib/supabase';
import type { NoteTarget } from '@/lib/dev-mode/note-target';

// Developer mode's notes, kept in the account's database (`dev_notes`):
// saved through save_dev_note, read back by their writer only, marked done
// through set_dev_note_status. Once saved, a note is announced to the
// server's /api/dev-note, which tells the developers' webhook.

export type NoteStatus = 'open' | 'done';

/** What the app sends to save_dev_note: the note and where it was written. */
export interface NewDevNote {
  id: string;
  page: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  theme: 'light' | 'dark';
  locale: string;
  appVersion: string;
  platform: 'web' | 'ios';
  target: NoteTarget;
  comment: string;
  /** A small JPEG as a data URL, or null when the area could not be drawn. */
  screenshot: string | null;
}

/** A saved note as the list shows it (its screenshot is loaded on its own). */
export interface DevNote {
  id: string;
  created_at: string;
  page: string;
  viewport: NewDevNote['viewport'];
  theme: string;
  locale: string;
  app_version: string;
  platform: string;
  target: NoteTarget;
  comment: string;
  status: NoteStatus;
  resolved_at: string | null;
  has_screenshot: boolean;
}

/** Comments are up to this many characters (the table's limit). */
export const COMMENT_MAX = 4000;

// The iOS app has no server of its own: it asks the website's.
const ENDPOINT = process.env.NEXT_PUBLIC_NATIVE_APP === '1' ? 'https://cfop.app/api/dev-note' : '/api/dev-note';

function account() {
  const client = getSupabase();
  const { userId } = getPersistenceSnapshot();
  if (!client || !userId) throw new Error('Not signed in');
  return { client, userId };
}

export async function saveDevNote(note: NewDevNote): Promise<void> {
  const { client, userId } = account();
  const { error } = await client.rpc('save_dev_note', { p_note: note, p_expected_user_id: userId });
  if (error) throw error;
  void notifyDevNote(note.id);
}

/**
 * Tell the server a note was saved, so it can pass it on to the webhook.
 * The note is saved either way; a failure is only logged.
 */
export async function notifyDevNote(id: string): Promise<void> {
  try {
    const client = getSupabase();
    const token = (await client?.auth.getSession())?.data.session?.access_token;
    if (!token) return;
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) console.warn(`Developer note ${id} was saved; announcing it failed (HTTP ${response.status})`);
  } catch (error) {
    console.warn(`Developer note ${id} was saved; announcing it failed`, error);
  }
}

// Everything but the screenshot, which each row loads when it is shown.
const LIST_COLUMNS = 'id, created_at, page, viewport, theme, locale, app_version, platform, target, comment, status, resolved_at, has_screenshot';
export const NOTES_PAGE = 50;

/** The account's latest notes with this status, newest first. */
export async function listDevNotes(status: NoteStatus): Promise<DevNote[]> {
  const { client } = account();
  const { data, error } = await client.from('dev_notes').select(LIST_COLUMNS)
    .eq('status', status).order('created_at', { ascending: false }).limit(NOTES_PAGE);
  if (error) throw error;
  return data as unknown as DevNote[];
}

export async function loadDevNoteScreenshot(id: string): Promise<string | null> {
  const { client } = account();
  const { data, error } = await client.from('dev_notes').select('screenshot').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data?.screenshot as string | null | undefined) ?? null;
}

export async function setDevNoteStatus(id: string, status: NoteStatus): Promise<void> {
  const { client, userId } = account();
  const { data, error } = await client.rpc('set_dev_note_status', { p_id: id, p_status: status, p_expected_user_id: userId });
  if (error) throw error;
  if (data !== true) throw new Error('Note not found');
}
