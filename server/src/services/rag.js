import crypto from 'node:crypto';
import { db, uid } from '../db.js';

const DIM = 384;

/**
 * Tashqi API'siz ishlaydigan vektorlashtirish: so'z + bigram'lar hash'lanib,
 * DIM o'lchamli siyrak vektorga joylanadi, so'ng L2 normallashtiriladi.
 * Semantik jihatdan real embedding'dan sodda, ammo offline va tez ishlaydi.
 */
export function embed(text) {
  const v = new Float32Array(DIM);
  const tokens = normalize(text);
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) grams.push(tokens[i] + '_' + tokens[i + 1]);

  for (const g of grams) {
    const h = crypto.createHash('md5').update(g).digest();
    const slot = h.readUInt16BE(0) % DIM;
    const sign = h[2] % 2 === 0 ? 1 : -1;
    v[slot] += sign * (1 + Math.log(1 + g.length / 4));
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return Array.from(v);
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Matnni gap chegaralarini hurmat qilgan holda bo'laklarga ajratadi. */
export function chunkText(text, size = 900, overlap = 150) {
  const clean = String(text).replace(/\r/g, '').trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const out = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      const brk = clean.lastIndexOf('\n', end);
      const dot = clean.lastIndexOf('. ', end);
      const cut = Math.max(brk, dot);
      if (cut > i + size * 0.5) end = cut + 1;
    }
    out.push(clean.slice(i, end).trim());
    if (end >= clean.length) break; // oxirgi bo'lak yozildi
    // Oldinga siljish kafolati: dumdagi qoldiq `overlap` dan qisqa bo'lsa,
    // `end - overlap` joriy `i` dan ortda qolib, sikl cheksiz aylanardi.
    const next = end - overlap;
    i = next > i ? next : end;
  }
  return out.filter(Boolean);
}

export function indexDocument({ userId, title, filename, mime, text, tags = [] }) {
  const id = uid('doc');
  const chunks = chunkText(text);
  db.prepare(`INSERT INTO documents (id, user_id, title, filename, mime, size, tags, status, chunk_count)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, userId, title, filename, mime, Buffer.byteLength(text), JSON.stringify(tags), 'indexed', chunks.length);

  const stmt = db.prepare('INSERT INTO chunks (id, doc_id, idx, text, vector) VALUES (?,?,?,?,?)');
  const tx = db.transaction(() => {
    chunks.forEach((c, i) => stmt.run(uid('chk'), id, i, c, JSON.stringify(embed(c))));
  });
  tx();
  return { id, chunk_count: chunks.length };
}

export function search(userId, query, topK = 5) {
  const q = embed(query);
  const rows = db.prepare(`
    SELECT c.id, c.doc_id, c.idx, c.text, c.vector, d.title, d.filename
    FROM chunks c JOIN documents d ON d.id = c.doc_id
    WHERE d.user_id = ?`).all(userId);

  return rows
    .map((r) => ({
      id: r.id,
      doc_id: r.doc_id,
      title: r.title,
      filename: r.filename,
      idx: r.idx,
      text: r.text,
      score: cosine(q, JSON.parse(r.vector)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((r) => r.score > 0.02);
}

export function buildContext(hits) {
  return hits
    .map((h, i) => `[${i + 1}] ${h.title} (bo'lak ${h.idx + 1}, o'xshashlik ${h.score.toFixed(3)})\n${h.text}`)
    .join('\n\n---\n\n');
}
