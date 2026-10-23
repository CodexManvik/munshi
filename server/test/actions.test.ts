import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID } from '../seed.ts';
import { refreshOpportunities } from '../detectors.ts';
import { nextOpportunity, getOpportunity, confirmOpportunity, NotProposedError } from '../opportunities.ts';
import { makeSendWhatsApp } from '../whatsapp.ts';
import { AT, fresh, deps, sent } from './helpers.ts';

test('confirm sends one reminder with a pay link and records the action', async () => {
  const db = fresh(); sent.length = 0;
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const r = await confirmOpportunity(db, opp.id, deps, AT);
  assert.match(r.payUrl!, /^https:\/\/demo\.test\/pay\/[0-9a-f]{8}$/);
  assert.equal(r.line, 'Sharma ji ko reminder bhej diya.');
  assert.equal(sent.length, 1);
  assert.ok(sent[0][1].includes('₹450') && sent[0][1].includes(r.payUrl!));
  assert.equal(getOpportunity(db, opp.id)!.status, 'done');
  assert.equal((db.prepare('SELECT tool FROM actions').get() as any).tool, 'send_udhaar_reminder');
  assert.equal((db.prepare('SELECT amount FROM pay_links').get() as any).amount, 450);
});

test('confirm rejects an opportunity that is not proposed', async () => {
  const db = fresh();
  refreshOpportunities(db, HERO_ID, AT);
  const id = (db.prepare('SELECT id FROM opportunities LIMIT 1').get() as any).id;
  await assert.rejects(confirmOpportunity(db, id, deps, AT), NotProposedError);
});

test('double confirm sends only one WhatsApp', async () => {
  const db = fresh(); sent.length = 0;
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const results = await Promise.allSettled([confirmOpportunity(db, opp.id, deps, AT), confirmOpportunity(db, opp.id, deps, AT)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(sent.length, 1);
});

test('unsent WhatsApp still returns a pay link and QR line', async () => {
  const db = fresh();
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const r = await confirmOpportunity(db, opp.id, { ...deps, sendWhatsApp: async () => ({ sent: false, error: 'x' }) }, AT);
  assert.equal(r.line, 'WhatsApp nahi gaya. Yeh QR Sharma ji ko dikha dijiye.');
  assert.ok(r.payUrl);
});

test('makeSendWhatsApp without config reports not_configured', async () => {
  assert.deepEqual(await makeSendWhatsApp({})('+911', 'hi'), { sent: false, error: 'not_configured' });
});
