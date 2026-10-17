# Fundamental Bias Scanner: build notes

*How the spec "Edge Proof — Fundamental Bias Scanner Spec" (12 Oct 2026) is built in EdgeProof, reviewed by three experts: a forex analyst, a software engineer and a product designer. Founder decisions (17 Oct 2026): build all of it now, ignore the spec's phased build plan, no gate on the feature, the Scanner tab replaces Progress in the sidebar, and skip spec requirements that don't match the product.*

---

## 1. What changes from the spec, and why

| Spec says | Built as | Reason |
| --- | --- | --- |
| For users who finished the foundation course | Open to every signed-in user | Founder decision: no gate |
| Phased 6–8 week build plan | Built in one pass | Founder decision |
| Email alerts from `check_health` | In-app status screen and server logs | No email provider yet (roadmap: email arrives with account security) |
| OANDA v20 or Twelve Data for prices | Twelve Data | Key provided |
| OECD/FRED/DBnomics for macro | Per-factor source chains, freshest wins (table in §2) | Several OECD mirrors on FRED stopped updating in 2022–2025; probed every series on 17 Oct 2026 |
| CFTC public API (Socrata) | CFTC's published report files (`deafut.txt`, yearly `deacot{year}.zip`) | The Socrata host wasn't reachable; the files carry the same legacy futures report |
| GitHub Actions calls management commands | GitHub Actions calls one HMAC-signed endpoint per job (same pattern as the existing sweep); the same jobs run as management commands locally | The free host can't run commands from CI; the endpoint runs the job in a thread with a Job row |
| `/api/scanner/...` | `/api/v1/scanner/...` | All API routes are versioned under `/api/v1/` (spec §15) |
| "Publish the results inside Edge Proof" (validation) | An **Evidence** tab, computed from weekly snapshots including the 3-year historical replay | Same goal; it's live now rather than at the end of a later phase |
| Open question: AI-written summary | Template summary written by code, no AI cost | Keeps the feature free and deterministic; an AI summary can be added later through the tutor's provider layer |
| Open question: user-adjustable weights | One house model, weights in a versioned config table | Clearer for v1; the spec's own recommendation |
| Schedule in WAT | Same times in UTC in the workflow (WAT = UTC+1) | GitHub Actions cron is UTC |

Everything else in the spec is built as written: 8 currencies, 28 pairs, 8 factors, the −2…+2 factor rules, the currency and pair formulas, the five labels, stale-data rules, weekly snapshots, history, rankings, scorecards and the read-only API.

## 2. Data sources actually used

Probed live on 17 Oct 2026. Each currency/factor has an ordered chain; the newest observation wins, and anything past the factor's refresh window is excluded and marked stale.

| Factor | USD | EUR | GBP | JPY | AUD | NZD | CAD | CHF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COT | CFTC USD Index (098662) | CFTC Euro FX (099741) | CFTC British pound (096742) | CFTC Japanese yen (097741) | CFTC Australian dollar (232741) | CFTC NZ dollar (112741) | CFTC Canadian dollar (090741) | CFTC Swiss franc (092741) |
| Policy rate | BIS daily | BIS daily | BIS daily | BIS daily | BIS daily | BIS daily | BIS daily | BIS daily |
| CPI y/y | OECD | FRED HICP index (y/y computed) | OECD | IMF via DBnomics (stale since 2025-07) | OECD (quarterly) | OECD (quarterly) | OECD | SNB |
| Real GDP q/q | OECD | Eurostat | OECD | OECD | OECD | OECD | OECD | OECD |
| Unemployment | OECD | Eurostat | OECD | OECD | OECD | OECD (quarterly) | OECD | OECD (quarterly) |
| Business confidence | OECD | OECD | OECD | OECD | OECD | OECD | OECD | OECD |
| Price trend (pairs) | Twelve Data daily closes for all 28 pairs | | | | | | | |
| Retail sentiment (pairs) | Myfxbook Community Outlook, all 28 pairs, with sample size | | | | | | | |

**Known gap:** Japan CPI. OECD stopped publishing it in 2021 and the freshest free keyless source (IMF) ends in July 2025, so JPY inflation shows as stale and is excluded under the spec's own rule. A free e-Stat (Statistics Japan) app ID would close the gap; see open questions.

## 3. Forex analyst

*Lens: does each number mean what a macro trader thinks it means, and is the method honest about what it can't know?*

