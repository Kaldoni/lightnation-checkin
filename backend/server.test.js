const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, databaseError } = require('./config');

process.env.NODE_ENV = 'production';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
process.env.SUPABASE_SECRET_KEY = '';
const originalFetch = global.fetch;
let sent;
let failure = false;
global.fetch = async (url, options) => {
  if (!String(url).startsWith('https://test.supabase.co')) return originalFetch(url, options);
  sent = options?.body ? JSON.parse(options.body) : undefined;
  if (failure) throw new TypeError('fetch failed');
  return new Response(JSON.stringify([{ id: 1 }]), { headers: { 'Content-Type': 'application/json' } });
};
const { app } = require('./index');
let server;
let base;
before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); global.fetch = originalFetch; });

test('production configuration preserves deployment variables', () => {
  const config = loadConfig({ NODE_ENV: 'production', SUPABASE_URL: 'https://deployed.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key' });
  assert.equal(config.SUPABASE_URL, 'https://deployed.supabase.co');
});
test('Supabase credentials are mandatory, including when both settings are empty', () => {
  for (const [url, key] of [['', ''], ['https://test.supabase.co', ''], ['', 'server-key']]) {
    assert.throws(() => loadConfig({
      NODE_ENV: 'production', SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_SECRET_KEY: '',
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
