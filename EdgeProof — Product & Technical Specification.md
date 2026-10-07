# EdgeProof — Product & Technical Specification

Oct 7, 2026 · @Someone

EdgeProof (working name) is a free web platform that takes forex traders from zero to a realistic, evidence-tested edge through a gated path: learn, build your own strategy, test it, prove it on unseen data, then scale slowly. Stack: Vite + React on Vercel, Django REST on a free container host, PostgreSQL.

## 1. Overview

EdgeProof exists to replace hope with evidence: users only move forward when their own data proves they are ready. The founder is user one and tests every phase on himself first.

**Problem.** Regulators found 74–89% of retail CFD accounts lose money ([ESMA](https://www.esma.europa.eu/node/84933)). A study of Brazilian day traders found 97% of those who persisted over 300 days lost money, with no evidence of learning by trading ([Chague et al.](https://ssrn.com/abstract=3423101)). Traders lack a process: they copy strategies, skip testing and over-leverage.

**Target users**

| Persona | Description | Main need |
| --- | --- | --- |
| Beginner | No trading experience | A structured start that doesn't sell dreams |
| Struggling trader | Blown accounts, failed prop challenges | A reset with honest feedback |
| Disciplined learner | Willing to spend months learning | Proof of edge before risking money |

**Product principles**

1. No shortcuts: stages unlock only through gates.
2. Your own strategy: no signals, no copy trading.
3. Honesty over hype: real odds, real statistics, including "no edge".
4. Process over profit: reward rule-following and journaling.
5. Numbers by code, explanations by AI.
6. Conflict-free: no broker or prop firm referral revenue.
7. Education only: no trade calls or personal financial advice.

**Success metrics**

| Metric | Definition | Data source |
| --- | --- | --- |
| Active user | Completed a lesson block, exam attempt or trade log in the period | ActivityEvent |
| Level completion | Share of users who pass each level exam within 90 days of signup, plus weekly drop-off by level | ExamAttempt (level scope) |
| Journaling consistency | Share of active users logging trades in 3 of the last 4 weeks | Trade, ActivityEvent |
| Rule-following rate | Median share of journaled trades that followed every rule | Trade |
| Honest verdicts | Strategies reaching any verdict, including "No edge found yet" | Verdict |
| Gate funnel | Users passing each gate, and time between gates | GatePass |
| Retention | Users active at day 30 and day 90 | ActivityEvent |
| Spend discipline | Share of ladder users staying within their yearly fee cap | Spend, LadderBudget |

Targets are set after the first 20–30 outside users, not from the founder's own results, since he writes the content and exams.

## 2. Scope and release phases

The product ships in four phases. Each phase must be usable on its own before the next starts.

| Phase | Ships | Exit criteria |
| --- | --- | --- |
| 1. Learn and record (MVP) | Auth and 3-minute onboarding; installable PWA; lesson renderer with 3 simulators (position size, expectancy, drawdown); multiple-choice and numeric questions; Academy Levels 1–2 with placement exams; gates framework (Gates 1–2, phase-aware); ungated practice journal with rule checklist and core metrics; rulebook builder without AI; AI tutor last, with a hard cap | 5+ outside beginners finish Level 1; founder logs 30+ practice-journal trades; under 5% of questions confirmed faulty |
| 2. Test and validate | Levels 3–7; data splits and testing workflow; TradingView and MT4/MT5 imports; edge verdict and Gates 3–4; forward testing; pre-trade checklist, tilt flags, discipline score; AI clarity advisor and journal review; chart drills, spaced repetition, timetable generator, reading check-ins; notifications | Founder receives a verdict on a strategy; 20–30 outside users active; DPIA completed |
| 3. Fund and scale | Gate 5 and micro-live step; prop firm directory, challenge fit check and simulator, cost estimates, ladder milestones, fee budget, money tracker; scenario simulator | Written legal opinion obtained before release; first users reach the micro-live step |
| 4. Community and trust | Cohorts, accountability partners, mentor reviews, process leaderboards, verified track records, public outcome reporting | Defined after Phase 3 |

**Phase-aware gates.** A gate only requires content and features that are published. In Phase 1, Gate 2 requires the published level exams (Levels 1–2). Users who passed a gate keep it when new levels are published; new levels then appear as required learning before the next gate.

**Build order for Phase 1:** auth and onboarding → lesson renderer and simulators → Level 1 content, tested with 3–5 outside beginners → practice journal and core metrics → rulebook builder → Level 2 content → AI tutor.

**Out of scope for all phases:** trade signals, copy trading, managed accounts, handling user funds, broker or prop referral links, a custom backtesting engine (unless funded later).

## 3. Roles, accounts and notifications

| Role | Can do |
| --- | --- |
| Learner | Everything on their own data; nothing on others' data |
| Mentor (Phase 4) | Read journals and strategies shared with them by a learner; leave reviews |
| Content editor | Create and edit lessons, questions, exams, books and companion notes |
| Admin | Manage users, gate thresholds, prop firm data, feature flags, audit logs |

All sharing is opt-in and revocable by the learner. Admins can read a user's journal only through a time-limited SupportGrant the user creates; every read is written to the audit log. While the founder works alone, the Content editor and Admin roles are held by one account, with a draft → publish step kept for content.

**Account and settings**

| ID | Requirement |
| --- | --- |
| AS-1 | Change password, change email (re-verified), link or unlink Google, log out of all devices. |
| AS-2 | Settings: timezone, weekly study hours, notification preferences, data-saver mode, AI features on or off. |
| AS-3 | Account deletion is a 7-day soft delete with confirmation, then a hard delete job (see §16). |
| AS-4 | Age check at signup: a confirmed "I am 18 or older" statement; only the flag and check date are stored. |

**Notifications**

| Type | Default channel | Notes |
| --- | --- | --- |
| Study session due | In-app, web push (PWA) | Accurate to ±30 minutes |
| Daily or weekly review | In-app, web push | Skipped if already done |
| Exam cooldown ended | In-app | — |
| Import finished or failed | In-app | — |
| Weekly digest | Email (opt-in) | One email instead of one per event, to stay within free email limits |

Users set preferences per type, quiet hours and one-click unsubscribe. Reminders are generated by the scheduled sweep (§13) from a Notification table and shown on next visit if push is unavailable.

## 4. Onboarding and trader profile

Onboarding takes about 3 minutes and asks only what shapes the plan. Deeper questions move to where they teach or where risk begins. Visitors can try Level 1, Lesson 1 and one simulator before signing up.

**Flow**

1. Account creation (email and password, or Google) with the age statement. Email verification can finish later; it doesn't block the plan.
2. Time and sessions.
3. Experience and history.
4. Plan review and acceptance (Gate 1).

**Requirements**

| ID | Requirement | Phase |
| --- | --- | --- |
| ON-1 | Each step saves on completion; users resume on any device. Median completion under 5 minutes; drop-off measured per step. | 1 |
| ON-2 | Time step captures weekly hours, timezone and the sessions (Asia, London, New York) the user can watch, shown in local time. | 1 |
| ON-3 | Experience step records years trading, accounts blown, prop challenges attempted and what usually went wrong; this seeds the never-again list. Experienced users are offered placement exams (§5). | 1 |
| ON-4 | The plan shows a suggested trading style for learning purposes, sessions, Academy pace, expected time to reach the Strategy Lab, and placement options. Wording describes options; it doesn't instruct. | 1 |
| ON-5 | Accepting the plan passes Gate 1. | 1 |
| ON-6 | Risk-comfort equity curves and the realistic-returns exercise are Level 2 lessons, not onboarding questions. | 1 |
| ON-7 | Readiness check (money that can be lost, debt, emergency savings) runs before forward testing, where money risk starts. Answers indicating risk show a clear warning and a "learn and practise, fund later" path. Only a plaintext risk flag is stored alongside the encrypted answers. | 2 |
| ON-8 | After 30+ journaled trades, the app compares stated traits with behaviour and shows the differences. | 2 |

**Style suggestion logic.** Fewer than 7 hours a week or no overlap with major sessions suggests position or swing trading on daily or 4-hour charts. Day trading is suggested only with 15+ weekly hours and daily overlap with London or New York.

## 5. Trading Academy

The Academy is a mandatory, interactive course from foundations to advanced. Passing every level exam (Gate 2) unlocks the Strategy Lab.

**Curriculum structure.** Level → Module → Lesson. Each module ends with an exam; each level ends with a level exam.

| Level | Modules (draft) | Paired reading (draft; paid books optional and never gating) |
| --- | --- | --- |
| 1. Foundations | How forex works; pairs and quotes; pips, lots, leverage, margin; brokers, execution models, stop-outs and negative balance protection; spreads, commissions, swaps (including the Wednesday triple swap); weekend and news gaps and stops that don't fill; sessions; why most traders lose; scams and funding risks | Babypips School of Pipsology (free) |
| 2. Probability and risk | Probability thinking; randomness and statistics for traders (coin-flip equity curves, why 30 trades prove nothing, confidence ranges); expectancy and R-multiples; position sizing; drawdown maths and risk of ruin; risk-comfort curves; realistic returns | *Fooled by Randomness*, Nassim Taleb; *Trade Your Way to Financial Freedom*, Van Tharp |
| 3. Psychology | Thinking in probabilities; fear and greed; revenge trading; routines; journaling | *Trading in the Zone*, Mark Douglas |
| 4. Technical analysis | Market structure; support and resistance; trends; price action and candles; indicators; timeframes | Free online resources; *Technical Analysis of the Financial Markets*, John Murphy (optional) |
| 5. Fundamentals | Interest rates; central banks; economic calendar; news risk; intermarket links | Central bank publications (free) |
| 6. Strategy design | Ideas to rules; mechanical vs discretionary; backtesting methods and hindsight bias; costs; overfitting; sample size; out-of-sample testing | *Evidence-Based Technical Analysis*, David Aronson (ch. 1–6) |
| 7. Advanced | Multi-timeframe analysis; currency exposure and correlated positions; trade management; prop firm rules and firm risk; performance review | *Market Wizards*, Jack Schwager |

**Placement exams.** Users can test out of any level by scoring at least 90% on its placement exam; a pass counts as that level's gate evidence.

**Lesson requirements**

| ID | Requirement | Phase |
| --- | --- | --- |
| AC-1 | Lessons are built from typed blocks: text, simulator, diagram, embedded question, glossary link, key takeaway; chart drills added in Phase 2. | 1 |
| AC-2 | Simulators are reusable React components. Phase 1: position size, expectancy, drawdown. Phase 2: leverage and margin, pip and lot, risk of ruin. | 1–2 |
| AC-3 | Chart drills use historical candles where users mark structure or levels; a correct mark falls within ±N% of the visible price range, set per drill in the authoring tool. | 2 |
| AC-4 | Question types: multiple choice and numeric (with tolerance) in Phase 1; multi-select, ordering and chart-marking in Phase 2. | 1–2 |
| AC-5 | Exams draw randomly from a bank holding at least 2× the questions drawn; pass mark 80% by default; questions are drawn and graded on the server and answers never reach the client. | 1 |
| AC-6 | After a failed exam, the user reviews the missed concepts and may retake once immediately with different questions; a 24-hour cooldown applies from the second failure. | 1 |
| AC-7 | Level exams pass the level; passing all published levels completes Gate 2 (phase-aware). | 1 |
| AC-8 | Every question has "report this question"; pass rates per question are tracked and outliers flagged; admins can grant a gate override, recorded in the audit log. | 1 |
| AC-9 | Spaced repetition review cards (1, 3, 7, 21 days). | 2 |
| AC-10 | Progress saves per block and syncs later if offline. | 1 |

**Reading library and timetable**

| ID | Requirement | Phase |
| --- | --- | --- |
| RL-1 | Each module links its recommended reading with where to buy, borrow or read free; only public-domain texts are hosted. No copyrighted PDFs. | 1 |
| RL-2 | In-house companion notes (key ideas in our own words, discussion questions). | 2 |
| RL-3 | Reading check-ins of 3–5 questions, for free reading only. | 2 |
| RL-4 | Phase 1 uses a weekly study-hours goal plus streaks. Phase 2 adds a generated timetable that interleaves lessons, reading, review and exams and reschedules forward when a user falls behind. | 1–2 |
| RL-5 | Calendar export through a revocable, read-only feed token per user. | 2 |

**Content authoring.** Writing the content is the largest piece of work in the project. Lessons are Markdown files with a small block syntax, kept in the repository and compiled to static JSON at build time, so they load from Vercel even when the backend is asleep. Django admin holds only questions, exams and configuration. Each module gets a writing-time estimate and a place in a content calendar; Level 1 ships first and is tested with outside beginners before Level 2 is written. A chart-drill authoring tool (click candles to set zones) is built in Phase 2 before any drills are written.

## 6. Strategy Lab

Users build their own strategy as a structured, versioned rulebook. Drafting opens in Phase 1 after Level 2; testing unlocks at Gate 3, which is checked by code.

**Strategy structure (one version)**

| Part | Fields |
| --- | --- |
| Market | Instruments, timeframe(s), sessions |
| Setup | One or more structured conditions (indicator or price element, comparator, value, timeframe), all of which must be true |
| Entry | Trigger and order type |
| Stop | Placement rule; an initial stop is mandatory |
| Exit | Target rule, trade management (breakeven, partials, trailing) |
| Risk | Risk per trade %, daily and weekly loss limits, maximum drawdown in R, max open trades, max trades per day, max total risk per currency (default 2%), losing-streak rule |
| Costs | Per instrument: spread, commission per lot, slippage (defaults 0.3 pips on majors, 1.0 on crosses, 3+ inside news windows), swap per night |
| No-trade rules | News windows, spread limit, other conditions |
| Examples | Annotated screenshots of valid and invalid setups per rule |

**Requirements**

| ID | Requirement | Phase |
| --- | --- | --- |
| SL-1 | Guided builder walks through each part; drafts save automatically. | 1 |
| SL-2 | Profile fit check warns on conflicts with the profile (for example, a 5-minute strategy for someone with 5 free hours a week). | 1 |
| SL-3 | Clarity checks by code: required fields filled, setup rules use structured conditions or pass a banned-vague-words list ("strong", "clear", "looks like"), each setup rule has a valid and an invalid example. | 1 |
| SL-4 | Gate 3 passes when every SL-3 check passes. The AI clarity advisor (Phase 2) suggests rewording but never decides the gate. | 1 |
| SL-5 | A version with a free-text rule kept after a recorded override is classified **discretionary**; otherwise **mechanical**. Discretionary versions face stricter verdict thresholds (§8) and carry a "lower reliability" label. | 2 |
| SL-6 | Every saved change after Gate 3 creates a new version with a required reason; trades, tests and verdicts attach to one version. | 1 |
| SL-7 | Validation attempts are counted per strategy and across all of a user's strategies; the count raises the verdict bar (§8). | 2 |
| SL-8 | Risk limits drive warnings in the journal and pre-trade checklist. | 1 |
| SL-9 | Trading plan export as a one-page PDF. | 2 |
| SL-10 | Up to 5 active strategies; archived ones stay readable. | 1 |
| SL-11 | Classic strategy types appear only as Academy lessons, never as copyable templates. | 1 |
| SL-12 | Pine Script helper drafts a script from a mechanical version, labelled "unverified, check before use"; scripts are never run by the app. | 2 |

## 7. Backtesting workflow and journal

Testing happens on free external tools; EdgeProof records, separates, cost-adjusts and analyses the results. No custom backtesting engine is built. Manual replay overstates results, so the app treats it as a filter, not proof, and says so in the interface.

**Testing tools (user side)**

- [The Free Chart](https://thefreechart.com/chart): free market replay with forex data back to 2004 at 1-minute resolution and simulated spreads, commissions and swaps. Default recommendation for manual replay.
- TradingView: Pine Script and Strategy Tester for coded strategies; free plan Bar Replay is limited to daily and higher timeframes.

**Test sessions**

| ID | Requirement | Phase |
| --- | --- | --- |
| BT-1 | A test run belongs to one strategy version and has a type: development, validation, forward or live. | 2 |
| BT-2 | Data splits are set per strategy and instrument. Minimum ranges: development 3+ years for intraday and 8+ years for swing strategies; validation 12+ months, placed after development. | 2 |
| BT-3 | A validation window is burned per strategy once used: later versions must validate on a new unseen window or go straight to forward testing. Maximum 3 validation attempts per strategy. The lock is honour-based because replay happens in external tools, and the interface says so. | 2 |
| BT-4 | For manual replay, the app picks a random start date (and pair, if several) inside the split, and the user logs every setup seen, including skipped ones with a reason; the app shows skipped ÷ seen. | 2 |
| BT-5 | Every validation trade needs a before-screenshot and its maximum adverse excursion (MAE) in R. | 2 |
| BT-6 | Fast logging form: prefill from the previous trade, paste or pick a screenshot, keyboard shortcuts on desktop, large touch targets on mobile. | 2 |
| BT-7 | TradingView Strategy Tester CSV import with column mapping and preview; imports showing zero commission are flagged and re-costed with the version's cost model. | 2 |
| BT-8 | Trades outside the run's date range are flagged; per-year results are shown and a warning appears when one year produces more than 50% of total R. | 2 |

**Journal (practice, forward and live trades)**

| ID | Requirement | Phase |
| --- | --- | --- |
| JR-1 | The practice journal is open from day one with no gate: trades can link to a draft strategy and are excluded from verdicts. | 1 |
| JR-2 | Trades belong to a user and a trading account (demo, live or prop); a test run link is optional. Imported trades with no run land in an "unassigned" inbox. | 1 |
| JR-3 | Trade fields: instrument, direction, entry, initial stop (immutable once saved), target, exit price, size, initial risk in account currency, open and close time, fees, swap, outcome, setup, before and after screenshots. Market session is computed from the open time. | 1 |
| JR-4 | R = net P&L in account currency ÷ initial risk in account currency. Partial closes merge into one trade with a weighted R. A trade with no initial stop is a rule break and is excluded from verdict samples. | 1 |
| JR-5 | Rule check per trade: one checkbox per rule, giving a rule-followed flag and a list of broken rules; the never-again list is shown on the form. | 1 |
| JR-6 | Context tags: emotion before and after, confidence 1–5, sleep, distractions, and an automatic "after a loss" flag. | 1 |
| JR-7 | MT4/MT5 statement import (Phase 2): parsed with a non-executing parser in a background job with size, row and time limits; only trade rows are kept; the header (name, account number, broker, server) is dropped at parse time; the original file is deleted after parsing; deduplicated by account and ticket number. | 2 |
| JR-8 | Guided daily (3 questions) and weekly (5 questions) reviews. | 1 |
| JR-9 | Notes and tags on any trade; search across the journal. | 1 |
| JR-10 | CSV export of all journal data, with formula characters escaped in every cell. | 1 |
| JR-11 | Screenshots are compressed in the browser to WebP (about 1600 px wide, about 200 KB) before upload; data-saver mode skips automatic image loading. | 1 |

## 8. Analytics engine, edge verdict and gates

All statistics and gate decisions are computed by deterministic Python code in the Django backend, with unit tests against known datasets. AI may explain results but never computes them.

**Core metrics (per strategy version and session type)**

Results are measured in R as defined in JR-4, net of the version's cost model (§6), never the user's own cost figures.

```latex
\text{Expectancy} = \frac{1}{N}\sum_{i=1}^{N} R_i
```

N counts every closed trade in the sample, breakevens included (a trade with |R| under 0.1 is a breakeven). Trades that overlap in time and share a currency form one cluster and count once toward sample-size thresholds.

```latex
\text{Profit factor} = \frac{\sum \text{winning R}}{\left|\sum \text{losing R}\right|}
```

| Metric | Definition |
| --- | --- |
| Win rate | Wins ÷ closed trades, with breakevens shown separately |
| Max drawdown | Largest peak-to-trough fall of the cumulative R curve; compared with the plan as R × risk per trade % |
| Expected drawdown | 95th-percentile maximum drawdown and losing streak from a 10,000-path Monte Carlo of trade order, shown as "what you should expect" |
| Expectancy range | Block bootstrap (weekly blocks, 10,000 resamples) giving a range and its lower bound |
| Costs share | Costs as % of gross R; warning above 20%, or when the average stop is under 10 pips |
| Rule-following rate | Trades with every rule followed ÷ trades |
| Cost of rule breaking | Total R of rule-broken trades, and of tilt-window trades |
| Breakdowns | By instrument, market session, weekday, setup, year, emotion tag and rule-followed vs broken |

**Edge verdict.** Computed when a strategy version has a validation run. Every verdict always shows the expectancy range and the line "Results this good can occur with no real edge X% of the time", computed from the bootstrap.

| Verdict | Conditions (mechanical; discretionary in brackets) |
| --- | --- |
| Not enough data | Fewer than 100 (150) development or 50 (100) validation trades, counted by cluster |
| No edge found yet | Any "Passed out-of-sample test" condition fails |
| Passed out-of-sample test | Development expectancy ≥ +0.10R; validation expectancy ≥ +0.10R and at least 50% of development; validation profit factor ≥ 1.25; one-sided 90% bootstrap lower bound of pooled expectancy above 0 (95% once the user has made more than 3 validation attempts); 95th-percentile Monte Carlo drawdown within the plan's maximum drawdown |
| Passed forward test | All of the above, plus Gate 5 criteria |

**How it is computed.** Metrics and verdicts are fully recomputed per version and run type when trades change (debounced) and cached by an input hash; for a few hundred trades this takes milliseconds. Each verdict stores the trade-set hash, range bounds, random seed, risk % used and config version, so it can be re-explained later. Discretionary verdicts carry a "lower reliability" label.

**Gates**

| Gate | Unlocks | Default criteria | Scope |
| --- | --- | --- | --- |
| 1 | Academy | Plan accepted | User |
| 2 | Testing in the Strategy Lab | All published level exams passed (or placed out of) | User |
| 3 | Test runs | All SL-3 clarity checks pass | Version |
| 4 | Forward testing | "Passed out-of-sample test" | Version |
| 5 | Micro-live step | 50+ forward trades over at least 8 weeks; forward expectancy above 0 after real costs and at least 50% of validation; forward max drawdown within the 95th-percentile Monte Carlo drawdown; rule-following ≥ 90%; readiness check done | Version |
| 6 | Funded ladder (Phase 3, after legal opinion) | 30+ real-money trades at ≤ 0.25% risk each, expectancy above 0, rule-following ≥ 90% | Version |

Gates are enforced on the server by permission classes; the interface lock is only a convenience. Thresholds live in a versioned config table, and existing passes are kept when the config changes. Validation trades can't be edited after a verdict; other edits that change a verdict revoke the related pass, with the reason shown. All thresholds are reviewed with experienced traders before launch.

## 9. Forward testing and funded ladder

Forward testing proves the strategy holds up in real time on demo; the ladder then scales users in small steps tied to their own data.

**Forward testing**

| ID | Requirement | Phase |
| --- | --- | --- |
| FT-1 | Forward runs use the exact version that passed; editing starts a new version and a new forward run. | 2 |
| FT-2 | Rolling metrics are shown every 10 trades, with no drift verdict before 30 trades. After that, a flag appears when rolling-30 expectancy falls below the validation range's lower bound or drawdown exceeds 1.5× the backtest maximum. | 2 |
| FT-3 | Diagnosis on failure: discipline (rule-following under 90%), execution (spread and slippage per trade worse than the cost model) or strategy (neither), with the evidence. | 2 |
| FT-4 | Honest exit: after 3 strategies end in "No edge found yet", the app offers a structured pause, a fundamentals review, or stepping back, in neutral wording. | 2 |
| FT-5 | Micro-live step (Gate 5 → 6): real money at ≤ 0.25% risk per trade for 30+ trades before any paid challenge, to expose real execution. | 3 |

**Funded ladder (Phase 3)**

The whole ladder is blocked until a written opinion from a Nigerian securities lawyer confirms it stays on the education side (§17). Wording describes the user's own data and rules; it never ranks firms or tells users what to do.

| ID | Requirement |
| --- | --- |
| FL-1 | Prop firm directory: fee, account size, profit target, daily and maximum drawdown (closed or floating), time limits, consistency rules, news rules, minimum trading days, last verified date, firm-risk note (firms have closed and denied payouts before). Entries older than 90 days are hidden; users can report errors. No affiliate links, no ranking. |
| FL-2 | Challenge replay: a 10,000-path Monte Carlo of the user's own trades under a firm's rules, using MAE to model worst-case intraday equity. Shows P(pass), P(survive 60 days funded) and expected fees per payout, each as a range, labelled as a replay of past data. |
| FL-3 | Challenge simulator: run a full simulated challenge on demo with a firm's rules before paying. |
| FL-4 | Ladder milestones (micro-live → small challenge → funded → first payout → larger account) unlock on criteria the user sets in advance; the app suggests defaults. |
| FL-5 | Fee budget: a yearly cap set by the user (suggested default: no more than 2 challenge fees per quarter); reaching it triggers a guided review before more spending is logged. |
| FL-6 | Money tracker: total spent vs total earned across the whole journey. |
| FL-7 | Scale-back: when drawdown passes the level the user set in the risk plan, the app shows that the user's own rule calls for stepping down. |

## 10. AI layer

AI is the coach and explainer; code is the referee. All AI calls go through one Django service so prompts, limits, logging and guardrails live in one place.

| Feature | Phase | Input | Output |
| --- | --- | --- | --- |
| Academy tutor | 1 | Current lesson, user question | Explanation, follow-up practice question (streamed) |
| Rule clarity advisor | 2 | One rule's text | Suggested rewording; never decides Gate 3 |
| Journal review | 2 | Computed metrics, tagged trades, masked notes (last 7 or 30 days) | Patterns, one focus goal |
| Result explainer | 2 | Verdict inputs and outputs | Plain-language explanation |
| Pine Script helper | 2 | Mechanical rulebook version | Draft script labelled "unverified" |
| Chart screenshot review | 2 | Screenshot + rulebook, after user consent | Which rules appear met or not, with uncertainty stated |
| Monthly discipline review | 2 | Metrics and behaviour trends | Summary and improvement goals |

**Guardrails**

- The system prompt forbids trade signals, buy or sell calls, price predictions, return promises and recommending brokers or prop firms.
- User content (notes, rule text, imported fields, screenshot text) is wrapped in delimiters and treated as data, never instructions; injection cases are part of the evaluation set (§18).
- A server-side check (no extra model call) blocks signal-like language and numbers not present in the inputs; after one failed retry the app refuses with a safe message rather than regenerating again.
- AI output is rendered as sanitised markdown with no raw HTML.
- AI never sees readiness answers or anything derived from them, and never decides a gate.

**Memory per user.** A structured summary (profile highlights, current strategy version, recurring mistakes, goals) is stored in Postgres and passed as context, so coaching improves over time without sending full history on every call.

**Privacy.** Names, account numbers and emails are masked before any call. Each AI feature has its own consent, and users can switch AI off entirely. Users can view and clear their coach memory. The provider must offer a data-processing agreement, short or zero retention and no training on API data; it is named in the privacy policy, and the cross-border transfer basis is recorded under the Nigeria Data Protection Act.

**Cost control.** Phase 1 ships only the tutor, with a hard per-user daily limit, answers cached by lesson and question, and a monthly spending cap at the provider plus a lower internal circuit breaker. Calls time out after 45 seconds. The provider sits behind an interface so it can be swapped.

## 11. Discipline engine and recommended features

These features target behaviour, the most common reason accounts blow. They reward process, never profit.

| ID | Feature | Phase | Requirement |
| --- | --- | --- | --- |
| DE-1 | Pre-trade checklist | 2 | Before logging a forward or live trade, the user ticks each rule; an unticked rule marks a planned rule break. |
| DE-2 | Tilt flags | 2 | Never blocks or delays logging. Tags trades as "tilt window" when: a trade opens within 30 minutes of 2 consecutive losses, the daily loss limit is reached, size exceeds 1.25× plan, or the trade is outside planned sessions or inside a news window. A frequency trigger starts only after 20+ trades of history. Shows the R cost of tilt-window trades. |
| DE-3 | Discipline score | 2 | 0–100 over the last 30 days: at least 50% from objective checks (initial stop present, risk % within plan, session and news compliance, imported trades that were journaled), the rest from self-reported rule checks, with the self-reported share shown. Unjournaled imported trades lower the score. Shows "not enough data" under 10 trades. |
| DE-4 | Routine builder | 2 | Pre-session checklist, post-session review and weekly planning with reminders (§3 Notifications). |
| DE-5 | Never-again list | 1 | Seeded in onboarding; shown on the journal form, and in the pre-trade checklist from Phase 2. |
| DE-6 | Scenario simulator | 3 | Replays major events (for example the 2015 Swiss franc unpegging) to teach gaps, slippage and leverage risk; the core lesson on gaps sits in Level 1. |
| DE-7 | Mistake library | 3 | Case studies only with explicit consent, with identifying details (dates, amounts, firm names) removed. |
| DE-8 | Scam and broker checker | 2 | How to check a broker's regulator; red-flag checklists for signal sellers and "account managers". |
| DE-9 | Streaks | 1 | For study sessions and journaling (Phase 1) and rule-following (Phase 2); never for profit. |

## 12. Community and trust features (Phase 4)

| ID | Feature | Requirement |
| --- | --- | --- |
| CT-1 | Cohorts | Groups of 8–15 users starting the Academy together, with a shared plan and weekly check-in thread. |
| CT-2 | Accountability partners | Paired users see each other's discipline score and streaks, never P&L. |
| CT-3 | Mentor reviews | Mentors with verified records review shared strategies and journals under mentor terms that forbid personalised advice. Shared journals strip imported personal data, show the user a preview and expire by default. Blocked until the legal opinion (§17). |
| CT-4 | Process leaderboards | Ranked by discipline score and learning streaks only; opt-in. |
| CT-5 | Verified track records | Only OAuth or read-only APIs with encrypted, revocable tokens; passwords (including MT4/MT5 investor passwords) are never stored. Deferred if no such API exists. |
| CT-6 | Public outcome report | Quarterly anonymised stats on progress through gates, including how many get "No edge found yet". |
| CT-7 | Native mobile app | Only if the PWA (§16) proves insufficient. |

Moderation: community content follows a code of conduct that bans signal selling, account-management offers and referral links; reported posts are hidden pending review.

## 13. Architecture

A Vite + React single-page app on Vercel talks to one Django REST backend; Django holds all business logic, analytics and AI calls, backed by PostgreSQL. Everything runs on free tiers until usage or funding justifies paid plans.

&#91;embedded content: system architecture · frontend, Django backend, managed services\]

The browser calls the API at `/api/*` on the Vercel domain, and a Vercel rewrite forwards it to Django, so the browser sees one site: the refresh cookie is first-party and no cross-origin setup is needed. Published lessons are static JSON served by Vercel, so learning works even while the backend is asleep. Screenshots upload directly to R2 with signed URLs (see §16).

| Component | Choice | Notes |
| --- | --- | --- |
| Frontend | Vite, React, TypeScript, React Router, TanStack Query, Tailwind CSS; installable PWA with a service worker | Static build on Vercel with an `/api/*` rewrite to the backend; Lightweight Charts loaded only on chart routes |
| Backend | Django 5, Django REST Framework, drf-spectacular; SimpleJWT for tokens, django-allauth only for Google sign-in | One web process on a free container host (Render or Koyeb; free tiers sleep when idle and allow a single small service, so no separate worker). Gunicorn with threaded workers (`gthread`, 2 workers × 8 threads, 90 s timeout); numpy, no pandas |
| Database | PostgreSQL on Neon (chosen) | Pooled URL for the app with `DISABLE_SERVER_SIDE_CURSORS=True`, short `CONN_MAX_AGE` with health checks and a 10 s connect timeout; a direct URL for migrations and backups |
| Background work | No always-on worker | Verdicts and metrics compute in the request (milliseconds); imports and AI reviews run in a thread in the web process with a Job row tracking progress; anything unfinished is picked up by the sweep |
| Scheduled sweep | GitHub Actions cron (private repo) calling an HMAC-signed `POST /internal/jobs/sweep` | Idempotent; sends due notifications, retries stuck jobs, cleans unconfirmed uploads; finishes within 60 s; timing accurate to about ±30 minutes |
| Object storage | Cloudflare R2 (chosen) | Private bucket, per-user key prefix, short-lived signed URLs |
| Backups | Nightly `pg_dump` via GitHub Actions to a separate encrypted R2 bucket | 35-day retention; restore rehearsed before outside users join |
| Email | A transactional provider's free tier | Verification, password reset, weekly digest only |
| Monitoring | Sentry free plan | PII scrubbing on, `send_default_pii=False` |

**Environments.** Local (Docker Compose with Postgres) and production; staging runs locally or shares the production host's free quota until the project is paid for. Configuration through environment variables only, with a secrets inventory listing owner and rotation date for each key.

## 14. Data model

PostgreSQL with Django ORM. All tables carry `id` (UUID), `created_at` and `updated_at`; user-owned tables carry `user_id` and are filtered by it in every query. Key entities by app:

| Django app | Entity | Key fields | Relationships |
| --- | --- | --- | --- |
| accounts | User | email, name, timezone, role | has one Profile |
| accounts | Profile | style, sessions, weekly\_hours, risk\_comfort, answers (JSONB), readiness (encrypted JSONB), plan\_accepted\_at | belongs to User |
| accounts | NeverAgainItem | text, order | belongs to User |
| academy | Level, Module, Lesson | order, title, status, version | Level → Modules → Lessons |
| academy | LessonBlock | type, content (JSONB), order | belongs to Lesson |
| academy | Question | type, prompt, options (JSONB), answer (JSONB), tolerance, concept\_tags | many-to-many with Exam via bank |
| academy | Exam, ExamAttempt | pass\_mark, cooldown / score, passed, answers (JSONB) | Attempt belongs to User and Exam |
| academy | LessonProgress, ReviewCard | completed\_blocks / concept, due\_at, interval | belong to User |
| library | Book, Chapter, CompanionNote | title, author, access\_links, public\_domain / chapter refs / notes | Chapter → Module mapping |
| schedule | StudyPlan, StudySession | weekly\_hours / date, type, target\_id, done | belong to User |
| strategy | Strategy | name, status | belongs to User; has Versions |
| strategy | StrategyVersion | number, reason, rules (JSONB), risk\_plan (JSONB), clarity\_status, locked | belongs to Strategy |
| strategy | RuleExample | rule\_key, valid, image\_key, note | belongs to Version |
| testing | TestSession | type, instrument, date\_from, date\_to, split (dev/validation), source | belongs to Version |
| testing | Trade | instrument, side, entry, stop, target, size, opened\_at, closed\_at, r\_result, pnl, fees, rules\_followed, broken\_rules (JSONB), tags (JSONB), notes, external\_ticket | belongs to TestSession |
| testing | TradeImage | kind (before/after), image\_key | belongs to Trade |
| testing | Import | file\_key, format, status, mapping (JSONB), report | belongs to User |
| analytics | MetricSnapshot | scope, period, metrics (JSONB), computed\_at | per Version and session type |
| analytics | Verdict | verdict, confidence, inputs (JSONB), outputs (JSONB), config\_version | belongs to Version |
| gates | GateConfig | gate, criteria (JSONB), version | admin-managed |
| gates | GatePass | gate, passed\_at, evidence (JSONB) | belongs to User |
| discipline | DisciplineScore, TiltEvent, Review | score, components / reason / type, answers | belong to User |
| ladder | PropFirm, FirmRuleSet | name, rules (JSONB), verified\_at | admin-managed |
| ladder | LadderStep, Spend, Payout | level, criteria / amount, date / amount, date | belong to User |
| ai | AIInteraction | feature, model, tokens, cost, flagged | belongs to User |
| ai | CoachMemory | summary (JSONB), updated\_at | one per User |
| audit | AuditLog | actor, action, target, at | system-wide |

**Changes from peer review.** These additions and changes take precedence over the table above.

| Django app | Entity | Change |
| --- | --- | --- |
| accounts | Profile | Adds `readiness_risk_flag` (plaintext boolean), `over_18_confirmed_at`, `last_active_at`; money-related answers move into the encrypted field |
| accounts | SupportGrant | New: user, scope, expires\_at; checked before any admin read of user data |
| accounts | ActivityEvent | New: user, type, ref, at; powers retention and funnel metrics |
| academy | Exam | Adds `scope` (module, level, placement) and `level_id` |
| academy | ExamAttempt | Adds `drawn_question_ids`, `started_at`, `submitted_at`; graded on the server |
| academy | QuestionReport | New: user, question, reason, status |
| strategy | StrategyVersion | Adds `kind` (mechanical or discretionary), `cost_model` (JSONB per instrument), `max_drawdown_r` in the risk plan |
| testing | TestSession | Renamed **TestRun**; references a DataSplit instead of storing a split |
| testing | DataSplit | New: strategy, instrument, dev\_from, dev\_to, val\_from, val\_to |
| testing | ValidationUse | New: data\_split, strategy\_version, test\_run, used\_at; unique per split and strategy (a window is used once) |
| testing | SetupSeen | New: test\_run, seen\_at, taken (bool), skip\_reason |
| testing | TradingAccount | New: user, kind (demo, live, prop), broker, currency, prop\_ruleset (nullable) |
| testing | Trade | Adds non-null `user_id` and `account_id`; `test_run_id` becomes nullable; adds `initial_stop`, `initial_risk_ccy`, `exit_price`, `outcome`, `setup_key`, `market_session`, `mae_r`, `swap`, `cluster_id`, `tilt_window`; unique (account\_id, external\_ticket) where a ticket exists; indexes on (user\_id, opened\_at) and (test\_run\_id, closed\_at) |
| analytics | Verdict | Adds `trade_set_hash`, `range_low`, `range_high`, `seed`, `risk_pct_used` |
| gates | GatePass | Adds `strategy_version_id` (nullable), `config_version`, `revoked_at`, `revoke_reason` |
| ladder | LadderBudget | New: user, year, cap |
| core | Job | New: user, kind, status, progress, result, error; filtered by user |
| core | Notification | New: user, type, channel, due\_at, sent\_at, dedupe\_key |
| core | UploadIntent | New: user, key, content\_type, size, confirmed\_at; unconfirmed rows swept after 24 hours |
| audit | AuditLog | `actor_id` stored as a UUID, not a foreign key; append-only |

JSONB is used only where structure varies (rule sets, question options, metrics); anything filtered or joined on gets a real column and an index.

## 15. API design

REST API with Django REST Framework under `/api/v1/`, JSON only, documented with an OpenAPI schema (drf-spectacular). Authentication by short-lived JWT access tokens kept in memory only, and a rotating refresh token in an HttpOnly, Secure, SameSite=Lax cookie scoped to the refresh path (first-party through the Vercel proxy); reuse of an old refresh token revokes all of that user's sessions. List endpoints are paginated (cursor-based).

| Module | Main endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/google`, `POST /auth/verify-email`, `POST /auth/password-reset` |
| Profile | `GET/PATCH /me`, `GET/PUT /me/profile`, `POST /me/plan/accept`, `GET /me/gates` |
| Academy | `GET /levels`, `GET /modules/{id}`, `GET /lessons/{id}`, `POST /lessons/{id}/progress`, `POST /exams/{id}/attempts`, `GET /review-cards/due`, `POST /review-cards/{id}/answer` |
| Library | `GET /books`, `GET /modules/{id}/reading`, `POST /reading/{id}/checkin` |
| Schedule | `GET /me/timetable`, `PATCH /me/timetable/settings`, `GET /me/timetable.ics` |
| Strategy | `GET/POST /strategies`, `GET/PATCH /strategies/{id}`, `POST /strategies/{id}/versions`, `POST /versions/{id}/clarity-check`, `POST /versions/{id}/examples`, `GET /versions/{id}/plan.pdf` |
| Testing | `GET/POST /versions/{id}/sessions`, `GET/POST /sessions/{id}/trades`, `PATCH/DELETE /trades/{id}`, `POST /imports` (TradingView CSV, MT4/MT5), `GET /imports/{id}` |
| Uploads | `POST /uploads/presign` returns a signed URL for direct screenshot upload to object storage |
| Analytics | `GET /versions/{id}/metrics`, `GET /versions/{id}/verdict`, `POST /versions/{id}/verdict/recompute`, `GET /me/journal/breakdowns` |
| Discipline | `GET /me/discipline-score`, `POST /me/reviews`, `GET /me/tilt-events` |
| AI | `POST /ai/tutor`, `POST /ai/journal-review`, `POST /ai/explain-verdict`, `POST /ai/pine-script` |
| Ladder | `GET /prop-firms`, `POST /versions/{id}/fit-check`, `GET/POST /me/ladder`, `GET/POST /me/spend` |
| Data rights | `GET /me/export`, `DELETE /me` |

**Added after review**

| Module | Endpoints |
| --- | --- |
| Account | `POST /me/security/password`, `POST /me/security/email`, `POST /me/security/logout-all`, `DELETE /me/security/google`, `GET/PATCH /me/settings` |
| Exams | `GET /exams/{id}`, `POST /exams/{id}/attempts` (draws questions server-side, returns prompts only), `POST /attempts/{id}/submit`, `POST /questions/{id}/report` |
| Testing | `GET/POST /strategies/{id}/data-splits`, `POST /runs/{id}/setups-seen`, `GET /me/trades/unassigned`, `GET /runs/{id}/drift` |
| Uploads | `POST /uploads/presign` (takes size and type; refuses over 5 MB or non-image types), `POST /uploads/{key}/confirm` (checks the stored object, re-encodes and strips EXIF) |
| Accounts | `GET/POST /me/trading-accounts` |
| Gates | `GET /me/gate-passes` (history, including revocations) |
| AI | `POST /ai/clarity-advice`, `POST /ai/chart-review`, `POST /ai/monthly-review`, `GET/DELETE /me/coach-memory` |
| Notifications | `GET /me/notifications`, `PATCH /me/notification-preferences` |
| Support | `POST/DELETE /me/support-grants` |
| Jobs | `GET /jobs/{id}` (owner only) |
| Internal | `POST /internal/jobs/sweep` (HMAC signature with timestamp; no user auth) |

Learner responses never include `answer` or `tolerance` fields; a serializer test enforces this.

**Conventions.** Errors return a JSON body with `code`, `message` and field errors. Rate limits per user and per IP (stricter on auth and AI). Long jobs (imports, verdict recompute, AI reviews) return `202 Accepted` with a job ID; the client polls `GET /jobs/{id}`.

## 16. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Security | HTTPS everywhere; Argon2 password hashing; CSRF double-submit tokens on cookie-authenticated endpoints; Cloudflare Turnstile on signup and password reset; generic responses that don't reveal whether an account exists; dependency and secret scanning in CI; least-privilege keys (for example a storage key limited to one bucket). |
| Admin | Django admin at a non-default path with 2FA (django-otp); only content, config and prop-firm models registered; encrypted fields never shown; user data reachable only through a SupportGrant. |
| Rate limits | Shared Postgres-backed cache so limits hold across threads and restarts; only the host's known proxy hops trusted for client IP; per-account caps on auth emails; per-user AI budgets. |
| Uploads | PNG, JPEG or WebP only; per-user key prefix; size and type checked on confirm; re-encoded with EXIF stripped; served with `Content-Disposition: attachment`, `nosniff` and signed URLs of 5 minutes or less. |
| Encryption | Field-level envelope encryption with the master key stored apart from the database credentials; key ID stored with each value; `MultiFernet` rotation. |
| Data isolation | Every user-owned query goes through a shared base queryset filtered by the authenticated user; tests prove one user can't read another's data. |
| Deletion and retention | Account deletion purges database rows, storage prefixes and coach memory, and records a tombstone; backups age out within 35 days; a published retention period per data type. |
| Performance | API p95 under 500 ms for reads once warm. |
| Cold starts | If the API doesn't answer within 2 seconds, show a waking state and retry with backoff for up to 60 seconds, then an offline mode that keeps the user's work; a failed refresh during wake-up never logs the user out. Lessons keep working because they are static. |
| Mobile and low bandwidth | Every Phase 1 flow works at 360 px width with touch; installable PWA that caches published lessons and queues journal entries offline; under 300 KB of JavaScript (gzip) on first load; data-saver mode. |
| Accessibility | WCAG 2.2 AA: keyboard navigation, screen-reader labels on simulators, colour never the only signal. |
| Observability | Structured logs with request IDs, AI cost dashboard, gate decision audit trail, Sentry with PII scrubbing. |

**Empty, error and offline states.** Every main screen (dashboard, lesson, exam, journal, strategy, verdict, import) has a specified first-run state, error state and offline state, with acceptance criteria written as Given/When/Then before it is built. Examples: zero trades shows how to log a first practice trade; a partly failed import lists the rejected rows and why; an exhausted AI quota explains when it resets.

## 17. Legal, compliance and content rights

- **Investment-advice boundary.** The Investments and Securities Act 2025 widened SEC Nigeria's reach, and the SEC has warned about unregistered online investment platforms ([ISA 2025 summary](https://resource.scp-law.com/2025/04/30/nigerias-investment-and-securities-act-2025-whats-changed-and-why-it-matters/), [SEC warning](https://businessday.ng/markets/article/nigerias-sec-warns-on-proliferation-of-unregistered-online-platforms/)). Obtain a written opinion from a Nigerian securities lawyer before public launch; the funded ladder, challenge replay and mentor reviews stay blocked until it exists.
- **Wording rules.** Outputs describe the user's own data and rules ("your rule says X; your data shows Y"); never "we recommend". Users set their own risk limits, with teaching ranges. No firm rankings. "Proven" is not used in product copy.
- **Data protection (NDPA 2023).** Complete a data protection impact assessment before outside users join in Phase 2 (profiling, new technology and cross-border AI transfer are triggers); keep a records-of-processing register; name a data protection officer; run an incident runbook with 72-hour breach notice to the Nigeria Data Protection Commission; track user numbers against the 2025 implementation directive's thresholds for registration and audit filing ([NDPA overview](https://www.mondaq.com/nigeria/data-protection/1366934/the-nigerias-data-protection-act-2023-a-look-at-key-provisions), [GAID 2025](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf)). A data-protection lawyer confirms which tier applies.
- **AI provider.** Data-processing agreement, retention terms and recorded cross-border transfer basis before any user data is sent (§10).
- **Consumer protection.** Terms of service covering education-only use, no guarantee of results, AI output not being advice, liability limits, governing law and complaints; reviewed by a lawyer against the FCCPA 2018. Risk warnings at signup, before forward testing, before micro-live and before the ladder.
- **Content rights.** Companion notes are original writing; books are linked, not hosted, unless public domain; confirm licences for any historical price data shown in lessons.
- **Age.** 18+ only, with a confirmed age statement at signup (AS-4).
- **Third-party tools.** The Free Chart and TradingView are linked as external tools; EdgeProof has no affiliation and stores only what users import.

## 18. Testing and QA strategy

| Layer | Approach |
| --- | --- |
| Analytics and gates | Hand-computed fixtures for every metric, verdict rule and gate; property-based tests for edge cases (no trades, all wins, all losses, breakevens, zero losses for profit factor); fixed seeds for bootstrap and Monte Carlo; a simulated zero-edge strategy must pass the verdict less than 10% of the time. |
| Acceptance criteria | Given/When/Then for every gate, verdict, import and empty or error state, written before the feature is built. |
| API | pytest with the DRF test client; permission tests for every endpoint, including cross-user access and gate bypass attempts; serializer test that answers never reach learners. |
| Imports | Fixtures for TradingView and MT4/MT5 files, including malformed rows, duplicates, XSS payloads, an XML bomb, formula payloads and oversized files. |
| Frontend | Vitest for components and simulators; Playwright end-to-end on a 360 px viewport for onboarding, exam pass and fail, practice journal, strategy creation and verdict; offline and cold-start scenarios. |
| AI | Evaluation set checked on every prompt change for forbidden outputs (signals, predictions, invented numbers) and prompt-injection cases planted in notes, rules and imports. |
| Dogfooding | Each phase used by the founder for at least 4 weeks, then by outside users before the next phase. |
| CI | GitHub Actions: lint, type-check, tests, migration check and secret scanning on every pull request; Vercel preview deploys. |

## 19. Peer review findings and resolutions

Four independent reviewers raised 60 findings (7 critical, 27 high); all critical and high findings are resolved in this version, and the rest are resolved or scheduled. The biggest changes: Phase 1 no longer contradicts its own gates, Phase 1 scope is cut to what one person can build, the edge verdict is much harder to pass by luck, and the free-tier runtime (auth, jobs, backups) is now designed rather than assumed.

| Reviewer | Lens | Critical | High | Medium | Low |
| --- | --- | --- | --- | --- | --- |
| Architecture | Backend, data model, free-tier runtime | 2 | 5 | 7 | 1 |
| Trading | Statistics, verdicts, curriculum | 3 | 8 | 4 | 0 |
| Security and legal | AppSec, privacy, Nigerian law | 0 | 8 | 6 | 1 |
| Product and UX | Scope, UX, spec quality | 2 | 6 | 6 | 1 |

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| ARCH-1, PM-1 | Critical | Phase 1 couldn't reach the Lab or log trades under its own gates | Phase-aware gates; ungated practice journal (§2, §7, §8) |
| TRD-1 | Critical | Verdict passed zero-edge strategies 35–40% of the time | Thresholds raised; bootstrap lower bound required; dev expectancy must be positive (§8) |
| TRD-2 | Critical | Validation data could be reused across versions | Window burned per strategy; max 3 attempts; bar rises with attempts (BT-3, SL-7) |
| TRD-3 | Critical | Manual replay hindsight bias | Random start, setups-seen log, minimum ranges, per-year warning (BT-2, BT-4, BT-8) |
| PM-2 | Critical | Content writing unplanned and underestimated | Content authoring plan; Markdown in repo; Level 1 first (§5) |
| ARCH-2 | Critical | Worker can't run on free hosts | No always-on worker; in-request compute, threaded jobs, signed sweep (§13) |
| ARCH-3, SEC-1 | High | Cross-site refresh cookie | Vercel `/api` proxy, first-party cookie, in-memory access token (§13, §15) |
| ARCH-4 | High | Trade model too narrow | TradingAccount, nullable run, user\_id, new columns and indexes (§14) |
| ARCH-5 | High | Gate passes not per version or server-enforced | GatePass per version, revocation, permission classes (§8, §14) |
| ARCH-6 | High | Split rules not modelled | DataSplit and ValidationUse (§14) |
| ARCH-7 | High | No real backups on free tiers | Neon chosen; nightly pg\_dump to R2; restore rehearsal (§13) |
| TRD-4 | High | Gate 5 could pass negative forward results | New Gate 5 criteria; drift rules; execution diagnosis (§8, §9) |
| TRD-5 | High | R undefined | R defined on initial risk; partials merged; no-stop trades excluded (JR-3, JR-4) |
| TRD-6 | High | Costs not enforced | Cost model per version; re-costing of imports; costs-share warning (§6, BT-7, §8) |
| TRD-7 | High | Discretionary strategies judged like mechanical | Classification and stricter thresholds (SL-5, §8) |
| TRD-8 | High | Correlated trades inflate samples | Clustering; currency exposure limit (§6, §8) |
| TRD-9 | High | Bootstrap and drawdown assumptions | Block bootstrap; Monte Carlo drawdown (§8) |
| TRD-10 | High | Prop fit check unrealistic | MAE-based Monte Carlo with ranges; firm-risk notes; fee cap (FL-1, FL-2, FL-5) |
| TRD-11 | High | Tilt cool-off punished honest logging | Flags only, never blocks (DE-2) |
| SEC-2 | High | Unsafe statement parsing and PII | Safe parser, header dropped, file deleted, CSV escaping (JR-7, JR-10) |
| SEC-3, ARCH-11 | High | Uploads not enforceable | Upload intents, confirm step, re-encode, per-user prefix (§15, §16) |
| SEC-4 | High | AI data transfer unaddressed | Masking, per-feature consent, DPA, transfer basis (§10) |
| SEC-5 | High | NDPA obligations missing | DPIA, register, DPO, breach runbook, threshold tracking (§17) |
| SEC-6 | High | Features could look like investment advice | Wording rules; ladder and mentors blocked until legal opinion (§9, §17) |
| SEC-7 | High | Prompt injection and unsafe AI output | Delimiters, server-side checks, sanitised rendering, AI never decides gates (§10) |
| SEC-8 | High | Deletion didn't reach backups and logs | Deletion job, 35-day backup expiry, Sentry scrubbing (§16) |
| PM-3, TRD-14 | High | Long mandatory Academy hurts retention | Placement exams; drafting from Level 2; time-to-Lab shown (§4, §5, §6) |
| PM-4 | High | Phase 1 too big | Phase 1 cut and build order (§2) |
| PM-5 | High | Metrics not measurable | ActivityEvent, Exam scope, LadderBudget; targets from outside users (§1, §14) |
| PM-6 | High | 15-minute onboarding | 3-minute onboarding; readiness moved to Phase 2 (§4) |
| PM-7 | High | No mobile-first design | 360 px requirement, PWA, client compression (§16, JR-11) |
| PM-8 | High | Cold-start experience untestable | Static lessons; acceptance criteria for waking and offline (§13, §16) |
| TRD-15 | Medium | Verdict names overclaim | Renamed verdicts; range always shown; micro-live step (§8, FT-5) |
| TRD-12 | Medium | Discipline score gameable | Objective checks weighted ≥ 50% (DE-3) |
| TRD-13 | Medium | Curriculum gaps and reading list | Modules added; reading list revised; paid books optional (§5) |
| ARCH-8, PM-11 | Medium | Reminders and notifications unspecified | Notification table, sweep, digest, ±30 min (§3, §13) |
| ARCH-9 | Medium | Neon pooling settings | Settings added (§13) |
| ARCH-10 | Medium | Exam answers could leak | Server-side draw and grading; serializer test (AC-5, §15) |
| ARCH-12 | Medium | Verdict recompute and storage | Full debounced recompute; verdict stores inputs (§8, §14) |
| ARCH-13 | Medium | Sync AI calls block the server | Threaded Gunicorn; streaming; 45 s timeout (§10, §13) |
| ARCH-14, SEC-10 | Medium | Admin exposure and key management | Hardened admin; SupportGrant; envelope encryption (§16) |
| SEC-9 | Medium | Encryption key management | Envelope encryption, key IDs, rotation (§16) |
| SEC-11 | Medium | Rate limits and abuse | Shared cache limits, Turnstile, AI budgets (§16) |
| SEC-12 | Medium | Job endpoint and feed tokens | HMAC-signed sweep; revocable feed tokens; secrets inventory (§13, RL-5) |
| SEC-13 | Medium | Phase 4 sharing and broker credentials | No stored passwords; stripped, expiring shares (CT-3, CT-5) |
| SEC-14 | Medium | Consumer protection | Terms, verified-date rules, no "proven" (§17, FL-1) |
| PM-9 | Medium | No exam recovery path | Immediate retake, question reports, admin override (AC-6, AC-8) |
| PM-10 | Medium | Gate 3 non-deterministic | Code-based clarity checks; AI advisory only (SL-3, SL-4) |
| PM-12 | Medium | Account management missing | Account and settings requirements (§3, §15) |
| PM-13 | Medium | Ambiguous requirements | Max drawdown field, tolerance definition, Given/When/Then, empty states (§6, AC-3, §16, §18) |
| PM-14 | Medium | Phase dependencies | Phase column on requirements; never-again list on journal form (§4–§11) |
| ARCH-15 | Low | Small consistency gaps | Job entity, missing endpoints, TestSession renamed TestRun (§14, §15) |
| SEC-15 | Low | Age check had no mechanism | Confirmed age statement (AS-4) |
| PM-15 | Low | AI scope and founder-only exit criteria | Tutor only in Phase 1; outside-user exit criteria (§2, §10) |

## 20. Open questions

- [ ] Final product name and domain
- [ ] Render or Koyeb for the Django service, after checking current free-tier terms
- [ ] AI provider with a data-processing agreement, and the monthly spending cap
- [ ] Written legal opinion on the investment-advice boundary (blocks Phase 3 ladder and mentor features)
- [ ] Data protection impact assessment before Phase 2 outside users
- [ ] Gate thresholds and exam pass marks reviewed with experienced traders
- [ ] Content calendar and writing-time estimates for Levels 1–2
- [ ] Whether The Free Chart offers any export EdgeProof can import
