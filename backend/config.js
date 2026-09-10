const path = require('path');
const dotenv = require('dotenv');

function loadConfig(env = process.env) {
  // Local development uses the project's file; deployments retain injected env.
  const file = dotenv.config({ path: path.join(__dirname, '.env'), quiet: true, processEnv: {} }).parsed || {};
  const config = env.NODE_ENV === 'production' ? { ...file, ...env } : { ...env, ...file };
  const url = (config.SUPABASE_URL || '').trim();
  const key = (config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase is required. Set SUPABASE_URL and a server secret/service-role key in backend/.env.');
  {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('SUPABASE_URL must be a valid project URL.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || !key || /dummy|your-project/.test(parsed.hostname) || /your-service-role-key/.test(key)) {
      throw new Error('Set a real SUPABASE_URL and server secret/service-role key in backend/.env.');
    }
    if (key.startsWith('sb_publishable_')) throw new Error('Use a Supabase server secret key, not a publishable key.');
  }
  return { ...config, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key };
}

function databaseError(error) {
  if (/fetch failed|ENOTFOUND|EACCES|timeout|network/i.test(`${error.message} ${error.details}`)) {
    return { status: 503, error: 'Cannot reach Supabase. Check the project URL, network access, and whether the project is paused.' };
  }
  if (['42P01', 'PGRST205'].includes(error.code)) return { status: 503, error: 'Supabase tables are missing. Run backend/supabase-schema.sql in the Supabase SQL editor.' };
  if (error.code === '23505') return { status: 409, error: 'This tag is already assigned to a child.' };
  return { status: 500, error: error.message || 'Database request failed.' };
}

module.exports = { loadConfig, databaseError };
