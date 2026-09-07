import Database from 'libsql';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ikki rejim:
 *   1. Turso (bulut) — TURSO_DATABASE_URL berilsa. Vercel kabi serverless
 *      muhitlarda shu rejim ishlatiladi, chunki lokal disk vaqtinchalik.
 *   2. Lokal fayl — aks holda. DATA_DIR bilan papkani o'zgartirish mumkin.
 *
 * `libsql` paketi better-sqlite3 bilan bir xil SINXRON API beradi,
 * shuning uchun qolgan kod (db.prepare(...).get()/.all()/.run()) o'zgarmaydi.
 */
const remoteUrl = process.env.TURSO_DATABASE_URL;

// Serverless muhitda fayl tizimi faqat o'qish uchun ochiq (/tmp dan tashqari).
// TURSO_DATABASE_URL berilmasa, quyida mkdirSync EROFS bilan yiqiladi va
// funksiya tushunarsiz "FUNCTION_INVOCATION_FAILED" beradi. Sababini aytamiz.
if (!remoteUrl && process.env.VERCEL) {
  throw new Error(
    'TURSO_DATABASE_URL topilmadi. Vercel'da lokal SQLite fayli ishlamaydi ' +
      '(fayl tizimi faqat o'qish uchun va vaqtinchalik). ' +
      'Project Settings > Environment Variables da TURSO_DATABASE_URL va ' +
      'TURSO_AUTH_TOKEN ni qo'shing, so'ng qayta deploy qiling.'
  );
}

export const db = remoteUrl
  ? new Database(remoteUrl, { authToken: process.env.TURSO_AUTH_TOKEN })
  : (() => {
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const local = new Database(path.join(dataDir, 'nexusai.db'));
      local.pragma('journal_mode = WAL');
      local.pragma('foreign_keys = ON');
      return local;
    })();

// Qator natijalarini normallashtirish:
//   1. libsql .get() ga xizmatchi `_metadata` maydonini qo'shadi — API javoblariga
//      tushmasligi uchun olib tashlanadi.
//   2. Turso zahiralangan kalit so'z bo'lgan ustun nomlarini KATTA harfda qaytaradi
//      (masalan `action` -> `ACTION`). Natijada r.action `undefined` bo'lib qoladi va
//      audit hash-zanjiri jimgina buziladi. Shuning uchun bunday kalitlar kichik
//      harfga qaytariladi. Sxemadagi barcha ustunlar kichik harfda.
const normalizeRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  delete row._metadata;
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase();
    if (lower !== key && !(lower in row)) {
      row[lower] = row[key];
      delete row[key];
    }
  }
  return row;
};

const preparePlain = db.prepare.bind(db);
db.prepare = (sql) => {
  const stmt = preparePlain(sql);
  const getPlain = stmt.get.bind(stmt);
  const allPlain = stmt.all.bind(stmt);
  stmt.get = (...args) => normalizeRow(getPlain(...args));
  stmt.all = (...args) => {
    const rows = allPlain(...args);
    return Array.isArray(rows) ? rows.map(normalizeRow) : rows;
  };
  return stmt;
};

// Turso (uzoq Hrana protokoli) da tranzaksiya ishlamaydi: har bir statement
// alohida HTTP oqimida ketishi mumkin, shuning uchun BEGIN va COMMIT turli
// ulanishlarga tushib "no transaction is active" xatosini beradi.
// Shu sababli uzoq rejimda tranzaksiya o'rniga statementlar ketma-ket bajariladi.
//
// Ta'siri: indexDocument() ichidagi chunk yozuvlari atomar emas — o'rtada xato
// bo'lsa hujjat qisman indekslangan bo'lib qolishi mumkin (hujjatni qayta
// yuklash bilan tuzatiladi). Lokal fayl rejimida atomarlik saqlanadi.
if (remoteUrl) {
  db.transaction = (fn) => (...args) => fn(...args);
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',      -- super_admin | ai_engineer | security_analyst | member
  department    TEXT DEFAULT '',
  twofa_method  TEXT DEFAULT 'none',                 -- none | totp | fido2 | yubikey
  twofa_enabled INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active',               -- active | pending | suspended
  settings      TEXT DEFAULT '{}',
  created_at    TEXT DEFAULT (datetime('now')),
  last_active   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_2fa (
  user_id  TEXT PRIMARY KEY,
  code     TEXT NOT NULL,
  expires  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Yangi muloqot',
  model      TEXT DEFAULT 'nexus-v4-core',
  pinned     INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                      -- user | assistant | system
  content         TEXT NOT NULL DEFAULT '',
  reasoning       TEXT DEFAULT '',
  model           TEXT DEFAULT '',
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  latency_ms      INTEGER DEFAULT 0,
  attachments     TEXT DEFAULT '[]',
  sources         TEXT DEFAULT '[]',
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS documents (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  filename   TEXT DEFAULT '',
  mime       TEXT DEFAULT 'text/plain',
  size       INTEGER DEFAULT 0,
  tags       TEXT DEFAULT '[]',
  status     TEXT DEFAULT 'indexed',                 -- indexing | indexed | failed
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  id      TEXT PRIMARY KEY,
  doc_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  idx     INTEGER NOT NULL,
  text    TEXT NOT NULL,
  vector  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);

CREATE TABLE IF NOT EXISTS models (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  arch         TEXT DEFAULT '',
  version      TEXT DEFAULT 'v1.0',
  status       TEXT DEFAULT 'serving',               -- serving | training | idle | failed
  badge        TEXT DEFAULT '',
  capabilities TEXT DEFAULT '[]',
  latency_ms   INTEGER DEFAULT 0,
  deployment   TEXT DEFAULT 'cloud',                 -- cloud | on_prem
  progress     INTEGER DEFAULT 0,
  metrics      TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id        TEXT PRIMARY KEY,
  seq       INTEGER,
  ts        TEXT DEFAULT (datetime('now')),
  actor     TEXT DEFAULT 'system',
  action    TEXT NOT NULL,
  resource  TEXT DEFAULT '',
  ip        TEXT DEFAULT '',
  severity  TEXT DEFAULT 'info',                     -- info | low | medium | high | critical
  status    TEXT DEFAULT 'success',
  meta      TEXT DEFAULT '{}',
  prev_hash TEXT DEFAULT '',
  hash      TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_seq ON audit_logs(seq);

CREATE TABLE IF NOT EXISTS alerts (
  id       TEXT PRIMARY KEY,
  ts       TEXT DEFAULT (datetime('now')),
  title    TEXT NOT NULL,
  detail   TEXT DEFAULT '',
  severity TEXT DEFAULT 'medium',
  source   TEXT DEFAULT '',
  status   TEXT DEFAULT 'open'                       -- open | ack | resolved
);

CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT DEFAULT '',
  status      TEXT DEFAULT 'idle',                   -- active | idle | patching | quarantined
  confidence  REAL DEFAULT 0.9,
  last_action TEXT DEFAULT '',
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  prefix     TEXT NOT NULL,
  hash       TEXT NOT NULL,
  scopes     TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  last_used  TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  day    TEXT NOT NULL,
  dau    INTEGER DEFAULT 0,
  requests INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0
);
`);

export const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export const json = (v, fallback) => {
  try { return JSON.parse(v); } catch { return fallback; }
};
