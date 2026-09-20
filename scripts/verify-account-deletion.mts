// Run with Node 24. Only in-memory fixtures are used; no account is deleted.
import assert from 'node:assert/strict';
const { createDeleteAccountHandler } = await import(new URL('../supabase/functions/delete-account/handler.ts', import.meta.url).href) as typeof import('../supabase/functions/delete-account/handler');

const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
let calls: { path: string; method: string }[] = [];
let authStatus = 200;
let passwordStatus = 200;
let deletionStatus = 200;
let returnedId = userId;
const handler = createDeleteAccountHandler({
  url: 'https://example.test', anonKey: 'public-test-key', serviceKey: 'private-test-key',
  fetcher: async (input, init) => {
    const path = String(input).replace('https://example.test/auth/v1/', '');
    calls.push({ path, method: init?.method ?? 'GET' });
    const headers = new Headers(init?.headers);
    if (path === 'user') {
      assert.equal(headers.get('Authorization'), 'Bearer user-token');
      return Response.json({ id: userId, email: 'fixture@example.test' }, { status: authStatus });
    }
    if (path.startsWith('token?')) {
      assert.deepEqual(JSON.parse(String(init?.body)), { email: 'fixture@example.test', password: 'test-password' });
      return Response.json({ user: { id: returnedId } }, { status: passwordStatus });
    }
    assert.equal(path, `admin/users/${userId}`);
    assert.equal(headers.get('Authorization'), 'Bearer private-test-key');
    assert.equal(init?.method, 'DELETE');
    assert.deepEqual(JSON.parse(String(init?.body)), { should_soft_delete: false });
    return Response.json({}, { status: deletionStatus });
  },
});
const request = (body: unknown = { confirm: true, password: 'test-password' }, headers: Record<string, string> = {}) => new Request('https://example.test/delete-account', {
  method: 'POST', headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json', Origin: 'capacitor://localhost', ...headers }, body: JSON.stringify(body),
});
let response = await handler(request());
assert.equal(response.status, 204);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(calls.length, 3);
for (const [body, headers, status] of [
  [{ confirm: false, password: 'test-password' }, {}, 400],
  [{ confirm: true, password: 'test-password', userId: otherId }, {}, 400],
  [{ confirm: true, password: '' }, {}, 400],
  [{ confirm: true, password: 'x'.repeat(9000) }, {}, 413],
  [null, {}, 400],
  [{}, { Authorization: '' }, 401],
  [{}, { Origin: 'https://attacker.test' }, 403],
] as const) {
  calls = [];
  response = await handler(request(body, headers));
  assert.equal(response.status, status);
  assert.equal(calls.length, 0, 'invalid requests never reach Auth or admin APIs');
}
for (const [auth, password, id, deletion, status, count] of [
  [401, 200, userId, 200, 401, 1],
  [200, 400, userId, 200, 403, 2],
  [200, 429, userId, 200, 429, 2],
  [200, 200, otherId, 200, 403, 2],
  [200, 200, userId, 500, 503, 3],
] as const) {
  calls = []; authStatus = auth; passwordStatus = password; returnedId = id; deletionStatus = deletion;
  response = await handler(request());
  assert.equal(response.status, status);
  assert.equal(calls.length, count);
  assert.ok(!(await response.text()).includes('private-test-key'));
}
for (const origin of ['https://cfop.app', 'https://cfop-trainer-ten.vercel.app', 'capacitor://localhost']) {
  response = await handler(new Request('https://example.test/delete-account', { method: 'OPTIONS', headers: { Origin: origin } }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
}
response = await handler(new Request('https://example.test/delete-account', { method: 'OPTIONS', headers: { Origin: 'https://cfop.app.attacker.test' } }));
assert.equal(response.status, 403);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
assert.equal((await handler(new Request('https://example.test/delete-account'))).status, 405);
console.log('Verified deletion authentication, password checks, account isolation, CORS, limits and failure handling.');
