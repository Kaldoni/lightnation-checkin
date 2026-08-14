const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, 'data.db');
const initData = [
  ['Amara Johnson',7,'Mrs. Johnson','080-1234-5678','Peanuts','A001'],
  ['David Okafor',5,'Mr. Okafor','080-2345-6789','None','A002'],
  ['Grace Mensah',9,'Mrs. Mensah','080-3456-7890','Lactose','A003']
];

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

initDb();

// API routes
app.get('/api/children', (req, res) => {
  const db = openDb();
  db.all('SELECT * FROM children ORDER BY id', (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({...r, checkedIn: !!r.checkedIn})))
  });
});

app.post('/api/children', (req, res) => {
  const { name, age, guardian, guardianPhone, allergies, tag } = req.body;
  const db = openDb();
  db.run('INSERT INTO children (name,age,guardian,guardianPhone,allergies,tag) VALUES (?,?,?,?,?,?)', [name, age, guardian, guardianPhone, allergies || 'None', tag], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// Update a child
app.put('/api/children/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, age, guardian, guardianPhone, allergies, checkedIn, checkInTime, checkOutTime, tag } = req.body;
  const db = openDb();
  db.run(
    `UPDATE children SET name=?, age=?, guardian=?, guardianPhone=?, allergies=?, checkedIn=?, checkInTime=?, checkOutTime=?, tag=? WHERE id=?`,
    [name, age, guardian, guardianPhone, allergies || 'None', checkedIn ? 1 : 0, checkInTime || null, checkOutTime || null, tag, id],
    function (err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// Delete a child
app.delete('/api/children/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = openDb();
  db.run('DELETE FROM children WHERE id=?', [id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

app.post('/api/checkin', (req, res) => {
  const { id } = req.body;
  const time = new Date().toLocaleTimeString();
  const db = openDb();
  db.run('UPDATE children SET checkedIn=1, checkInTime=?, checkOutTime=NULL WHERE id=?', [time, id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, checkInTime: time });
  });
});

app.post('/api/checkout', (req, res) => {
  const { id } = req.body;
  const time = new Date().toLocaleTimeString();
  const db = openDb();
  db.run('UPDATE children SET checkedIn=0, checkOutTime=? WHERE id=?', [time, id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, checkOutTime: time });
  });
});

app.get('/api/attendance', (req, res) => {
  const db = openDb();
  db.get('SELECT COUNT(*) as total FROM children', (err, totalRow) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    db.get('SELECT COUNT(*) as inside FROM children WHERE checkedIn=1', (err2, inRow) => {
      db.close();
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ total: totalRow.total, inside: inRow.inside });
    });
  });
});

// AI proxy: forwards to configured provider or responds locally if no API key
app.post('/api/ai', async (req, res) => {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const key = process.env.AI_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  // If no key provided, return a simple local reply based on attendance data
  if (!key) {
    const prompt = (req.body && (req.body.prompt || (req.body.messages && req.body.messages.map(m => m.content || m.text || '').join('\n')))) || '';
    const db = openDb();
    db.all('SELECT name, checkedIn, checkInTime, checkOutTime, guardian, allergies, tag FROM children', (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      const text = prompt.toLowerCase();
      if (text.includes('who') && text.includes('inside')) {
        const inside = rows.filter(r => r.checkedIn).map(r => `${r.name} (Tag ${r.tag})`).join(', ');
        return res.json({ reply: inside || 'No one is currently inside.' });
      }
      if (text.includes('allerg')) {
        const list = rows.filter(r => r.allergies && r.allergies !== 'None').map(r => `${r.name}: ${r.allergies}`).join('; ');
        return res.json({ reply: list || 'No allergy alerts.' });
      }
      // default summary
      const summary = rows.map(r => `${r.name} - ${r.checkedIn ? 'In' : 'Out'}`).join('; ');
      return res.json({ reply: `No AI key configured. Quick summary: ${summary}` });
    });
    return;
  }

  try {
    // Default to OpenAI-compatible Chat Completions
    if (provider === 'openai') {
      const messages = req.body.messages || [{ role: 'user', content: req.body.prompt || '' }];
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1000 })
      });
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || data?.error || JSON.stringify(data);
      return res.json({ reply });
    }

    // Anthropic (basic mapping) support
    if (provider === 'anthropic') {
      const prompt = req.body.prompt || (req.body.messages && req.body.messages.map(m => m.content || m.text || '').join('\n')) || '';
      const resp = await fetch('https://api.anthropic.com/v1/complete', {
        method: 'POST',
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-2', prompt, max_tokens: 1000 })
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

// Serve client build if present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
