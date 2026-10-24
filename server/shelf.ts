import type { DB } from './db.ts';
import type { AnthropicLike } from './actions.ts';
import { refreshOpportunities } from './detectors.ts';
import { getOpportunity, proposeOpportunity } from './opportunities.ts';
import { MODEL, template, withTimeout } from './phrase.ts';

export type Level = 'empty' | 'low' | 'ok';
export type Reading = { sku: string; level: Level };
export class NoVisionError extends Error {}
// The photo was looked at but nothing usable came back: never report that as "all fine".
export class UnreadablePhotoError extends Error {}

const items = (db: DB, merchantId: string) =>
  db.prepare('SELECT sku, name, est_qty, reorder_point FROM inventory WHERE merchant_id=? ORDER BY sku').all(merchantId) as any[];

export function applyShelfReading(db: DB, merchantId: string, readings: Reading[], at: Date): { line: string; low: string[] } {
  const known = new Map(items(db, merchantId).map(i => [i.sku, i]));
  const low: string[] = [];
  for (const r of readings) {
    const item = known.get(r.sku);
    if (!item || r.level === 'ok') continue;
    const qty = r.level === 'empty' ? 0 : Math.min(item.est_qty, item.reorder_point - 1);
    db.prepare('UPDATE inventory SET est_qty=?, updated_at=? WHERE merchant_id=? AND sku=?').run(qty, at.toISOString(), merchantId, r.sku);
    low.push(r.sku);
  }
  const names = low.map(s => known.get(s).name);
  return { line: names.length ? `Shelf dekh li: ${names.join(' aur ')} kam hain.` : 'Shelf dekh li, sab theek hai.', low };
}

// Apply a reading, then put the best restock offer for what was seen in front of the merchant.
export function shelfFlow(db: DB, merchantId: string, readings: Reading[], at: Date) {
  const { line, low } = applyShelfReading(db, merchantId, readings, at);
  refreshOpportunities(db, merchantId, at);
  const best = low.length ? db.prepare(
    `SELECT id FROM opportunities WHERE merchant_id=? AND status IN ('new','proposed') AND type IN ('group_buy_open','stock_low')
     AND json_extract(payload,'$.sku') IN (${low.map(() => '?').join(',')}) ORDER BY est_value DESC LIMIT 1`,
  ).get(merchantId, ...low) as any : null;
  if (!best) return { line, next: null };
  const opp = proposeOpportunity(db, merchantId, best.id);
  return { line, next: { id: opp.id, line: template(getOpportunity(db, opp.id)!) } };
}

export async function analyzeShelf(db: DB, merchantId: string, image: { data: string; mediaType: string }, anthropic?: AnthropicLike): Promise<Reading[]> {
  if (!anthropic) throw new NoVisionError('vision needs Claude');
  const list = items(db, merchantId);
  const res = await withTimeout(anthropic.messages.create({
    model: MODEL, max_tokens: 2000, output_config: { effort: 'low' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: `Yeh ek kirana dukaan ki shelf hai. In cheezon ke liye batao stock kitna dikh raha hai: ${list.map(i => `${i.sku} (${i.name})`).join(', ')}. Sirf JSON array do, jaise [{"sku":"surf_1kg","level":"low"}]. level sirf "empty", "low" ya "ok". Jo cheez dikh nahi rahi, use chhod do.` },
      ],
    }],
  }), 20_000);
  const text = (res.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  let parsed: unknown;
  try { parsed = json ? JSON.parse(json) : null; } catch { parsed = null; }
  const skus = new Set(list.map(i => i.sku));
  const readings = (Array.isArray(parsed) ? parsed : [])
    .filter((r: any) => skus.has(r?.sku) && ['empty', 'low', 'ok'].includes(r?.level))
    .map((r: any) => ({ sku: r.sku, level: r.level as Level }));
  if (!readings.length) throw new UnreadablePhotoError('no usable shelf reading');
  return readings;
}
