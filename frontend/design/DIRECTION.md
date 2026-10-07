# EdgeProof landing page: direction

## Brief (self-authored from the product spec and DESIGN.md)

- **What and who:** the public landing page for EdgeProof, a free web app for forex beginners, traders who have blown accounts or failed prop challenges, and disciplined learners. The baseline device is a 360 px phone on a slow mobile connection in Lagos.
- **The one job:** in ten seconds a visitor understands that EdgeProof is a free, gated path that tests *their own* strategy honestly, then creates an account (or tries a lesson with no account).
- **Three words:** steady, honest, exact. References from outside the web: a hospital lab report with reference ranges, a flight simulator logbook, a canal lock flight.
- **What exists:** DESIGN.md (tokens, IBM Plex, the range bar), the spec. No photos, no users yet, so no testimonials, logos or user counts.
- **Image generation:** not used.

**Conflict with the skill, resolved for DESIGN.md:** the web-designer process wants the three explorations to differ in typeface and accent hue. DESIGN.md fixes both (IBM Plex; ink, chart paper and one amber). The explorations differ in ground, richness source, grammar and motion instead.

## The category default we refuse

Forex education sites share one look: black or navy ground, neon green candles, gold gradients, Lamborghinis, income screenshots, countdown timers, "join 10,000 traders", and a signal-group CTA. Prop firm sites add targets and timers. Fintech's fallback is navy plus trust green.

Slop faces this brief falls into naturally:
- **The Launch Page:** our ink is navy, and a tilted chart screenshot with a glow is the obvious hero. Refused: the hero is a real, readable verdict panel, flat, on chart paper.
- **The Paper Edition:** chart paper plus mono figures is close. Refused: the ground is cool grey, not warm; no italic accent word, no pill, no mono eyebrows, no black pill button, no stats strip.

## Three concepts

| | Concept | Ground | Richness | Grammar | Motion |
|---|---|---|---|---|---|
| A | EdgeProof is **a lab report**: a result printed with its reference range | light (chart paper) | live data: a verdict computed in the page | scroll-story | resampled results stack into a histogram, then the range settles |
| B | EdgeProof is **a flight simulator** before the licence | dark (ink) | an interactive tool | tool-first | sliders drive the result |
| C | EdgeProof is **a flight of canal locks**: you rise one gate at a time | surface | line drawing | poster | the path draws itself |

**Chosen: A.** Its first screen carries evidence (a verdict with its range), says what the product is, and shows something no forex site shows: "No edge found yet" as a good outcome. It puts DESIGN.md's signature element, the range bar, in the hero.
- **B lost** as a hero because a position-size slider explains one lesson, not the product. It returns as section 4, "Try the first simulator".
- **C lost** because a staircase on an empty page is a diagram without evidence. Its idea returns as section 3, the gated path.

## Tokens

All tokens come from DESIGN.md §3–§6 (`src/styles/tokens.css`). Nothing new is introduced.
- Ground `--bg` (chart paper), panels `--surface`, amber only for the primary action and the range-bar estimate.
- Type: IBM Plex Sans for words, IBM Plex Mono for figures only. Display 48/52 (32/36 phone), H2 24/32 (21/28), body 16/26.
- Radii: 16 px for the verdict panel, 10 px for buttons. No shadows (nothing floats).
- Widths: 1200 px page, 68ch text.

## Grammar: one question per section

1. **What is this?** Hero: headline, one paragraph, the action, and the example verdict.
2. **Why bother testing?** The odds, with sources.
3. **How does it work?** Five gates, each with the criteria that open it.
4. **Can I try it?** The Level 1 position-size simulator, live.
5. **What's the catch?** What EdgeProof never does, and what is ready today.
6. **Close:** start Level 1, plus the risk warning in the footer.

## Signature: the resampling

