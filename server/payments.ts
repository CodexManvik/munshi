import { randomUUID } from 'node:crypto';
import type { DB } from './db.ts';
import { hashPayer } from './seed.ts';

const LINK_SQL = `SELECT p.ref, p.amount, p.status, p.action_id, p.merchant_id, m.name AS merchant_name, k.id AS khata_id, k.customer_name, k.phone
  FROM pay_links p JOIN merchants m ON m.id = p.merchant_id JOIN khata k ON k.id = p.khata_id WHERE p.ref = ?`;

export function getPayLink(db: DB, ref: string) {
  const r = db.prepare(LINK_SQL).get(ref) as any;
  if (!r) return null;
  return { ref: r.ref as string, merchantName: r.merchant_name as string, customerName: r.customer_name as string, amount: r.amount as number, status: r.status as 'pending' | 'paid' };
}

export function payLink(db: DB, ref: string, at: Date): { alreadyPaid: boolean; announcement: string } | null {
  const r = db.prepare(LINK_SQL).get(ref) as any;
  if (!r) return null;
  const announcement = `${r.customer_name} ne ₹${r.amount} chuka diye`;
  const ts = at.toISOString();
  db.exec('BEGIN');
  try {
    const flipped = db.prepare("UPDATE pay_links SET status='paid', paid_at=? WHERE ref=? AND status='pending'").run(ts, ref);
    if (flipped.changes === 0) { db.exec('COMMIT'); return { alreadyPaid: true, announcement }; }
    db.prepare("INSERT INTO payments (merchant_id,amount,ts,payer_hash,counterparty) VALUES (?,?,?,?,'customer')")
      .run(r.merchant_id, r.amount, ts, hashPayer(r.phone));
    db.prepare("UPDATE khata SET status='paid' WHERE id=?").run(r.khata_id);
    db.prepare("INSERT INTO ledger (merchant_id,action_id,kind,amount,label,ts) VALUES (?,?,'udhaar_recovered',?,?,?)")
      .run(r.merchant_id, r.action_id, r.amount, `${r.customer_name} ka udhaar wapas`, ts);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { alreadyPaid: false, announcement };
}

export function recordWalkin(db: DB, merchantId: string, amount: number, at: Date): string {
  db.prepare("INSERT INTO payments (merchant_id,amount,ts,payer_hash,counterparty) VALUES (?,?,?,?,'customer')")
    .run(merchantId, amount, at.toISOString(), hashPayer(randomUUID()));
  return `₹${amount} prapt hue`;
}
