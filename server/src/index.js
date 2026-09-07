import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import knowledgeRoutes from './routes/knowledge.js';
import platformRoutes from './routes/platform.js';
import { activeProvider } from './services/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
// CLIENT_ORIGIN vergul bilan bir nechta manzilni qabul qiladi (prod + Vercel preview).
// Bo'sh bo'lsa — lokal ishlab chiqish uchun hamma origin ochiq.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length
      ? (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin))
      : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 40, standardHeaders: true, legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 15 * 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: '4.2.0',
    uptime_s: Math.round(process.uptime()),
    ai: activeProvider(),
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/kb', knowledgeRoutes);
app.use('/api', platformRoutes);

// Ishlab chiqarish: client build'ini shu serverdan tarqatish
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Ichki server xatosi' });
});

app.listen(PORT, () => {
  const ai = activeProvider();
  console.log(`\n  NexusAI server → http://localhost:${PORT}`);
  console.log(`  AI provayder   → ${ai.provider} (${ai.model})`);
  if (ai.provider === 'demo') console.log('  ⚠  Kalit topilmadi — demo rejim. server/.env faylini to\u2018ldiring.\n');
  else console.log('');
});
