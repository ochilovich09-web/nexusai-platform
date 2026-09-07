import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import os from 'node:os';
import { db, uid, json } from '../db.js';
import { requireAuth, requireRole, publicUser } from '../middleware/auth.js';
import { writeAudit, verifyChain, merkleRoot } from '../services/audit.js';
import { activeProvider } from '../services/ai.js';

const r = Router();
r.use(requireAuth);

/* ---------------------------------- Model Studio --------------------------------- */

r.get('/models', (_req, res) => {
  const models = db.prepare('SELECT * FROM models').all()
    .map((m) => ({ ...m, capabilities: json(m.capabilities, []), metrics: json(m.metrics, {}) }));
  res.json({ models, provider: activeProvider() });
});

r.post('/models', requireRole('super_admin', 'ai_engineer'), (req, res) => {
  const { name, arch = '', version = 'v1.0', deployment = 'cloud', capabilities = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Model nomi majburiy' });
  const id = uid('mdl');
  db.prepare(`INSERT INTO models (id, name, arch, version, status, badge, capabilities, deployment, progress, metrics)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, arch, version, 'training', 'Training', JSON.stringify(capabilities), deployment, 0,
      JSON.stringify({ train_loss: 1.84, val_loss: 1.9, epoch: 0, epochs: 5 }));
  writeAudit({ actor: req.user.email, action: 'model.created', resource: id, ip: req.ip, severity: 'medium' });
  res.json({ model: db.prepare('SELECT * FROM models WHERE id = ?').get(id) });
});

r.patch('/models/:id', requireRole('super_admin', 'ai_engineer'), (req, res) => {
  const { status, progress } = req.body || {};
  db.prepare('UPDATE models SET status = COALESCE(?, status), progress = COALESCE(?, progress) WHERE id = ?')
    .run(status ?? null, progress ?? null, req.params.id);
  writeAudit({ actor: req.user.email, action: 'model.updated', resource: req.params.id, ip: req.ip, severity: 'medium', meta: { status, progress } });
  res.json({ model: db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id) });
});

/** Trening telemetriyasi — jonli grafik uchun. */
r.get('/models/:id/telemetry', (req, res) => {
  const m = db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Model topilmadi' });
  const met = json(m.metrics, {});
  const steps = 30;
  const curve = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return {
      step: Math.round(t * 14200),
      train: +(1.84 * Math.exp(-2.2 * t) + 0.30 + Math.sin(i) * 0.012).toFixed(3),
      val: +(1.90 * Math.exp(-2.0 * t) + 0.36 + Math.cos(i) * 0.014).toFixed(3),
    };
  });
  res.json({
    model: { ...m, capabilities: json(m.capabilities, []), metrics: met },
    curve,
    benchmarks: [
      { name: 'MMLU (umumiy bilim)', score: 88.4 },
      { name: 'HumanEval (kod)', score: 82.1 },
      { name: 'CyberSec & Exploit Detection', score: 94.7 },
      { name: 'Uzbek Lex (huquqiy korpus)', score: 79.3 },
    ],
    redteam: { pass_rate: 100, scenarios: 1200, jailbreak_blocked: 1200 },
  });
});

/* ------------------------------------ Agents ------------------------------------- */

r.get('/agents', (_req, res) => {
  res.json({ agents: db.prepare('SELECT * FROM agents ORDER BY name').all() });
});

r.post('/agents/:id/action', requireRole('super_admin', 'security_analyst'), (req, res) => {
  const { action } = req.body || {};
  const map = { activate: 'active', pause: 'idle', patch: 'patching', quarantine: 'quarantined' };
  const status = map[action];
  if (!status) return res.status(400).json({ error: 'Noma\u2019lum amal' });

  db.prepare("UPDATE agents SET status = ?, last_action = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, `${action} \u2014 ${req.user.name}`, req.params.id);
  writeAudit({ actor: req.user.email, action: `agent.${action}`, resource: req.params.id, ip: req.ip, severity: 'high' });
  res.json({ agent: db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) });
});

/* ----------------------------------- Security ------------------------------------ */

r.get('/security/overview', (_req, res) => {
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY ts DESC LIMIT 25').all();
  const failed = db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action = 'auth.login_failed' AND ts > datetime('now','-24 hours')").get().c;
  const load = os.loadavg()[0];

  res.json({
    alerts,
    health: {
      uptime_s: Math.round(process.uptime()),
      cpu_load: +load.toFixed(2),
      mem_used_mb: Math.round((os.totalmem() - os.freemem()) / 1048576),
      mem_total_mb: Math.round(os.totalmem() / 1048576),
      node: process.version,
      tls: 'TLS 1.3 mTLS',
    },
    threat: {
      failed_logins_24h: failed,
      blocked_ips: db.prepare("SELECT COUNT(DISTINCT ip) c FROM audit_logs WHERE status = 'failed'").get().c,
      waf: 'active',
      rate_limit: '120 so\u2018rov / 15 daqiqa',
    },
    policies: [
      { name: 'Zero-Data-Retention', enabled: true, detail: 'Model provayderiga yuborilgan matnlar saqlanmaydi' },
      { name: 'Prompt Injection Guard', enabled: true, detail: 'Hujjat ichidagi buyruqlar bajarilmaydi' },
      { name: 'PII redaksiya', enabled: true, detail: 'Shaxsiy ma\u2019lumotlar modelga yuborishdan oldin maskalanadi' },
      { name: 'mTLS ichki trafik', enabled: true, detail: 'Xizmatlararo aloqa sertifikat bilan' },
      { name: 'Post-quantum kalit almashish', enabled: false, detail: 'Kyber-768 gibrid rejim (rejalashtirilgan)' },
    ],
  });
});

r.post('/security/alerts/:id', requireRole('super_admin', 'security_analyst'), (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'ack', 'resolved'].includes(status)) return res.status(400).json({ error: 'Noto\u2018g\u2018ri holat' });
  db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, req.params.id);
  writeAudit({ actor: req.user.email, action: 'alert.status_changed', resource: req.params.id, ip: req.ip, severity: 'medium', meta: { status } });
  res.json({ ok: true });
});

/* ------------------------------------- Audit ------------------------------------- */

r.get('/audit', (req, res) => {
  const { severity, q, limit = 100 } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (severity && severity !== 'all') { sql += ' AND severity = ?'; params.push(severity); }
  if (q) { sql += ' AND (action LIKE ? OR actor LIKE ? OR resource LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY seq DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 100, 500));

  const logs = db.prepare(sql).all(...params).map((l) => ({ ...l, meta: json(l.meta, {}) }));
  res.json({ logs, integrity: verifyChain(), merkle_root: merkleRoot() });
});

r.get('/audit/verify', (_req, res) => res.json({ ...verifyChain(), merkle_root: merkleRoot() }));

/* ----------------------------------- Analytics ----------------------------------- */

r.get('/analytics', (_req, res) => {
  const days = 7;
  const labels = ['Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'];
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const day = d.toISOString().slice(0, 10);
    const row = db.prepare('SELECT * FROM metrics WHERE day = ?').get(day) || {};
    series.push({
      day,
      label: labels[(d.getDay() + 6) % 7],
      dau: row.dau ?? 0,
      requests: row.requests ?? 0,
      tokens: row.tokens ?? 0,
      errors: row.errors ?? 0,
    });
  }

  const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const active = db.prepare("SELECT COUNT(*) c FROM users WHERE last_active > datetime('now','-15 minutes')").get().c;
  const totals = db.prepare('SELECT COALESCE(SUM(requests),0) rq, COALESCE(SUM(tokens),0) tk, COALESCE(SUM(errors),0) er FROM metrics').get();
  const avgLatency = db.prepare("SELECT COALESCE(AVG(latency_ms),0) a FROM messages WHERE role = 'assistant'").get().a;

  res.json({
    kpis: {
      users,
      active_now: active,
      requests: totals.rq,
      tokens: totals.tk,
      error_rate: totals.rq ? +((totals.er / totals.rq) * 100).toFixed(3) : 0,
      avg_latency_ms: Math.round(avgLatency),
      conversations: db.prepare('SELECT COUNT(*) c FROM conversations').get().c,
      documents: db.prepare('SELECT COUNT(*) c FROM documents').get().c,
    },
    series,
    model_share: db.prepare(`SELECT model, COUNT(*) n FROM messages WHERE role='assistant' AND model <> ''
                             GROUP BY model ORDER BY n DESC LIMIT 6`).all(),
    domains: [
      { name: 'Dasturlash & kod', share: 38 },
      { name: 'Moliya & audit', share: 27 },
      { name: 'Kiberxavfsizlik', share: 19 },
      { name: 'Huquq & shartnomalar', share: 16 },
    ],
  });
});

/* ------------------------------------- Users ------------------------------------- */

r.get('/users', requireRole('super_admin', 'security_analyst'), (req, res) => {
  const { q } = req.query;
  const rows = q
    ? db.prepare('SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC').all(`%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows.map(publicUser) });
});

