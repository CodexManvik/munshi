---
version: 1
slug: "web"
primary_target: "web"
related_targets: []
---

# Munshi web surfaces

Scope: `/soundbox` (merchant device face), `/pay/:ref` (customer pay page), `/ledger` (rupees earned), `/control` (offstage demo panel). Mode: Operate. Mobile-first at 375px.

Audience and job: a kirana merchant hears one proposal and answers haan/nahi; a customer pays a reminder link; judges read the rupee result; an operator fires demo beats.

Constraints: unattended build, user away; code-led (no image generation); no Paytm logo or wordmark; Hinglish copy from the spec; payments are simulated and must say so.

## Direction contract

THESIS: The Soundbox is an announcer, so Munshi speaks in India's broadcast grammar: Doordarshan/Akashvani bulletin captions on studio indigo. It refuses the category default of a white fintech card stack with a blue accent.

OWN-WORLD: Studio-indigo shell (#141d5c family) with signal-white type; saffron caption strip for whatever Munshi is saying or asking; test-card state inks: green for money in, red for declined, cyan for system info. Anek Latin condensed for captions and numerals, Mukta for body. 1px hairlines, no cards, no glass, no gradients.

STORY: The merchant hears and reads one line, taps or says Haan, and watches the rupees land. The customer sees who is asking, how much, and that it is a demo. Judges see a total that grows with each action.

FIRST VIEWPORT: /soundbox at 375x812: thin indigo top bar (Munshi name, live dot, clock); the caption block centred, line at about 30px, any rupee amount inside it monumental; two full-width answer buttons, Haan in saffron and Nahi in an outline, at thumb height; a round mic under them; the QR replaces the answer row once a pay link exists. Below 812px everything still fits without scrolling.

FORM: Doordarshan/Akashvani broadcast graphics, my grounded list position 6 of 7, seed cb459d82. Signature move: the bulletin wipe, where each spoken line enters as a caption strip revealed word by word in sync with speech, and payment announcements wipe in as a full-width green band under the top bar (green = money in).

Raises (all six challengers declined):
- Tabular discipline, from Datamatics: every rupee figure uses tabular numerals and ledger amounts align right.
- One colour, one meaning, from the transit diagram: saffron means Munshi is speaking or asking, green means money in, red means declined, and none is used as decoration.
- Fixed scale, from the botanical folio: one caption scale is shared by every route.
- Hairline registration, from the plate section: 1px rules divide ledger rows and the control log instead of boxes.
- Active layer above terrain, from the orienteering map: only the live proposal sits on saffron.
- Monumental numerals, from the Crouwel specimen: the rupee amount is the largest element on any screen showing it.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
