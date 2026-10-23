# Munshi Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build sub-project 1 of Munshi: seeded Paytm data → udhaar detector → Hindi proposal on a web Soundbox → merchant "haan" → WhatsApp reminder with pay link → judge pays → Soundbox announces → ₹ ledger updates.

**Architecture:** One Node/TypeScript HTTP server (stdlib `node:http` + `node:sqlite`) holds data, detectors, an opportunity lifecycle that structurally gates every side effect behind a merchant confirmation, and a Claude agent that can only *propose*. One React (Vite) app serves `/soundbox`, `/pay/:ref`, `/ledger`, `/control`, fed by Server-Sent Events.

**Tech Stack:** Node 22.17 (`--experimental-strip-types`, `node:sqlite`, `node:test`), `@anthropic-ai/sdk`, React 18 + Vite, `qrcode`, Web Speech API (`hi-IN`), Meta WhatsApp Cloud API.

**Spec:** `docs/superpowers/specs/2026-10-24-munshi-design.md` (sections 4–11; this plan covers build-order row 1 only)

## Global Constraints

- Run TypeScript with `node --experimental-strip-types`. No `enum`, `namespace`, or constructor parameter properties. Relative imports include the `.ts` extension. Use `import type` for type-only imports.
- Server runtime dependencies: `@anthropic-ai/sdk` only. Database is `DatabaseSync` from `node:sqlite`; HTTP is `node:http`. Web dependencies: `react`, `react-dom`, `qrcode`; dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/qrcode`, `@types/node`.
- Money is integer rupees everywhere. Display as `₹450` (no decimals).
- Hero merchant: id `m_ramesh`, name `Ramesh Kirana`. Hero udhaar: `Sharma ji`, ₹450, given 12 days before seed time.
- Merchant-facing copy is Hinglish in Roman script, one or two short sentences.
- Claude model: `claude-sonnet-5-5`. Load the `claude-api` skill before writing any Claude API code.
- Hard rule 1: a tool that sends a message or moves money runs only through `confirmOpportunity`, which rejects unless the opportunity's status is `proposed`.
- Hard rule 2: no merchant-facing tool or API output contains `payer_hash` or any value from `payments.payer_hash`.
- Server listens on `PORT` (default `3000`); Vite dev server proxies `/api` to it.
- UI is mobile-first (designed at 375 px, scales up); load the `impeccable:impeccable` skill before building any web page.
- Tests share `server/test/helpers.ts` exporting `AT` (`2026-11-01T09:00:00+05:30`), `DAY`, `fresh()` (`:memory:` db seeded at `AT`), `sent` (array of `[to, text]`), and `deps` (fake `sendWhatsApp` pushing to `sent`, `publicUrl 'https://demo.test'`). Task 1 creates it with `AT`, `DAY`, `fresh`; Task 3 adds `sent` and `deps`.
- Environment: `ANTHROPIC_API_KEY`, `WA_TOKEN`, `WA_PHONE_ID`, `WA_GRAPH_VERSION` (default `v23.0`), `PUBLIC_URL` (public tunnel URL used in WhatsApp links), `DEMO_CUSTOMER_PHONE` (Sharma ji's number, E.164). Every one is optional; absence degrades to fallbacks, never crashes.

## Review Focus

1. **Chrome `hi-IN` speech recognition returns Devanagari** (`हाँ`, `हां`, `नहीं`), not Roman text — "haan" must be recognized in both scripts. Pinned in Task 5.
2. **Merchant taps Haan twice, or says "haan" after already tapping it** — the reminder must be sent once; the second confirm gets a 409, not a second WhatsApp. Pinned in Task 3.
3. **Judge taps Pay twice or reopens a paid link** — one payment, one ledger line, one announcement; the page says it is already paid. Pinned in Task 4.
4. **No `ANTHROPIC_API_KEY` or Claude times out on stage** — every opportunity still gets a spoken template line and Haan/Nahi still work. Pinned in Task 5.
5. **Browser blocks speech output until a user gesture** — the Soundbox must not try to speak before the first tap. Pinned in Task 7.

---

## File Structure

```
package.json            scripts + deps
tsconfig.json           editor/type-check only (noEmit)
vite.config.ts          React plugin, /api proxy, root web/
server/
  db.ts                 openDb + schema
  clock.ts              demo clock with offset
  seed.ts               deterministic demo data
  detectors.ts          Opportunity type, udhaarOverdue, refreshOpportunities
  opportunities.ts      lifecycle: next, propose, confirm, decline, shouldInterrupt
  actions.ts            executors (udhaar reminder) + Deps type
  whatsapp.ts           makeSendWhatsApp
  payments.ts           getPayLink, payLink, recordWalkin
  ledger.ts             getLedger
  phrase.ts             template + Claude phrasing with cache and timeout
  tools.ts              agent tool definitions + implementations
  agent.ts              classifyReply, converse (agent loop)
  events.ts             SSE hub + in-process listeners
  app.ts                createApp: routes, static files
  main.ts               boot: open db, seed, warm phrases, listen
  test/*.test.ts
web/
  index.html  main.tsx  api.ts  speech.ts  styles.css
  Soundbox.tsx  Pay.tsx  Ledger.tsx  Control.tsx
README.md               demo setup + rehearsal checklist
```

---

### Task 1: Project setup, schema, clock, seed

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `server/db.ts`, `server/clock.ts`, `server/seed.ts`
- Test: `server/test/seed.test.ts`

**Interfaces:**
- Produces:
  - `type DB = DatabaseSync`; `openDb(path: string): DB` — creates all tables below if absent.
  - `now(): Date`, `advance(minutes: number): void`, `resetClock(): void` — `now()` is real time plus an in-memory offset.
  - `HERO_ID = 'm_ramesh'`; `seed(db: DB, at: Date, opts?: { demoPhone?: string }): void` — deletes all rows from every table, then inserts.
  - Schema (amounts INTEGER rupees, timestamps ISO TEXT):
    - `merchants(id TEXT PK, name, category, locality, lat REAL, lng REAL, language)`
    - `payments(id INTEGER PK, merchant_id, amount, ts, payer_hash, counterparty CHECK IN ('customer','distributor'))`
    - `settlements(merchant_id, date, amount)`
    - `khata(id INTEGER PK, merchant_id, customer_name, phone, amount, given_on, status CHECK IN ('open','paid'))`
    - `opportunities(id INTEGER PK, merchant_id, type, key, payload TEXT, est_value, status CHECK IN ('new','proposed','accepted','declined','done'), created_at, UNIQUE(merchant_id, type, key))`
    - `actions(id INTEGER PK, opportunity_id, tool, args TEXT, result TEXT, ts)`
    - `pay_links(ref TEXT PK, merchant_id, khata_id, action_id, amount, status CHECK IN ('pending','paid'), paid_at)`
    - `ledger(id INTEGER PK, merchant_id, action_id, kind, amount, label, ts)`

- [ ] **Step 1: Create `package.json`, `tsconfig.json`, `.gitignore`**

`package.json` scripts:
```json
{
  "type": "module",
  "scripts": {
    "server": "node --experimental-strip-types server/main.ts",
    "dev": "vite",
    "build": "vite build",
    "test": "node --experimental-strip-types --test \"server/test/*.test.ts\""
  }
}
```
`tsconfig.json`: `"noEmit": true, "allowImportingTsExtensions": true, "verbatimModuleSyntax": true, "module": "nodenext", "jsx": "react-jsx", "strict": true`. `.gitignore`: `node_modules`, `web/dist`, `*.db`, `.env`. Run `npm i @anthropic-ai/sdk` and `npm i -D @types/node typescript`.

- [ ] **Step 2: Write the failing test `server/test/seed.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.ts';
import { seed, HERO_ID } from '../seed.ts';
import { now, advance, resetClock } from '../clock.ts';

const AT = new Date('2026-11-01T09:00:00+05:30');
const DAY = 86_400_000;
const fresh = () => { const db = openDb(':memory:'); seed(db, AT); return db; };

test('seed creates hero and 20 nearby shops', () => {
  const db = fresh();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM merchants').get().n, 21);
  assert.equal(db.prepare('SELECT name FROM merchants WHERE id=?').get(HERO_ID).name, 'Ramesh Kirana');
});

test('every merchant has customer payments spanning the 90 days before AT', () => {
  const db = fresh();
  const r = db.prepare("SELECT MIN(ts) lo, MAX(ts) hi, COUNT(DISTINCT merchant_id) m FROM payments WHERE counterparty='customer'").get();
  assert.equal(r.m, 21);
  assert.ok(new Date(r.lo).getTime() >= AT.getTime() - 90 * DAY);
  assert.ok(new Date(r.hi).getTime() < AT.getTime());
});

test('seed puts Sharma ji ₹450 open udhaar given 12 days ago', () => {
  const db = fresh();
  const k = db.prepare("SELECT * FROM khata WHERE customer_name='Sharma ji'").get();
  assert.equal(k.amount, 450);
  assert.equal(k.status, 'open');
  assert.equal(Math.round((AT.getTime() - new Date(k.given_on).getTime()) / DAY), 12);
});

test('seed is deterministic and re-seeding replaces data', () => {
  const db = fresh();
  const sum = () => db.prepare('SELECT COUNT(*) n, SUM(amount) s FROM payments').get();
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../db.ts`.

- [ ] **Step 4: Implement `server/db.ts`, `server/clock.ts`, `server/seed.ts`**

Seed content (all relative to `at`, using a seeded PRNG `mulberry32(42)` so output is deterministic):
- Hero `m_ramesh` "Ramesh Kirana", category `kirana`, locality `Aliganj, Lucknow`, lat `26.8467`, lng `80.9462`, language `hi`.
- 20 shops `m_n01`…`m_n20` within 2 km of the hero, categories cycling `kirana`, `sweets`, `pooja`, `general`.
- Per merchant per day for 90 days: 15–40 customer payments of ₹20–₹600 at shop hours (08:00–21:00 IST); `payer_hash` = first 12 hex chars of SHA-256 of `${merchantId}:${customerIndex}`, from a pool of 150 customers where 30 "regulars" account for half of visits. In the final 7 days, `sweets` and `pooja` volumes ×1.4.
- `settlements`: one row per merchant per day = that day's customer total.
- Hero distributor payments: one per week, ₹8,000–₹15,000, counterparty `distributor`.
- Hero khata: `Sharma ji` ₹450 given 12 days ago (`phone` = `opts.demoPhone ?? '+919999900001'`), `Pinky didi` ₹230 given 9 days ago, `Verma ji` ₹120 given 3 days ago, `Gupta ji` ₹800 given 20 days ago with status `paid`.
- Wrap inserts in one `BEGIN`/`COMMIT`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore server
git commit -m "feat: schema, demo clock, deterministic seed"
```

---

### Task 2: Udhaar detector and opportunity queue

**Files:**
- Create: `server/detectors.ts`, `server/opportunities.ts`
- Test: `server/test/opportunities.test.ts`

**Interfaces:**
- Consumes: `DB`, `openDb`, `seed`, `HERO_ID` (Task 1).
- Produces:
  - `type Opportunity = { type: string; key: string; estValue: number; payload: Record<string, unknown> }`
  - `type Detector = (db: DB, merchantId: string, at: Date) => Opportunity[]`
  - `udhaarOverdue: Detector` — open khata rows with whole days since `given_on` **> 7**; `type 'udhaar_overdue'`, `key 'khata:<id>'`, `estValue = amount`, `payload { khataId, customerName, amount, days }`.
  - `detectors: Detector[]` (`[udhaarOverdue]`; later sub-projects append).
  - `refreshOpportunities(db, merchantId, at): void` — runs detectors, `INSERT OR IGNORE` with status `new`.
  - `type OppRow = { id: number; merchantId: string; type: string; key: string; payload: any; estValue: number; status: string }`
  - `getOpportunity(db, id): OppRow | null`
  - `nextOpportunity(db, merchantId, at): OppRow | null` — refreshes; if a row is already `proposed` returns it; else the highest `est_value` `new` row, marked `proposed`.
  - `proposeOpportunity(db, merchantId, oppId): OppRow` — sets it `proposed` and any other `proposed` row of this merchant back to `new` (one proposal at a time).
  - `declineOpportunity(db, oppId): void` — `proposed` → `declined`.
  - `shouldInterrupt(db, merchantId, at): boolean` — false if any `customer` payment for the merchant in the 5 minutes before `at`.

- [ ] **Step 1: Write the failing test `server/test/opportunities.test.ts`**

```ts
const AT = new Date('2026-11-01T09:00:00+05:30');
// helper: fresh() opens :memory: and seeds at AT

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
  assert.equal(nextOpportunity(db, HERO_ID, AT)!.payload.customerName, 'Pinky didi');
});

test('refresh does not duplicate opportunities', () => {
  const db = fresh();
  refreshOpportunities(db, HERO_ID, AT); refreshOpportunities(db, HERO_ID, AT);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM opportunities').get().n, 2);
});

test('proposeOpportunity leaves only one proposal', () => {
  const db = fresh();
  const a = nextOpportunity(db, HERO_ID, AT)!;
  const other = db.prepare("SELECT id FROM opportunities WHERE id != ?").get(a.id).id;
  proposeOpportunity(db, HERO_ID, other);
  assert.equal(getOpportunity(db, a.id)!.status, 'new');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM opportunities WHERE status='proposed'").get().n, 1);
});

test('shouldInterrupt is false within 5 minutes of a customer payment', () => {
  const db = fresh();
  db.prepare("INSERT INTO payments(merchant_id,amount,ts,payer_hash,counterparty) VALUES(?,?,?,?, 'customer')")
    .run(HERO_ID, 50, new Date(AT.getTime() - 2 * 60_000).toISOString(), 'x');
  assert.equal(shouldInterrupt(db, HERO_ID, AT), false);
  assert.equal(shouldInterrupt(db, HERO_ID, new Date(AT.getTime() + 4 * 60_000)), true);
});
```
Note: the seed's last payments fall before 21:00 the previous day, so `AT` at 09:00 is quiet.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../detectors.ts`.

- [ ] **Step 3: Implement `server/detectors.ts` and `server/opportunities.ts`** per the Interfaces block. `payload` is stored as JSON text and parsed on read.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: udhaar detector and opportunity queue"
```

---

### Task 3: Confirm-gated execution: WhatsApp reminder with pay link

**Files:**
- Create: `server/actions.ts`, `server/whatsapp.ts`
- Modify: `server/opportunities.ts` (add `confirmOpportunity`)
- Test: `server/test/actions.test.ts`

**Interfaces:**
- Consumes: `OppRow`, `getOpportunity`, `nextOpportunity` (Task 2).
- Produces:
  - `type SendWhatsApp = (to: string, text: string) => Promise<{ sent: boolean; error?: string }>`
  - `makeSendWhatsApp(env: { WA_TOKEN?: string; WA_PHONE_ID?: string; WA_GRAPH_VERSION?: string }): SendWhatsApp` — missing token/id → `{ sent: false, error: 'not_configured' }`; otherwise `fetch` POST `https://graph.facebook.com/${version}/${phoneId}/messages` with `{ messaging_product: 'whatsapp', to: <digits only>, type: 'text', text: { body, preview_url: true } }`, `AbortSignal.timeout(5000)`; non-2xx or throw → `{ sent: false, error }`. Never throws.
  - `type AnthropicLike = { messages: { create(params: any): Promise<any> } }`
  - `type Deps = { sendWhatsApp: SendWhatsApp; publicUrl: string; anthropic?: AnthropicLike }`
  - `type ActionResult = { line: string; payUrl?: string }`
  - `class NotProposedError extends Error`
  - `confirmOpportunity(db, oppId, deps, at): Promise<ActionResult>` — throws `NotProposedError` unless status is `proposed`; sets `accepted`; inserts an `actions` row (tool = executor name, args = payload); runs `executors[opp.type]`; stores result; sets `done`. Status flips to `accepted` **before** any await so a concurrent second confirm fails.
  - `executors: Record<string, (db: DB, opp: OppRow, actionId: number, deps: Deps, at: Date) => Promise<ActionResult>>` with `udhaar_overdue` → `send_udhaar_reminder`: inserts `pay_links` (ref = `randomUUID().slice(0, 8)`, amount = khata amount, status `pending`), sends WhatsApp to the khata phone, returns `payUrl = ${publicUrl}/pay/${ref}`.

Exact copy:
- WhatsApp body: `Namaste ${customerName}, Ramesh Kirana se yaad dilaana tha: ₹${amount} baaki hain. Yahan aasaani se chuka dein: ${payUrl} (Munshi AI dwara bheja gaya)`
- Line when sent: `${customerName} ko reminder bhej diya.`
- Line when not sent: `WhatsApp nahi gaya. Yeh QR ${customerName} ko dikha dijiye.`

- [ ] **Step 1: Write the failing test `server/test/actions.test.ts`**

```ts
const sent: Array<[string, string]> = [];
const deps: Deps = { publicUrl: 'https://demo.test', sendWhatsApp: async (to, text) => { sent.push([to, text]); return { sent: true }; } };

test('confirm sends one reminder with a pay link and records the action', async () => {
  const db = fresh(); sent.length = 0;
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const r = await confirmOpportunity(db, opp.id, deps, AT);
  assert.match(r.payUrl!, /^https:\/\/demo\.test\/pay\/[0-9a-f]{8}$/);
  assert.equal(r.line, 'Sharma ji ko reminder bhej diya.');
  assert.equal(sent.length, 1);
  assert.ok(sent[0][1].includes('₹450') && sent[0][1].includes(r.payUrl!));
  assert.equal(getOpportunity(db, opp.id)!.status, 'done');
  assert.equal(db.prepare("SELECT tool FROM actions").get().tool, 'send_udhaar_reminder');
  assert.equal(db.prepare("SELECT amount FROM pay_links").get().amount, 450);
});

test('confirm rejects an opportunity that is not proposed', async () => {
  const db = fresh();
  refreshOpportunities(db, HERO_ID, AT);
  const id = db.prepare("SELECT id FROM opportunities LIMIT 1").get().id;
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../actions.ts`.

- [ ] **Step 3: Implement `server/whatsapp.ts`, `server/actions.ts`, and `confirmOpportunity`** per the Interfaces block. Put `NotProposedError`, `Deps`, `ActionResult`, `AnthropicLike` in `actions.ts`; `confirmOpportunity` lives in `opportunities.ts` and imports executors from `actions.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: confirm-gated udhaar reminder with WhatsApp and pay link"
```

---

### Task 4: Payment, ledger, announcement

**Files:**
- Create: `server/payments.ts`, `server/ledger.ts`
- Test: `server/test/payments.test.ts`

**Interfaces:**
- Consumes: `confirmOpportunity`, `Deps` (Task 3).
- Produces:
  - `getPayLink(db, ref): { ref: string; merchantName: string; customerName: string; amount: number; status: 'pending' | 'paid' } | null`
  - `payLink(db, ref, at): { alreadyPaid: boolean; announcement: string } | null` — `null` for unknown ref. In one transaction: `UPDATE pay_links SET status='paid' WHERE ref=? AND status='pending'`; if 0 rows changed → `{ alreadyPaid: true }` with no other writes. Otherwise insert a `customer` payment (`payer_hash` = first 12 hex of SHA-256 of the khata phone), set khata `paid`, insert ledger `{ kind: 'udhaar_recovered', amount, label: '${customerName} ka udhaar wapas', action_id }`.
  - `recordWalkin(db, merchantId, amount, at): string` — inserts a `customer` payment with a random `payer_hash`; returns `₹${amount} prapt hue`.
  - `getLedger(db, merchantId, at, days = 7): { total: number; items: Array<{ kind: string; amount: number; label: string; ts: string; tool: string }> }` — ledger rows in the window, newest first, `tool` joined from `actions`.

Exact copy: announcement `${customerName} ne ₹${amount} chuka diye`.

- [ ] **Step 1: Write the failing test `server/test/payments.test.ts`**

```ts
async function remindSharma() {
  const db = fresh();
  const opp = nextOpportunity(db, HERO_ID, AT)!;
  const { payUrl } = await confirmOpportunity(db, opp.id, deps, AT);
  return { db, ref: payUrl!.split('/').pop()! };
}

test('paying a link announces, closes khata, and writes one ledger line', async () => {
  const { db, ref } = await remindSharma();
  assert.deepEqual(getPayLink(db, ref), { ref, merchantName: 'Ramesh Kirana', customerName: 'Sharma ji', amount: 450, status: 'pending' });
  const r = payLink(db, ref, AT)!;
  assert.deepEqual(r, { alreadyPaid: false, announcement: 'Sharma ji ne ₹450 chuka diye' });
  assert.equal(db.prepare("SELECT status FROM khata WHERE customer_name='Sharma ji'").get().status, 'paid');
  const l = getLedger(db, HERO_ID, AT);
  assert.equal(l.total, 450);
  assert.deepEqual(l.items.map(i => [i.kind, i.label, i.tool]), [['udhaar_recovered', 'Sharma ji ka udhaar wapas', 'send_udhaar_reminder']]);
});

test('paying twice is idempotent', async () => {
  const { db, ref } = await remindSharma();
  payLink(db, ref, AT);
  assert.equal(payLink(db, ref, AT)!.alreadyPaid, true);
  assert.equal(getLedger(db, HERO_ID, AT).total, 450);
  assert.equal(getPayLink(db, ref)!.status, 'paid');
});

test('unknown ref returns null', () => {
  assert.equal(payLink(fresh(), 'nope', AT), null);
  assert.equal(getPayLink(fresh(), 'nope'), null);
});

test('ledger excludes entries older than the window', async () => {
  const { db, ref } = await remindSharma();
  payLink(db, ref, AT);
  assert.equal(getLedger(db, HERO_ID, new Date(AT.getTime() + 8 * DAY)).total, 0);
});

test('walk-in payment announces amount', () => {
  assert.equal(recordWalkin(fresh(), HERO_ID, 120, AT), '₹120 prapt hue');
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test`, FAIL: cannot find module `../payments.ts`.
- [ ] **Step 3: Implement `server/payments.ts` and `server/ledger.ts`** per the Interfaces block.
- [ ] **Step 4: Run to verify it passes** — `npm test`, all passing.
- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: idempotent pay links, walk-ins, rupee ledger"
```

---

### Task 5: Phrasing, reply classification, and the propose-only agent

**Files:**
- Create: `server/phrase.ts`, `server/tools.ts`, `server/agent.ts`
- Test: `server/test/agent.test.ts`

**Interfaces:**
- Consumes: `OppRow`, `nextOpportunity`, `proposeOpportunity`, `declineOpportunity`, `confirmOpportunity`, `getOpportunity` (Tasks 2–3); `getLedger` (Task 4); `Deps`, `AnthropicLike`, `ActionResult` (Task 3).
- Produces:
  - `template(opp: OppRow): string` — for `udhaar_overdue`: `${customerName} ka ₹${amount} udhaar ${days} din se baaki hai. Reminder bhej doon?`
  - `phrase(opp: OppRow, anthropic?: AnthropicLike): Promise<string>` — cache `Map` keyed by `template(opp)`; on miss, asks Claude to rewrite the template as a warm one-to-two-sentence Hinglish line keeping every number and name; 4-second timeout; any failure or no client → template. Only successful Claude output is cached.
  - `classifyReply(text: string): 'yes' | 'no' | 'other'`
  - `toolDefs: Array<{ name: string; description: string; input_schema: object }>` for `get_opportunities`, `explain_opportunity { id: number }`, `get_ledger { days?: number }`, `send_udhaar_reminder { khata_id: number }`.
  - `runTool(db, merchantId, at, name: string, input: any): unknown` — JSON-serializable. `get_opportunities` → refresh then `{ id, type, estValue, payload }[]` for `new`/`proposed`; `explain_opportunity` → that row's type, payload, estValue; `get_ledger` → `getLedger`; `send_udhaar_reminder` → find/create the opportunity for `khata:<id>`, `proposeOpportunity`, return `{ status: 'needs_confirmation', opportunityId, line: template(opp) }`. It never executes.
  - `converse(db, merchantId, text, at, deps: Deps): Promise<ActionResult & { opportunityId?: number }>`:
    - `yes` + a `proposed` opportunity → `confirmOpportunity`.
    - `no` + a `proposed` opportunity → `declineOpportunity`, line `Theek hai, rehne dete hain.`
    - otherwise, with `deps.anthropic` → agent loop: `messages.create({ model: 'claude-sonnet-5-5', max_tokens: 300, system, tools: toolDefs, messages })`, execute `tool_use` blocks via `runTool`, at most 4 rounds, return final text as `line` plus `opportunityId` if a tool proposed one.
    - otherwise → line `Maaf kijiye, samajh nahi aaya. Haan ya Nahi dabaiye.`
  - System prompt (exact): `Aap Munshi hain, Ramesh Kirana ke AI business partner. Hamesha Hinglish (Roman script) mein 1-2 chhote vaakya bolein. Tools se hi data lein, kabhi andaaza na lagayein. Aap koi kaam khud nahi karte: kaam ke liye tool sirf prastaav banata hai, aur dukaandaar ke "haan" kehne par hi kaam hota hai. Kabhi mat kahiye ki kaam ho gaya.`

`classifyReply` patterns (case-insensitive, trimmed, matches whole words):
```ts
const YES = /^(haan|haa|han|ha|hanji|haanji|ji haan|yes|ok|okay|theek hai|thik hai|kar do|bhej do|हाँ|हां|हा|जी हाँ|जी हां|ठीक है|भेज दो|कर दो)(\s+ji|\s+जी)?[.!]*$/i;
const NO  = /^(nahi|nahin|na|no|mat|rehne do|नहीं|नही|ना|मत|रहने दो)(\s+ji|\s+जी)?[.!]*$/i;
```

- [ ] **Step 1: Write the failing test `server/test/agent.test.ts`**

```ts
test('classifyReply handles Roman and Devanagari', () => {
  for (const t of ['haan', 'Haan ji', 'हाँ', 'हां जी', 'theek hai', 'bhej do']) assert.equal(classifyReply(t), 'yes', t);
  for (const t of ['nahi', 'नहीं', 'rehne do']) assert.equal(classifyReply(t), 'no', t);
  for (const t of ['kitna udhaar hai?', 'haan par kal bhejna']) assert.equal(classifyReply(t), 'other', t);
});

test('phrase falls back to template without a client or on failure', async () => {
  const opp = nextOpportunity(fresh(), HERO_ID, AT)!;
  assert.equal(await phrase(opp), 'Sharma ji ka ₹450 udhaar 12 din se baaki hai. Reminder bhej doon?');
  const broken = { messages: { create: async () => { throw new Error('down'); } } };
  assert.equal(await phrase(opp, broken), template(opp));
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
  const khataId = db.prepare("SELECT id FROM khata WHERE customer_name='Pinky didi'").get().id;
  let round = 0;
  const fake = { messages: { create: async () => round++ === 0
    ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'send_udhaar_reminder', input: { khata_id: khataId } }] }
    : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Pinky didi ko reminder bhej doon?' }] } } };
  const r = await converse(db, HERO_ID, 'Pinky didi ko yaad dilao', AT, { ...deps, anthropic: fake });
  assert.equal(r.line, 'Pinky didi ko reminder bhej doon?');
  assert.equal(getOpportunity(db, r.opportunityId!)!.status, 'proposed');
  assert.equal(sent.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM actions').get().n, 0);
});

test('no merchant-facing tool output contains payer_hash values', () => {
  const db = fresh();
  const hashes = db.prepare('SELECT DISTINCT payer_hash h FROM payments').all().map((r: any) => r.h);
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
```

- [ ] **Step 2: Run to verify it fails** — `npm test`, FAIL: cannot find module `../agent.ts`.
- [ ] **Step 3: Load the `claude-api` skill, then implement `server/phrase.ts`, `server/tools.ts`, `server/agent.ts`** per the Interfaces block. In the agent loop, append the assistant `content` and a `user` turn of `tool_result` blocks each round.
- [ ] **Step 4: Run to verify it passes** — `npm test`, all passing.
- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: Hinglish phrasing, reply classifier, propose-only agent"
```

---

### Task 6: HTTP server, SSE, control endpoints, finale API test

**Files:**
- Create: `server/events.ts`, `server/app.ts`, `server/main.ts`
- Test: `server/test/finale.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces:
  - `type SoundboxEvent = { type: 'announce'; text: string } | { type: 'brief' } | { type: 'ledger' }`
  - `events.ts`: `publish(e: SoundboxEvent): void`, `subscribe(res: ServerResponse): void` (SSE, `data: <json>\n\n`, removes on close), `onEvent(fn: (e: SoundboxEvent) => void): () => void` (in-process listener, returns unsubscribe).
  - `createApp(db: DB, deps: Deps & { demoPhone?: string }): http.Server` — routes (JSON in/out; uses `now()` from `clock.ts` for `at`):

| Method + path | Behavior |
|---|---|
| `GET /api/events` | SSE stream |
| `POST /api/next` | body `{ interrupt?: boolean }`; if `interrupt` and `!shouldInterrupt` → `{ id: null }`; else `nextOpportunity` → `{ id, line: await phrase(opp, deps.anthropic) }` or `{ id: null }` |
| `POST /api/opportunities/:id/confirm` | `confirmOpportunity` → `ActionResult`; `NotProposedError` → 409 `{ error: 'not_proposed' }` |
| `POST /api/opportunities/:id/decline` | → `{ line: 'Theek hai, rehne dete hain.' }`; not proposed → 409 |
| `POST /api/converse` | body `{ text }` (missing → 400) → `converse(...)` |
| `GET /api/pay/:ref` | `getPayLink` or 404 |
| `POST /api/pay/:ref` | `payLink`; null → 404; if not `alreadyPaid` publish `announce` then `ledger` → `{ alreadyPaid }` |
| `GET /api/ledger` | `getLedger(db, HERO_ID, now())` |
| `POST /api/control/reset` | `resetClock()`, `seed(db, now(), { demoPhone })`, publish `ledger` → `{ ok: true }` |
| `POST /api/control/advance` | body `{ minutes }` → `advance` → `{ now }` |
| `POST /api/control/brief` | publish `brief` → `{ ok: true }` |
| `POST /api/control/walkin` | body `{ amount }` → `recordWalkin`; publish `announce` → `{ ok: true }` |
| other `GET` | serve file from `web/dist`, else `web/dist/index.html`; if `web/dist` missing → 404 |

  - `main.ts`: open `munshi.db`, seed with `now()`, build `Deps` from env (`makeSendWhatsApp(process.env)`, `publicUrl: PUBLIC_URL ?? 'http://localhost:3000'`, `anthropic` only if `ANTHROPIC_API_KEY`), warm phrases (`refreshOpportunities` then `phrase` for each `new` row, without awaiting the listen), listen on `PORT ?? 3000`, log the URL.

- [ ] **Step 1: Write the failing test `server/test/finale.test.ts`**

```ts
test('finale core loop over HTTP', async () => {
  const db = openDb(':memory:'); seed(db, now());
  const server = createApp(db, deps).listen(0);
  const base = `http://localhost:${(server.address() as any).port}`;
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
  } finally { off(); server.close(); }
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test`, FAIL: cannot find module `../app.ts`.
- [ ] **Step 3: Implement `server/events.ts`, `server/app.ts`, `server/main.ts`** per the Interfaces block. Route matching is a small regex table; no framework.
- [ ] **Step 4: Run to verify it passes** — `npm test`, all passing.
- [ ] **Step 5: Smoke-run the server** — `npm run server`, then `curl -X POST http://localhost:3000/api/next`. Expected: JSON with a Sharma ji line. Stop the server.
- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat: HTTP API, SSE events, demo control, finale API test"
```

---

### Task 7: Soundbox web client

**Files:**
- Create: `vite.config.ts`, `web/index.html`, `web/main.tsx`, `web/api.ts`, `web/speech.ts`, `web/styles.css`, `web/Soundbox.tsx`
- Modify: `package.json` (web deps)

**Interfaces:**
- Consumes: the HTTP API and `SoundboxEvent` (Task 6).
- Produces:
  - `web/api.ts`: `api.next(interrupt?: boolean)`, `api.confirm(id)`, `api.decline(id)`, `api.converse(text)`, `api.getPay(ref)`, `api.pay(ref)`, `api.ledger()`, `api.control(action, body?)`, and `onEvents(fn): () => void` (wraps `EventSource('/api/events')`).
  - `web/speech.ts`: `speak(text: string): Promise<void>` (`speechSynthesis`, `lang 'hi-IN'`, prefers a `hi-IN` voice, resolves on end or after 15 s); `listen(): Promise<string>` (`webkitSpeechRecognition`/`SpeechRecognition`, `lang 'hi-IN'`, single result; resolves `''` if unsupported or on error).
  - `web/main.tsx`: picks the page by `location.pathname` prefix (`/soundbox`, `/pay/`, `/ledger`, `/control`; `/` → Soundbox). No router library.

Soundbox behavior:
- Before the first tap: a full-screen **"Dukaan kholo"** button; nothing speaks until it is tapped (unlocks audio).
- Device face: dark rounded body, Paytm-blue (`#00BAF2`) accent, large current line text, always-visible **Haan** / **Nahi** buttons (enabled only while an opportunity is pending), a mic button.
- Brief (on tap of "Dukaan kholo" and on SSE `brief`): speak `Suprabhat Ramesh ji! Aaj ke kaam sunaata hoon.`, then loop: `api.next()` → speak line → wait for Haan / Nahi / mic → `confirm`/`decline` or `converse` → speak result line → repeat until `id: null` or 3 opportunities handled (spec: brief = top 3) → speak `Bas itna hi. Aapka din shubh ho!`.
- Mic: `listen()` → `api.converse(text)` → speak `line`.
- When a result has `payUrl`, show it as a QR code (`qrcode` `toDataURL`) with the caption `Scan karke chukayein` until the next opportunity.
- SSE `announce` → show and speak the text (queued behind any current speech).
- Idle interrupt: every 60 s with no pending opportunity and no speech, `api.next(true)`; if it returns a line, run one loop iteration.

- [ ] **Step 1: Install web deps** — `npm i react react-dom qrcode` and `npm i -D vite @vitejs/plugin-react @types/react @types/react-dom @types/qrcode`. `vite.config.ts`: `root: 'web'`, `build.outDir: 'dist'` (relative to root → `web/dist`), `server.proxy: { '/api': 'http://localhost:3000' }`, `plugins: [react()]`.
- [ ] **Step 2: Implement the files above.**
- [ ] **Step 3: Build** — `npm run build`. Expected: exits 0, `web/dist/index.html` exists.
- [ ] **Step 4: Verify in the browser** — run `npm run server` and `npm run dev`, open `http://localhost:5173/soundbox` in the browser pane:
  - Fresh load shows only "Dukaan kholo"; no speech has been attempted (check console: no `speechSynthesis` errors).
  - Tap it → the Sharma ji ₹450 line appears; Haan → "Sharma ji ko reminder bhej diya." or the QR line, and a QR code appears.
  - `curl -X POST localhost:3000/api/control/walkin -H "content-type: application/json" -d "{\"amount\":120}"` → "₹120 prapt hue" appears.
- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts web
git commit -m "feat: Soundbox web client with Hindi voice and Haan/Nahi"
```

---

### Task 8: Pay, Ledger, and Control pages

**Files:**
- Create: `web/Pay.tsx`, `web/Ledger.tsx`, `web/Control.tsx`
- Modify: `web/main.tsx`, `web/styles.css`

**Interfaces:**
- Consumes: `api`, `onEvents` (Task 7).

Pages:
- **`/pay/:ref`** (phone-first): merchant name, `₹${amount}`, `${customerName}`, a **Pay ₹450**-style button labelled `Pay ₹${amount}` → `api.pay(ref)` → green tick + `Payment safal!`. If the link is already `paid` on load or the POST returns `alreadyPaid` → `Yeh bhugtaan pehle hi ho chuka hai.` Unknown ref → `Link galat hai.` Button disables while the request is in flight. Footer: `Demo payment — koi asli paisa nahi katega.`
- **`/ledger`**: heading `Is hafte Munshi ne aapko dilaye`, big `₹${total}`, list of items (`label`, `₹amount`, time, small `tool` tag). Refetches on SSE `ledger`.
- **`/control`**: buttons Reset demo, Shop opens (brief), Walk-in ₹120, Advance 10 min; shows the last response JSON.

- [ ] **Step 1: Implement the three pages and wire them in `web/main.tsx`.**
- [ ] **Step 2: Build** — `npm run build`, exits 0.
- [ ] **Step 3: Verify in the browser pane** with server + dev running:
  - `/control` → Reset; `/soundbox` → Dukaan kholo → Haan; open the QR's URL (replace host with `localhost:5173`) → Pay → Soundbox speaks "Sharma ji ne ₹450 chuka diye"; `/ledger` shows ₹450 without reload.
  - Reload the pay page → "Yeh bhugtaan pehle hi ho chuka hai."; `/pay/nope` → "Link galat hai."
  - Resize to mobile (375 px): pay page has no horizontal scroll.
- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat: pay page, live ledger, demo control panel"
```

---

### Task 9: Demo setup and rehearsal

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the whole app.

README sections (exact content decided here):
- **Run:** `npm i`, `npm run build`, `npm run server` (serves the built web app on port 3000).
- **Env:** each variable from Global Constraints with one line on what it does and what happens without it.
- **Public URL:** `cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`); set `PUBLIC_URL` to the printed URL and restart.
- **WhatsApp test number:** add each recipient (judge) number to the test number's allowed list in Meta's WhatsApp dashboard; the recipient must first send any message ("hi") to the test number, which opens the 24-hour window that allows the free-form reminder. Without that, the QR fallback is used.
- **Rehearsal checklist:** the Step 2 list below.

- [ ] **Step 1: Write `README.md`.**
- [ ] **Step 2: Full rehearsal with real Claude and WhatsApp** (team member's phone as Sharma ji):
  - Reset from `/control`; Soundbox on a phone/tablet in Chrome; tap Dukaan kholo; say "हाँ" by voice.
  - WhatsApp arrives on the phone within 5 s; tapping the link opens the pay page over the tunnel; Pay → Soundbox announces; `/ledger` shows ₹450.
  - Ask by voice "kitna udhaar baaki hai?" → a sensible Hinglish answer naming Pinky didi ₹230.
  - Unset `ANTHROPIC_API_KEY`, restart, repeat the brief → template lines, Haan still works.
  - Disconnect Wi-Fi on the server machine mid-demo → note which steps fail; confirm the QR path still works over the hotspot.
- [ ] **Step 3: Record a backup video** of the full rehearsal flow and keep it next to the deck.
- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: demo setup and rehearsal checklist"
```