**Trigger:** the hero renders (and a "Replay" text button).
**Frames:** 10,000 bootstrap resamples of the 54 example trades arrive in their random order over 1.6 s and stack as dots into a histogram of possible expectancies (one dot ≈ 50 resamples). When the last resample lands, the range bar's whisker (5th to 95th percentile) and the amber estimate fade in over the zero line.
**Timing and easing:** 1,600 ms, ease-out (`cubic-bezier(0.2, 0, 0, 1)`), then 200 ms for the whisker.
**Why:** it shows where the range comes from, which is the brand's point (DESIGN.md §1: "we show you the uncertainty"). It explains a change; it doesn't decorate or celebrate money.
**Reduced motion:** the finished histogram and range render immediately.
**Note on DESIGN.md §6 ("no entrance animations"):** this isn't a section entrance; it is a one-time data explanation inside one panel, and it can be replayed. Flagged here so it can be vetoed.

## Voice

A coach who has blown accounts too: plain, direct, never selling. Describe, don't instruct.

## Content

**Nav:** EdgeProof (wordmark) · Sign in

**1. Hero**
- H1: Test your forex strategy before it costs you money
- Body: EdgeProof is a free course and testing lab. Learn the basics, write your own rules, then test them on market data you haven't seen. The verdict comes from code, and it always shows its uncertainty.
- Action: Create free account · text link: Try a lesson first, no account needed
- Panel: "Example verdict · London breakout, version 3 · validation run" / "No edge found yet" / "Validation expectancy was −0.07R across 54 trades. That's a useful result: it saved real money." / Expectancy −0.07R with range −0.35R to +0.23R / "Each dot is 50 of 10,000 resamples of these 54 trades." / checks: Validation trades at least 50 (54, met) · Expectancy at least +0.10R (−0.07R, not met) · Profit factor at least 1.25 (0.89, not met) · Range lower bound above zero (−0.35R, not met) / "Replay the resampling"

**2. The odds**
- H2: Most retail traders lose money. Few of them ever tested their rules.
- 74–89%: of retail CFD accounts lose money, according to Europe's securities regulator, ESMA.
- 97%: of Brazilian day traders who kept going for more than 300 days lost money, with no sign they learned by trading (Chague, De-Losso and Giovannetti).
- EdgeProof has no secret to sell you. It gives you a process: learn, write rules, test them honestly, and only then risk money.

**3. Five gates**
- H2: Five gates, each opened by your own data
- Gate 1, Your plan: a 3-minute setup about your hours, sessions and history. Accept the plan to open the Academy.
- Gate 2, The Academy: seven levels, from pips and margin to strategy design. Pass each level exam at 80%, or skip a level with a 90% placement score.
- Gate 3, Your rulebook: every setup rule is a structured condition with a valid and an invalid example. Words like "strong" or "looks like" don't pass.
- Gate 4, Unseen data: at least 100 development and 50 validation trades, costs included. Expectancy of +0.10R or more, and a range whose lower bound stays above zero.
- Gate 5, Demo forward test: 50 or more trades over at least 8 weeks, following your rules on 90% of them.
- After the gates: real money at 0.25% risk per trade for 30 trades, before any larger step.

**4. Try it**
- H2: Try the first simulator
- Position size comes from your stop, not from how sure you feel. Move the stop and watch the size change while the risk stays the same.
- Link: Open the full lesson

**5. What it won't do**
- H2: What EdgeProof will never do
- No trade calls and no copy trading. You build your own strategy.
- No referral money from brokers or prop firms, so nothing here is steered by commission.
- No handling of your money. EdgeProof never holds funds.
- No promises about returns, and no personal financial advice. It is an education tool.
- Ready today: the Academy (Levels 1 and 2), the practice journal and the rulebook builder are being built first. Testing and verdicts follow in phase 2.

**6. Close**
- H2: Start with Level 1. It's free.
- Action: Create free account
- Footer: Trading forex and CFDs carries a high risk of losing money. EdgeProof is an education tool. It doesn't give investment advice or trade calls. · Sign in · Try a lesson · © 2026 EdgeProof
