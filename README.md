# Munshi

The Soundbox that runs the shop. Munshi spots money a kirana is leaving on the table, proposes one action in one Hinglish line, does it only on the merchant's "haan", and proves the result in rupees.

All data is synthetic demo data. No real money moves.

## Run

```bash
npm install
npm run build
npm run server
```

Open http://localhost:3000. Routes:

| Route | Who | What |
|---|---|---|
| `/soundbox` | merchant (phone or tablet on the counter, or a projector) | the device face: speaks, listens, Haan / Nahi, shelf photo |
| `/pay/:ref` | customer | mock UPI page opened from the WhatsApp link or QR |
| `/ledger` | merchant | rupees Munshi earned this week, each traced to its action; loan shown separately |
| `/paytm` | judges | the demo week projected across 1 to 10 lakh merchants (labelled synthetic) |
| `/control` | team, offstage | fire the finale beats on cue |

`npm test` runs the server test suite. `npm run dev` runs Vite on 5173 with `/api` proxied to 3000 (start the server too).

## Environment

Put these in `.env` (loaded automatically). Every one is optional; without it the demo falls back instead of failing.

| Variable | Does | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude rewrites lines warmly, answers spoken questions, reads shelf photos | template lines; spoken questions get "Haan ya Nahi dabaiye"; shelf photos need the `/control` demo beat |
| `MUNSHI_MODEL` | Claude model (default `claude-opus-5-5`, run at low effort) | default |
| `WA_TOKEN`, `WA_PHONE_ID` | send udhaar reminders on WhatsApp (Meta Cloud API) | the Soundbox shows a QR for the same pay link |
| `WA_GRAPH_VERSION` | Graph API version (default `v23.0`) | default |
| `WA_VERIFY_TOKEN` | verify token for the inbound webhook `/webhook/whatsapp` (shelf photos sent on WhatsApp) | webhook verification fails; use the Soundbox camera or `/control` |
| `PUBLIC_URL` | public URL used in WhatsApp links and QR codes | `http://localhost:3000`, which a judge's phone cannot open |
| `DEMO_CUSTOMER_PHONE` | Sharma ji's WhatsApp number, E.164 (e.g. `+9198…`) | a dummy number |
| `DEMO_KEY` | required on the merchant and control API when set; open each screen once with `?key=<DEMO_KEY>` (stored in the browser). The customer pay page never needs it | API open to anyone who has the tunnel URL |
| `PORT`, `MUNSHI_DB` | port (3000) and SQLite file (`munshi.db`) | defaults |

### Public URL

Phones must reach the server, so tunnel it and restart with the printed URL:

```bash
cloudflared tunnel --url http://localhost:3000
```

### WhatsApp test number

1. In Meta's WhatsApp dashboard, add each recipient (the judge playing Sharma ji) to the test number's allowed list.
2. The recipient sends any message ("hi") to the test number first. That opens the 24-hour window that allows Munshi's free-form reminder.
3. For shelf photos over WhatsApp, point the app's webhook at `PUBLIC_URL/webhook/whatsapp` with `WA_VERIFY_TOKEN`.

If any of this fails on stage, the QR on the Soundbox opens the same pay link.

## Finale script (about 5 minutes)

Open `/soundbox` on the stage device, `/control` on a laptop offstage, `/ledger` or `/paytm` on the projector. Press **Reset** in `/control` first.

1. **Shop opens.** Tap **Dukaan kholo**. The morning brief: Sharma ji's ₹450 udhaar, then the neighbourhood mithai spike, then Pinky didi. Say or tap **Haan** on Sharma ji. The WhatsApp reminder (or QR) goes out; the judge pays on their phone; the Soundbox announces *"Sharma ji ne ₹450 chuka diye"* and the week total ticks up.
2. **Shelf photo.** Tap the camera on the Soundbox (needs Claude) or press **Shelf photo** in `/control`. Munshi says Surf Excel and Parle-G are low and offers the Surf group order: 4 shops, 8% off. **Haan.**
3. **Credit.** Press **Munshi, aur kuch?** Munshi sees the ₹72,000 Diwali stock bill due in 3 days and offers a ₹50,000 loan: true cost ₹1,240, ₹570 a day from settlements. **Haan.**
4. **Win-back.** Press **Munshi, aur kuch?** again: 12 regulars have not come for 3 weeks; a ₹15 offer goes through the Paytm app without the merchant ever seeing who they are. **Haan.** Press **Purana grahak lauta**: one returns and spends ₹340.
5. **Loyalty.** Press **Pakka grahak aaya**: a regular's 10th visit triggers the reward announcement, again without naming the customer.
6. **Close.** Show `/ledger` (every rupee traced to the action that earned it, loan kept separate), then `/paytm` at 1,00,000 merchants.

Keyboard on the Soundbox: `H` = Haan, `N` = Nahi.

## Rehearsal checklist

- [ ] Reset, then run the full script on the real stage device in Chrome, with the venue network.
- [ ] Hindi voice: the Soundbox prefers a `hi-IN` voice, then `en-IN`. Check which one the device has.
- [ ] Say "हाँ" by voice once; tap once. Both confirm.
- [ ] WhatsApp reaches the judge's phone within 5 seconds and the link opens over the tunnel.
- [ ] Ask by voice "kitna udhaar baaki hai?" (needs Claude): a short Hinglish answer naming Pinky didi.
- [ ] Unset `ANTHROPIC_API_KEY`, restart, repeat the brief: template lines, Haan still works.
- [ ] Drop the server's Wi-Fi mid-run: note what fails; the QR path over a phone hotspot still works.
- [ ] Record a backup video of the full run.

## How it works

- `server/detectors.ts` and the feature modules (`inventory.ts`, `customers.ts`, `credit.ts`) look at the data and emit opportunities with a rupee estimate. The brief covers shop tasks; credit and win-back come as nudges.
- `server/opportunities.ts` is the only path to a side effect: `confirmOpportunity` refuses anything not currently proposed, so a double "haan" can never send twice.
- `server/agent.ts` lets Claude read and propose through tools, never execute.
- Customer identity (`payer_hash`) never leaves the server; network aggregates need at least 5 shops.
- Design: `docs/superpowers/specs/2026-10-24-munshi-design.md`; plans in `docs/superpowers/plans/`.
