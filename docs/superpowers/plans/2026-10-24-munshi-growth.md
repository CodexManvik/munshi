# Munshi Growth Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build spec sub-projects 2–5 on top of the core loop: shelf vision → reorder → group buy, network demand signals, invisible loyalty + win-back, smart credit, and the Paytm impact dashboard.

**Architecture:** Same shape as the core loop. Each feature adds tables to `server/db.ts`, seed rows to `server/seed.ts`, a detector to `detectors.ts`, a template to `phrase.ts`, and an executor to `actions.ts`. Every side effect still runs only through `confirmOpportunity`. Event rules (loyalty, win-back returns) live in `server/payments.ts` on incoming payments.

**Tech Stack:** As in the core plan. Vision uses Claude image input (base64) via the same `AnthropicLike` adapter.

**Spec:** `docs/superpowers/specs/2026-10-24-munshi-design.md` (sections 2, 5–9; build-order rows 2–5)

## Global Constraints

- Everything in the core plan's Global Constraints still applies (strip-types rules, integer rupees, Hinglish copy, hard rules 1–2).
- Hard rule 3: any aggregate over other merchants returns nothing when fewer than 5 shops are in the group.
- Customer identity never leaves the server: loyalty and win-back use `payer_hash` internally only; merchant-facing payloads carry counts.
- Group tiers for the demo distributor: 2–3 members 4%, 4+ members 8%.
- Loan terms: tenure 90 days, total cost `round(principal × 0.0248)`, daily deduction `ceil((principal + cost) / 90)`, principal = gap rounded up to the next ₹10,000.
- Projections on `/paytm` are labelled as projections of this demo's synthetic week; no real metrics are invented.

## Review Focus

1. **Group order reaches the 8% tier only after the hero joins** — the member count shown must include the hero exactly once, even if "join" is confirmed twice. Pinned in G2.
2. **A network aggregate built from 4 shops** must return nothing, not a spike. Pinned in G3.
3. **Shelf photo with no Claude key** must still let the demo proceed (canned detection from `/control`), and a real photo without vision gives a clear line, never a crash. Pinned in G4.
4. **Loyalty reward fires on exactly the 10th visit**, not the 11th, and its announcement never names the customer. Pinned in G5.
5. **Accepting the loan twice** disburses once. Pinned in G6 (falls out of the confirm gate; test it anyway).

---

### G1: Schema and seed for growth features

**Files:** Modify `server/db.ts`, `server/seed.ts`. Test: `server/test/seed.test.ts`.

Tables (add to `SCHEMA` and `TABLES`):
- `inventory(merchant_id, sku, name, unit_price, daily_units, est_qty, reorder_point, updated_at, PRIMARY KEY (merchant_id, sku))`
- `distributors(id TEXT PK, name)`; `distributor_skus(distributor_id, sku, unit_price, tiers TEXT)` — tiers JSON `[{"min":2,"pct":4},{"min":4,"pct":8}]`
- `group_orders(id INTEGER PK, distributor_id, sku, close_at, status CHECK IN ('open','closed'))`; `group_members(group_id, merchant_id, qty, UNIQUE(group_id, merchant_id))`
- `orders(id INTEGER PK, merchant_id, distributor_id, sku, qty, total, discount_pct, group_id, due_on, status CHECK IN ('placed','due','paid'), ts)`
- `loyalty_rules(merchant_id PK, visits_required, reward_amount)`
- `winback_campaigns(id INTEGER PK, merchant_id, action_id, offer, count, ts)`; `winback_targets(campaign_id, payer_hash, returned_at)`
- `loans(id INTEGER PK, merchant_id, action_id, principal, total_cost, daily_deduction, tenure_days, status, ts)`

Seed (hero unless stated):
- Inventory: `surf_1kg` Surf Excel 1kg ₹210, 3/day, est 2, reorder 6; `parle_g` Parle-G ₹10, 40/day, est 15, reorder 30; `tata_salt` Tata Salt 1kg ₹28, 6/day, est 24, reorder 10; `diya_pack` Mitti diye (12) ₹60, 2/day, est 6, reorder 4; `soan_papdi` Soan Papdi 250g ₹90, 2/day, est 8, reorder 4.
- Distributor `d_shree` "Shree Ganesh Traders" sells all five SKUs at 85% of shelf price; tiers on every SKU as above.
- One open group order on `surf_1kg` closing in 2 days with `m_n01`, `m_n04`, `m_n05` joined (qty 10 each).
- Diwali stock order: `orders` row status `due`, ₹72,000, due in 3 days.
- Loyalty rule 10 visits → ₹20; payer `hashPayer('m_ramesh:loyal')` with exactly 9 visits in the last 60 days.
- 12 lapsed regulars `hashPayer('m_ramesh:lapsed:<i>')`, 5 visits each between 30 and 70 days ago, none since.

