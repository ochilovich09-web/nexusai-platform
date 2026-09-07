import { Router } from 'express';
import multer from 'multer';
import { db, json } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { indexDocument, search } from '../services/rag.js';
import { writeAudit } from '../services/audit.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
r.use(requireAuth);

r.get('/documents', (req, res) => {
  const rows = db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({
    documents: rows.map((d) => ({ ...d, tags: json(d.tags, []) })),
    stats: {
      documents: rows.length,
      chunks: rows.reduce((s, d) => s + d.chunk_count, 0),
      bytes: rows.reduce((s, d) => s + d.size, 0),
    },
  });
});

// Fayl yuklash (matnli formatlar: txt, md, json, csv, log, kod fayllari)
r.post('/documents', upload.single('file'), (req, res) => {
  try {
    let text = req.body?.text || '';
    let title = req.body?.title || '';
    let filename = '';
    let mime = 'text/plain';

    if (req.file) {
      filename = req.file.originalname;
      mime = req.file.mimetype;
      title = title || filename;
      if (/^(text\/|application\/(json|xml|javascript|x-yaml))/.test(mime) || /\.(txt|md|json|csv|log|ya?ml|js|ts|py|go|rs|java|sql|html|css)$/i.test(filename)) {
        text = req.file.buffer.toString('utf-8');
      } else {
        return res.status(415).json({ error: 'Hozircha faqat matnli fayllar indekslanadi (txt, md, json, csv, log, kod)' });
      }
    }
    if (!text.trim()) return res.status(400).json({ error: 'Hujjat matni bo\u2018sh' });

    const tags = json(req.body?.tags || '[]', []);
    const out = indexDocument({ userId: req.user.id, title: title || 'Nomsiz hujjat', filename, mime, text, tags });
    writeAudit({ actor: req.user.email, action: 'kb.document_indexed', resource: out.id, ip: req.ip, meta: { chunks: out.chunk_count } });
    res.json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(out.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

r.delete('/documents/:id', (req, res) => {
  db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  writeAudit({ actor: req.user.email, action: 'kb.document_deleted', resource: req.params.id, ip: req.ip, severity: 'medium' });
  res.json({ ok: true });
});

// Semantik qidiruv testeri
r.post('/search', (req, res) => {
  const { query, topK = 5 } = req.body || {};
  if (!query?.trim()) return res.status(400).json({ error: 'So\u2018rov bo\u2018sh' });
  const started = Date.now();
  const hits = search(req.user.id, query, topK);
  res.json({ hits, latency_ms: Date.now() - started });
});

export default r;
