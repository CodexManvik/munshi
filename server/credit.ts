import type { DB } from './db.ts';
import type { Detector } from './detectors.ts';
import type { Executor } from './actions.ts';

const DAY = 86_400_000;
const TENURE = 90;
const rs = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function loanTerms(principal: number) {
  const cost = Math.round(principal * 0.0248);
  return { principal, cost, daily: Math.ceil((principal + cost) / TENURE), tenure: TENURE };
}

// A bill due within a week that the next few days of settlements will not cover.
export const cashGap: Detector = (db, merchantId, at) => {
  const bill = db.prepare("SELECT id, total, due_on FROM orders WHERE merchant_id=? AND status='due' AND due_on > ? AND due_on <= ? ORDER BY due_on LIMIT 1")
    .get(merchantId, at.toISOString(), new Date(at.getTime() + 7 * DAY).toISOString()) as any;
  if (!bill) return [];
  const recent = db.prepare('SELECT amount FROM settlements WHERE merchant_id=? ORDER BY date DESC LIMIT 14').all(merchantId) as any[];
  const perDay = recent.length ? recent.reduce((s, r) => s + r.amount, 0) / recent.length : 0;
  const dueDays = Math.ceil((new Date(bill.due_on).getTime() - at.getTime()) / DAY);
  const gap = Math.round(bill.total - perDay * dueDays);
  if (gap <= 0) return [];
  const terms = loanTerms(Math.ceil(gap / 10_000) * 10_000);
  return [{ type: 'cash_gap', key: `gap:${bill.id}`, estValue: gap, payload: { orderId: bill.id, due: bill.total, dueDays, gap, ...terms } }];
};

export const creditTemplate = (p: any) =>
  `${p.dueDays} din mein Diwali stock ka ${rs(p.due)} ka bill hai, paise ${rs(p.gap)} kam padenge. ${rs(p.principal)} ka loan le lein? Asli kharcha ${rs(p.cost)}, roz ${rs(p.daily)} settlement se katega.`;

export const acceptLoan: Executor = async (db, opp, actionId, _deps, at) => {
  const p = opp.payload;
  db.prepare("INSERT INTO loans (merchant_id,action_id,principal,total_cost,daily_deduction,tenure_days,status,ts) VALUES (?,?,?,?,?,?,'active',?)")
    .run(opp.merchantId, actionId, p.principal, p.cost, p.daily, p.tenure, at.toISOString());
  return { line: `${rs(p.principal)} aapke khaate mein aa gaye. Roz ${rs(p.daily)} settlement se katega.` };
};
