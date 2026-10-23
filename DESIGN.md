---
name: Munshi
description: A shop-counter announcer that speaks in broadcast captions on studio indigo.
colors:
  indigo-950: "#0b1140"
  indigo-900: "#0f1650"
  indigo-800: "#141d5c"
  indigo-700: "#1c2875"
  indigo-600: "#283796"
  on-indigo: "#f7f8ff"
  on-indigo-dim: "#b8bfeb"
  indigo-rule: "rgb(247 248 255 / 0.16)"
  saffron: "#ffb000"
  saffron-hi: "#ffc533"
  saffron-ink: "#1d1400"
  money: "#2fbf78"
  money-ink: "#04210f"
  decline: "#ff5a5f"
  info: "#49c8ee"
  paper: "#f5f6fb"
  ink: "#11163a"
  ink-dim: "#4b5287"
  rule: "#d8dbee"
typography:
  display:
    fontFamily: "'Anek Latin Variable', 'Mukta', system-ui, sans-serif"
    fontSize: "clamp(64px, 20vw, 120px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 72"
  headline:
    fontFamily: "'Anek Latin Variable', 'Mukta', system-ui, sans-serif"
    fontSize: "clamp(26px, 7vw, 36px)"
    fontWeight: 650
    lineHeight: 1.16
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 82"
  title:
    fontFamily: "'Anek Latin Variable', 'Mukta', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
    fontVariation: "'wdth' 85"
  body:
    fontFamily: "'Mukta', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Mukta', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.45
  numeral:
    fontFamily: "'Anek Latin Variable', 'Mukta', system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 750
    fontFeature: "'tnum' 1, 'lnum' 1"
    fontVariation: "'wdth' 80"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  full: "999px"
spacing:
  gutter: "20px"
  gutter-wide: "32px"
  row: "16px"
  gap: "12px"
  stage-max: "560px"
  wrap-max: "720px"
components:
  button-ask:
    backgroundColor: "{colors.saffron}"
    textColor: "{colors.saffron-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0 22px"
    height: "56px"
  button-ask-hover:
    backgroundColor: "{colors.saffron-hi}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-indigo}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0 22px"
    height: "56px"
  button-plain:
    backgroundColor: "{colors.indigo-700}"
    textColor: "{colors.on-indigo}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0 22px"
    height: "56px"
  button-plain-hover:
    backgroundColor: "{colors.indigo-600}"
  button-round:
    backgroundColor: "{colors.indigo-700}"
    textColor: "{colors.on-indigo}"
    rounded: "{rounded.full}"
    size: "64px"
  button-round-active:
    backgroundColor: "{colors.saffron}"
    textColor: "{colors.saffron-ink}"
  caption-strip:
    backgroundColor: "{colors.indigo-700}"
    textColor: "{colors.on-indigo}"
    typography: "{typography.headline}"
    padding: "18px 20px 20px"
  caption-strip-ask:
    backgroundColor: "{colors.saffron}"
    textColor: "{colors.saffron-ink}"
  band-money:
    backgroundColor: "{colors.money}"
    textColor: "{colors.money-ink}"
    padding: "16px 20px"
  top-bar:
    backgroundColor: "{colors.indigo-950}"
    textColor: "{colors.on-indigo}"
    height: "52px"
  nav-link:
    textColor: "{colors.on-indigo-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 9px"
  nav-link-active:
    backgroundColor: "{colors.indigo-700}"
    textColor: "{colors.on-indigo}"
  input:
    backgroundColor: "{colors.indigo-900}"
    textColor: "{colors.on-indigo}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.indigo-700}"
    textColor: "{colors.on-indigo-dim}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.on-indigo}"
    textColor: "{colors.indigo-900}"
---

# Design System: Munshi

## Overview

**Creative North Star: "The Bulletin on Studio Indigo"**

Munshi speaks in India's broadcast grammar: Doordarshan and Akashvani bulletin captions laid over a studio-indigo set. The screen is a transmission, not a dashboard. Whatever Munshi is saying sits in one caption strip that wipes in from the left, word by word, keeping pace with the voice; whatever money arrives wipes across the full width as a green announcement band under the top bar. Everything else is quiet indigo, signal-white type, and 1px hairlines.

Density is low and deliberate: one line, one decision, one big answer. Type is condensed, heavy, and large enough to read at arm's length across a shop counter. Rupee figures are the loudest objects on any screen that shows them. Colour is a signal system borrowed from the broadcast test card: each ink carries exactly one meaning and is never spent on decoration.

The one exception to the indigo set is the customer's pay page, which sits on daylight paper under an indigo masthead, because it is opened outdoors on a phone and must read as a receipt in sunlight. The system refuses the category default of a white fintech card stack with a blue accent: no cards, no glass, no gradients.

**Key Characteristics:**
- Studio-indigo ground with signal-white type; daylight paper only for the customer pay page.
- Full-bleed caption strips and announcement bands that wipe in, square-edged, edge to edge.
- Condensed variable display face (Anek Latin, width axis 72 to 90%) over a plain Devanagari-friendly body face (Mukta).
- Monumental, tabular rupee numerals.
- Hairline-ruled lists instead of boxed rows.

