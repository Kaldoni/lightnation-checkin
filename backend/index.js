const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { loadConfig, databaseError } = require('./config');
const { createClient } = require('@supabase/supabase-js');

const config = loadConfig();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) }
});

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

function sendDatabaseError(res, error) {
  const failure = databaseError(error);
  return res.status(failure.status).json({ error: failure.error });
}

app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('children').select('id').limit(1);
    if (error) return sendDatabaseError(res, error);

    return res.json({ ok: true, database: 'supabase' });
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
    const { data, error } = await supabase.from('children').select('*').order('id');
    if (error) return sendDatabaseError(res, error);
    return res.json((data || []).map(fromSupabaseChild));
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/children', async (req, res) => {
  const { name, age, guardian, guardianPhone, allergies, tag } = req.body;

  try {
    const { data, error } = await supabase.from('children').insert([toSupabaseChild({ name, age, guardian, guardianPhone, allergies, tag })]).select('id');
    if (error) return sendDatabaseError(res, error);
    return res.json({ id: data?.[0]?.id ?? null });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.put('/api/children/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, age, guardian, guardianPhone, allergies, tag } = req.body;

  try {
    const { error } = await supabase.from('children').update(toSupabaseChild({
      name,
      age,
      guardian,
      guardianPhone,
      allergies,
      tag,
    })).eq('id', id);
    if (error) return sendDatabaseError(res, error);
    return res.json({ ok: true });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.delete('/api/children/:id', async (req, res) => {
  const id = Number(req.params.id);

  try {
    const { error } = await supabase.from('children').delete().eq('id', id);
    if (error) return sendDatabaseError(res, error);
    return res.json({ ok: true });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/checkin', async (req, res) => {
  const { id } = req.body;
  try {
    const time = new Date().toISOString();
    const { error } = await supabase.from('children').update({
      checked_in: true,
      last_check_in: time,
      last_check_out: null
    }).eq('id', id);
    if (error) return sendDatabaseError(res, error);
    return res.json({ ok: true, checkInTime: time });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.post('/api/checkout', async (req, res) => {
  const { id } = req.body;
  try {
    const time = new Date().toISOString();
    const { error } = await supabase.from('children').update({
      checked_in: false,
      last_check_out: time
    }).eq('id', id);
    if (error) return sendDatabaseError(res, error);
    return res.json({ ok: true, checkOutTime: time });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const { data, error } = await supabase.from('children').select('id, checked_in');
    if (error) return sendDatabaseError(res, error);
    const total = data.length;
    const inside = data.filter((row) => Boolean(row.checked_in)).length;
    return res.json({ total, inside });
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
if (require.main === module) app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT} using Supabase`));
module.exports = { app };
