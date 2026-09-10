// Usage: node backend/create-teacher.js <path-to-private-credentials.json>
// Input: { "email": "...", "password": "..." }. Never commit this input file.
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { loadConfig } = require('./config');

async function main() {
  if (!process.argv[2]) throw new Error('Provide the path to a private JSON file containing email and password.');
  const { email, password } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 12) throw new Error('Provide an email and a password of at least 12 characters.');
  const config = loadConfig();
  const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'teacher' } });
  if (error) throw error;
  console.log('Teacher account created.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
