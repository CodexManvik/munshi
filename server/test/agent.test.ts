import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID } from '../seed.ts';
import { nextOpportunity, getOpportunity } from '../opportunities.ts';
import { template, phrase } from '../phrase.ts';
import { runTool } from '../tools.ts';
import { classifyReply, converse } from '../agent.ts';
import { AT, fresh, deps, sent } from './helpers.ts';

test('classifyReply handles Roman and Devanagari', () => {
  for (const t of ['haan', 'Haan ji', 'हाँ', 'हां जी', 'theek hai', 'bhej do']) assert.equal(classifyReply(t), 'yes', t);
  for (const t of ['nahi', 'नहीं', 'rehne do']) assert.equal(classifyReply(t), 'no', t);
  for (const t of ['kitna udhaar hai?', 'haan par kal bhejna']) assert.equal(classifyReply(t), 'other', t);
});

test('classifyReply accepts natural spoken variants of yes and no', () => {
  for (const t of ['हाँ भेज दो', 'हां हां', 'ओके', 'हाँ,', 'Haan, bhej do!', 'ok ji', 'kar do', 'ठीक है जी', 'bhej do na', 'भेज दो ना']) assert.equal(classifyReply(t), 'yes', t);
  for (const t of ['नहीं चाहिए', 'nahi chahiye', 'na na', 'mat bhejo', 'अभी नहीं', 'नहीं।']) assert.equal(classifyReply(t), 'no', t);
  for (const t of ['haan nahi', 'haan par kal bhejna', 'pehle Pinky ko bhejo']) assert.equal(classifyReply(t), 'other', t);
});

test('phrase falls back to template without a client or on failure', async () => {
  const opp = nextOpportunity(fresh(), HERO_ID, AT)!;
  assert.equal(await phrase(opp), 'Sharma ji ka ₹450 udhaar 12 din se baaki hai. Reminder bhej doon?');
  const broken = { messages: { create: async () => { throw new Error('down'); } } };
  assert.equal(await phrase(opp, broken), template(opp));
});

test('phrase falls back to template when Claude is slower than 4 seconds', async () => {
  const opp = nextOpportunity(fresh(), HERO_ID, AT)!;
  const slow = { messages: { create: () => new Promise(() => {}) } };
  const t0 = Date.now();
  assert.equal(await phrase(opp, slow), template(opp));
  assert.ok(Date.now() - t0 < 5000);
});

test('converse yes confirms the proposal; no declines', async () => {
  const db = fresh();
  nextOpportunity(db, HERO_ID, AT);
  assert.equal((await converse(db, HERO_ID, 'हाँ', AT, deps)).line, 'Sharma ji ko reminder bhej diya.');
  nextOpportunity(db, HERO_ID, AT);
  assert.equal((await converse(db, HERO_ID, 'nahi', AT, deps)).line, 'Theek hai, rehne dete hain.');
});

test('converse without Claude gives the fallback line', async () => {
  assert.equal((await converse(fresh(), HERO_ID, 'kitna udhaar hai?', AT, deps)).line, 'Maaf kijiye, samajh nahi aaya. Haan ya Nahi dabaiye.');
});

test('agent tool call proposes but never executes', async () => {
  const db = fresh(); sent.length = 0;
  const khataId = (db.prepare("SELECT id FROM khata WHERE customer_name='Pinky didi'").get() as any).id;
  let round = 0;
  const fake = { messages: { create: async () => round++ === 0
    ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'send_udhaar_reminder', input: { khata_id: khataId } }] }
    : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Pinky didi ko reminder bhej doon?' }] } } };
  const r = await converse(db, HERO_ID, 'Pinky didi ko yaad dilao', AT, { ...deps, anthropic: fake });
  assert.equal(r.line, 'Pinky didi ko reminder bhej doon?');
  assert.equal(getOpportunity(db, r.opportunityId!)!.status, 'proposed');
  assert.equal(sent.length, 0);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM actions').get() as any).n, 0);
});

test('no merchant-facing tool output contains payer_hash values', () => {
  const db = fresh();
  const hashes = (db.prepare('SELECT DISTINCT payer_hash h FROM payments').all() as any[]).map(r => r.h);
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const outputs = [
    runTool(db, HERO_ID, AT, 'get_opportunities', {}),
    runTool(db, HERO_ID, AT, 'explain_opportunity', { id: opp.id }),
    runTool(db, HERO_ID, AT, 'get_ledger', {}),
  ].map(o => JSON.stringify(o));
  for (const out of outputs) {
    assert.ok(!out.includes('payer_hash'));
    for (const h of hashes) assert.ok(!out.includes(h));
  }
});
