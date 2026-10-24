import { tx, type DB } from './db.ts';
import type { Detector } from './detectors.ts';
import type { Executor } from './actions.ts';

const DAY = 86_400_000;
const OFFER = 15;

// Regulars (4+ visits in the 60 days before the last 3 weeks) who have not come back since.
// Hashes stay inside this module: callers only ever see counts.
function lapsedPayers(db: DB, merchantId: string, at: Date): Array<{ payer: string; avg: number }> {
  const iso = (ms: number) => new Date(ms).toISOString();
  const recent = iso(at.getTime() - 21 * DAY);
  return (db.prepare(
    `SELECT payer_hash payer, AVG(amount) avg FROM payments
     WHERE merchant_id=? AND counterparty='customer' AND ts >= ? AND ts < ?
     GROUP BY payer_hash HAVING COUNT(*) >= 4
       AND payer_hash NOT IN (SELECT payer_hash FROM payments WHERE merchant_id=? AND ts >= ?)
       AND payer_hash NOT IN (SELECT t.payer_hash FROM winback_targets t JOIN winback_campaigns c ON c.id = t.campaign_id WHERE c.merchant_id=? AND c.ts >= ?)`,
  ).all(merchantId, iso(at.getTime() - 81 * DAY), recent, merchantId, recent, merchantId, iso(at.getTime() - 30 * DAY)) as any[]);
}

export const lapsedRegulars: Detector = (db, merchantId, at) => {
  const payers = lapsedPayers(db, merchantId, at);
  if (!payers.length) return [];
  const avgBasket = Math.round(payers.reduce((s, p) => s + p.avg, 0) / payers.length);
  return [{
    type: 'lapsed_regulars',
    key: `lapsed:${new Date(at.getTime() - (at.getTime() % (7 * DAY))).toISOString().slice(0, 10)}`,
    estValue: Math.round(avgBasket * payers.length * 0.3),
    payload: { count: payers.length, avgBasket, offer: OFFER },
  }];
};

export const lapsedTemplate = (p: any) =>
  `${p.count} pakke grahak 3 hafte se nahi aaye. Unhe ₹${p.offer} ka offer bhejoon? Paytm app se jaayega, naam aapko nahi dikhega.`;

// Simulated Paytm consumer-app push: the offer reaches the customers, their identity never reaches the merchant.
export const sendWinbackOffer: Executor = async (db, opp, actionId, _deps, at) => tx(db, () => {
  const payers = lapsedPayers(db, opp.merchantId, at);
  const campaign = Number(db.prepare('INSERT INTO winback_campaigns (merchant_id,action_id,offer,count,ts) VALUES (?,?,?,?,?)')
    .run(opp.merchantId, actionId, OFFER, payers.length, at.toISOString()).lastInsertRowid);
  const ins = db.prepare('INSERT INTO winback_targets (campaign_id,payer_hash) VALUES (?,?)');
  for (const p of payers) ins.run(campaign, p.payer);
  return { line: `${payers.length} purane grahakon ko Paytm app par ₹${OFFER} ka offer bhej diya. Unki pehchaan aapko nahi dikhayi jaati.` };
});
