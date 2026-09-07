import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, uid } from '../db.js';
import { signToken, requireAuth, publicUser } from '../middleware/auth.js';
import { writeAudit } from '../services/audit.js';

const r = Router();
// 2FA kodlari bazada saqlanadi: serverless muhitda login va tasdiqlash
// so'rovlari turli instansiyalarga tushishi mumkin, xotiradagi Map ishlamaydi.
const pending2fa = {
  set(userId, entry) {
    db.prepare('INSERT OR REPLACE INTO pending_2fa (user_id, code, expires) VALUES (?,?,?)')
      .run(userId, entry.code, entry.expires);
  },
  get(userId) {
    return db.prepare('SELECT code, expires FROM pending_2fa WHERE user_id = ?').get(userId);
  },
  delete(userId) {
    db.prepare('DELETE FROM pending_2fa WHERE user_id = ?').run(userId);
  },
};
const resetTokens = new Map();  // token  -> { userId, expires }

const strongEnough = (p) =>
  p.length >= 12 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

r.post('/register', (req, res) => {
  const { email, name, password, department = '' } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: 'email, name va password majburiy' });
  if (!strongEnough(password)) {
    return res.status(400).json({ error: 'Parol kamida 12 belgi, katta harf, kichik harf, raqam va maxsus belgi bo‘lishi kerak' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Bu email allaqachon ro‘yxatdan o‘tgan' });
  }

  const id = uid('usr');
  const first = db.prepare('SELECT COUNT(*) c FROM users').get().c === 0;
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, department)
              VALUES (?,?,?,?,?,?)`)
    .run(id, email, name, bcrypt.hashSync(password, 10), first ? 'super_admin' : 'member', department);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  writeAudit({ actor: email, action: 'user.register', resource: id, ip: req.ip, severity: 'info' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    writeAudit({ actor: email || 'noma’lum', action: 'auth.login_failed', ip: req.ip, severity: 'medium', status: 'failed' });
    return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
  }

  if (user.twofa_enabled) {
    const code = String(crypto.randomInt(100000, 999999));
    pending2fa.set(user.id, { code, expires: Date.now() + 5 * 60_000 });
    writeAudit({ actor: user.email, action: 'auth.2fa_challenge', ip: req.ip, severity: 'info' });
    // Ishlab chiqarishda bu kod SMS/email/TOTP orqali yuboriladi.
    return res.json({ twofa_required: true, user_id: user.id, dev_code: code, method: user.twofa_method });
  }

  writeAudit({ actor: user.email, action: 'auth.login', ip: req.ip, severity: 'info' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/2fa/verify', (req, res) => {
  const { user_id, code } = req.body || {};
  const entry = pending2fa.get(user_id);
  if (!entry || entry.expires < Date.now()) return res.status(400).json({ error: 'Kod muddati tugagan, qaytadan kiring' });
  if (entry.code !== String(code)) {
    writeAudit({ actor: user_id, action: 'auth.2fa_failed', ip: req.ip, severity: 'high', status: 'failed' });
    return res.status(401).json({ error: 'Tasdiqlash kodi noto‘g‘ri' });
  }
  pending2fa.delete(user_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  writeAudit({ actor: user.email, action: 'auth.2fa_success', ip: req.ip, severity: 'info' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/forgot', (req, res) => {
  const { email } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  // Email mavjudligini oshkor qilmaymiz.
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    resetTokens.set(token, { userId: user.id, expires: Date.now() + 30 * 60_000 });
    writeAudit({ actor: user.email, action: 'auth.reset_requested', ip: req.ip, severity: 'medium' });
    return res.json({ ok: true, dev_token: token });
  }
  res.json({ ok: true });
});

r.post('/reset', (req, res) => {
  const { token, password } = req.body || {};
  const entry = resetTokens.get(token);
  if (!entry || entry.expires < Date.now()) return res.status(400).json({ error: 'Havola yaroqsiz yoki muddati tugagan' });
  if (!strongEnough(password || '')) return res.status(400).json({ error: 'Parol talablarga javob bermaydi' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), entry.userId);
  resetTokens.delete(token);
  writeAudit({ actor: entry.userId, action: 'auth.password_reset', ip: req.ip, severity: 'high' });
  res.json({ ok: true });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

r.patch('/me', requireAuth, (req, res) => {
  const { name, department, settings } = req.body || {};
  db.prepare('UPDATE users SET name = COALESCE(?, name), department = COALESCE(?, department), settings = COALESCE(?, settings) WHERE id = ?')
    .run(name ?? null, department ?? null, settings ? JSON.stringify(settings) : null, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

r.post('/me/2fa', requireAuth, (req, res) => {
  const { enabled, method = 'totp' } = req.body || {};
  db.prepare('UPDATE users SET twofa_enabled = ?, twofa_method = ? WHERE id = ?')
    .run(enabled ? 1 : 0, enabled ? method : 'none', req.user.id);
  writeAudit({ actor: req.user.email, action: enabled ? 'auth.2fa_enabled' : 'auth.2fa_disabled', ip: req.ip, severity: 'high' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

r.post('/me/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!bcrypt.compareSync(current || '', req.user.password_hash)) {
    return res.status(401).json({ error: 'Joriy parol noto‘g‘ri' });
  }
  if (!strongEnough(next || '')) return res.status(400).json({ error: 'Yangi parol talablarga javob bermaydi' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  writeAudit({ actor: req.user.email, action: 'auth.password_changed', ip: req.ip, severity: 'high' });
  res.json({ ok: true });
});

export default r;
