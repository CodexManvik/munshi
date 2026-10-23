import type { DB } from './db.ts';

export type LedgerItem = { kind: string; amount: number; label: string; ts: string; tool: string };

export type LoanSummary = { principal: number; totalCost: number; dailyDeduction: number; tenureDays: number };

// Loans are shown beside the ledger, never inside its total: borrowed money is not earned money.
export function getLedger(db: DB, merchantId: string, at: Date, days = 7): { total: number; items: LedgerItem[]; loan: LoanSummary | null } {
  const l = db.prepare("SELECT principal, total_cost, daily_deduction, tenure_days FROM loans WHERE merchant_id=? AND status='active' ORDER BY id DESC LIMIT 1").get(merchantId) as any;
  const loan = l ? { principal: l.principal, totalCost: l.total_cost, dailyDeduction: l.daily_deduction, tenureDays: l.tenure_days } : null;
  const from = new Date(at.getTime() - days * 86_400_000).toISOString();
  const items = (db.prepare(
    `SELECT l.kind, l.amount, l.label, l.ts, COALESCE(a.tool, '') AS tool FROM ledger l LEFT JOIN actions a ON a.id = l.action_id
     WHERE l.merchant_id = ? AND l.ts >= ? AND l.ts <= ? ORDER BY l.ts DESC, l.id DESC`,
  ).all(merchantId, from, at.toISOString()) as any[]).map(r => ({ kind: r.kind, amount: r.amount, label: r.label, ts: r.ts, tool: r.tool }));
  return { total: items.reduce((s, i) => s + i.amount, 0), items, loan };
}
