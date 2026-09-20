type Configuration = {
  url: string;
  anonKey: string;
  serviceKey: string;
  fetcher?: typeof fetch;
};

const origins = new Set([
  'https://cfop.app', 'https://cfop-trainer-ten.vercel.app', 'capacitor://localhost',
  'http://localhost:3000', 'http://127.0.0.1:3000',
]);

export function createDeleteAccountHandler({ url, anonKey, serviceKey, fetcher = fetch }: Configuration) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (status: number, code?: string) => new Response(code ? JSON.stringify({ code }) : null, { status, headers });
    if (origin && !origins.has(origin)) return respond(403, 'origin_not_allowed');
    if (request.method === 'OPTIONS') return respond(204);
    if (request.method !== 'POST') return respond(405, 'method_not_allowed');
    const authorization = request.headers.get('authorization');
    if (!authorization || !/^Bearer \S+$/i.test(authorization)) return respond(401, 'session_invalid');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return respond(415, 'invalid_request');
    try {
      // Read a bounded body; passwords and tokens must never be logged.
      const reader = request.body?.getReader();
      if (!reader) return respond(400, 'invalid_request');
      let body = '';
      let bytes = 0;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) { await reader.cancel(); return respond(413, 'invalid_request'); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      let input: unknown;
      try { input = JSON.parse(body); } catch { return respond(400, 'invalid_request'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return respond(400, 'invalid_request');
      const payload = input as Record<string, unknown>;
      if (Object.keys(payload).some((key) => key !== 'password' && key !== 'confirm') ||
        payload.confirm !== true || typeof payload.password !== 'string' ||
        !payload.password || payload.password.length > 1024) return respond(400, 'invalid_request');
      const call = (path: string, init: RequestInit) => fetcher(`${url}/auth/v1/${path}`, {
        ...init, signal: AbortSignal.timeout(15000),
      });
      // Resolve the user on the server; never accept a client-supplied user id.
      const current = await call('user', { headers: { apikey: anonKey, Authorization: authorization } });
      if (!current.ok) return respond(current.status >= 500 ? 503 : 401, 'session_invalid');
      const user = await current.json();
      if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || typeof user.email !== 'string') return respond(401, 'session_invalid');
      const verified = await call('token?grant_type=password', {
        method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: payload.password }),
      });
      if (!verified.ok) {
        if (verified.status === 429) return respond(429, 'rate_limited');
        return respond(verified.status >= 500 ? 503 : 403, verified.status >= 500 ? 'unavailable' : 'password_invalid');
      }
      const reauthenticated = await verified.json();
      if (reauthenticated.user?.id !== user.id) return respond(403, 'session_invalid');
      // Hard deletion also cascades account_data and auth sessions in Postgres.
      const deleted = await call(`admin/users/${user.id}`, {
        method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ should_soft_delete: false }),
      });
      if (!deleted.ok) return respond(503, 'delete_failed');
      return respond(204);
    } catch {
      return respond(503, 'unavailable');
    }
  };
}