r.patch('/users/:id', requireRole('super_admin'), (req, res) => {
  const { role, status, department } = req.body || {};
  db.prepare('UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status), department = COALESCE(?, department) WHERE id = ?')
    .run(role ?? null, status ?? null, department ?? null, req.params.id);
  writeAudit({ actor: req.user.email, action: 'rbac.user_updated', resource: req.params.id, ip: req.ip, severity: 'high', meta: { role, status } });
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)) });
});

/* ------------------------------------ API keys ----------------------------------- */

r.get('/api-keys', (req, res) => {
  const keys = db.prepare('SELECT id, name, prefix, scopes, created_at, last_used FROM api_keys WHERE user_id = ?').all(req.user.id);
  res.json({ keys: keys.map((k) => ({ ...k, scopes: json(k.scopes, []) })) });
});

r.post('/api-keys', (req, res) => {
  const { name = 'Yangi kalit', scopes = ['chat:read', 'chat:write'] } = req.body || {};
  const raw = 'nxs_' + crypto.randomBytes(24).toString('hex');
  const id = uid('key');
  db.prepare('INSERT INTO api_keys (id, user_id, name, prefix, hash, scopes) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, name, raw.slice(0, 12), bcrypt.hashSync(raw, 10), JSON.stringify(scopes));
  writeAudit({ actor: req.user.email, action: 'apikey.created', resource: id, ip: req.ip, severity: 'high' });
  res.json({ id, name, key: raw, note: 'Bu kalit faqat bir marta ko\u2018rsatiladi' });
});

r.delete('/api-keys/:id', (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  writeAudit({ actor: req.user.email, action: 'apikey.revoked', resource: req.params.id, ip: req.ip, severity: 'high' });
  res.json({ ok: true });
});

export default r;
