/**
 * Vaqtinchalik diagnostika. Sirlarni OSHKOR QILMAYDI — faqat mavjudligini
 * va uzunligini ko'rsatadi. Muammo aniqlangach bu fayl o'chiriladi.
 */
export default async function handler(req, res) {
  const out = { node: process.version, vercel: Boolean(process.env.VERCEL), env: {}, libsql: null, db: null };

  for (const k of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'GEMINI_API_KEY', 'JWT_SECRET']) {
    const v = process.env[k];
    out.env[k] = v ? { set: true, length: v.length, starts: v.slice(0, 12) } : { set: false };
  }

  try {
    const mod = await import('libsql');
    out.libsql = { loaded: true, hasDefault: typeof mod.default === 'function' };
  } catch (e) {
    out.libsql = { loaded: false, error: String(e && e.message).slice(0, 300) };
  }

  if (out.libsql?.loaded && process.env.TURSO_DATABASE_URL) {
    try {
      const { default: Database } = await import('libsql');
      const db = new Database(process.env.TURSO_DATABASE_URL, { authToken: process.env.TURSO_AUTH_TOKEN });
      out.db = { ok: true, users: db.prepare('SELECT COUNT(*) c FROM users').get().c };
    } catch (e) {
      out.db = { ok: false, error: String(e && e.message).slice(0, 300) };
    }
  }

  res.status(200).json(out);
}