- **Factor directions are right for FX.** Higher-than-target inflation scores bullish because it points to a tighter central bank, not because inflation is good. The explanation text says so, or users will read it as a contradiction.
- **Inflation targets** (midpoint where a range is used): US 2, EUR 2, GBP 2, JPY 2, AUD 2.5 (2–3 band), NZD 2 (1–3 band), CAD 2, CHF 1 (0–2 band). Stored in config with the other thresholds.
- **Rate cycle rules made exact:** "hiked within 6 months" means the latest change was up and within 183 days; "holding after hikes" means the latest change was up but older; "no clear cycle" means no change in the last 24 months; cuts mirror hikes. Moves of under 5 bp are ignored (BIS series carry rounding).
- **COT:** net non-commercial position (long − short) for each currency's CME future, ranked within the last 52 weekly reports. USD uses the ICE Dollar Index contract, as the spec says. The JPY and CHF contracts are quoted as the foreign currency against USD, so long = foreign-currency bullish; no sign flip is needed.
- **Quarterly series** (AUD and NZD CPI, NZD and CHF unemployment): "3 months ago" means one quarter earlier. The refresh windows widen to 120 days for these.
- **Price trend:** four signals (above 20, 50 and 200-day SMAs; 50-day SMA higher than 10 days ago). All four bullish = +2; net +2 or +3 = +1; net −1 to +1 = 0; net −2 or −3 = −1; all four bearish = −2.
- **Retail sentiment is contrarian and thin.** The sample size is always shown; under 500 positions, the factor is shown but greyed with "small sample".
- **What I'd add for value (built):** an **agreement** line on each scorecard ("5 of 8 factors point the same way"), because a ±6 built on two loud factors deserves less trust than one built on six quiet ones. It's displayed but doesn't change the score, so the spec's method stays intact.
- **Honesty:** the Evidence tab shows hit rates with sample sizes and says plainly that the replay uses approximate release dates (below). If Very Bullish/Very Bearish don't beat Neutral, the tab says so.
- **Release lags for the replay** (to avoid look-ahead, the spec's validation rule): COT available 3 days after its as-of Tuesday; policy rates the same day; CPI 15 days after month end; unemployment 30 days; business confidence 10 days; GDP 45 days after quarter end; prices at the close.

## 4. Software engineer

*Lens: one-way pipeline, idempotent jobs, pure scoring, nothing the UI computes.*

- **App `scanner`** with the spec's tables: `Currency`, `Pair`, `DataSource`, `RawObservation` (unique on factor + subject + period), `FactorConfig` (versioned), `ScoringRun`, `FactorScore`, `CurrencyScore`, `PairScore`. Currencies, pairs and default config are seeded by a data migration.
- **Sources** (`scanner/sources/*.py`): one small adapter per provider (CFTC, BIS, OECD, Eurostat, FRED, SNB, DBnomics, Twelve Data, Myfxbook), all on the standard library with `certifi`, timeouts and a polite User-Agent. Each returns observations; ingestion upserts them and updates `DataSource` health.
- **Scoring** (`scanner/scoring.py`): pure functions from observations to factor scores, currency scores, pair scores, labels and ranks. Unit tests cover every factor rule, the spec's worked example (GBPUSD = −5.75, Bearish), stale renormalisation and the "more than 2 missing" rule.
- **Runs:** every run is stored; Saturday runs (after COT) are weekly snapshots. `as_of` makes the same engine replay history week by week using only data released by then.
- **Jobs:** `fetch_prices`, `fetch_sentiment`, `fetch_macro`, `fetch_cot`, `run_scoring`, `check_health`, plus `backfill` (3 years) and `replay` (weekly snapshots from history). Locally: `manage.py scanner <job>`. Deployed: GitHub Actions → `POST /internal/scanner/<job>` (HMAC, like the sweep) → background thread + Job row.
- **Rate limits:** Twelve Data's free tier allows 8 requests a minute; prices fetch in batches of 8 symbols with a pause. Myfxbook logs in once per run and logs out.
- **API** (signed-in users, no gate), cached until the next run: `GET /api/v1/scanner/pairs`, `/currencies`, `/pairs/{symbol}`, `/pairs/{symbol}/history`, `/status`, `/evidence`.
- **Redistribution:** raw third-party series are never served in bulk; scorecards show the value behind each factor score with its source and date, which is what the spec asks for.

## 5. Product designer

*Lens: a learner on a 360 px phone should read the bias, the reason and the date in one glance, and never mistake it for a signal.*

- **Navigation:** the Scanner tab (radar icon) replaces Progress in the sidebar and tab bar. Progress stays in the Profile.
- **Screens:** one Scanner page with three tabs: **Pairs** (default rankings), **Currencies** (strength board) and **Evidence** (validation). Plus the **pair scorecard** (`/scanner/EURUSD`) with the bias history beneath it, and a currency breakdown sheet.
- **Five label colours** (spec rule) mapped to tokens, never colour alone: Very Bullish = `--gain` solid; Bullish = `--gain` tint; Neutral = `--neutral-data`; Bearish = `--loss` tint; Very Bearish = `--loss` solid. Colour-blind mode switches gain/loss to blue/orange automatically. Every chip carries its word.
- **Score bar:** a diverging bar from −10 to +10 with a marked zero line, the scanner's version of the range bar. Rows show rank, pair, the bar, the score in mono (+6.2), the label chip and a week-on-week arrow with its value.
- **Scorecard on mobile:** factor rows stack as cards (factor name, base value and score, quote value and score, contribution), not a wide table, so there's no horizontal scrolling at 360 px. Desktop shows the side-by-side table.
- **History chart:** the spec asked for score and weekly close on one chart; that would need two y-axes, which DESIGN.md bans. Two stacked charts share the time axis instead: score with the five label bands, then the weekly close.
- **Trust details on every screen:** "Last updated", a stale badge on any factor past its window, and one disclaimer line: "Educational analysis of fundamentals, not a trade signal."
- **Teaching:** each factor has a "What this measures" popover and links to the Academy lesson that teaches it (rates → Level 5 interest rates; inflation and labour → actual versus expected; growth and business confidence → the economic calendar; trend → moving averages; retail sentiment → fear and greed; COT → what moves currency prices).

## 6. Open questions

1. **Japan CPI:** register a free e-Stat app ID (`ESTAT_APP_ID`) so JPY inflation can be current?
2. **Redistribution terms:** each provider's terms must be checked before public launch (spec requirement; a founder task).

## 7. Evidence and "Explain it simply" (founder request, 17 Oct 2026)

**Analyst.** A score is only teachable if a learner can see what's under it. Every factor now has an Evidence sheet:
- the recent official prints the score used (policy rates shown as decisions: level, date it took effect, size of the move; COT with long and short contracts; release dates, marked "about" when estimated);
- a link to the original release (Fed, ECB, BoE, BoJ, RBA, RBNZ, BoC and SNB decisions pages; BLS, Eurostat, ONS, Statistics Bureau of Japan, ABS, Stats NZ, Statistics Canada, Swiss FSO; CFTC; OECD BCI);
- central bank publications on the topic, from each bank's own RSS feed (primary sources, no news API). Items are tagged by factor with keyword rules and housekeeping (bank notes, appointments, data portals) is dropped. The RBA blocks automated requests, so AUD has links but no feed;
- scheduled releases from the Forex Factory weekly calendar (forecast and previous only; actual figures stay with the official sources). Unofficial feed: fetched once a day, cached, shown with a link back, never redistributed. It rate-limits (HTTP 429) on repeated fetches.

**Engineer.** `Publication` and `CalendarEvent` models; `fetch_news` job (central bank feeds + calendar) scheduled daily at 05:30 UTC. Endpoints: `GET /scanner/factor/{pair|currency}/{factor}`, `GET /scanner/calendar/{pair|currency}`, `GET /scanner/explain/status`, `POST /scanner/explain` (server-sent events). Explanations use the AI provider chain (Gemini/Groq failover) with the tutor's guardrails: rules in the system prompt, data in tags, the code check for signal language and invented prices, one rewrite then a refusal, cost logging and the monthly circuit breaker. Only public data is sent, so there is no consent step; the Settings AI switch still applies. Answers are cached per scoring run + subject + factor and shared, so cached ones are free; new ones count toward `AI_SCANNER_DAILY_LIMIT` (20). Cached API responses carry a `CACHE_VERSION` so code changes invalidate them.

**Designer.** "Evidence" sits under each factor name (scorecard and currency board) and opens a bottom sheet on phones, a side sheet on desktop. "Explain it simply" is a secondary button (the amber stays free) at the top of each sheet, under the pair summary and inside each expanded currency. The explanation streams into a quiet panel labelled "Explained simply" with the footer "Written by AI from the data on this page. It can make mistakes and is not advice." The scorecard gains a "Coming up" section with the next releases and speeches for both currencies.
