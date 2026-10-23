import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, HERO_ID, hashPayer } from '../seed.ts';
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

test('seed stocks five SKUs and an open Surf group order with 3 nearby members', () => {
  const db = fresh();
  assert.equal((db.prepare('SELECT COUNT(*) n FROM inventory WHERE merchant_id=?').get(HERO_ID) as any).n, 5);
  const g = db.prepare("SELECT id, sku, status FROM group_orders").get() as any;
  assert.equal(g.sku, 'surf_1kg');
  assert.equal(g.status, 'open');
  assert.equal((db.prepare('SELECT COUNT(*) n FROM group_members WHERE group_id=?').get(g.id) as any).n, 3);
});

test('seed has a loyal payer at exactly 9 visits and 12 lapsed regulars', () => {
  const db = fresh();
  assert.equal((db.prepare('SELECT COUNT(*) n FROM payments WHERE merchant_id=? AND payer_hash=?').get(HERO_ID, hashPayer('m_ramesh:loyal')) as any).n, 9);
  const recent = new Date(AT.getTime() - 21 * DAY).toISOString();
  for (let i = 0; i < 12; i++) {
    const h = hashPayer(`m_ramesh:lapsed:${i}`);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM payments WHERE payer_hash=?').get(h) as any).n, 5);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM payments WHERE payer_hash=? AND ts > ?').get(h, recent) as any).n, 0);
  }
});

test('seed has a ₹72,000 Diwali stock order due in 3 days', () => {
  const o = fresh().prepare("SELECT total, due_on, status FROM orders WHERE status='due'").get() as any;
  assert.equal(o.total, 72000);
  assert.equal(Math.round((new Date(o.due_on).getTime() - AT.getTime()) / DAY), 3);
});
