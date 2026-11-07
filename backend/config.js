const path = require('path');
const dotenv = require('dotenv');

function loadConfig(env = process.env) {
  // Local development uses the project's file; deployments retain injected env.
  const file = dotenv.config({ path: path.join(__dirname, '.env'), quiet: true, processEnv: {} }).parsed || {};
  const config = env.NODE_ENV === 'production' ? { ...file, ...env } : { ...env, ...file };

  const firebaseProjectId = (config.FIREBASE_PROJECT_ID || '').trim();
  const firebaseClientEmail = (config.FIREBASE_CLIENT_EMAIL || '').trim();
  const firebasePrivateKey = (config.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const firebaseDatabaseUrl = (config.FIREBASE_DATABASE_URL || '').trim();
  const firebaseApiKey = (config.FIREBASE_API_KEY || '').trim();

  const hasFirebase = Boolean(firebaseProjectId && firebaseClientEmail && firebasePrivateKey && firebaseDatabaseUrl);
  if (hasFirebase) {
    return {
      ...config,
      DATABASE_PROVIDER: 'firebase',
      FIREBASE_PROJECT_ID: firebaseProjectId,
      FIREBASE_CLIENT_EMAIL: firebaseClientEmail,
      FIREBASE_PRIVATE_KEY: firebasePrivateKey,
      FIREBASE_DATABASE_URL: firebaseDatabaseUrl,
      FIREBASE_API_KEY: firebaseApiKey,
    };
  }

  const url = (config.SUPABASE_URL || '').trim();
  const key = (config.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase is required. Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.');
  {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('SUPABASE_URL must be a valid project URL.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || !key || /dummy|your-project/.test(parsed.hostname) || /your-secret-key/.test(key)) {
      throw new Error('Set a real SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.');
    }
    if (key.startsWith('sb_publishable_')) throw new Error('Use a Supabase server secret key, not a publishable key.');
  }
  return { ...config, DATABASE_PROVIDER: 'supabase', SUPABASE_URL: url, SUPABASE_SECRET_KEY: key };
}

function databaseError(error) {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  if (/fetch failed|ENOTFOUND|EACCES|timeout|network/i.test(message)) {
    return { status: 503, error: 'Cannot reach Supabase. Check the project URL, network access, and whether the project is paused.' };
  }
  if (['42P01', 'PGRST205'].includes(error?.code)) return { status: 503, error: 'Supabase tables are missing. Run backend/supabase-schema.sql in the Supabase SQL editor.' };
  if (error?.code === '23505') return { status: 409, error: 'This tag is already assigned to a child.' };
  return { status: 500, error: error?.message || 'Database request failed.' };
}

module.exports = { loadConfig, databaseError };