Tests: seed creates the 5 SKUs and the group order with 3 members; loyal payer has exactly 9 visits; 12 lapsed payers have no visit in the last 21 days.

### G2: Stock and group-buy detectors and executors

**Files:** `server/detectors.ts`, `server/actions.ts`, `server/phrase.ts`, `server/tools.ts`. Test: `server/test/growth.test.ts`.

- `stockLow`: `est_qty <= reorder_point` and no open group order for the SKU. `key 'sku:<sku>'`, `estValue = round(daily_units × 2 × unit_price × 0.15)`, payload `{ sku, name, estQty, qty, distributor, total }` where `qty = reorder_point × 2 − est_qty`, `total = qty × distributor price`.
- `groupBuyOpen`: open group order for a SKU this shop holds at or below reorder point and has not joined. `key 'group:<id>'`, payload `{ groupId, sku, name, qty, members (after joining), pct (tier at members), saving, total }`, `estValue = saving`.
- Templates: stock — `${name} khatam hone wala hai, sirf ${estQty} bache. ${distributor} se ${qty} mangwa doon? ₹${total}.`; group — `${name} ka group order chal raha hai: aap judein toh ${members} dukaanein, ${pct}% bachat, ₹${saving} bachenge. Jud jaaun?`
- Executors: `place_order` (orders row `placed`, inventory `est_qty += qty`, line `${distributor} ko ${qty} ${name} ka order bhej diya, ₹${total}.`); `join_group_buy` (INSERT OR IGNORE member, order with discount, inventory refill, ledger `group_saving` amount saving label `${name} group order mein bachat`, line `Jud gaye! ${members} dukaanein, ${pct}% bachat, ₹${saving} bache.`).
- Tests: stock_low fires for Surf? No — Surf has an open group → group_buy_open fires instead; Parle-G (15 ≤ 30) → stock_low; confirm group → 4 members, ledger +saving; confirming twice → still 4 members (409 second time).

### G3: Local demand spike (network intelligence)

- `localDemandSpike`: for each category among `sweets`, `pooja`: shops within 2 km (haversine) excluding the hero; if fewer than 5 → skip; compare total customer payments last 7 days vs mean weekly total over days 8–35; uplift ≥ 30% → opportunity `key 'spike:<category>:<week>'`, related SKU (`pooja → diya_pack`, `sweets → soan_papdi`), payload `{ category, label, uplift, shops, sku, name, qty, total }`, `estValue = round(daily_units × 7 × unit_price × uplift/100)`. Executor reuses `place_order`.
- Template: `Aapke mohalle ki ${shops} dukaanon mein ${label} ki bikri ${uplift}% upar hai. ${name} ka stock badhaaun? ${qty} pack, ₹${total}.`
- Tests: fires for pooja with 5 shops and uplift ≥ 30; deleting one pooja shop → no pooja spike; payload has no merchant ids.

### G4: Shelf photo

- `server/shelf.ts`: `SHELF_SKUS` (the 5 hero SKUs); `applyShelfReading(db, merchantId, readings: Array<{ sku, level: 'empty'|'low'|'ok' }>, at): { line }` (empty → 0, low → reorder_point − 1, ok → unchanged; line `Shelf dekh li: ${names} kam hain.` or `Shelf dekh li, sab theek hai.`); `analyzeShelf(image: { data: base64, mediaType }, anthropic?)` → readings via Claude vision with a strict-JSON instruction, or throws `NoVisionError`.
- Routes: `POST /api/shelf` `{ image, mediaType }` → analyze + apply → `{ line }` (no vision → 503 `{ line: 'Photo dekhne ke liye AI chalu nahi hai.' }`); `POST /api/control/shelf` applies canned readings (`surf_1kg: empty`, `parle_g: low`) and publishes `brief`-less `announce`? No — returns `{ line }` and publishes `{ type: 'shelf', line }` so the Soundbox speaks it and asks the next proposal.
- WhatsApp inbound: `GET /webhook/whatsapp` verify (`hub.verify_token` = `WA_VERIFY_TOKEN`), `POST /webhook/whatsapp` image message → download media via Graph API → analyze → apply → publish `shelf`. Text-only or failures ignored with 200.
- Tests: `applyShelfReading` lines and quantities; canned control route returns the line and makes Surf/Parle-G low.

