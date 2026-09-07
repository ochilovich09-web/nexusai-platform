import { Router } from 'express';
import { db, uid, json } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { streamChat, splitReasoning, activeProvider } from '../services/ai.js';
import { search, buildContext } from '../services/rag.js';
import { writeAudit } from '../services/audit.js';

const r = Router();
r.use(requireAuth);

const mapMsg = (m) => ({
  ...m,
  attachments: json(m.attachments, []),
  sources: json(m.sources, []),
});

r.get('/provider', (_req, res) => res.json(activeProvider()));

r.get('/conversations', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c WHERE c.user_id = ?
    ORDER BY c.pinned DESC, c.updated_at DESC`).all(req.user.id);
  res.json({ conversations: rows });
});

r.post('/conversations', (req, res) => {
  const id = uid('cnv');
  db.prepare('INSERT INTO conversations (id, user_id, title, model) VALUES (?,?,?,?)')
    .run(id, req.user.id, req.body?.title || 'Yangi muloqot', req.body?.model || 'nexus-v4-core');
  res.json({ conversation: db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) });
});

r.get('/conversations/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Muloqot topilmadi' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC').all(conv.id);
  res.json({ conversation: conv, messages: messages.map(mapMsg) });
});

r.patch('/conversations/:id', (req, res) => {
  const { title, pinned } = req.body || {};
  db.prepare(`UPDATE conversations SET title = COALESCE(?, title), pinned = COALESCE(?, pinned),
              updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(title ?? null, pinned === undefined ? null : pinned ? 1 : 0, req.params.id, req.user.id);
  res.json({ ok: true });
});

r.delete('/conversations/:id', (req, res) => {
  db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  writeAudit({ actor: req.user.email, action: 'chat.conversation_deleted', resource: req.params.id, ip: req.ip, severity: 'medium' });
  res.json({ ok: true });
});

/**
 * Oqimli javob. SSE hodisalari:
 *   meta   — foydalanuvchi xabari id'si, model, RAG manbalari
 *   delta  — matn bo'lagi
 *   done   — yakuniy xabar (reasoning ajratilgan, tokenlar, kechikish)
 *   error  — xato matni
 */
r.post('/conversations/:id/stream', async (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Muloqot topilmadi' });

  const { content, attachments = [], reasoning = true, useRag = true, temperature = 0.6 } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: 'Xabar bo‘sh' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const userMsgId = uid('msg');
  db.prepare('INSERT INTO messages (id, conversation_id, role, content, attachments) VALUES (?,?,?,?,?)')
    .run(userMsgId, conv.id, 'user', content, JSON.stringify(attachments));

  if (db.prepare('SELECT COUNT(*) c FROM messages WHERE conversation_id = ?').get(conv.id).c === 1) {
    const title = content.trim().replace(/\s+/g, ' ').slice(0, 48) + (content.length > 48 ? '…' : '');
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conv.id);
  }

  let hits = [];
  if (useRag) {
    try { hits = search(req.user.id, content, 4); } catch { hits = []; }
  }
  const ragContext = hits.length ? buildContext(hits) : '';
  const sources = hits.map((h) => ({ doc_id: h.doc_id, title: h.title, chunk: h.idx + 1, score: +h.score.toFixed(3) }));

  const { model, provider } = activeProvider();
  send('meta', { user_message_id: userMsgId, model, provider, sources });

  const history = db.prepare(`SELECT role, content FROM messages WHERE conversation_id = ?
                              ORDER BY created_at ASC, rowid ASC`).all(conv.id)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-20);

  const started = Date.now();
  let full = '';
  let usage = { in: 0, out: 0 };
  let failed = null;

  try {
    for await (const chunk of streamChat({
      messages: history,
      reasoning,
      ragContext,
      persona: json(req.user.settings, {}).persona || '',
      temperature,
    })) {
      if (chunk.text) { full += chunk.text; send('delta', { text: chunk.text }); }
      if (chunk.usage) usage = { in: chunk.usage.in ?? usage.in, out: chunk.usage.out ?? usage.out };
      if (chunk.error) failed = chunk.error;
    }
  } catch (err) {
    failed = err.message;
    send('error', { error: err.message });
  }

  const latency = Date.now() - started;
  const { reasoning: trace, answer } = splitReasoning(full);
  const id = uid('msg');

  db.prepare(`INSERT INTO messages (id, conversation_id, role, content, reasoning, model, tokens_in, tokens_out, latency_ms, sources)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, conv.id, 'assistant', answer, trace, model, usage.in, usage.out, latency, JSON.stringify(sources));
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);

  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare('SELECT id FROM metrics WHERE day = ?').get(today);
  if (row) {
    db.prepare('UPDATE metrics SET requests = requests + 1, tokens = tokens + ?, errors = errors + ? WHERE id = ?')
      .run(usage.in + usage.out, failed ? 1 : 0, row.id);
  } else {
    db.prepare('INSERT INTO metrics (day, dau, requests, tokens, errors) VALUES (?,?,?,?,?)')
      .run(today, 1, 1, usage.in + usage.out, failed ? 1 : 0);
  }

  writeAudit({
    actor: req.user.email, action: 'ai.completion', resource: conv.id, ip: req.ip,
    severity: failed ? 'medium' : 'info', status: failed ? 'failed' : 'success',
    meta: { model, provider, latency, tokens: usage.in + usage.out, rag_hits: hits.length },
  });

  send('done', {
    message: { id, role: 'assistant', content: answer, reasoning: trace, model, tokens_in: usage.in, tokens_out: usage.out, latency_ms: latency, sources },
  });
  res.end();
});

export default r;
