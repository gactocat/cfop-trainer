// Run with Node 24: node --import ./scripts/register-src-alias.mjs scripts/verify-dev-notes.mts
// The /api/dev-note handler with in-memory fixtures for Supabase and the webhook.
import assert from 'node:assert/strict';
import { createDevNoteHandler, type DevNoteWebhookBody } from '@/lib/dev-mode/dev-note-webhook';

const userId = '11111111-1111-4111-8111-111111111111';
const noteId = '33333333-3333-4333-8333-333333333333';
const row = {
  id: noteId, user_id: userId, created_at: '2026-11-28T01:02:03.000Z', status: 'open', page: '/pll/random?x=1',
  viewport: { width: 390, height: 844, devicePixelRatio: 3 }, theme: 'dark', locale: 'ja', app_version: 'abc1234',
  platform: 'ios', target: { kind: 'element', part: { ui: 'SettingRow' } }, comment: 'Too wide', screenshot: 'data:image/jpeg;base64,/9j/',
};

let calls: string[] = [];
let authStatus = 200;
let developer: unknown = true;
let developerStatus = 200;
let rows: unknown[] = [row];
let webhookStatus = 200;
let webhookThrows = false;
let received: { body: DevNoteWebhookBody; headers: Headers } | null = null;
const fetcher: typeof fetch = async (input, init) => {
  const url = String(input);
  const headers = new Headers(init?.headers);
  calls.push(url.replace('https://db.test', '').replace(/\?.*/, ''));
  if (url.startsWith('https://hook.test/')) {
    if (webhookThrows) throw new DOMException('timed out', 'TimeoutError');
    received = { body: JSON.parse(String(init?.body)), headers };
    return new Response('ok', { status: webhookStatus });
  }
  assert.equal(headers.get('apikey'), 'public-key');
  assert.equal(headers.get('Authorization'), 'Bearer user-token', 'Supabase is asked as the account');
  if (url === 'https://db.test/auth/v1/user') return Response.json({ id: userId }, { status: authStatus });
  if (url === 'https://db.test/rest/v1/rpc/is_developer') {
    assert.equal(init?.method, 'POST');
    return Response.json(developer, { status: developerStatus });
  }
  assert.ok(url.startsWith('https://db.test/rest/v1/dev_notes?'), url);
  assert.ok(url.includes(`id=eq.${noteId}`));
  return Response.json(rows);
};
const options = { supabaseUrl: 'https://db.test/', supabaseKey: 'public-key', webhookUrl: 'https://hook.test/notes', fetcher };
const request = (body: unknown = { id: noteId }, headers: Record<string, string> = {}, method = 'POST') => new Request('https://cfop.app/api/dev-note', {
  method, headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json', ...headers },
  body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
});
const reset = () => {
  calls = []; authStatus = 200; developer = true; developerStatus = 200; rows = [row];
  webhookStatus = 200; webhookThrows = false; received = null;
};

// Sent: checked with Auth, as a developer, the note read back as its writer.
let handler = createDevNoteHandler({ ...options, webhookSecret: 'hook-secret' });
let response = await handler(request());
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { ok: true, sent: true });
assert.deepEqual(calls, ['/auth/v1/user', '/rest/v1/rpc/is_developer', '/rest/v1/dev_notes', 'https://hook.test/notes']);
assert.ok(received);
const sent = received as { body: DevNoteWebhookBody; headers: Headers };
assert.equal(sent.headers.get('Authorization'), 'Bearer hook-secret');
assert.equal(sent.headers.get('Content-Type'), 'application/json');
assert.equal(sent.body.type, 'dev_note');
assert.deepEqual(sent.body.note, { ...row, url: 'https://cfop.app/pll/random?x=1' });

// Without a secret, no Authorization header goes to the webhook.
reset();
handler = createDevNoteHandler(options);
response = await handler(request());
assert.equal(response.status, 200);
assert.equal((received as { headers: Headers } | null)?.headers.get('Authorization'), null);

// No webhook configured: nothing is asked or sent.
reset();
response = await createDevNoteHandler({ ...options, webhookUrl: undefined })(request());
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { ok: true, sent: false });
assert.deepEqual(calls, []);
response = await createDevNoteHandler({ ...options, webhookUrl: '' })(request({}, { Authorization: '' }));
assert.equal(response.status, 200);
assert.deepEqual(calls, []);

// Requests refused before anything is asked.
for (const [body, headers, status] of [
  [{}, {}, 400],
  [{ id: 'not-a-uuid' }, {}, 400],
  ['not json', {}, 400],
  [{ id: noteId, pad: 'x'.repeat(2000) }, {}, 413],
  [{ id: noteId }, { Authorization: '' }, 401],
  [{ id: noteId }, { Authorization: 'Basic abc' }, 401],
] as const) {
  reset();
  response = await handler(request(body, headers));
  assert.equal(response.status, status, JSON.stringify(body));
  assert.deepEqual(calls, [], 'nothing reaches Supabase or the webhook');
}
reset();
response = await handler(request(undefined, {}, 'GET'));
assert.equal(response.status, 405);
response = await createDevNoteHandler({ ...options, supabaseKey: undefined })(request());
assert.equal(response.status, 503);
assert.deepEqual(calls, []);

// Refused by Supabase: nothing reaches the webhook.
for (const [setup, status, asked] of [
  [() => { authStatus = 401; }, 401, 1],
  [() => { developer = false; }, 403, 2],
  [() => { developerStatus = 404; developer = { code: 'PGRST202' }; }, 403, 2],
  [() => { rows = []; }, 404, 3],
  [() => { rows = [{ ...row, user_id: '22222222-2222-4222-8222-222222222222' }]; }, 404, 3],
] as const) {
  reset();
  setup();
  response = await handler(request());
  assert.equal(response.status, status);
  assert.equal(calls.length, asked);
  assert.equal(received, null);
}

// The webhook failing is reported, not hidden.
reset();
webhookStatus = 500;
response = await handler(request());
assert.equal(response.status, 502);
reset();
webhookThrows = true;
response = await handler(request());
assert.equal(response.status, 502);
assert.deepEqual(await response.json(), { ok: false, reason: 'TimeoutError' });

// The iOS app (capacitor://localhost) may call it; other origins get no CORS headers.
reset();
response = await handler(request(undefined, { Origin: 'capacitor://localhost' }, 'OPTIONS'));
assert.equal(response.status, 204);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
assert.match(response.headers.get('Access-Control-Allow-Headers') ?? '', /authorization/);
response = await handler(request(undefined, { Origin: 'https://attacker.test' }, 'OPTIONS'));
assert.equal(response.status, 403);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
response = await handler(request(undefined, { Origin: 'capacitor://localhost' }));
assert.equal(response.status, 200);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
assert.equal(response.headers.get('Cache-Control'), 'no-store');
response = await handler(request(undefined, { Origin: 'https://attacker.test' }));
assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);

console.log('dev notes: webhook route checks passed');