### G5: Invisible loyalty and win-back

- `recordCustomerPayment(db, merchantId, amount, payerHash, at): string[]` in `payments.ts` (announcements): inserts payment; if a loyalty rule exists and the payer's visit count is a positive multiple of `visits_required` → `Dhanyavaad! Yeh grahak ki ${n}vi khareed hai, agli baar ₹${reward} off.`; if the payer is an un-returned win-back target → mark returned, ledger `winback_sale` amount, label `Purana grahak lauta (₹${offer} offer)`, announcement `Ek purana grahak ₹${offer} offer se lauta! ₹${amount} ki khareed.`. `recordWalkin` becomes a wrapper with a random payer.
- `lapsedRegulars` detector: payers with ≥ 4 visits in days 21–81 before `at` and none in the last 21. `key 'lapsed:<week>'`, payload `{ count, avgBasket, offer: 15 }`, `estValue = round(avgBasket × count × 0.3)`.
- Executor `send_winback_offer`: campaign + targets (hashes stay server-side), line `${count} purane grahakon ko Paytm app par ₹${offer} ka offer bhej diya. Unki pehchaan aapko nahi dikhayi jaati.`
- Template: `${count} pakke grahak 3 hafte se nahi aaye. Unhe ₹${offer} ka offer bhejoon? Paytm app se jaayega, naam aapko nahi dikhega.`
- Control routes: `POST /api/control/regular` (the loyal payer pays ₹180), `POST /api/control/returning` (first un-returned target pays ₹340).
- Tests: 10th visit announces, 11th does not; announcement has no hash; win-back payload/tool output has no hashes; returning target writes one ledger line.

### G6: Smart credit

- `cashGap` detector: due orders within 7 days; `buffer = avg daily settlement (last 14 days) × days until due`; `gap = due − buffer`; if `gap > 0` → principal = ceil(gap / 10000) × 10000, payload `{ due, dueDays, gap, principal, cost, daily, tenure: 90 }`, `key 'gap:<orderId>'`, `estValue = principal` (ranked by need).
- Template: `${dueDays} din mein Diwali stock ka ₹${due} ka bill hai, paise ₹${gap} kam padenge. ₹${principal} ka loan le lein? Asli kharcha ₹${cost}, roz ₹${daily} settlement se katega.`
- Executor `accept_loan`: loans row, line `₹${principal} aapke khaate mein aa gaye. Roz ₹${daily} settlement se katega.`; publish announce.
- `getLedger` adds `loan: { principal, totalCost, dailyDeduction, tenureDays } | null` (not in `total`).
- Tests: principal ₹50,000 for the seed; accept twice → one loan; ledger total unchanged by the loan.

### G7: Paytm impact endpoint

- `GET /api/impact?merchants=100000` → `{ week: { recovered, groupSavings, winbackSales, loanGmv, offersDelivered, actions }, perMerchant, projected: { merchants, monthlyIncome, loanGmv, consumerReach } }` from this hero's last 7 days ×N (monthly = ×4.3). Labelled synthetic in the UI.
- Test: zeros on fresh seed; after the core loop payment, `recovered = 450` and `projected.monthlyIncome = round(450 × 4.3 × N)`.

### G8: UI for growth features

- Soundbox: shelf camera button (`<input type="file" accept="image/*" capture="environment">`) → `POST /api/shelf`; SSE `shelf` event speaks the line then asks the next proposal; type tag colour per opportunity type (udhaar saffron, stock/group cyan, spike info, lapsed, credit) shown under the caption rule.
- Ledger: loan section when `loan` exists; tool labels for new tools.
- Control: Shelf photo (demo), Regular grahak, Purana grahak lauta.
- `/paytm`: impact page (indigo shell, English-first for judges), merchant-count selector (1, 1,000, 1,00,000), labelled as projection of a synthetic demo week.
- Verify in browser at 375 and 1440; detector clean.
