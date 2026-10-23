import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID, hashPayer } from '../seed.ts';
import { lapsedRegulars } from '../customers.ts';
import { recordCustomerPayment } from '../payments.ts';
import { stockLow, groupBuyOpen, localDemandSpike } from '../inventory.ts';
import { refreshOpportunities } from '../detectors.ts';
import { proposeOpportunity, confirmOpportunity, nextOpportunity, NotProposedError } from '../opportunities.ts';
import { template } from '../phrase.ts';
import { getLedger } from '../ledger.ts';
import { shelfFlow, analyzeShelf, NoVisionError } from '../shelf.ts';
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

const CANNED = [{ sku: 'surf_1kg', level: 'empty' as const }, { sku: 'parle_g', level: 'low' as const }];

test('a shelf reading updates stock, names what is low, and proposes the group order', () => {
  const db = fresh();
  const r = shelfFlow(db, HERO_ID, CANNED, AT);
  assert.equal(r.line, 'Shelf dekh li: Surf Excel 1kg aur Parle-G kam hain.');
  assert.equal(stock(db, 'surf_1kg'), 0);
  assert.equal(stock(db, 'parle_g'), 15);
  assert.match(r.next!.line, /^Surf Excel 1kg ka group order chal raha hai: aap judein toh 4 dukaanein, 8% bachat, ₹172 bachenge\. Jud jaaun\?$/);
  assert.equal((db.prepare('SELECT status FROM opportunities WHERE id=?').get(r.next!.id) as any).status, 'proposed');
});

test('an all-ok shelf says so and proposes nothing new', () => {
  const r = shelfFlow(fresh(), HERO_ID, [{ sku: 'tata_salt', level: 'ok' }], AT);
  assert.equal(r.line, 'Shelf dekh li, sab theek hai.');
  assert.equal(r.next, null);
});

test('shelf vision needs Claude and keeps only known SKUs and levels', async () => {
  const img = { data: 'aGk=', mediaType: 'image/jpeg' };
  await assert.rejects(analyzeShelf(fresh(), HERO_ID, img), NoVisionError);
  const fake = { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Yeh raha: [{"sku":"surf_1kg","level":"empty"},{"sku":"bogus","level":"low"},{"sku":"parle_g","level":"meh"}]' }] }) } };
  assert.deepEqual(await analyzeShelf(fresh(), HERO_ID, img, fake), [{ sku: 'surf_1kg', level: 'empty' }]);
});

test('refresh drops new opportunities whose condition no longer holds', () => {
  const db = fresh();
  refreshOpportunities(db, HERO_ID, AT);
  db.prepare("UPDATE inventory SET est_qty=100 WHERE sku='parle_g'").run();
  refreshOpportunities(db, HERO_ID, AT);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM opportunities WHERE type='stock_low'").get() as any).n, 0);
});

const lapsedHashes = () => Array.from({ length: 12 }, (_, i) => hashPayer(`${HERO_ID}:lapsed:${i}`));

test('lapsed regulars counts 12 and carries no customer identity', () => {
  const db = fresh();
  const [o] = lapsedRegulars(db, HERO_ID, AT);
  assert.equal(o.payload.count, 12);
  assert.equal(o.payload.offer, 15);
  const text = JSON.stringify(o);
  for (const h of lapsedHashes()) assert.ok(!text.includes(h));
  assert.equal(template({ type: o.type, payload: o.payload } as any), '12 pakke grahak 3 hafte se nahi aaye. Unhe ₹15 ka offer bhejoon? Paytm app se jaayega, naam aapko nahi dikhega.');
});

test('loyalty fires on exactly the 10th visit and never names the customer', () => {
  const db = fresh();
  const loyal = hashPayer(`${HERO_ID}:loyal`);
  const tenth = recordCustomerPayment(db, HERO_ID, 180, loyal, AT);
  assert.deepEqual(tenth, ['₹180 prapt hue', 'Dhanyavaad! Yeh grahak ki 10vi khareed hai, agli baar ₹20 off.']);
  assert.ok(!tenth.join(' ').includes(loyal));
  assert.deepEqual(recordCustomerPayment(db, HERO_ID, 90, loyal, AT), ['₹90 prapt hue']);
});

test('win-back offer goes to 12 hidden targets and a return is credited once', async () => {
  const db = fresh();
  refreshOpportunities(db, HERO_ID, AT);
  const id = (db.prepare("SELECT id FROM opportunities WHERE type='lapsed_regulars'").get() as any).id;
  proposeOpportunity(db, HERO_ID, id);
  const r = await confirmOpportunity(db, id, deps, AT);
  assert.equal(r.line, '12 purane grahakon ko Paytm app par ₹15 ka offer bhej diya. Unki pehchaan aapko nahi dikhayi jaati.');
  assert.equal((db.prepare('SELECT COUNT(*) n FROM winback_targets').get() as any).n, 12);
  const h = lapsedHashes()[0];
  assert.deepEqual(recordCustomerPayment(db, HERO_ID, 340, h, AT), ['₹340 prapt hue', 'Ek purana grahak ₹15 offer se lauta! ₹340 ki khareed.']);
  recordCustomerPayment(db, HERO_ID, 200, h, AT);
  assert.deepEqual(getLedger(db, HERO_ID, AT).items.map(i => [i.kind, i.amount, i.label]), [['winback_sale', 340, 'Purana grahak lauta (₹15 offer)']]);
});
