# Product

<!-- impeccable:product-schema 1 -->

> Written unattended: the user asked for an autonomous build and was away. Facts come from the approved spec (`docs/superpowers/specs/2026-10-24-munshi-design.md`); lines marked *(inferred)* were not confirmed by the user.

## Platform

web

## Stack

delegated: React 18 + Vite, no UI libraries, served by the project's own Node server. Chosen in the approved implementation plan.

## Users

- **Merchant (primary):** a kirana owner in a Tier-2/3 Indian city (demo persona: Ramesh, Ramesh Kirana, Aliganj, Lucknow). Behind a busy counter, hands often full, reads Hindi more comfortably than English, does not open apps during the day. Uses Munshi through a Soundbox-style device face: listens, answers "haan" or "nahi", glances at a QR.
- **Customer:** a shop regular who owes udhaar (demo: Sharma ji). Receives a WhatsApp reminder and pays from a phone link.
- **Hackathon judges:** Paytm product and business leaders watching a live 5-minute finale on a projector and on their own phones. *(inferred)*
- **Demo operator:** a team member offstage driving the scripted beats from a control panel.

## Product Purpose

Munshi turns a merchant's payment device from something that reports what happened into a partner that makes money happen: it detects money left on the table, proposes one action in one Hinglish voice line, executes it only on the merchant's "haan", and proves the result in rupees. Success at the hackathon: first place; success for a merchant: rupees recovered or earned that the ledger can trace to Munshi's actions.

## Positioning

"Paytm's AI Soundbox tells you what happened. Munshi makes it happen, and shows you the rupees." It acts rather than answers, and it is built on network effects only a payments platform has (nearby-shop demand signals, group buying, privacy-preserving loyalty).

## Operating Context

- The Soundbox face runs on an Android phone or tablet on a shop counter (on stage: held up or projected). Voice in Hindi (`hi-IN`); tap fallback always available.
- The pay page opens on a customer's phone from a WhatsApp link, often over mobile data.
- The ledger is shown to the merchant and on the projector.
- The control panel is used offstage on a laptop or phone.

## Capabilities and Constraints

- Every side effect (message sent, money committed) requires the merchant's explicit confirmation.
- Customer identity from payments is never shown to the merchant.
- All money is whole rupees, written `₹450`.
- Payments are simulated; no real money moves. The pay page must say so.
- Speech output cannot start before a user gesture (browser rule).
- Must work with no LLM and no WhatsApp configured (template lines, QR fallback).

## Brand Commitments

- Name: **Munshi** (the traditional shop accountant/clerk).
- Voice: warm, respectful Hinglish in Roman script ("Ramesh ji", "aap"), one or two short sentences.
- Paytm-adjacent but not Paytm-branded: no Paytm logo, wordmark, or claim to be an official Paytm product. *(inferred)*

## Evidence on Hand

All data is synthetic demo data from `server/seed.ts` (Ramesh Kirana, 20 nearby shops, Sharma ji ₹450 udhaar). No real merchants, testimonials, metrics, or partnerships exist; none may be invented.

## Product Principles

1. Act, then prove: every suggestion carries a rupee value and every result lands in the ledger.
2. One thing at a time: one line, one decision, one big answer button.
3. The merchant's yes is sacred: nothing happens without it.
4. Works in a noisy shop: readable at arm's length, usable by voice or thumb.
5. Never leak a customer's identity.

## Accessibility & Inclusion

Low-literacy and Hindi-first users: large type, icon-plus-word buttons, voice in and out, high contrast for bright shop lighting. *(inferred)*
