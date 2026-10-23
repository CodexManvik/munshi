# Munshi — the Soundbox that runs the shop

**Hackathon:** Paytm AI Hackathon (multi-round: idea/PPT → shortlisted teams build prototype → finale)
**Track:** 1 — Merchant Growth AI (with natural Track 2 lending and Track 3 agentic overlap)
**Goal:** Win first place.
**Date:** 2026-10-24

## 1. Understanding

**What the user said:** Win the hackathon outright. Team builds with Claude Code (2 instances, a third if shortlisted); strengths are web/React, backend + LLM agents, voice/WhatsApp. Claude builds autonomously, step by step.

**Context found:**
- Paytm's AI push is branded "Paytm Intelligence (Pi)"; leadership calls AI "a revenue line item".
- Stated priorities: SMBs, Tier-2/3 penetration, scaling merchant lending and insurance beyond payments. 4 crore+ merchants.
- **Paytm already shipped an AI Soundbox (Oct 2025)** that *answers* merchant questions about collections and trends in 11 languages. A Q&A copilot is therefore not novel.

**Assumptions:** Judges are Paytm product/business leaders; the finale is a live demo + pitch; no access to real Paytm APIs (everything is simulated).

**Positioning:** *"Paytm's AI Soundbox tells you what happened. Munshi makes it happen — and shows you the rupees."*

## 2. Product

Munshi watches a kirana's payment flow, detects money left on the table, proposes **one action in one Hindi voice line**, executes it on the merchant's "haan", and attributes the realized rupees in a ledger.

Pillars (user-selected):
1. **Network intelligence + group buying** — hyperlocal demand signals aggregated across nearby Paytm merchants; pooled distributor orders for bulk discounts. The "only Paytm can do this" moat.
2. **Invisible loyalty + win-back** — repeat customers counted by hashed UPI ID; rewards and win-back offers delivered through the Paytm consumer app. Merchant never sees customer identity.
3. **Shelf vision** — merchant sends a shelf photo on WhatsApp; Claude vision spots stock gaps and drafts a reorder.
4. **₹ outcome ledger** — every rupee recovered, earned, or saved traced to the action that caused it.
5. **Smart credit** — cash-gap detection triggers a pre-approved loan offer with true cost in plain Hindi; accepted by voice.

Explicitly out: voice cloning of the merchant; multi-agent orchestration; real Paytm integrations.

**Business model (for the deck):** free to merchants; funded by lending cross-sell, merchant/brand-funded offers, and consumer-app engagement.

## 3. Build order (each sub-project gets its own plan)

| # | Sub-project | Done when |
|---|---|---|
| 0 | Round-1 deck | Problem, Munshi vs AI Soundbox, pillars, privacy design, business model, demo storyboard |
| 1 | Core loop | Seeded data, detector engine, agent with tools, `/soundbox`, WhatsApp reminder, `/pay/:ref`, webhook → announcement → `/ledger`, `/control` |
| 2 | Shelf vision → reorder → group buy | Photo in on WhatsApp → inventory update → reorder proposal → group join with live member counter |
| 3 | Invisible loyalty + win-back | Loyalty rule fires on payment; lapsed-regulars detector; win-back via simulated Paytm push |
| 4 | Smart credit | `cash_gap` detector, `quote_loan` / `accept_loan`, settlement deduction shown in ledger |
| 5 | Paytm impact dashboard | `/paytm` projecting loan GMV, win-back revenue, engagement from 1 → 1 lakh merchants |

## 4. Architecture

**Approach:** deterministic detectors + one tool-using Claude agent.
- Detectors are plain functions `(db, merchantId, now) → Opportunity[]`, each with a ₹ estimate. They decide *what* to suggest — predictable, explainable, testable.
- Claude phrases opportunities in Hindi, interprets merchant replies, calls tools, and reads shelf photos.
- Payment webhooks close the loop into the ledger.

**Stack:** one Node/TypeScript backend, SQLite, one React (Vite) app with routes, Claude API, browser Web Speech API (`hi-IN`) for STT/TTS (Sarvam as swap-in if quality falls short), Meta WhatsApp Cloud API test number.

## 5. Data model (SQLite)

| Table | Key fields |
|---|---|
| `merchants` | id, name, category, locality, lat, lng, language |
| `payments` | id, merchant_id, amount, ts, payer_hash, counterparty (`customer` \| `distributor`) |
| `settlements` | merchant_id, date, amount |
| `khata` | id, merchant_id, customer_name, phone, amount, given_on, status |
| `inventory` | merchant_id, sku, name, est_qty, reorder_point, updated_at |
| `distributors` | id, name, sku, unit_price, group_tiers (JSON: min_members → discount %) |
| `group_orders` / `group_members` | id, distributor_id, sku, close_at, status / group_id, merchant_id, qty |
| `loan_offers` | id, merchant_id, principal, total_cost, daily_deduction, tenure_days, status |
| `loyalty_rules` | merchant_id, visits_required, reward_amount |
| `opportunities` | id, merchant_id, type, payload JSON, est_value, status (`new` → `proposed` → `accepted`/`declined` → `done`) |
| `actions` | id, opportunity_id, tool, args JSON, result JSON, ts |
| `ledger` | id, merchant_id, action_id, kind, amount, ts |

