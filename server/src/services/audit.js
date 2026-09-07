import crypto from 'node:crypto';
import { db, uid } from '../db.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Har bir yozuv oldingi yozuv hash'i bilan bog'lanadi (hash-chain).
 * Bitta qator o'zgartirilsa, undan keyingi barcha hash'lar buziladi.
 */
export function writeAudit({ actor = 'system', action, resource = '', ip = '', severity = 'info', status = 'success', meta = {} }) {
  const last = db.prepare('SELECT seq, hash FROM audit_logs ORDER BY seq DESC LIMIT 1').get();
  const seq = (last?.seq ?? 0) + 1;
  const prev_hash = last?.hash ?? 'GENESIS';
  const ts = new Date().toISOString();
  const payload = JSON.stringify({ seq, ts, actor, action, resource, ip, severity, status, meta });
  const hash = sha256(prev_hash + payload);

  db.prepare(`INSERT INTO audit_logs (id, seq, ts, actor, action, resource, ip, severity, status, meta, prev_hash, hash)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uid('aud'), seq, ts, actor, action, resource, ip, severity, status, JSON.stringify(meta), prev_hash, hash);

  return { seq, hash };
}

/** Butun zanjirni qayta hisoblab, buzilgan qatorni topadi. */
export function verifyChain() {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY seq ASC').all();
  let prev = 'GENESIS';
  for (const r of rows) {
    const payload = JSON.stringify({
      seq: r.seq, ts: r.ts, actor: r.actor, action: r.action, resource: r.resource,
      ip: r.ip, severity: r.severity, status: r.status, meta: JSON.parse(r.meta || '{}'),
    });
    const expected = sha256(prev + payload);
    if (r.prev_hash !== prev || r.hash !== expected) {
      return { valid: false, brokenAt: r.seq, total: rows.length };
    }
    prev = r.hash;
  }
  return { valid: true, brokenAt: null, total: rows.length, head: prev };
}

/** Merkle root — jurnalning yaxlit "barmoq izi". */
export function merkleRoot() {
  let level = db.prepare('SELECT hash FROM audit_logs ORDER BY seq ASC').all().map((r) => r.hash);
  if (!level.length) return sha256('EMPTY');
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256(level[i] + (level[i + 1] ?? level[i])));
    }
    level = next;
  }
  return level[0];
}
