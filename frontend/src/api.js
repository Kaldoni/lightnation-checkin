export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the backend is running.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    throw new Error(errorMessage(data?.error) || errorMessage(data) || `Server request failed (${response.status}).`);
  }
  if (data === null) throw new Error('The server returned an invalid response. Check the API proxy.');
  return data;
}

export function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function errorMessage(value) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  for (const field of ['message', 'error', 'details', 'hint', 'code']) {
    const message = errorMessage(value[field]);
    if (message) return message;
  }
  return '';
}
