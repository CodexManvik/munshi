import type { DB } from './db.ts';

// What this shop's last 7 days would mean across N merchants. A projection of a synthetic
// demo week, labelled as such on screen; no real metrics are claimed.
export function getImpact(db: DB, merchantId: string, at: Date, merchants: number) {
  const from = new Date(at.getTime() - 7 * 86_400_000).toISOString();
  const to = at.toISOString();
  const ledger = (kind: string) => (db.prepare('SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE merchant_id=? AND kind=? AND ts >= ? AND ts <= ?')
    .get(merchantId, kind, from, to) as any).s as number;
  const one = (sql: string) => (db.prepare(sql).get(merchantId, from, to) as any).v as number;
  const week = {
    recovered: ledger('udhaar_recovered'),
    groupSavings: ledger('group_saving'),
    winbackSales: ledger('winback_sale'),
    loanGmv: one('SELECT COALESCE(SUM(principal),0) v FROM loans WHERE merchant_id=? AND ts >= ? AND ts <= ?'),
    offersDelivered: one('SELECT COALESCE(SUM(count),0) v FROM winback_campaigns WHERE merchant_id=? AND ts >= ? AND ts <= ?'),
    actions: one(`SELECT COUNT(*) v FROM actions a JOIN opportunities o ON o.id = a.opportunity_id WHERE o.merchant_id=? AND a.ts >= ? AND a.ts <= ?`),
  };
  const perMerchant = week.recovered + week.groupSavings + week.winbackSales;
  return {
    week,
    perMerchant,
    projected: {
      merchants,
      weeklyIncome: perMerchant * merchants,
      loanGmv: week.loanGmv * merchants,
      consumerReach: week.offersDelivered * merchants,
    },
  };
}
