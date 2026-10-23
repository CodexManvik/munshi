import type { DB } from './db.ts';

export type Opportunity = { type: string; key: string; estValue: number; payload: Record<string, any> };
export type Detector = (db: DB, merchantId: string, at: Date) => Opportunity[];

const DAY = 86_400_000;

export const udhaarOverdue: Detector = (db, merchantId, at) =>
  (db.prepare("SELECT id, customer_name, amount, given_on FROM khata WHERE merchant_id=? AND status='open'").all(merchantId) as any[])
    .map(k => ({ k, days: Math.floor((at.getTime() - new Date(k.given_on).getTime()) / DAY) }))
    .filter(({ days }) => days > 7)
    .map(({ k, days }) => ({
      type: 'udhaar_overdue',
      key: `khata:${k.id}`,
      estValue: k.amount,
      payload: { khataId: k.id, customerName: k.customer_name, amount: k.amount, days },
    }));

export const detectors: Detector[] = [udhaarOverdue];

export function refreshOpportunities(db: DB, merchantId: string, at: Date): void {
  const ins = db.prepare(
    "INSERT OR IGNORE INTO opportunities (merchant_id,type,key,payload,est_value,status,created_at) VALUES (?,?,?,?,?,'new',?)",
  );
  for (const detect of detectors) {
    for (const o of detect(db, merchantId, at)) ins.run(merchantId, o.type, o.key, JSON.stringify(o.payload), o.estValue, at.toISOString());
  }
}
