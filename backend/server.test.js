const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, databaseError } = require('./config');

process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-server-key';
const originalFetch = global.fetch;
let sent;
let failure = false;
global.fetch = async (url, options) => {
  if (!String(url).startsWith('https://test.supabase.co')) return originalFetch(url, { ...options, headers: { Authorization: 'Bearer teacher-token', ...options?.headers } });
  if (String(url).includes('/auth/v1/user')) {
    const token = new Headers(options?.headers).get('authorization');
    if (token === 'Bearer invalid-token') return new Response('{"message":"Invalid token"}', { status: 401 });
    return new Response(JSON.stringify({ id: 'teacher-id', email: 'teacher@example.com', app_metadata: { role: token === 'Bearer student-token' ? 'student' : 'teacher' } }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (String(url).includes('/auth/v1/token')) {
    const credentials = JSON.parse(options.body);
    if (credentials.password !== 'test-password') return new Response('{"message":"Invalid credentials"}', { status: 400 });
    return new Response(JSON.stringify({ access_token: 'teacher-token', refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, user: { id: 'teacher-id', email: credentials.email, app_metadata: { role: credentials.email === 'student@example.com' ? 'student' : 'teacher' } } }), { headers: { 'Content-Type': 'application/json' } });
  }
  sent = options?.body ? JSON.parse(options.body) : undefined;
  if (failure) throw new TypeError('fetch failed');
  return new Response(JSON.stringify([{ id: 1 }]), { headers: { 'Content-Type': 'application/json' } });
};
const app = require('./index');
let server;
let base;
before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); global.fetch = originalFetch; });

test('Vercel entry exports a request handler and serves a JSON root', async () => {
  assert.equal(typeof app, 'function');
  const response = await fetch(base + '/');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'LightNation API', database: 'supabase' });
  const missing = await fetch(base + '/missing');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Route not found.' });
});

test('production configuration preserves deployment variables', () => {
  const config = loadConfig({ NODE_ENV: 'production', SUPABASE_URL: 'https://deployed.supabase.co', SUPABASE_SECRET_KEY: 'server-key' });
  assert.equal(config.SUPABASE_URL, 'https://deployed.supabase.co');
});
test('children and mutations require teacher authentication', async () => {
  for (const [path, method] of [['/api/children', 'GET'], ['/api/children/1', 'DELETE'], ['/api/checkin', 'POST'], ['/api/ai', 'POST']]) {
    assert.equal((await originalFetch(base + path, { method })).status, 401);
  }
  assert.equal((await fetch(base + '/api/children', { headers: { Authorization: 'Bearer invalid-token' } })).status, 401);
  assert.equal((await fetch(base + '/api/children', { headers: { Authorization: 'Bearer student-token' } })).status, 403);
  assert.equal((await fetch(base + '/api/children')).status, 200);
  assert.equal((await fetch(base + '/api/children/1', { method: 'DELETE' })).status, 200);
});
test('teacher login accepts valid credentials and rejects other accounts', async () => {
  for (const [email, password, status] of [['teacher@example.com', 'test-password', 200], ['teacher@example.com', 'wrong', 401], ['student@example.com', 'test-password', 401]]) {
    const response = await originalFetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, status);
    if (status === 200) assert.equal((await response.json()).accessToken, 'teacher-token');
  }
});
test('Supabase credentials are mandatory, including when both settings are empty', () => {
  for (const [url, key] of [['', ''], ['https://test.supabase.co', ''], ['', 'server-key']]) {
    assert.throws(() => loadConfig({
      NODE_ENV: 'production', SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: key,
    }), /Supabase is required/);
  }
});
test('local configuration overrides stale inherited project settings', () => {
  const file = require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true, processEnv: {} }).parsed;
  if (!file?.SUPABASE_URL) return;
  assert.equal(loadConfig({ SUPABASE_URL: 'https://dummy.supabase.co' }).SUPABASE_URL, file.SUPABASE_URL);
});
test('health checks the database and reports connection failures', async () => {
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true, database: 'supabase' });
  failure = true;
  try {
    const response = await fetch(base + '/api/health');
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Cannot reach Supabase/);
  } finally { failure = false; }
});
test('check-in and checkout send valid timestamps', async () => {
  for (const route of ['checkin', 'checkout']) {
    const response = await fetch(base + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"id":1}' });
    assert.equal(response.status, 200);
    const timestamp = sent[route === 'checkin' ? 'last_check_in' : 'last_check_out'];
    assert.equal(new Date(timestamp).toISOString(), timestamp);
  }
});
test('editing a child preserves attendance fields', async () => {
  const response = await fetch(base + '/api/children/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test', guardian: 'Guardian', age: 0, tag: 'T1' }) });
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(sent, 'checked_in'), false);
  assert.equal(Object.hasOwn(sent, 'last_check_in'), false);
  assert.equal(Object.hasOwn(sent, 'last_check_out'), false);
});
test('invalid child data is rejected before database access', async () => {
  const response = await fetch(base + '/api/children', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"age":99}' });
  assert.equal(response.status, 400);
});
test('missing schema and duplicate tags produce actionable errors', () => {
  assert.equal(databaseError({ code: 'PGRST205' }).status, 503);
  assert.equal(databaseError({ code: '23505' }).status, 409);
});
