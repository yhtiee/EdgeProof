# EdgeProof roadmap and build status

*Every feature in the product spec (EdgeProof — Product & Technical Specification), grouped by release phase, with what has been built. IDs (ON-1, JR-3…) point to the spec. Last updated 17 October 2026.*

**Status key:** ✅ Done · 🟡 Partly done (what's missing is noted) · ⬜ Not started · ⏩ Done early (a later-phase item already built)

---

## At a glance

| Phase | What it delivers | Status |
| --- | --- | --- |
| **1. Learn and record (MVP)** | Accounts, onboarding, the Academy with exams, practice journal and metrics, rulebook builder, AI tutor | 🟡 Nearly complete: the **AI tutor**, the **Progress page**, and account security tasks (email verification, password reset, change email or password) remain |
| **2. Test and validate** | Test runs and data splits, imports, edge verdict, Gates 3–4, forward testing, discipline engine, AI advisers, chart drills, timetable, notifications | 🟡 A few items done early (Gate 3, discretionary label, all 7 levels of content, extra simulators); the rest not started |
| **3. Fund and scale** | Micro-live step, prop firm directory and tools, funded ladder, money tracker, scenario simulator | ⬜ Not started (blocked on a written legal opinion) |
| **4. Community and trust** | Cohorts, accountability partners, mentor reviews, process leaderboards, verified records, outcome reports | ⬜ Not started (defined after Phase 3) |

**Phase exit criteria** (from the spec):

- Phase 1: 5+ outside beginners finish Level 1; the founder logs 30+ practice-journal trades; under 5% of questions confirmed faulty.
- Phase 2: the founder receives a verdict on a strategy; 20–30 outside users active; data protection impact assessment completed.
- Phase 3: written legal opinion obtained before release; first users reach the micro-live step.

**Development builds** open every gate (lesson order, exams, Strategy Lab, future features) for testing; deployed builds are gated and show what to do to unlock each one. One switch: `OPEN_GATES` in `backend/.env`, which works only while `DJANGO_DEBUG` is on.

---

## Phase 1: Learn and record (MVP)

Build order in the spec: auth and onboarding → lessons and simulators → Level 1 content → practice journal and metrics → rulebook builder → Level 2 content → AI tutor.

### Accounts and settings (§3)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| — | Register, sign in, sign out, sessions | ✅ | Access token in memory, rotating refresh cookie, reuse of an old token revokes all sessions |
| — | Google sign-in | 🟡 | API endpoint exists; no button in the app yet |
| — | Email verification and password reset | ⬜ | Needs an email provider (spec: a transactional provider's free tier) |
| AS-1 | Change password, change email, link or unlink Google, log out of all devices | 🟡 | Log out of all devices done; the rest not built |
| AS-2 | Settings: timezone, weekly hours, notification preferences, data-saver, AI on or off | 🟡 | Timezone, weekly hours (profile) and data-saver done; notification preferences and AI switch wait for those features |
| AS-3 | Account deletion: 7-day soft delete, then hard delete | 🟡 | Soft-delete request and "sign in to cancel" done; the hard-delete job and the button in the app aren't |
| AS-4 | "I am 18 or older" at signup | ✅ | |
| — | Profile section (names, onboarding answers) | ✅ | |

### Onboarding (§4)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| ON-1 | Steps save as you go; resume on any device | ✅ | Drop-off per step isn't measured yet |
| ON-2 | Time and sessions step, shown in local time | ✅ | |
| ON-3 | Experience step; seeds the never-again list; placement offered to experienced users | ✅ | |
| ON-4 | Plan: suggested style, sessions, pace, time to the Lab | ✅ | |
| ON-5 | Accepting the plan passes Gate 1 | ✅ | |
| ON-6 | Risk-comfort and realistic returns taught in Level 2, not asked in onboarding | ✅ | |
| — | Visitors can try Level 1, Lesson 1 and one simulator before signing up | ✅ | `/try`, `/try/position-size` |

### Trading Academy (§5)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| AC-1 | Lessons built from typed blocks (text, simulator, diagram, question, glossary, takeaway) | ✅ | Plus Pip the mascot and a drawing per module |
| AC-2 | Simulators (Phase 1: position size, expectancy, drawdown) | ✅ ⏩ | 17 simulators built, including the Phase 2 ones (leverage and margin, pip value, risk of ruin) |
| AC-4 | Multiple-choice and numeric questions | ✅ | |
| AC-5 | Exams drawn and graded on the server; answers never reach the browser; bank ≥ 2× the draw | ✅ | 353 questions, 58 exams (44 module, 7 level, 7 placement) |
| AC-6 | One immediate retake with different questions, then a 24-hour cooldown | ✅ | |
| AC-7 | Level exams pass the level; all published levels pass Gate 2 | ✅ | |
| AC-8 | "Report this question", pass-rate outliers flagged, admin gate override | 🟡 | Reporting done; automatic outlier flagging and an override screen in admin not built |
| AC-10 | Progress saves per screen and syncs later when offline | ✅ | |
| — | Lessons open in order; module and level exams gate the path | ✅ | |
| — | Placement exams (90% skips a level) | ✅ | |
| — | Content: Levels 1–2 | ✅ ⏩ | **All 7 levels written**: 44 modules, 98 lessons, with cited sources and a glossary |
| — | Test Level 1 with 3–5 outside beginners | ⬜ | A founder task, and part of the Phase 1 exit criteria |
| RL-1 | Recommended reading linked (buy, borrow or free) | ✅ | Per level |
| RL-4 | Weekly study-hours goal and streaks | 🟡 | Weekly hours captured; journaling streak done; a study streak isn't shown yet |

### Gates (§8)

| Gate | Unlocks | Status | Notes |
| --- | --- | --- | --- |
| 1 | Academy | ✅ | Plan accepted |
| 2 | Testing in the Strategy Lab | ✅ | Phase-aware: all published level exams (now all 7), or placement |
| 3 | Test runs (per strategy version) | ✅ ⏩ | Clarity checks by code; locks the version |
| — | Gates framework: server enforcement, audit log, versioned config | ✅ | |
| — | **Progress page** showing the real path and gate criteria | 🟡 | Page exists with placeholder content; needs live data |

### Practice journal and core metrics (§7, §8)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| JR-1 | Practice journal open from day one, no gate; trades can link to draft strategies | ✅ | |
| JR-2 | Trades belong to a user and a trading account (demo, live, prop) | ✅ | Unassigned-imports inbox comes with imports (Phase 2) |
| JR-3 | Trade fields, immutable initial stop, session from the open time | ✅ | |
| JR-4 | R = net P&L ÷ initial risk; partial closes merge; no stop = rule break | ✅ | |
| JR-5 | Rule check per trade; never-again list on the form | ✅ | Rules come from the chosen strategy version, or a practice checklist |
| JR-6 | Emotion, confidence, sleep, distractions, automatic "after a loss" | ✅ | |
| JR-8 | Guided daily (3) and weekly (5) reviews | ✅ | |
| JR-9 | Notes, tags and search | ✅ | |
| JR-10 | CSV export with formula characters escaped | ✅ | |
| JR-11 | Screenshots compressed to WebP in the browser; data-saver respected | ✅ | Re-encoded on the server with EXIF stripped |
| — | Offline-first logging (saved on the device, synced later) | ✅ | |
| — | Core metrics: expectancy with range, win rate, profit factor, drawdown, Monte Carlo, costs share, rule-following, breakdowns | ✅ | Deterministic code with hand-checked tests |
| DE-5 | Never-again list | ✅ | |
| DE-9 | Streaks for study and journaling, never for profit | 🟡 | Journaling streak and calendar done; study streak not shown |

### Strategy Lab: rulebook builder (§6)

Design document: `docs/strategy-lab/rulebook-builder.md`.

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| SL-1 | Guided builder, part by part, autosaving drafts | ✅ | Saves on the device first; handles conflicts between devices |
| SL-2 | Profile fit check | ✅ | |
| SL-3 | Clarity checks by code (structured conditions, banned vague words, examples) | ✅ | Same results in the browser and on the server, tested on 12 fixtures |
| SL-4 | Gate 3 only when every check passes | ✅ | |
| SL-5 | Mechanical or discretionary label | ✅ ⏩ | Spec lists it as Phase 2 |
| SL-6 | After Gate 3, changes create a new version with a reason | ✅ | |
| SL-8 | Risk limits drive journal warnings | ✅ | |
| SL-10 | Up to 5 active strategies | ✅ | |
| SL-11 | No copyable templates | ✅ | |
| — | Drafting opens after the Level 6 strategy lessons | ✅ | Founder decision (the spec said after Level 2) |

### AI tutor (§10)

| Feature | Status | Notes |
| --- | --- | --- |
| **Academy tutor**: ask about the current lesson; streamed explanation plus a follow-up practice question | ⬜ | **Next to build.** Daily per-user limit, answers cached by lesson and question, monthly spending cap and circuit breaker, 45 s timeout, swappable provider |
| Guardrails: no signals or predictions; user text treated as data; server check for signal-like language and invented numbers; sanitised output | ⬜ | Built with the tutor |
| Privacy: names and emails masked; consent per feature; AI can be switched off | ⬜ | Built with the tutor |

### Platform (§13, §16)

| Feature | Status | Notes |
| --- | --- | --- |
| Installable PWA; lessons cached for offline use | ✅ | |
| Waking state for a sleeping server, retries, offline mode that keeps work | ✅ | |
| First load under 300 KB of JavaScript (gzip) | ✅ | About 139 KB; heavy screens load on demand |
| Every flow works at 360 px | ✅ | Checked in browser tests |
| Dark mode, colour-blind mode, reduced motion | ✅ | |
| Field encryption, data isolation by user, Argon2 | ✅ | |
| Scheduled sweep (GitHub Actions → signed endpoint) | ✅ | |
| Screenshot storage on Cloudflare R2 | 🟡 | Code ready; uses local disk until R2 keys are set |
| Admin at a hidden path with two-factor login | 🟡 | django-otp installed; enforcement and setup to confirm before launch |
| Cloudflare Turnstile on signup and password reset | ⬜ | |
| Nightly encrypted backups, restore rehearsed | ⬜ | |
| CI: lint, type-check, tests, migration check, secret scanning on every pull request | ⬜ | Tests exist and pass locally (106 backend, 89 frontend) |
| Sentry with PII scrubbing | 🟡 | Configured in settings; needs a project key |
| Deployment (Vercel + container host + Neon) | ⬜ | Not deployed yet |

---

## Phase 2: Test and validate

| Area | ID | Feature | Status |
| --- | --- | --- | --- |
| Onboarding | ON-7 | Readiness check before forward testing (money that can be lost, debt, savings); encrypted answers | ⬜ |
| | ON-8 | After 30+ trades, compare stated traits with behaviour | ⬜ |
| Academy | AC-2 | Extra simulators: leverage and margin, pip and lot, risk of ruin | ⏩ Done |
| | AC-3 | Chart drills on historical candles (mark structure or levels), plus the drill authoring tool | ⬜ |
| | AC-4 | Multi-select, ordering and chart-marking questions | ⬜ |
| | AC-9 | Spaced-repetition review cards (1, 3, 7, 21 days) | ⬜ |
| | — | Levels 3–7 content | ⏩ Done (with exams) |
| Reading | RL-2 | Companion notes in our own words | ⬜ |
| | RL-3 | Reading check-ins (3–5 questions) | ⬜ |
| | RL-4 | Generated study timetable that reschedules when you fall behind | ⬜ |
| | RL-5 | Calendar export (read-only feed) | ⬜ |
| Strategy Lab | SL-5 | Discretionary label | ⏩ Done |
| | SL-7 | Validation attempts counted; more attempts raise the verdict bar | ⬜ |
| | SL-9 | One-page trading plan PDF | ⬜ |
| | SL-12 | Pine Script helper (labelled "unverified") | ⬜ (rule schema ready for it) |
| Testing workflow | BT-1 | Test runs per version: development, validation, forward, live | ⬜ |
| | BT-2 | Data splits per strategy and pair, with minimum ranges | ⬜ |
| | BT-3 | Validation window used once per strategy; max 3 attempts | ⬜ |
| | BT-4 | Random start date for replay; log every setup seen, including skipped | ⬜ |
| | BT-5 | Validation trades need a before-screenshot and MAE | ⬜ |
| | BT-6 | Fast logging form (prefill, paste screenshot, shortcuts) | 🟡 Mostly in the journal form |
| | BT-7 | TradingView Strategy Tester CSV import, re-costed | ⬜ |
| | BT-8 | Out-of-range trades flagged; per-year results; one-year-dominates warning | ⬜ |
| Journal | JR-7 | MT4/MT5 statement import (safe parser, personal data dropped) | ⬜ |
| Analytics | — | Edge verdict (Not enough data / No edge found yet / Passed out-of-sample test) with ranges and the "no real edge X% of the time" line | ⬜ (metrics engine ready) |
| Gates | 3 | Clarity checks pass | ⏩ Done |
| | 4 | Forward testing unlocks on "Passed out-of-sample test" | ⬜ |
| Forward testing | FT-1 | Forward runs use the exact version that passed | ⬜ |
| | FT-2 | Rolling metrics every 10 trades; drift flag after 30 | ⬜ |
| | FT-3 | Diagnosis: discipline, execution or strategy | ⬜ |
| | FT-4 | Honest exit after 3 strategies with no edge | ⬜ |
| Discipline engine | DE-1 | Pre-trade checklist for forward and live trades | ⬜ |
| | DE-2 | Tilt flags (never block logging) | ⬜ |
| | DE-3 | Discipline score 0–100 with contributors | ⬜ |
| | DE-4 | Routine builder with reminders | ⬜ |
| | DE-8 | Scam and broker checker | ⬜ (Level 1 lessons cover the topic) |
| | DE-9 | Rule-following streaks | ⬜ |
| AI | — | Rule clarity adviser (never decides Gate 3) | ⬜ |
| | — | Journal review (patterns, one focus goal) | ⬜ |
| | — | Result explainer for verdicts | ⬜ |
| | — | Chart screenshot review (with consent) | ⬜ |
| | — | Monthly discipline review | ⬜ |
| | — | Coach memory (view and clear) | ⬜ |
| Notifications | §3 | Study session due, review due, cooldown ended, import finished, weekly digest; preferences and quiet hours; web push | ⬜ (data model and sweep ready) |
| Compliance | §17 | Data protection impact assessment before outside users join | ⬜ |

---

## Phase 3: Fund and scale

Blocked until a written opinion from a Nigerian securities lawyer confirms it stays on the education side (spec §17).

| ID | Feature | Status |
| --- | --- | --- |
| Gate 5 | Micro-live step: 50+ forward trades over 8+ weeks, expectancy above 0 after costs, rule-following ≥ 90%, readiness check done | ⬜ |
| FT-5 | Micro-live: real money at ≤ 0.25% risk for 30+ trades before any paid challenge | ⬜ |
| Gate 6 | Funded ladder unlocks after 30+ real-money trades meeting the criteria | ⬜ |
| FL-1 | Prop firm directory (rules, fees, verified date, firm-risk note; no affiliate links, no ranking) | ⬜ |
| FL-2 | Challenge replay: Monte Carlo of your own trades under a firm's rules | ⬜ |
| FL-3 | Challenge simulator on demo | ⬜ |
| FL-4 | Ladder milestones with criteria set in advance | ⬜ |
| FL-5 | Fee budget with a guided review at the cap | ⬜ |
| FL-6 | Money tracker: spent vs earned | ⬜ |
| FL-7 | Scale-back when drawdown passes your own limit | ⬜ |
| DE-6 | Scenario simulator (replays events such as the 2015 franc unpegging) | ⬜ |
| DE-7 | Mistake library (consented, anonymised case studies) | ⬜ |

---

## Phase 4: Community and trust

Defined in detail after Phase 3.

| ID | Feature | Status |
| --- | --- | --- |
| CT-1 | Cohorts of 8–15 starting the Academy together | ⬜ |
| CT-2 | Accountability partners (discipline and streaks, never P&L) | ⬜ |
| CT-3 | Mentor reviews (blocked until the legal opinion) | ⬜ |
| CT-4 | Process leaderboards (discipline and learning only, opt-in) | ⬜ |
| CT-5 | Verified track records (read-only APIs only; no passwords stored) | ⬜ |
| CT-6 | Quarterly public outcome report | ⬜ |
| CT-7 | Native mobile app, only if the PWA proves insufficient | ⬜ |

---

## Before outside users (cross-cutting)

| Task | Status |
| --- | --- |
| Written opinion from a Nigerian securities lawyer (before public launch) | ⬜ |
| Terms of service and privacy policy, reviewed against the FCCPA 2018 and NDPA 2023 | ⬜ |
| Data protection impact assessment; records-of-processing register; data protection officer named | ⬜ |
| AI provider data-processing agreement and cross-border transfer basis | ⬜ |
| Deployment, backups, CI, Sentry, Turnstile (see Platform above) | ⬜ |

---

## What's next

1. **Progress page with live data** (finishes the Phase 1 gates item; small).
2. **AI tutor** (the last Phase 1 build-order item).
3. **Phase 1 account security:** email verification, password reset, change email or password, account deletion in the app.
4. **Launch groundwork:** deploy, CI, backups; then test Level 1 with 3–5 outside beginners.
5. **Phase 2**, starting with test runs and data splits (BT-1–BT-3), then the edge verdict and Gate 4.
