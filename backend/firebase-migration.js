const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const envFile = dotenv.config({ path: path.join(__dirname, '.env'), quiet: true, processEnv: {} }).parsed || {};
const config = { ...process.env, ...envFile };

const sourceUrl = (config.SUPABASE_URL || '').trim();
const sourceKey = (config.SUPABASE_SECRET_KEY || '').trim();
const firebaseProjectId = (config.FIREBASE_PROJECT_ID || '').trim();
const firebaseClientEmail = (config.FIREBASE_CLIENT_EMAIL || '').trim();
const firebasePrivateKey = (config.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
const firebaseDatabaseUrl = (config.FIREBASE_DATABASE_URL || '').trim();

if (!sourceUrl || !sourceKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY before running the migration.');
}
if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey || !firebaseDatabaseUrl) {
  throw new Error('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_DATABASE_URL before running the migration.');
}

const supabase = createClient(sourceUrl, sourceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

initializeApp({
  credential: cert({
    projectId: firebaseProjectId,
    clientEmail: firebaseClientEmail,
    privateKey: firebasePrivateKey,
  }),
  databaseURL: firebaseDatabaseUrl,
});

const db = getFirestore();

async function fetchAll(table, select = '*') {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}

async function migrateCollection(collectionName, rows, mapper = (row) => row) {
  const collection = db.collection(collectionName);
  for (const row of rows) {
    const value = mapper(row);
    const docId = String(value.id ?? row.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await collection.doc(docId).set(value, { merge: true });
  }
  return rows.length;
}

async function main() {
  const children = await fetchAll('children', '*');
  const attendance = await fetchAll('attendance', '*');
  const reportingSettings = await fetchAll('reporting_settings', '*');

  const childrenCount = await migrateCollection('children', children, (row) => ({
    ...row,
    id: Number(row.id),
    guardian_phone: row.guardian_phone ?? row.guardianPhone ?? null,
    checked_in: Boolean(row.checked_in ?? row.checkedIn ?? false),
    last_check_in: row.last_check_in ?? row.checkInTime ?? null,
    last_check_out: row.last_check_out ?? row.checkOutTime ?? null,
    allergies: row.allergies ?? 'None',
  }));

  const attendanceCount = await migrateCollection('attendance', attendance, (row) => ({
    ...row,
    id: Number(row.id),
    child_id: Number(row.child_id),
  }));

  const settingsCount = await migrateCollection('reporting_settings', reportingSettings, (row) => ({
    ...row,
    id: Number(row.id ?? 1),
    started_at: row.started_at ?? row.startedAt ?? null,
  }));

  console.log(`Migrated ${childrenCount} children, ${attendanceCount} attendance rows, and ${settingsCount} reporting settings rows to Firebase.`);
}

main().catch((error) => {
  console.error('Firebase migration failed:', error.message || error);
  process.exitCode = 1;
});
