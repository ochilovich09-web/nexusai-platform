import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret(), { expiresIn: '12h' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token talab qilinadi' });

  try {
    const payload = jwt.verify(token, secret());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Hisob to‘xtatilgan' });
    req.user = user;
    db.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").run(user.id);
    next();
  } catch {
    res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Bu amal uchun ruxsat yetarli emas' });
  }
  next();
};

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  department: u.department,
  twofa_enabled: !!u.twofa_enabled,
  twofa_method: u.twofa_method,
  status: u.status,
  created_at: u.created_at,
  last_active: u.last_active,
  settings: JSON.parse(u.settings || '{}'),
});
