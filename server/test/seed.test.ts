import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, HERO_ID } from '../seed.ts';
import { now, advance, resetClock } from '../clock.ts';
import { AT, DAY, fresh } from './helpers.ts';

test('seed creates hero and 20 nearby shops', () => {
  const db = fresh();
  assert.equal((db.prepare('SELECT COUNT(*) n FROM merchants').get() as any).n, 21);
  assert.equal((db.prepare('SELECT name FROM merchants WHERE id=?').get(HERO_ID) as any).name, 'Ramesh Kirana');
});

test('every merchant has customer payments spanning the 90 days before AT', () => {
  const db = fresh();
  const r = db.prepare("SELECT MIN(ts) lo, MAX(ts) hi, COUNT(DISTINCT merchant_id) m FROM payments WHERE counterparty='customer'").get() as any;
  assert.equal(r.m, 21);
  assert.ok(new Date(r.lo).getTime() >= AT.getTime() - 90 * DAY);
  assert.ok(new Date(r.hi).getTime() < AT.getTime());
});

test('seed puts Sharma ji ₹450 open udhaar given 12 days ago', () => {
  const db = fresh();
  const k = db.prepare("SELECT * FROM khata WHERE customer_name='Sharma ji'").get() as any;
  assert.equal(k.amount, 450);
  assert.equal(k.status, 'open');
  assert.equal(Math.round((AT.getTime() - new Date(k.given_on).getTime()) / DAY), 12);
});

test('seed is deterministic and re-seeding replaces data', () => {
  const db = fresh();
  const sum = () => ({ ...(db.prepare('SELECT COUNT(*) n, SUM(amount) s FROM payments').get() as any) });
  const first = sum();
  seed(db, AT);
  assert.deepEqual(sum(), first);
});

test('clock advances by minutes and resets', () => {
  resetClock();
  const t0 = now().getTime();
  advance(30);
  assert.ok(now().getTime() - t0 >= 30 * 60_000);
  resetClock();
  assert.ok(now().getTime() - t0 < 60_000);
});
