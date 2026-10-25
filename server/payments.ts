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

export function payLink(db: DB, ref: string, at: Date): { alreadyPaid: boolean; announcement: string; name: string; amount: number } | null {
  const r = db.prepare(LINK_SQL).get(ref) as any;
  if (!r) return null;
  const announcement = `${r.customer_name} ne ₹${r.amount} chuka diye`;
  const ts = at.toISOString();
  db.exec('BEGIN');
  try {
    const flipped = db.prepare("UPDATE pay_links SET status='paid', paid_at=? WHERE ref=? AND status='pending'").run(ts, ref);
    if (flipped.changes === 0) { db.exec('COMMIT'); return { alreadyPaid: true, announcement, name: r.customer_name, amount: r.amount }; }
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
  return { alreadyPaid: false, announcement, name: r.customer_name, amount: r.amount };
}

export function recordWalkin(db: DB, merchantId: string, amount: number, at: Date): string {
  return recordCustomerPayment(db, merchantId, amount, hashPayer(randomUUID()), at)[0];
}

// A counter payment and the rules that ride on it. Announcements never name the payer.
export function recordCustomerPayment(db: DB, merchantId: string, amount: number, payerHash: string, at: Date): string[] {
  const ts = at.toISOString();
  const said = [`₹${amount} prapt hue`];
  db.prepare("INSERT INTO payments (merchant_id,amount,ts,payer_hash,counterparty) VALUES (?,?,?,?,'customer')").run(merchantId, amount, ts, payerHash);

  const rule = db.prepare('SELECT visits_required, reward_amount FROM loyalty_rules WHERE merchant_id=?').get(merchantId) as any;
  if (rule) {
    const visits = (db.prepare("SELECT COUNT(*) n FROM payments WHERE merchant_id=? AND payer_hash=? AND counterparty='customer'").get(merchantId, payerHash) as any).n;
    if (visits % rule.visits_required === 0) said.push(`Dhanyavaad! Yeh grahak ki ${visits}vi khareed hai, agli baar ₹${rule.reward_amount} off.`);
  }

  const target = db.prepare(
    `SELECT t.rowid, c.offer, c.action_id FROM winback_targets t JOIN winback_campaigns c ON c.id = t.campaign_id
     WHERE c.merchant_id=? AND t.payer_hash=? AND t.returned_at IS NULL LIMIT 1`,
  ).get(merchantId, payerHash) as any;
  if (target) {
    db.prepare('UPDATE winback_targets SET returned_at=? WHERE rowid=?').run(ts, target.rowid);
    db.prepare("INSERT INTO ledger (merchant_id,action_id,kind,amount,label,ts) VALUES (?,?,'winback_sale',?,?,?)")
      .run(merchantId, target.action_id, amount, `Purana grahak lauta (₹${target.offer} offer)`, ts);
    said.push(`Ek purana grahak ₹${target.offer} offer se lauta! ₹${amount} ki khareed.`);
  }
  return said;
}
