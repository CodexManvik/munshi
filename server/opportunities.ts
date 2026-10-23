import type { DB } from './db.ts';
import { refreshOpportunities } from './detectors.ts';
import { executors, type ActionResult, type Deps } from './actions.ts';

export type OppRow = {
  id: number; merchantId: string; type: string; key: string; payload: any; estValue: number; status: string;
};

const toOpp = (r: any): OppRow | null => r ? {
  id: r.id, merchantId: r.merchant_id, type: r.type, key: r.key,
  payload: JSON.parse(r.payload), estValue: r.est_value, status: r.status,
} : null;

export const getOpportunity = (db: DB, id: number): OppRow | null =>
  toOpp(db.prepare('SELECT * FROM opportunities WHERE id=?').get(id));

export const getProposed = (db: DB, merchantId: string): OppRow | null =>
  toOpp(db.prepare("SELECT * FROM opportunities WHERE merchant_id=? AND status='proposed'").get(merchantId));

export function proposeOpportunity(db: DB, merchantId: string, oppId: number): OppRow {
  db.prepare("UPDATE opportunities SET status='new' WHERE merchant_id=? AND status='proposed' AND id != ?").run(merchantId, oppId);
  db.prepare("UPDATE opportunities SET status='proposed' WHERE id=?").run(oppId);
  return getOpportunity(db, oppId)!;
}

export function nextOpportunity(db: DB, merchantId: string, at: Date): OppRow | null {
  refreshOpportunities(db, merchantId, at);
  const current = getProposed(db, merchantId);
  if (current) return current;
  const best = db.prepare(
    "SELECT id FROM opportunities WHERE merchant_id=? AND status='new' ORDER BY est_value DESC, id LIMIT 1",
  ).get(merchantId) as any;
  return best ? proposeOpportunity(db, merchantId, best.id) : null;
}

export class NotProposedError extends Error {}

export function declineOpportunity(db: DB, oppId: number): void {
  const r = db.prepare("UPDATE opportunities SET status='declined' WHERE id=? AND status='proposed'").run(oppId);
  if (r.changes === 0) throw new NotProposedError(`opportunity ${oppId} is not proposed`);
}

// The only path to a side effect. The status flip happens before any await,
// so a second concurrent confirm finds nothing to accept.
export async function confirmOpportunity(db: DB, oppId: number, deps: Deps, at: Date): Promise<ActionResult> {
  const r = db.prepare("UPDATE opportunities SET status='accepted' WHERE id=? AND status='proposed'").run(oppId);
  if (r.changes === 0) throw new NotProposedError(`opportunity ${oppId} is not proposed`);
  const opp = getOpportunity(db, oppId)!;
  const [tool, execute] = executors[opp.type];
  const actionId = Number(db.prepare('INSERT INTO actions (opportunity_id,tool,args,ts) VALUES (?,?,?,?)')
    .run(oppId, tool, JSON.stringify(opp.payload), at.toISOString()).lastInsertRowid);
  const result = await execute(db, opp, actionId, deps, at);
  db.prepare('UPDATE actions SET result=? WHERE id=?').run(JSON.stringify(result), actionId);
  db.prepare("UPDATE opportunities SET status='done' WHERE id=?").run(oppId);
  return result;
}

export function shouldInterrupt(db: DB, merchantId: string, at: Date): boolean {
  const since = new Date(at.getTime() - 5 * 60_000).toISOString();
  return !db.prepare(
    "SELECT 1 FROM payments WHERE merchant_id=? AND counterparty='customer' AND ts > ? AND ts <= ? LIMIT 1",
  ).get(merchantId, since, at.toISOString());
}
