const { createClient } = require('@supabase/supabase-js');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

function normalizeNumber(value) {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  return value;
}

function normalizeId(value) {
  const candidate = normalizeNumber(value);
  return Number.isInteger(candidate) ? candidate : value;
}

function pickFields(row = {}, fields) {
  const keys = Array.isArray(fields) ? fields : [];
  if (!keys.length) return row;
  if (keys.length === 1 && keys[0] === '*') return row;
  return keys.reduce((acc, key) => {
    const trimmed = String(key).trim();
    if (!trimmed) return acc;
    if (Object.prototype.hasOwnProperty.call(row, trimmed)) acc[trimmed] = row[trimmed];
    return acc;
  }, {});
}

function applyFilters(rows, filters) {
  return rows.filter((row) => filters.every((filter) => {
    const left = filter.column === 'id' ? normalizeId(row.id) : row[filter.column];
    const right = normalizeId(filter.value);
    switch (filter.type) {
      case 'eq': return left === right;
      case 'gt': return left > right;
      case 'gte': return left >= right;
      case 'lt': return left < right;
      case 'lte': return left <= right;
      default: return true;
    }
  }));
}

function sortRows(rows, field) {
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const left = normalizeId(a?.[field]);
    const right = normalizeId(b?.[field]);
    if (left === undefined || right === undefined) return 0;
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right));
  });
}

class FirebaseQueryBuilder {
  constructor(config, table) {
    this.config = config;
    this.table = table;
    this.filters = [];
    this.selectedFields = [];
    this.orderField = null;
    this.rangeStart = null;
    this.rangeEnd = null;
    this.limitCount = null;
    this.isSingle = false;
    this.operation = 'read';
    this.payload = null;
  }

  select(fields) {
    this.selectedFields = typeof fields === 'string'
      ? fields.split(',').map((value) => value.trim()).filter(Boolean)
      : Array.isArray(fields) ? fields : [];
    return this;
  }

  order(field) {
    this.orderField = field;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  gt(column, value) { this.filters.push({ type: 'gt', column, value }); return this; }
  gte(column, value) { this.filters.push({ type: 'gte', column, value }); return this; }
  lt(column, value) { this.filters.push({ type: 'lt', column, value }); return this; }
  lte(column, value) { this.filters.push({ type: 'lte', column, value }); return this; }
  range(start, end) { this.rangeStart = start; this.rangeEnd = end; return this; }
  limit(count) { this.limitCount = count; return this; }
  single() { this.isSingle = true; return this; }
  insert(rows) { this.operation = 'insert'; this.payload = rows; return this; }
  update(row) { this.operation = 'update'; this.payload = row; return this; }
  delete() { this.operation = 'delete'; return this; }

  async execute() {
    const firestore = getFirestore();
    const collection = firestore.collection(this.table);

    if (this.operation === 'insert') {
      const inserted = [];
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const row of rows) {
        const currentRows = (await collection.get()).docs.map((doc) => ({ ...doc.data(), id: normalizeId(doc.id) }));
        const nextId = this.table === 'children'
          ? currentRows.reduce((max, item) => Math.max(max, Number.isFinite(Number(item.id)) ? Number(item.id) : 0), 0) + 1
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const record = { ...row, id: this.table === 'children' ? nextId : row.id ?? nextId };
        const docId = String(record.id);
        await collection.doc(docId).set(record, { merge: true });
        inserted.push({ ...record, id: this.table === 'children' ? Number(record.id) : record.id });
      }
      const finalRows = this.selectedFields.length ? inserted.map((row) => pickFields(row, this.selectedFields)) : inserted;
      return { data: this.isSingle ? (finalRows[0] ?? null) : finalRows, error: null };
    }

    if (this.operation === 'update') {
      const found = await this._fetchRows();
      if (!found.length) return { data: null, error: null };
      for (const row of found) {
        const ref = collection.doc(String(row.id));
        await ref.set({ ...row, ...this.payload }, { merge: true });
      }
      return { data: null, error: null };
    }

    if (this.operation === 'delete') {
      const found = await this._fetchRows();
      for (const row of found) {
        await collection.doc(String(row.id)).delete();
      }
      return { data: null, error: null };
    }

    let rows = (await collection.get()).docs.map((doc) => {
      const data = doc.data();
      return { ...data, id: normalizeId(data.id ?? doc.id) };
    });
    rows = applyFilters(rows, this.filters);
    rows = sortRows(rows, this.orderField);
    if (this.rangeStart !== null || this.rangeEnd !== null) {
      const start = this.rangeStart ?? 0;
      const end = this.rangeEnd ?? rows.length;
      rows = rows.slice(start, end + 1);
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    if (this.selectedFields.length) rows = rows.map((row) => pickFields(row, this.selectedFields));
    if (this.isSingle) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }

  async _fetchRows() {
    const firestore = getFirestore();
    const collection = firestore.collection(this.table);
    let rows = (await collection.get()).docs.map((doc) => ({ ...doc.data(), id: normalizeId(doc.id) }));
    rows = applyFilters(rows, this.filters);
    rows = sortRows(rows, this.orderField);
    return rows;
  }
}

function createFirebaseAuth(config) {
  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({
      projectId: config.FIREBASE_PROJECT_ID,
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
      privateKey: config.FIREBASE_PRIVATE_KEY,
    }),
    databaseURL: config.FIREBASE_DATABASE_URL,
  });
  const auth = getAuth(app);

  return {
    async getUser(token) {
      try {
        const decoded = await auth.verifyIdToken(token);
        const user = await auth.getUser(decoded.uid);
        return {
          data: {
            user: {
              ...user,
              app_metadata: { role: user.customClaims?.role || 'teacher' },
              email: user.email,
            },
          },
          error: null,
        };
      } catch (error) {
        return { data: null, error: error || new Error('Unable to verify Firebase token.') };
      }
    },

    async signInWithPassword({ email, password }) {
      if (!config.FIREBASE_API_KEY) {
        return { data: null, error: new Error('Missing FIREBASE_API_KEY for Firebase Auth.') };
      }
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        return { data: null, error: { message: payload?.error?.message || 'Invalid Firebase credentials.' } };
      }
      const user = await auth.getUserByEmail(email);
      return {
        data: {
          session: { access_token: payload.idToken },
          user: {
            ...user,
            email: user.email,
            app_metadata: { role: user.customClaims?.role || 'teacher' },
          },
        },
        error: null,
      };
    },
  };
}

function createFirebaseDatabase(config) {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: config.FIREBASE_PRIVATE_KEY,
      }),
      databaseURL: config.FIREBASE_DATABASE_URL,
    });
  }
  return {
    from(table) {
      return new FirebaseQueryBuilder(config, table);
    },
    auth: createFirebaseAuth(config),
  };
}

function createDatabaseClient(config) {
  if (config.DATABASE_PROVIDER === 'firebase') {
    return createFirebaseDatabase(config);
  }
  return createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) },
  });
}

module.exports = { createDatabaseClient, createFirebaseDatabase, createFirebaseAuth };
