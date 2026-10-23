import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { openDb } from '../db.ts';
import { seed } from '../seed.ts';
import { now } from '../clock.ts';
import { createApp } from '../app.ts';
import { onEvent } from '../events.ts';
import { deps } from './helpers.ts';

test('finale core loop over HTTP', async () => {
  const db = openDb(':memory:');
  seed(db, now());
  const server = createApp(db, deps).listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const post = (p: string, body = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const heard: string[] = [];
  const off = onEvent(e => { if (e.type === 'announce') heard.push(e.text); });
  try {
    const next = await (await post('/api/next')).json();
    assert.match(next.line, /Sharma ji.*₹450/);
    const r = await (await post(`/api/opportunities/${next.id}/confirm`)).json();
    assert.equal((await post(`/api/opportunities/${next.id}/confirm`)).status, 409);
    const ref = r.payUrl.split('/').pop();
    assert.equal((await (await fetch(`${base}/api/pay/${ref}`)).json()).amount, 450);
    assert.deepEqual(await (await post(`/api/pay/${ref}`)).json(), { alreadyPaid: false });
    assert.deepEqual(await (await post(`/api/pay/${ref}`)).json(), { alreadyPaid: true });
    assert.deepEqual(heard, ['Sharma ji ne ₹450 chuka diye']);
    assert.equal((await (await fetch(`${base}/api/ledger`)).json()).total, 450);
    assert.equal((await fetch(`${base}/api/pay/nope`)).status, 404);
    assert.equal((await post('/api/converse', {})).status, 400);
  } finally {
    off();
    server.close();
  }
});