## Colors

A deep indigo set lit by four test-card inks, each with one job.

### Primary
- **Bulletin Saffron** (saffron): Munshi is speaking or asking. The live proposal's caption strip, the primary answer button (Haan, Pay), the active mic, the transmission meter while speech plays, the amount awaiting payment on the pay page and beside the QR. Also the focus ring, text selection, and caret, which mark "where you act". Hover lifts to **Saffron Highlight** (saffron-hi); text on saffron is **Saffron Ink** (saffron-ink).

### Secondary
- **Money-In Green** (money): money has arrived. The announcement band, ledger and impact amounts, the weekly total in the bar, the live-connection dot, and the caption's top hairline when a line reports money. Text on green is **Money Ink** (money-ink).

### Tertiary
- **Declined Red** (decline): declined, failed, or offline. Failed control-log entries, the caption's top hairline on a decline line, the offline dot.
- **Signal Cyan** (info): system information. The default caption's 1px top hairline and the ledger's entry-kind labels.

### Neutral
- **Studio Indigo** (indigo-800): the page ground for every route except the pay page.
- **Control-Room Indigo** (indigo-950): the top bar.
- **Deep Set Indigo** (indigo-900): mastheads, the gate screen, input wells.
- **Raised Indigo** (indigo-700): resting caption strip, plain buttons, round tool buttons, the active nav pill, picker chips.
- **Lit Indigo** (indigo-600): hover state of indigo controls; scrollbar thumb.
- **Signal White** (on-indigo): primary type on indigo.
- **Dimmed Signal** (on-indigo-dim): secondary type, meta, labels, inactive nav.
- **Indigo Hairline** (indigo-rule): every divider and the ghost button's outline on indigo.
- **Daylight Paper** (paper), **Receipt Ink** (ink), **Receipt Ink Dim** (ink-dim), **Paper Rule** (rule): the pay page's ground, text, secondary text, and divider.

### Named Rules
**The One Ink, One Meaning Rule.** Saffron means Munshi is speaking or asking, green means money in, red means declined, cyan means system info. None is used as decoration. If an element is coloured, you must be able to say which of these four things it is reporting.

**The Active Layer Rule.** Only the live proposal sits on a saffron field. Every other caption rests on Raised Indigo with a 1px tone hairline across its top.

**The Daylight Exception Rule.** Daylight paper appears only on a surface a customer opens outdoors on their own phone. It still carries an indigo masthead, so the brand set is never absent.

## Typography

**Display Font:** Anek Latin Variable (with Mukta, system-ui)
**Body Font:** Mukta (with system-ui)

**Character:** A condensed broadcast-caption face, driven through its width axis, carries everything Munshi says and every number; Mukta carries the quiet supporting text in a warm, Hindi-friendly humanist voice.

### Hierarchy
- **Display** (800, clamp(64px, 20vw, 120px), 0.9, width 72%): the monument. The first rupee figure in a caption and the headline amount on ledger, impact, and pay mastheads. On projector widths (1024px+) it grows to clamp(96px, 9vw, 160px). Long figures (crores) may shrink to fit a phone but must remain the largest thing on the page.
- **Headline** (650, clamp(26px, 7vw, 36px), 1.16, width 82%): the caption line and masthead headlines. On projector widths it becomes clamp(40px, 3.6vw, 64px).
- **Title** (700, 22px, 1.15, width 85%): the small caption step. Section titles, control names, pay result headings, the announcement band, buttons.
- **Body** (Mukta 400, 17px, 1.45): supporting sentences, footnotes (cap at 60ch).
- **Label** (Mukta 600, 15px): navigation, list labels, status lines. Meta text drops to 14px in Dimmed Signal.
- **Numeral** (750, 26px, width 80%, tabular lining): right-aligned list amounts.

### Named Rules
**The Two-Step Caption Rule.** Every route shares one caption scale: the large step (headline) and the small step (title). New screens pick from these two before inventing a size.

**The Monumental Numeral Rule.** The rupee amount is the largest element on any screen that shows it. Only the first figure in a line goes monumental; later ones stay inline and bold.

**The Tabular Rule.** Every rupee figure, time, and count is set with tabular lining numerals, and list amounts align right.

## Layout

Mobile-first at 375px. A single centred column: 560px for the Soundbox stage, 720px for the working screens (ledger, control, impact, pay). Side gutter is 20px, widening to 32px from 768px. Caption strips and the announcement band break out of the gutter to run full-bleed, like a broadcast lower-third, while the content inside them stays on the gutter line.

The Soundbox stage is a three-row grid (status line, centred caption, answer zone) that fills the dynamic viewport, so the answer buttons sit at thumb height and nothing scrolls at 375x812. Answers are a two-column grid (12px gap); round tool buttons sit centred beneath them. At 1024px+ the stage widens to 1040px for projection while the answer row and QR stay capped at 640px.

Working screens open with a deep-indigo masthead (26px over, 30px under) and continue as hairline-ruled lists with 16px row padding. The top bar is 52px plus the safe-area inset, and its content aligns to the same column as the page below.

## Elevation & Depth

