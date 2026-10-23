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

test('control shelf beat announces what is low and offers the group order', async () => {
  const db = openDb(':memory:');
  seed(db, now());
  const server = createApp(db, deps).listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const events: any[] = [];
  const off = onEvent(e => events.push(e));
  try {
    const r = await (await fetch(`${base}/api/control/shelf`, { method: 'POST' })).json();
    assert.equal(r.line, 'Shelf dekh li: Surf Excel 1kg aur Parle-G kam hain.');
    assert.match(r.next.line, /^Surf Excel 1kg ka group order/);
    assert.deepEqual(events.map(e => e.type), ['shelf']);
    assert.equal((await fetch(`${base}/api/shelf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: 'aGk=', mediaType: 'image/jpeg' }) })).status, 503);
    assert.equal((await fetch(`${base}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`)).status, 403);
  } finally {
    off();
    server.close();
  }
});
