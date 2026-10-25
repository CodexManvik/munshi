import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID } from '../seed.ts';
import { nextOpportunity } from '../opportunities.ts';
import { phraseFull, template } from '../phrase.ts';
import { spokenFor } from '../spoken.ts';
import { AT, fresh } from './helpers.ts';

const reply = (text: string) => ({ messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }) } });

test('without Claude: template line and template Devanagari', async () => {
  const opp = nextOpportunity(fresh(), HERO_ID, AT)!;
  assert.deepEqual(await phraseFull(opp), { line: template(opp), spoken: spokenFor(opp) });
});

test('Claude gives both lines: Roman first, Devanagari second', async () => {
  const db = fresh();
  db.prepare("UPDATE khata SET amount=451 WHERE customer_name='Sharma ji'").run(); // fresh cache key
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const r = await phraseFull(opp, reply('Ramesh ji, Sharma ji ka ₹451 udhaar 12 din se baaki hai. Reminder bhej doon?\nरमेश जी, Sharma ji का ₹451 उधार 12 दिन से बाकी है। रिमाइंडर भेज दूँ?'));
  assert.equal(r.line, 'Ramesh ji, Sharma ji ka ₹451 udhaar 12 din se baaki hai. Reminder bhej doon?');
  assert.equal(r.spoken, 'रमेश जी, Sharma ji का ₹451 उधार 12 दिन से बाकी है। रिमाइंडर भेज दूँ?');
});

test('Claude Devanagari that drops a number falls back to the template Devanagari', async () => {
  const db = fresh();
  db.prepare("UPDATE khata SET amount=452 WHERE customer_name='Sharma ji'").run();
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const r = await phraseFull(opp, reply('Sharma ji ka ₹452 udhaar 12 din se baaki hai. Reminder bhej doon?\nशर्मा जी का उधार बाकी है।'));
  assert.equal(r.line, 'Sharma ji ka ₹452 udhaar 12 din se baaki hai. Reminder bhej doon?');
  assert.equal(r.spoken, spokenFor(opp));
});