The world is flat broadcast graphics. Depth comes from tonal steps of indigo (950 bar, 900 masthead, 800 ground, 700 raised) and from motion, not from shadow. Two soft drops exist, both attached to the signal colours: a saffron glow under the primary answer button and a dark-green drop under the announcement band, so they read as lit above the set. Pulses are state, not decoration: a green ring on the live dot and a saffron ring on the listening mic.

### Shadow Vocabulary
- **Saffron lift** (`box-shadow: 0 6px 18px -8px rgb(255 176 0 / 0.65)`): the saffron answer button only.
- **Band drop** (`box-shadow: 0 10px 28px -14px rgb(4 33 15 / 0.7)`): the money announcement band only.
- **Tone hairline** (`box-shadow: inset 0 1px 0 <ink>`): the top edge of a resting caption strip, in info, money, or decline.

### Named Rules
**The Flat Set Rule.** Surfaces never float. Only the saffron action and the money band carry a drop, and only because they are signals.

## Shapes

Broadcast elements are square: caption strips and the announcement band have no radius and run edge to edge. Controls are touchable objects and are softly rounded: buttons 14px, inputs 10px, nav pills 8px, picker chips and tool buttons fully round. Dividers are 1px hairlines; there are no bordered containers and no cards. The ghost button's outline is a 2px inset hairline, not a border.

## Components

### Buttons
Big, condensed, and thumb-sized; they press in rather than lift.
- **Shape:** gently rounded (14px), 56px minimum height, 22px side padding, 24px icon plus word.
- **Ask (primary):** Bulletin Saffron with Saffron Ink, Saffron lift shadow. Hover to Saffron Highlight. Used for Haan and Pay only.
- **Ghost:** transparent with a 2px inset Indigo Hairline; hover brightens the outline to Dimmed Signal. Used for Nahi.
- **Plain:** Raised Indigo; hover to Lit Indigo. Used for operator actions.
- **Press / Disabled:** active scales to 0.97 over 160ms on the expo-out ease; disabled drops to 38% opacity.
- **Sizes in context:** answer row 68px tall at 26px; gate call-to-action 72px at 28px; control panel 48px at 19px.
- **Round tool:** 64px circle in Raised Indigo with a 28px icon and a Dimmed Signal label below. Listening turns it saffron with a pulsing ring.

### Chips
- **Style:** fully round, 40px, Raised Indigo with Dimmed Signal text, condensed 650 at 17px.
- **State:** selected inverts to Signal White with Deep Set Indigo text.

### Inputs / Fields
- **Style:** Deep Set Indigo well, 1px Indigo Hairline, 10px radius, 44px tall. Selects carry an inline Dimmed Signal chevron.
- **Focus:** the global 3px saffron outline at 3px offset.

### Navigation
- **Style:** a 52px Control-Room Indigo bar with a hairline base. Wordmark left (saffron base bar under four white level ticks, condensed 750 at 22px); links right in Mukta 600 at 15px, Dimmed Signal.
- **States:** hover brightens to Signal White; the current page sits on a Raised Indigo pill. Under 440px the wordmark drops to its mark when nav is present; links scroll horizontally.

### Lists (ledger, impact, control log)
- **Style:** no boxes. Each row has 16px vertical padding and a 1px Indigo Hairline below. Label left in Mukta 600 at 18px, meta beneath at 14px Dimmed Signal, amount right in the Numeral style in Money-In Green (Signal White when not earned income).

### Caption (signature)
The bulletin caption is the system's voice. A full-bleed strip in Raised Indigo with a 1px tone hairline on top, or solid saffron for the live proposal. On each new line the strip wipes in left to right (520ms clip-path, expo-out), then each word rises from blur in sequence, paced to speech (240ms lead, then one step per word). The first rupee figure becomes monumental inside the strip. A four-bar transmission meter beside the status line moves only while Munshi is talking.

### Announcement Band (signature)
Money in: a full-width Money-In Green band fixed directly under the top bar, coin icon plus a title-size line in Money Ink, wiping in over 700ms.

## Do's and Don'ts

### Do:
- **Do** put every spoken line in a caption strip and wipe it in; the wipe is the signature.
- **Do** keep the live proposal the only saffron field on screen.
- **Do** set rupee figures in tabular lining numerals, right-aligned in lists, with the headline figure as the largest element on the page.
- **Do** divide lists with 1px hairlines (Indigo Hairline on indigo, Paper Rule on paper).
- **Do** pick type from the two caption steps (clamp(26px, 7vw, 36px) and 22px) before adding a size.
- **Do** pair every button icon with a word, and keep primary actions at 56px or taller.
- **Do** honour reduced motion: all wipes, word reveals, pulses, and meters switch off.

### Don't:
- **Don't** use cards, glass, or gradients; the set is flat indigo with hairlines.
- **Don't** spend saffron, green, red, or cyan as decoration; each reports one thing.
- **Don't** use the daylight paper ground for anything a merchant, operator, or judge looks at.
- **Don't** round caption strips or the announcement band; broadcast graphics run square and edge to edge.
- **Don't** add drop shadows beyond the saffron lift and the band drop.
