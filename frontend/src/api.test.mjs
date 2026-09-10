import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./api.js', import.meta.url), 'utf8');
const { request, setAccessToken } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test('form requests expose nested server error messages instead of object coercion', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'This tag is already assigned.' } }), { status: 409 });
  await assert.rejects(request('/children', { method: 'POST', body: {} }), { message: 'This tag is already assigned.' });
});

test('handles nested proxy errors and unrecognizable error objects', async () => {
  for (const [error, expected] of [
    [{ error: { message: 'Deployment unavailable' } }, 'Deployment unavailable'],
    [{ code: 'FUNCTION_INVOCATION_FAILED' }, 'FUNCTION_INVOCATION_FAILED'],
    [{ unexpected: true }, 'Server request failed (500).'],
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ error }), { status: 500 });
    await assert.rejects(request('/children'), { message: expected });
  }
});

test('does not treat an error payload with HTTP 200 as a successful save', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Save failed' } }));
  await assert.rejects(request('/children', { method: 'POST', body: {} }), { message: 'Save failed' });
});

test('successful form submissions preserve JSON payload and response', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/children');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { name: 'Test' });
    return new Response('{"id":1}');
  };
  assert.deepEqual(await request('/children', { method: 'POST', body: { name: 'Test' } }), { id: 1 });
});

test('teacher tokens authorize requests and are cleared when the session expires', async () => {
  setAccessToken('teacher-token');
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer teacher-token');
    return new Response('{"error":"Session expired"}', { status: 401 });
  };
  await assert.rejects(request('/children'), /Session expired/);
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return new Response('[]');
  };
  await request('/children');
});
