import type { DB } from './db.ts';
import type { Detector } from './detectors.ts';
import type { Executor } from './actions.ts';

type Supply = { distributorId: string; distributor: string; price: number; tiers: Array<{ min: number; pct: number }> };

export function supplyFor(db: DB, sku: string): Supply {
  const r = db.prepare('SELECT d.id, d.name, s.unit_price, s.tiers FROM distributor_skus s JOIN distributors d ON d.id = s.distributor_id WHERE s.sku=? LIMIT 1').get(sku) as any;
  return { distributorId: r.id, distributor: r.name, price: r.unit_price, tiers: JSON.parse(r.tiers) };
}

export const tierPct = (tiers: Supply['tiers'], members: number) =>
  tiers.filter(t => members >= t.min).reduce((best, t) => Math.max(best, t.pct), 0);

const lowItems = (db: DB, merchantId: string) =>
  db.prepare('SELECT * FROM inventory WHERE merchant_id=? AND est_qty <= reorder_point ORDER BY sku').all(merchantId) as any[];

const openGroupFor = (db: DB, sku: string) =>
  db.prepare("SELECT id FROM group_orders WHERE sku=? AND status='open' ORDER BY id LIMIT 1").get(sku) as any;

export const orderQty = (item: any) => item.reorder_point * 2 - item.est_qty;

export const stockLow: Detector = (db, merchantId) =>
  lowItems(db, merchantId).filter(i => !openGroupFor(db, i.sku)).map(i => {
    const s = supplyFor(db, i.sku);
    const qty = orderQty(i);
    return {
      type: 'stock_low',
      key: `sku:${i.sku}`,
      estValue: Math.round(i.daily_units * 2 * i.unit_price * 0.15),
      payload: { sku: i.sku, name: i.name, estQty: i.est_qty, qty, distributorId: s.distributorId, distributor: s.distributor, total: qty * s.price },
    };
  });

export const groupBuyOpen: Detector = (db, merchantId) =>
  lowItems(db, merchantId).flatMap(i => {
    const g = openGroupFor(db, i.sku);
    if (!g || db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND merchant_id=?').get(g.id, merchantId)) return [];
    const s = supplyFor(db, i.sku);
    const members = (db.prepare('SELECT COUNT(*) n FROM group_members WHERE group_id=?').get(g.id) as any).n + 1;
    const pct = tierPct(s.tiers, members);
    const qty = orderQty(i);
    const saving = Math.round(qty * s.price * pct / 100);
    return [{
      type: 'group_buy_open',
      key: `group:${g.id}`,
      estValue: saving,
      payload: { groupId: g.id, sku: i.sku, name: i.name, qty, members, pct, saving, total: qty * s.price - saving, distributorId: s.distributorId, distributor: s.distributor },
    }];
  });

export const stockTemplate = (p: any) => `${p.name} khatam hone wala hai, sirf ${p.estQty} bache. ${p.distributor} se ${p.qty} mangwa doon? ₹${p.total}.`;
export const groupTemplate = (p: any) => `${p.name} ka group order chal raha hai: aap judein toh ${p.members} dukaanein, ${p.pct}% bachat, ₹${p.saving} bachenge. Jud jaaun?`;

function recordOrder(db: DB, merchantId: string, p: any, at: Date, extra: { total: number; pct?: number; groupId?: number }) {
  db.prepare("INSERT INTO orders (merchant_id,distributor_id,sku,qty,total,discount_pct,group_id,status,ts) VALUES (?,?,?,?,?,?,?,'placed',?)")
    .run(merchantId, p.distributorId, p.sku, p.qty, extra.total, extra.pct ?? 0, extra.groupId ?? null, at.toISOString());
  db.prepare('UPDATE inventory SET est_qty = est_qty + ?, updated_at=? WHERE merchant_id=? AND sku=?').run(p.qty, at.toISOString(), merchantId, p.sku);
}

export const placeOrder: Executor = async (db, opp, _actionId, _deps, at) => {
  const p = opp.payload;
  recordOrder(db, opp.merchantId, p, at, { total: p.total });
  return { line: `${p.distributor} ko ${p.qty} ${p.name} ka order bhej diya, ₹${p.total}.` };
};

export const joinGroupBuy: Executor = async (db, opp, actionId, _deps, at) => {
  const p = opp.payload;
  db.prepare('INSERT OR IGNORE INTO group_members (group_id,merchant_id,qty) VALUES (?,?,?)').run(p.groupId, opp.merchantId, p.qty);
  const members = (db.prepare('SELECT COUNT(*) n FROM group_members WHERE group_id=?').get(p.groupId) as any).n;
  const s = supplyFor(db, p.sku);
  const pct = tierPct(s.tiers, members);
  const saving = Math.round(p.qty * s.price * pct / 100);
  recordOrder(db, opp.merchantId, p, at, { total: p.qty * s.price - saving, pct, groupId: p.groupId });
  if (saving > 0) {
    db.prepare("INSERT INTO ledger (merchant_id,action_id,kind,amount,label,ts) VALUES (?,?,'group_saving',?,?,?)")
      .run(opp.merchantId, actionId, saving, `${p.name} group order mein bachat`, at.toISOString());
  }
  return { line: `Jud gaye! ${members} dukaanein, ${pct}% bachat, ₹${saving} bache.` };
};
