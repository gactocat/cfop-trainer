// Keeps the Free-plan Supabase project from pausing after a quiet week.
// Vercel Cron calls this route a few times a day (see vercel.json). Each call
// sends one read to PostgREST, which runs it in Postgres, so the database sees
// activity even when nobody uses the app.
//
// Anyone may call it: the request is the same one any visitor's browser can
// send with the public key, it changes nothing, and the response carries no
// data. The `.web.ts` extension keeps it out of the iOS static export, which
// has no server (see next.config.ts).

export const dynamic = 'force-dynamic';

// Insufficient privilege, raised by Postgres itself: the anon role may not
// read account_data. It proves the statement reached the database.
const PERMISSION_DENIED = '42501';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply(false, null, 'not configured');

  let status: number | null = null;
  try {
    const response = await fetch(`${url}/rest/v1/account_data?select=user_id&limit=1`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    status = response.status;
    const body: unknown = await response.json().catch(() => null);
    const code = body && typeof body === 'object' && 'code' in body ? body.code : null;
    // 200 with an empty list would also do, if anon is ever allowed to read.
    if (response.ok || code === PERMISSION_DENIED) return reply(true, status);
    return reply(false, status, typeof code === 'string' ? code : 'unexpected response');
  } catch (error) {
    return reply(false, status, error instanceof Error ? error.name : 'request failed');
  }
}

function reply(ok: boolean, status: number | null, reason?: string) {
  if (ok) console.log(`Supabase keep-alive: database answered (HTTP ${status})`);
  else console.error(`Supabase keep-alive failed: HTTP ${status ?? '-'}, ${reason}`);
  return Response.json(
    ok ? { ok } : { ok, status, reason },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
