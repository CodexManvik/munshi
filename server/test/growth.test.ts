import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID } from '../seed.ts';
import { stockLow, groupBuyOpen, localDemandSpike } from '../inventory.ts';
import { refreshOpportunities } from '../detectors.ts';
import { proposeOpportunity, confirmOpportunity, nextOpportunity, NotProposedError } from '../opportunities.ts';
import { template } from '../phrase.ts';
import { getLedger } from '../ledger.ts';
import { AT, fresh, deps } from './helpers.ts';

const oppId = (db: any, type: string) => {
  refreshOpportunities(db, HERO_ID, AT);
  return (db.prepare('SELECT id FROM opportunities WHERE type=?').get(type) as any).id as number;
};
const stock = (db: any, sku: string) => (db.prepare('SELECT est_qty FROM inventory WHERE merchant_id=? AND sku=?').get(HERO_ID, sku) as any).est_qty;

test('Parle-G low fires stock_low; Surf goes to its open group order instead', () => {
  const db = fresh();
  assert.deepEqual(stockLow(db, HERO_ID, AT).map(o => o.payload.sku), ['parle_g']);
  const [g] = groupBuyOpen(db, HERO_ID, AT);
  assert.deepEqual(
    { sku: g.payload.sku, members: g.payload.members, pct: g.payload.pct, qty: g.payload.qty, saving: g.payload.saving, total: g.payload.total },
    { sku: 'surf_1kg', members: 4, pct: 8, qty: 10, saving: 143, total: 1647 },
  );
  assert.equal(g.estValue, 143);
});

test('group template states members, discount and saving', () => {
  const db = fresh();
  proposeOpportunity(db, HERO_ID, oppId(db, 'group_buy_open'));
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  assert.equal(template(opp), 'Surf Excel 1kg ka group order chal raha hai: aap judein toh 4 dukaanein, 8% bachat, ₹143 bachenge. Jud jaaun?');
});

test('joining the group adds the hero once and writes the saving to the ledger', async () => {
  const db = fresh();
  const id = oppId(db, 'group_buy_open');
  proposeOpportunity(db, HERO_ID, id);
  const r = await confirmOpportunity(db, id, deps, AT);
  assert.equal(r.line, 'Jud gaye! 4 dukaanein, 8% bachat, ₹143 bache.');
  await assert.rejects(confirmOpportunity(db, id, deps, AT), NotProposedError);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM group_members').get() as any).n, 4);
  const l = getLedger(db, HERO_ID, AT);
  assert.deepEqual(l.items.map(i => [i.kind, i.amount, i.label]), [['group_saving', 143, 'Surf Excel 1kg group order mein bachat']]);
  assert.equal(stock(db, 'surf_1kg'), 12);
});

test('a solo order refills stock and earns no ledger line', async () => {
  const db = fresh();
  const id = oppId(db, 'stock_low');
  proposeOpportunity(db, HERO_ID, id);
  const r = await confirmOpportunity(db, id, deps, AT);
  assert.equal(r.line, 'Shree Ganesh Traders ko 45 Parle-G ka order bhej diya, ₹405.');
  assert.equal(stock(db, 'parle_g'), 60);
  assert.equal(getLedger(db, HERO_ID, AT).total, 0);
});

test('local demand spike fires for pooja with 5 nearby shops and leaks no merchant ids', () => {
  const db = fresh();
  const spike = localDemandSpike(db, HERO_ID, AT).find(o => o.payload.category === 'pooja')!;
  assert.ok(spike.payload.uplift >= 30, `uplift ${spike.payload.uplift}`);
  assert.equal(spike.payload.shops, 5);
  assert.equal(spike.payload.sku, 'diya_pack');
  assert.ok(!JSON.stringify(spike).includes('m_n'));
  assert.match(template({ type: spike.type, payload: spike.payload } as any), /^Aapke mohalle ki 5 dukaanon mein pooja samagri ki bikri \d+% upar hai\. Mitti diye \(12\) ka stock badhaaun\? \d+ pack, ₹\d+\.$/);
});

test('a network aggregate of 4 shops returns nothing', () => {
  const db = fresh();
  db.prepare("DELETE FROM merchants WHERE id='m_n03'").run();
  assert.equal(localDemandSpike(db, HERO_ID, AT).filter(o => o.payload.category === 'pooja').length, 0);
});
