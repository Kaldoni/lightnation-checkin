const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { loadConfig, databaseError } = require('./config');
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();

const config = loadConfig();

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'data.db');
const initData = [
  ['Amara Johnson', 7, 'Mrs. Johnson', '080-1234-5678', 'Peanuts', 'A001'],
  ['David Okafor', 5, 'Mr. Okafor', '080-2345-6789', 'None', 'A002'],
  ['Grace Mensah', 9, 'Mrs. Mensah', '080-3456-7890', 'Lactose', 'A003']
];

const hasSupabaseConfig = Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabaseConfig
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) }
    })
  : null;

if (!hasSupabaseConfig) {
  console.log('Supabase not configured; using local SQLite database fallback. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env to enable Supabase.');
}

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

function initDb() {
  const exists = fs.existsSync(DB_PATH);
  const db = openDb();
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      age INTEGER,
      guardian TEXT,
      guardianPhone TEXT,
      allergies TEXT,
      checkedIn INTEGER DEFAULT 0,
      checkInTime TEXT,
      checkOutTime TEXT,
      tag TEXT
    )`);
    if (!exists) {
      const stmt = db.prepare('INSERT INTO children (name,age,guardian,guardianPhone,allergies,tag) VALUES (?,?,?,?,?,?)');
      for (const r of initData) stmt.run(r);
      stmt.finalize();
    }
  });
  db.close();
}

function toSupabaseChild(row = {}) {
  return {
    name: row.name,
    age: row.age,
    guardian: row.guardian,
    guardian_phone: row.guardianPhone ?? row.guardian_phone ?? null,
    allergies: row.allergies ?? 'None',
    tag: row.tag,
  };
}

function fromSupabaseChild(row = {}) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    guardian: row.guardian,
    guardianPhone: row.guardian_phone ?? row.guardianPhone ?? null,
    allergies: row.allergies ?? 'None',
    checkedIn: Boolean(row.checked_in ?? row.checkedIn),
    checkInTime: row.last_check_in ?? row.checkInTime ?? null,
    checkOutTime: row.last_check_out ?? row.checkOutTime ?? null,
    tag: row.tag,
  };
}

function normalizeDbRow(row) {
  return { ...row, checkedIn: Boolean(row.checkedIn ?? row.checked_in) };
}

function parseLocalRows(rows) {
  return rows.map(normalizeDbRow);
}

function listLocalChildren() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all('SELECT * FROM children ORDER BY id', (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(parseLocalRows(rows));
    });
  });
}

function createLocalChild(payload) {
  return new Promise((resolve, reject) => {
    const { name, age, guardian, guardianPhone, allergies, tag } = payload;
    const db = openDb();
    db.run('INSERT INTO children (name,age,guardian,guardianPhone,allergies,tag) VALUES (?,?,?,?,?,?)', [name, age, guardian, guardianPhone, allergies || 'None', tag], function (err) {
      db.close();
      if (err) return reject(err);
      resolve({ id: this.lastID });
    });
  });
}

function updateLocalChild(id, payload) {
  return new Promise((resolve, reject) => {
    const { name, age, guardian, guardianPhone, allergies, checkedIn, checkInTime, checkOutTime, tag } = payload;
    const db = openDb();
    db.run(
      `UPDATE children SET name=?, age=?, guardian=?, guardianPhone=?, allergies=?, tag=? WHERE id=?`,
      [name, age, guardian, guardianPhone, allergies || 'None', tag, id],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ ok: true });
      }
    );
  });
}

function deleteLocalChild(id) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.run('DELETE FROM children WHERE id=?', [id], function (err) {
      db.close();
      if (err) return reject(err);
      resolve({ ok: true });
    });
  });
}

function toggleLocalCheckIn(id, checkedIn) {
  return new Promise((resolve, reject) => {
    const time = new Date().toISOString();
    const db = openDb();
    if (checkedIn) {
      db.run('UPDATE children SET checkedIn=1, checkInTime=?, checkOutTime=NULL WHERE id=?', [time, id], function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ ok: true, checkInTime: time });
      });
      return;
    }

    db.run('UPDATE children SET checkedIn=0, checkOutTime=? WHERE id=?', [time, id], function (err) {
      db.close();
      if (err) return reject(err);
      resolve({ ok: true, checkOutTime: time });
    });
  });
}

function attendanceLocal() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.get('SELECT COUNT(*) as total FROM children', (err, totalRow) => {
      if (err) {
        db.close();
        return reject(err);
      }
      db.get('SELECT COUNT(*) as inside FROM children WHERE checkedIn=1', (err2, inRow) => {
        db.close();
        if (err2) return reject(err2);
        resolve({ total: totalRow.total, inside: inRow.inside });
      });
    });
  });
}

function getLocalAiSummary(prompt) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all('SELECT name, checkedIn, checkInTime, checkOutTime, guardian, allergies, tag FROM children', (err, rows) => {
      db.close();
      if (err) return reject(err);
      const text = prompt.toLowerCase();
      if (text.includes('who') && text.includes('inside')) {
        const inside = rows.filter(r => r.checkedIn).map(r => `${r.name} (Tag ${r.tag})`).join(', ');
        return resolve({ reply: inside || 'No one is currently inside.' });
      }
      if (text.includes('allerg')) {
        const list = rows.filter(r => r.allergies && r.allergies !== 'None').map(r => `${r.name}: ${r.allergies}`).join('; ');
        return resolve({ reply: list || 'No allergy alerts.' });
      }
      const summary = rows.map(r => `${r.name} - ${r.checkedIn ? 'In' : 'Out'}`).join('; ');
      return resolve({ reply: `No AI key configured. Quick summary: ${summary}` });
    });
  });
}

if (!supabase) initDb();

function sendDatabaseError(res, error) {
  const failure = databaseError(error);
  return res.status(failure.status).json({ error: failure.error });
}

app.get('/api/health', async (req, res) => {
  try {
    if (supabase) {
      const { error } = await supabase.from('children').select('id').limit(1);
      if (error) return sendDatabaseError(res, error);
    } else { await listLocalChildren(); }
    return res.json({ ok: true, database: supabase ? 'supabase' : 'sqlite' });
  } catch (error) { return sendDatabaseError(res, error); }
});

app.use('/api', (req, res, next) => {
  const isToggle = ['/checkin', '/checkout'].includes(req.path);
  const id = req.path.startsWith('/children/') ? req.path.split('/')[2] : isToggle ? req.body?.id : undefined;
  if ((id !== undefined || isToggle) && (!Number.isSafeInteger(Number(id)) || Number(id) < 1)) {
    return res.status(400).json({ error: 'A valid child ID is required.' });
  }
  if ((req.method === 'POST' && req.path === '/children') || (req.method === 'PUT' && req.path.startsWith('/children/'))) {
    const { name, guardian, age, tag } = req.body || {};
    if (![name, guardian, tag].every(value => typeof value === 'string' && value.trim()) || !Number.isInteger(age) || age < 0 || age > 17) {
      return res.status(400).json({ error: 'Name, guardian, tag, and an age from 0 to 17 are required.' });
    }
  }
  next();
});

// API routes
app.get('/api/children', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('children').select('*').order('id');
      if (error) return sendDatabaseError(res, error);
      return res.json((data || []).map(fromSupabaseChild));
    }

    const rows = await listLocalChildren();
    return res.json(rows);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/children', async (req, res) => {
  const { name, age, guardian, guardianPhone, allergies, tag } = req.body;

  try {
    if (supabase) {
      const { data, error } = await supabase.from('children').insert([toSupabaseChild({ name, age, guardian, guardianPhone, allergies, tag })]).select('id');
      if (error) return sendDatabaseError(res, error);
      return res.json({ id: data?.[0]?.id ?? null });
    }

    const row = await createLocalChild({ name, age, guardian, guardianPhone, allergies, tag });
    return res.json(row);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.put('/api/children/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, age, guardian, guardianPhone, allergies, checkedIn, checkInTime, checkOutTime, tag } = req.body;

  try {
    if (supabase) {
      const { error } = await supabase.from('children').update(toSupabaseChild({
        name,
        age,
        guardian,
        guardianPhone,
        allergies,
        checkedIn,
        checkInTime,
        checkOutTime,
        tag,
      })).eq('id', id);
      if (error) return sendDatabaseError(res, error);
      return res.json({ ok: true });
    }

    const row = await updateLocalChild(id, { name, age, guardian, guardianPhone, allergies, checkedIn, checkInTime, checkOutTime, tag });
    return res.json(row);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.delete('/api/children/:id', async (req, res) => {
  const id = Number(req.params.id);

  try {
    if (supabase) {
      const { error } = await supabase.from('children').delete().eq('id', id);
      if (error) return sendDatabaseError(res, error);
      return res.json({ ok: true });
    }

    const row = await deleteLocalChild(id);
    return res.json(row);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/checkin', async (req, res) => {
  const { id } = req.body;
  try {
    if (supabase) {
      const time = new Date().toISOString();
      const { error } = await supabase.from('children').update({
        checked_in: true,
        last_check_in: time,
        last_check_out: null
      }).eq('id', id);
      if (error) return sendDatabaseError(res, error);
      return res.json({ ok: true, checkInTime: time });
    }

    const row = await toggleLocalCheckIn(id, true);
    return res.json(row);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/checkout', async (req, res) => {
  const { id } = req.body;
  try {
    if (supabase) {
      const time = new Date().toISOString();
      const { error } = await supabase.from('children').update({
        checked_in: false,
        last_check_out: time
      }).eq('id', id);
      if (error) return sendDatabaseError(res, error);
      return res.json({ ok: true, checkOutTime: time });
    }

    const row = await toggleLocalCheckIn(id, false);
    return res.json(row);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('children').select('id, checked_in');
      if (error) return sendDatabaseError(res, error);
      const total = data.length;
      const inside = data.filter((row) => Boolean(row.checked_in)).length;
      return res.json({ total, inside });
    }

    const row = await attendanceLocal();
    return res.json(row);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/ai', async (req, res) => {
  const provider = (config.AI_PROVIDER || 'openai').toLowerCase();
  const key = config.AI_KEY;
  const model = config.AI_MODEL || 'gpt-4o-mini';

  if (!key) {
    const prompt = (req.body && (req.body.prompt || (req.body.messages && req.body.messages.map((m) => m.content || m.text || '').join('\n')))) || '';

    try {
      if (supabase) {
        const { data, error } = await supabase.from('children').select('name, checked_in, last_check_in, last_check_out, guardian, allergies, tag');
        if (error) return sendDatabaseError(res, error);
        const mappedData = (data || []).map(fromSupabaseChild);
        const text = prompt.toLowerCase();
        if (text.includes('who') && text.includes('inside')) {
          const inside = mappedData.filter((r) => r.checkedIn).map((r) => `${r.name} (Tag ${r.tag})`).join(', ');
          return res.json({ reply: inside || 'No one is currently inside.' });
        }
        if (text.includes('allerg')) {
          const list = mappedData.filter((r) => r.allergies && r.allergies !== 'None').map((r) => `${r.name}: ${r.allergies}`).join('; ');
          return res.json({ reply: list || 'No allergy alerts.' });
        }
        const summary = mappedData.map((r) => `${r.name} - ${r.checkedIn ? 'In' : 'Out'}`).join('; ');
        return res.json({ reply: `No AI key configured. Quick summary: ${summary}` });
      }

      const row = await getLocalAiSummary(prompt);
      return res.json(row);
    } catch (error) {
      return sendDatabaseError(res, error);
    }
  }

  try {
    if (provider === 'openai') {
      const messages = req.body.messages || [{ role: 'user', content: req.body.prompt || '' }];
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1000 })
      });
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || data?.error || JSON.stringify(data);
      return res.json({ reply });
    }

    if (provider === 'anthropic') {
      const prompt = req.body.prompt || (req.body.messages && req.body.messages.map((m) => m.content || m.text || '').join('\n')) || '';
      const resp = await fetch('https://api.anthropic.com/v1/complete', {
        method: 'POST',
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.AI_MODEL || 'claude-2', prompt, max_tokens: 1000 })
      });
      const data = await resp.json();
      const reply = data?.completion || data?.error || JSON.stringify(data);
      return res.json({ reply });
    }

    return res.status(400).json({ error: 'Unsupported AI_PROVIDER' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// Serve client build if present
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}



const PORT = config.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT} using ${supabase ? 'Supabase' : 'SQLite'}`));
module.exports = { app };
