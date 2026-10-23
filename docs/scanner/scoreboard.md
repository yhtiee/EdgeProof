# Scoreboard and final bias: build notes

*Founder request, 23 Oct 2026: rebuild a well-known retail scanner's ranking method (benchmark: a screenshot of its board for 23 Oct 2026, kept as `backend/tests/fixtures/scoreboard_benchmark_2026-10-23.csv`) and **add it to our own model** so the two together decide each pair's bias and ranking. We copy the method, not the product: no third-party name, branding or layout.*

---

## 1. How the two models combine

| | Regime score (existing weighted model) | Momentum score (from the scoreboard) |
| --- | --- | --- |
| Question | Where is each economy and central bank? | Are the latest releases beating or missing forecasts? |
| Inputs | COT percentile, rate cycle, inflation vs target, GDP, unemployment trend, business confidence, trend, retail | The scoreboard's 14 macro columns and seasonality |
| Range | −10…+10 | −10…+10 (column sum over the columns with data) |

**Final bias = 0.5 × regime + 0.5 × momentum.** The Pairs tab ranks by it (most bullish first) and uses the existing five labels (±2, ±6). Trend, retail and COT count once, inside the regime score. If momentum has fewer than 5 macro columns with data, the final bias is the regime score alone. **Mixed** marks a pair whose two halves are both at least ±2 and point opposite ways. The weight is a `FactorConfig` row named `momentum`, so it can be tuned without code; revisit it once 12 weekly snapshots carry momentum.

The **Scoreboard** tab shows the benchmark-style board on its own (18 columns, plain sum, its own labels) so its match with the benchmark can be measured.

## 2. Scoreboard rules (from the method's published documentation, checked against the benchmark)

| Column | Rule | Benchmark match on 23 Oct |
| --- | --- | --- |
| Trend | 3-day SMA vs 14-day SMA: above +2, below −2; a 14-day slope (vs 5 days earlier) against the cross moves it to ±1 | 25/28 |
| Seasonality | Average open-to-close move for this calendar month over the last 10 completed years: up +1, down −1 (gold too) | 27/29 |
| COT | Per currency: speculators' long share (long ÷ long+short) up on the week +1, down −1; pair = base − quote. Gold: weekly change ± net side | 28/28 |
| Crowd | Contrarian retail: ≥60% long −1, ≤40% long +1 | 19/28 (the benchmark uses a different retail feed; we use Myfxbook) |
| GDP, retail sales, consumer confidence, CPI, PPI, PCE, NFP, unemployment, claims, ADP, JOLTS | Per currency, latest release: actual vs consensus forecast at the forecast's precision → +1 / 0 / −1 (unemployment and claims inverted). Pair = base − quote. US-only columns are 0 for other pairs | fills in as releases happen (see §4) |
| mPMI, sPMI | Latest survey vs the previous reading | partial (licensed PMIs, see §3) |
| Rates | Expected move next quarter: house view (admin) → next listed decision's forecast vs current → 3-month interbank rate vs policy rate (±0.10) | proxy right for USD, EUR, NZD, CAD, CHF; wrong for AUD, JPY; no UK series |
| Gold | Macro columns = USD reversed; rates = US 2-year yield vs its 7-day average (above −1) | |

Labels on the board: ≥7 Very Bullish, 4…6 Bullish, −3…3 Neutral, −6…−4 Bearish, ≤−7 Very Bearish (every benchmark row fits).

## 3. Data sources

- **Forecasts:** Forex Factory weekly feed (no key). Each release's forecast follows the feed until release time, then is frozen. The feed has no history, so there is no backfill: cells fill in as each indicator is next released.
- **Actuals:** FRED first prints for the 11 US releases (matched to the day FRED published them). Elsewhere, the "previous" figure on the next release of the same series, which arrives a week (claims) to a month (monthly data) late. Direct national feeds (ONS, StatCan, ABS, Stats NZ, Eurostat flash, e-Stat) are the next step to make non-US cells same-day.
- **Rejected:** biquote.io as a seed. Its "forecasts" aren't market consensus (4 of 5 checked differed from Forex Factory; on CAD CPI it gave the opposite sign to the benchmark).
- **PMIs:** S&P Global PMIs (EUR, GBP, JPY, AUD, CAD manufacturing, US) and ISM are licensed and withheld by every free feed tested, so they stay empty and say why. Free stand-ins: Philadelphia Fed manufacturing and non-manufacturing surveys (USD, FRED), EC industry and services confidence (EUR, Eurostat), Ivey PMI (CAD services), procure.ch (CHF), BusinessNZ PMI/PSI (NZD). The last three come through the calendar feed.
- **Other inputs:** gold COT (CFTC 088691), gold and monthly closes (Twelve Data), US 2-year yield (FRED DGS2), 3-month interbank rates (OECD).

## 4. Measuring the match

`manage.py scanner compare --csv <benchmark.csv>` prints cell agreement per column (only cells where we have data), label agreement, Spearman rank correlation and top/bottom-5 overlap. Targets:

| Measure | Target | When |
| --- | --- | --- |
| Trend, seasonality, COT cells | ≥ 90% | now |
| Crowd cells | ≥ 65% (different retail source) | now |
| Macro cells with data | ≥ 80% | after each indicator's next release (claims ~1 week, monthly ~4–6 weeks, GDP a quarter) |
| Board label agreement | ≥ 70% | ~6 weeks |
| Rank correlation (Spearman) | ≥ 0.8 | ~6 weeks |
| Top-5 / bottom-5 overlap | ≥ 3 of 5 each | ~6 weeks |

Send a fresh benchmark screenshot every week or two; each one becomes a fixture and a compare run.