**Seed:** "Ramesh Kirana" + ~20 nearby shops, 90 days of history, Diwali spike in the final week. All scripted finale beats exist in the seed, including a pre-set loyalty rule (10 visits → ₹20) and one customer at 9 visits.

## 6. Detectors

| Detector | Fires when | ₹ estimate |
|---|---|---|
| `udhaar_overdue` | khata entry unpaid > 7 days | amount due |
| `stock_low` | est_qty ≤ reorder_point | days to restock × avg daily sales × margin |
| `local_demand_spike` | category sales within 2 km, last 7 days, ≥ 30% above 28-day avg, **≥ 5 shops in aggregate** | expected extra sales |
| `group_buy_open` | open group order covers an SKU this shop needs | saving vs solo order |
| `lapsed_regulars` | payer_hashes with ≥ 4 visits in prior 60 days, none in last 21 | avg basket × count × win-back rate |
| `cash_gap` | projected outflow (group order + restock) > projected settlements over next 7 days | loan principal |

**Timing:** morning brief = top 3 by ₹. Proactive interruptions only when no payment in the last 5 minutes.
**Loyalty** is an event rule on each incoming payment, not a detector.

## 7. Agent tools

| Tool | Effect | Needs "haan" |
|---|---|---|
| `get_opportunities`, `explain_opportunity`, `get_ledger` | read | no |
| `analyze_shelf_photo` | vision → inventory update | no |
| `send_udhaar_reminder` | WhatsApp message + UPI pay link | yes |
| `join_group_buy`, `place_order` | commit to distributor order | yes |
| `send_winback_offer` | simulated Paytm-app push, merchant-funded | yes |
| `set_loyalty_rule` | set visits → reward rule | yes |
| `quote_loan` | plain-Hindi cost breakdown | no |
| `accept_loan` | disburse, schedule daily deduction | yes |

**Hard rules, enforced in code:**
1. A confirm-required tool rejects unless a matching `proposed` opportunity exists and the merchant confirmed it.
2. No merchant-facing tool output contains `payer_hash` or customer identity from `payments`.
3. Network aggregates return nothing below 5 shops.

## 8. Surfaces

| Route / channel | Audience | Purpose |
|---|---|---|
| `/soundbox` | merchant (Android phone/tablet on stage) | device face; Hindi speech in/out; always-visible Haan / Nahi buttons |
| `/pay/:ref` | customer (judge's phone) | mock UPI page; pay → webhook → Soundbox announcement |
| `/ledger` | merchant | weekly ₹ earned, each line linked to its action |
| `/paytm` | judges | business impact projected to 1 lakh merchants |
| `/control` | team, offstage | advance clock, fire events, reset demo |
| WhatsApp | real phones | reminders out; shelf photos in |

## 9. Finale script (~5 min)

1. **0:00 Shop opens** — morning brief: Sharma ji's udhaar, Surf low, local diya/mithai spike.
2. **0:45 Udhaar** — "Haan" → WhatsApp to a judge → judge pays → *"Sharma ji ne ₹450 chuka diye"* → ledger +₹450.
3. **1:45 Shelf → group buy** — shelf photo → reorder → group order → counter: *"4 dukaanein judi, 8% bachat"*.
4. **2:45 Credit** — cash gap → ₹50k offer, true cost ₹1,240, ₹560/day from settlements → "Haan".
5. **3:30 Win-back + loyalty** — *"12 regulars nahi aaye, ₹15 offer?"* → "Haan"; a payment triggers a 10th-visit reward.
6. **4:15 Close** — `/ledger` week total → `/paytm` at 1 lakh merchants.

## 10. Failure handling

| Failure | Fallback |
|---|---|
| Hindi STT mishears | Haan / Nahi buttons always shown |
| WhatsApp fails / judge number unregistered | Soundbox shows QR for the same pay link |
| Claude slow or down | template Hindi line per opportunity type; scripted lines pre-generated and cached |
| Venue internet down | all local except Claude; phone hotspot; recorded backup video |
| Duplicate payment webhook | idempotent on payment ref |
| Shelf photo misread | detected items shown to merchant before reorder is proposed |

## 11. Testing (`node:test`, no framework)

- Each detector fires and stays silent on seeded fixtures.
- Confirm-required tools reject without confirmation.
- Merchant-facing tool outputs never contain `payer_hash`.
- Network aggregate with < 5 shops returns nothing.
- Full finale script with the LLM mocked asserts the final ledger total.
- Full rehearsal against real Claude before the event.
