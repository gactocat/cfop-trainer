// The server's side of a developer note (POST /api/dev-note, a web-only
// route): once the app has saved a note, it sends the note's id here with
// the account's access token. The note is read back from the database as
// that account, after checking the token with Supabase Auth and that the
// account is a developer, and is posted to the webhook the deployment names
// (DEV_NOTE_WEBHOOK_URL, a server-only variable that never reaches clients).
// Without it nothing is sent; the note is saved either way.
//
// Framework-free, with fetch and the settings passed in, so
// scripts/verify-dev-notes.mts can drive it with fixtures.

export interface DevNoteHandlerOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  webhookUrl?: string;
  /** Sent as `Authorization: Bearer …` to the webhook, when set. */
  webhookSecret?: string;
  fetcher?: typeof fetch;
}

/** What the webhook receives. */
export interface DevNoteWebhookBody {
  type: 'dev_note';
  note: {
    id: string;
    user_id: string;
    created_at: string;
    status: 'open' | 'done';
    page: string;
    /** The page on the website (the iOS app's pages have the same paths). */
    url: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    theme: string;
    locale: string;
    app_version: string;
    platform: 'web' | 'ios';
    target: Record<string, unknown>;
    comment: string;
    /** A small JPEG as a data URL (under 400,000 characters), or null. */
    screenshot: string | null;
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_COLUMNS = 'id,user_id,created_at,status,page,viewport,theme,locale,app_version,platform,target,comment,screenshot';
// The iOS app's pages come from capacitor://localhost; the website calls from its own origin.
const APP_ORIGINS = ['capacitor://localhost'];
const TIMEOUT_MS = 10000;

export function createDevNoteHandler(options: DevNoteHandlerOptions) {
  const fetcher = options.fetcher ?? fetch;
  const supabase = options.supabaseUrl?.replace(/\/+$/, '');
  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors: Record<string, string> = origin && APP_ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const reply = (status: number, body: Record<string, unknown> | null) => new Response(body ? JSON.stringify(body) : null, {
      status,
      headers: { 'Cache-Control': 'no-store', ...(body ? { 'Content-Type': 'application/json' } : {}), ...cors },
    });

    if (request.method === 'OPTIONS') {
      if (!cors['Access-Control-Allow-Origin']) return reply(403, null);
      return new Response(null, { status: 204, headers: {
        ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store',
      } });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, reason: 'method' });
    // No webhook: nothing to do.
    if (!options.webhookUrl) return reply(200, { ok: true, sent: false });
    if (!supabase || !options.supabaseKey) return reply(503, { ok: false, reason: 'not configured' });

    const raw = await request.text().catch(() => '');
    if (raw.length > 1024) return reply(413, { ok: false, reason: 'too large' });
    let id: unknown;
    try { id = (JSON.parse(raw) as { id?: unknown } | null)?.id; } catch { /* checked below */ }
    if (typeof id !== 'string' || !UUID.test(id)) return reply(400, { ok: false, reason: 'id' });
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return reply(401, { ok: false, reason: 'token' });

    const asUser = { apikey: options.supabaseKey, Authorization: `Bearer ${token}` };
    try {
      // The token is the signed-in account's (Auth also refuses one signed out or deleted).
      const user = await fetcher(`${supabase}/auth/v1/user`, { headers: asUser, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
      const userId = user.ok ? ((await user.json()) as { id?: unknown }).id : null;
      if (typeof userId !== 'string') return reply(401, { ok: false, reason: 'token' });

      const developer = await fetcher(`${supabase}/rest/v1/rpc/is_developer`, {
        method: 'POST', headers: { ...asUser, 'Content-Type': 'application/json' }, body: '{}',
        cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!developer.ok || (await developer.json()) !== true) return reply(403, { ok: false, reason: 'not a developer' });

      // Row-level security returns the note only to its writer.
      const found = await fetcher(`${supabase}/rest/v1/dev_notes?select=${NOTE_COLUMNS}&id=eq.${id}`, {
        headers: asUser, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!found.ok) return reply(502, { ok: false, reason: `database ${found.status}` });
      const [row] = (await found.json()) as Omit<DevNoteWebhookBody['note'], 'url'>[];
      if (!row || row.user_id !== userId) return reply(404, { ok: false, reason: 'note' });

      const body: DevNoteWebhookBody = { type: 'dev_note', note: { ...row, url: new URL(row.page, new URL(request.url).origin).href } };
      const sent = await fetcher(options.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.webhookSecret ? { Authorization: `Bearer ${options.webhookSecret}` } : {}) },
        body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!sent.ok) {
        console.error(`Developer note ${id}: the webhook answered HTTP ${sent.status}`);
        return reply(502, { ok: false, reason: `webhook ${sent.status}` });
      }
      return reply(200, { ok: true, sent: true });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'request failed';
      console.error(`Developer note ${id}: ${reason}`);
      return reply(502, { ok: false, reason });
    }
  };
}
