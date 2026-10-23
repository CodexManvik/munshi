import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID } from '../seed.ts';
import { udhaarOverdue, refreshOpportunities } from '../detectors.ts';
import { nextOpportunity, declineOpportunity, proposeOpportunity, getOpportunity, shouldInterrupt } from '../opportunities.ts';
import { AT, DAY, fresh } from './helpers.ts';

test('udhaarOverdue fires for >7 days open, skips 3-day and paid', () => {
  const opps = udhaarOverdue(fresh(), HERO_ID, AT);
  assert.deepEqual(opps.map(o => o.payload.customerName).sort(), ['Pinky didi', 'Sharma ji']);
  assert.equal(opps.find(o => o.payload.customerName === 'Sharma ji')!.estValue, 450);
});

test('udhaar given exactly 7 days ago does not fire', () => {
  const db = fresh();
  db.prepare("UPDATE khata SET given_on=? WHERE customer_name='Verma ji'").run(new Date(AT.getTime() - 7 * DAY).toISOString());
  assert.ok(!udhaarOverdue(db, HERO_ID, AT).some(o => o.payload.customerName === 'Verma ji'));
});

test('nextOpportunity returns highest value first and keeps it proposed', () => {
  const db = fresh();
  const a = nextOpportunity(db, HERO_ID, AT)!;
  assert.equal(a.payload.customerName, 'Sharma ji');
  assert.equal(a.status, 'proposed');
  assert.equal(nextOpportunity(db, HERO_ID, AT)!.id, a.id);
  declineOpportunity(db, a.id);
  const b = nextOpportunity(db, HERO_ID, AT)!;
  const best = db.prepare("SELECT MAX(est_value) v FROM opportunities WHERE status IN ('new','proposed') AND type IN ('udhaar_overdue','stock_low','group_buy_open','local_demand_spike')").get() as any;
  assert.notEqual(b.id, a.id);
  assert.equal(b.estValue, best.v);
});

test('scope all reaches beyond the brief: credit first, then win-back', () => {
  const db = fresh();
  const first = nextOpportunity(db, HERO_ID, AT, 'all')!;
  assert.equal(first.type, 'cash_gap');
  declineOpportunity(db, first.id);
  assert.equal(nextOpportunity(db, HERO_ID, AT, 'all')!.type, 'lapsed_regulars');
});

test('refresh does not duplicate opportunities', () => {
  const db = fresh();
  const count = () => (db.prepare('SELECT COUNT(*) n FROM opportunities').get() as any).n;
  refreshOpportunities(db, HERO_ID, AT);
  const first = count();
  refreshOpportunities(db, HERO_ID, AT);
  assert.equal(count(), first);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM opportunities WHERE type='udhaar_overdue'").get() as any).n, 2);
});

test('proposeOpportunity leaves only one proposal', () => {
  const db = fresh();
  const a = nextOpportunity(db, HERO_ID, AT)!;
  const other = (db.prepare('SELECT id FROM opportunities WHERE id != ?').get(a.id) as any).id;
  proposeOpportunity(db, HERO_ID, other);
  assert.equal(getOpportunity(db, a.id)!.status, 'new');
  assert.equal((db.prepare("SELECT COUNT(*) n FROM opportunities WHERE status='proposed'").get() as any).n, 1);
});

test('shouldInterrupt is false within 5 minutes of a customer payment', () => {
  const db = fresh();
  db.prepare("INSERT INTO payments(merchant_id,amount,ts,payer_hash,counterparty) VALUES(?,?,?,?, 'customer')")
    .run(HERO_ID, 50, new Date(AT.getTime() - 2 * 60_000).toISOString(), 'x');
  assert.equal(shouldInterrupt(db, HERO_ID, AT), false);
  assert.equal(shouldInterrupt(db, HERO_ID, new Date(AT.getTime() + 4 * 60_000)), true);
});
