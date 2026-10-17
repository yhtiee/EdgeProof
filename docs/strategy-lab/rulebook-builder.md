# Strategy Lab: rulebook builder

*Design and build document. Phase 1, no AI. Sources: product spec §6 (Strategy Lab), §8 (Gates), §14 (Data model); `DESIGN.md`. Written by a three-role team (Trader, Engineer, Designer); the cross-review log in §5 records where they disagreed.*

---

## 1. Summary

1. Users write their **own** rulebook in ten short steps (name, market, setup, entry, stop, exit, risk, costs, no-trade rules, examples), then a clarity checklist. Drafts save on the device first and sync.
2. Setup rules are built from **12 typed building blocks** with objective definitions (moving averages, structure, prior-day and swing levels, three candle patterns, RSI, MACD, ATR, candle size, time windows, distance); anything else is free text, which the builder questions and which makes the version **discretionary** if kept.
3. **Clarity checks are code** (one TypeScript copy for instant feedback, one Python copy that decides **Gate 3**), tested against the same twelve fixtures; 28 checks block the gate, 11 only teach.
4. Passing Gate 3 **locks** the version; later edits create version 2, 3, … with a required reason. Trades in the journal attach to a version, and its risk plan drives journal warnings (SL-8).
5. Nothing in the builder recommends a strategy: no templates, no signals, no performance claims. The fixtures are labelled teaching fixtures for tests only.

---

## 2. Trader: vocabulary, definitions, defaults, banned words, discretion

*Lens: what retail forex traders actually use, defined so a computer and a second person would mark exactly the same candles.*

### 2.1 Ground rules for every condition

- **Closed candles only.** Every condition is evaluated on the last **closed** candle of its own timeframe. A higher-timeframe condition uses the last higher-timeframe candle that had closed when the entry-timeframe candle closed. This is how replay and TradingView should be read too; anything else is look-ahead.
- **Direction.** A rulebook trades `long`, `short`, or `both`. Rules are written for the long side; with `both`, the short side is the **mirror**: above ↔ below, bullish ↔ bearish, high ↔ low, swing low ↔ swing high, oversold threshold `x` ↔ `100 − x`. The preview shows both sides so nothing is assumed.
- **Pips.** One pip is 0.0001, or 0.01 for JPY-quoted pairs (as taught in Level 1). Distances are entered in pips **or** as a multiple of ATR, never as "a bit".
- **Timeframes offered:** M5, M15, M30, H1, H4, D1, W1. M1 is left out on purpose (see 2.9).
- **Trading day:** a day ends at 17:00 New York time, the forex rollover taught in Level 1. "Prior day high" means the high of the last completed day on that boundary.
- **Time zones:** time windows name a zone (Europe/London, America/New_York, Asia/Tokyo or UTC) and follow its daylight-saving changes.

### 2.2 Condition vocabulary (setup building blocks)

All setup conditions must be true at the same closed candle (AND). Each has a timeframe from the rulebook's market timeframes.

| # | Type key | Group | Parameters (units, allowed range, default) | Preview sentence (long side) |
|---|---|---|---|---|
| 1 | `price_vs_ma` | Trend and averages | `ma`: SMA \| EMA (EMA) · `period`: 2–400 (50) · `relation`: above \| below | "The candle closes above the 50 EMA on the 4-hour chart." |
| 2 | `ma_cross` | Trend and averages | `ma`: SMA \| EMA · `fast`: 2–200 (20) · `slow`: 3–400 (50), `slow > fast` · `direction`: bullish \| bearish · `within_bars`: 1–20 (3) | "The 20 EMA crossed above the 50 EMA within the last 3 candles on the 1-hour chart." |
| 3 | `ma_order` | Trend and averages | `ma`: SMA \| EMA · `fast` · `slow` · `relation`: above \| below | "The 50 EMA is above the 200 EMA on the daily chart." |
| 4 | `structure` | Structure and levels | `pattern`: higher_highs_lows \| lower_highs_lows \| break_up \| break_down · `strength`: 2–10 candles each side (3) | "The last two swing highs and swing lows are both higher on the 4-hour chart (swings use 3 candles each side)." |
| 5 | `level` | Structure and levels | `level`: prior_day_high \| prior_day_low \| prior_week_high \| prior_week_low \| swing_high \| swing_low \| round_number · `event`: within \| closes_above \| closes_below · `tolerance`: {`unit`: pips \| atr, `value`} (5 pips), only for `within` · `strength` for swing levels | "The candle's low comes within 5 pips of yesterday's low, and the candle closes above it, on the 1-hour chart." |
| 6 | `candle_pattern` | Candles | `pattern`: bullish_engulfing \| bearish_engulfing \| bullish_pin_bar \| bearish_pin_bar \| inside_bar · pattern parameters (see 2.3) | "The last closed candle is a bullish engulfing (body at least 1.2× the previous body) on the 1-hour chart." |
| 7 | `rsi` | Momentum | `period`: 2–50 (14) · `relation`: above \| below \| crosses_above \| crosses_below · `value`: 1–99 | "RSI(14) crosses above 30 on the 1-hour chart." |
| 8 | `macd` | Momentum | `fast`: 2–50 (12) · `slow`: 3–100 (26) · `signal`: 2–50 (9) · `event`: line_above_signal \| line_below_signal \| crosses_above_signal \| crosses_below_signal \| histogram_above_zero \| histogram_below_zero | "The MACD line (12, 26, 9) crosses above its signal line on the 4-hour chart." |
| 9 | `atr` | Volatility and distance | `period`: 2–50 (14) · `relation`: above \| below · `value` in pips (> 0) | "ATR(14) is above 8 pips on the 1-hour chart." |
| 10 | `distance` | Volatility and distance | `to`: ma \| prior_day_high \| prior_day_low · `ma`, `period` (when `to` = ma) · `relation`: within \| beyond · `unit`: pips \| atr · `value` | "The close is within 1 × ATR(14) of the 20 EMA on the 1-hour chart." |
| 11 | `time_window` | Time | `from`, `to`: HH:MM · `zone`: Europe/London \| America/New_York \| Asia/Tokyo \| UTC · `days`: Mon–Fri subset (all) | "The setup candle closes between 07:00 and 10:00 London time, Monday to Friday." |
| 12 | `candle_size` | Volatility and distance | `measure`: range \| body · `relation`: above \| below · `unit`: pips \| atr · `value` | "The setup candle's range is above 1.5 × ATR(14)." |
| 13 | `free_text` | Write my own | `text`: 15–280 characters · optional `override` {`reason`} | "(written by you) …" |

**Multi-timeframe conditions** are not a separate block: any condition can use any of the rulebook's timeframes, and the closed-candle rule in 2.1 makes the higher timeframe gate the lower one with no look-ahead. The builder groups conditions by timeframe in the preview ("On the daily chart… On the 4-hour chart…").

**Session filters:** the market part lists the sessions traded (Asia, London, New York); a `time_window` condition is the precise version. Session hours follow onboarding: Asia 00:00–09:00, London 07:00–16:00, New York 12:00–21:00 UTC.

### 2.3 Objective definitions

| Element | Definition (what the code checks) |
|---|---|
| SMA(n) | Arithmetic mean of the last *n* closes. |
| EMA(n) | Exponential average of closes, α = 2 / (n + 1), seeded with the SMA of the first *n* closes. |
| Crosses above | On the previous closed candle, A ≤ B; on this closed candle, A > B. (Crosses below mirrors it.) |
| Swing high, strength *k* | A candle whose high is strictly higher than the highs of the *k* candles before it and the *k* candles after it. It is **confirmed only after those *k* later candles close**; until then it doesn't exist. Equal highs don't count. Swing low mirrors it with lows. |
| Higher highs and higher lows | The latest two confirmed swing highs are rising **and** the latest two confirmed swing lows are rising. |
| Break up (break of structure) | A candle **closes** above the latest confirmed swing high. A wick through it is not a break. |
| Prior day / week high and low | High and low of the last completed trading day (17:00 New York boundary) or week (Sunday 17:00 to Friday 17:00 New York). |
| Round number | A price ending in `00` at the pip's second decimal: 1.0800, 1.0900; for JPY pairs 150.00, 151.00. |
| Level: `within` | Long side: the candle's **low** comes within the tolerance of the level and the candle **closes on the long side** of it (above support). Short side mirrors with the high. |
| Level: `closes_above` / `closes_below` | The candle's close is beyond the level by any amount. |
| Bullish engulfing | Previous candle bearish (close < open); this candle bullish; this open ≤ previous close; this close ≥ previous open; this body ≥ `ratio` × previous body. `ratio` 1.0–2.0, default 1.2. |
| Bullish pin bar | Lower wick ≥ `wick_ratio` × body (2.0–5.0, default 2.0); lower wick ≥ 60% of the candle's range; open and close both in the top third of the range; range ≥ `min_range_atr` × ATR(14) (0.3–2.0, default 0.5) so tiny candles don't count. Bearish mirrors it. |
| Inside bar | This high < previous high **and** this low > previous low (strict). |
| RSI(n) | Wilder's RSI on closes: average gain ÷ average loss with Wilder smoothing (α = 1 / n). |
| MACD (f, s, sig) | MACD line = EMA(f) − EMA(s) of closes; signal = EMA(sig) of the MACD line; histogram = MACD − signal. |
| ATR(n) | Wilder's average (α = 1 / n) of the true range: max(high − low, |high − previous close|, |low − previous close|). Shown in pips. |
| Candle range / body | Range = high − low; body = |close − open|. |
| Distance to an MA | |close − MA| measured in pips or as a multiple of ATR(14) on the same timeframe. |

### 2.4 Entry, stop and exit options

**Entry** (one trigger; the order type follows from it):

| Key | Order type | Parameters | Preview |
|---|---|---|---|
| `next_open` | Market | none | "Enter at the open of the next candle after all setup conditions are true." |
| `stop_beyond_setup` | Buy stop / sell stop | `buffer` {pips \| atr, value} (1 pip) · `expiry_bars` 1–10 (2) | "Place a buy stop 1 pip above the setup candle's high. Cancel it if it hasn't filled within 2 candles." |
| `limit_at_ma` | Buy limit / sell limit | `ma`, `period` · `expiry_bars` 1–10 (3) | "Place a buy limit at the 20 EMA. Cancel it after 3 candles." |
| `limit_retrace` | Buy limit / sell limit | `percent` 25–75 of the setup candle's range (50) · `expiry_bars` | "Place a buy limit at 50% of the setup candle's range." |

The entry has its own `timeframe`, one of the market timeframes; the "setup candle" is the entry-timeframe candle on which every setup condition became true.

**Initial stop** (mandatory):

| Key | Parameters | Preview |
|---|---|---|
| `swing` | `strength` 2–10 (3) · `buffer` {pips \| atr, value} | "Stop below the latest swing low (3 candles each side), plus 2 pips." |
| `setup_candle` | `buffer` | "Stop 1 pip below the setup candle's low." |
| `atr` | `period` (14) · `multiple` 0.5–5 (1.5) | "Stop 1.5 × ATR(14) below the entry." |
| `fixed` | `pips` 3–500 | "Stop 25 pips below the entry." |

Optional for every stop: `skip_if_wider_than` {pips \| atr, value} ("Skip the trade if the stop would be wider than 40 pips").

**Exit** (target, plus optional management and time exit):

| Part | Options |
|---|---|
| Target | `r_multiple` {r: 0.5–10} · `prior_swing` {strength} · `prior_day_level` (yesterday's high for longs) · `atr` {period, multiple} · `none` (allowed only with a trailing stop or a time exit) |
| Breakeven | `at_r` 0.5–5: "Move the stop to the entry price once the trade is +1R." |
| Partial close | `at_r` 0.5–5 · `percent` 10–90: "Close 50% at +1R." |
| Trailing stop | `atr` {period, multiple} · `swing` {strength} · `ma` {ma, period}: "Trail the stop 2 × ATR(14) behind the highest close." |
| Time exit | `bars` {n} · `time` {HH:MM, zone} · `before_weekend` (Friday 20:00 New York) |

### 2.5 Risk and cost defaults (with reasons)

| Setting | Default | Allowed | Warning above / below | Why |
|---|---|---|---|---|
| Risk per trade | 0.5% | 0.1–2% | warn above 1% | Level 2: 20 losses in a row at 1% leave about 82% of the account; at 2%, about 67%. Learners need survivable streaks. |
| Daily loss limit | 3R | 1–10R | warn above 5R | Level 3 revenge-trading lesson: stop the day before emotion takes over. |
| Weekly loss limit | 6R | ≥ daily, ≤ 20R | fail if below the daily limit | A weekly limit below the daily one can never be reached as written. |
| Maximum drawdown | 15R | 5–50R | — | The point at which the plan says stop and review; compared with the Monte Carlo drawdown later (§8). |
| Max open trades | 2 | 1–10 | warn above 3 | Several open trades are often one currency bet (Level 7). |
| Max trades per day | 3 | 1–20 | warn above 5 | Over-trading is a common reason costs swamp a small edge. |
| Max total risk per currency | 2% | 0.5–5% | warn above 3% | Spec default; EUR/USD and GBP/USD longs are both short dollars. |
| Losing-streak rule | 3 losses → stop for the day | 2–10 losses; action: stop for the day \| halve risk \| stop and review | — | Pre-committing to a pause is easier than deciding mid-streak. |
| Slippage | 0.3 pips majors, 1.0 crosses | 0–20 | — | Spec defaults. Majors here: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD. |
| Slippage in news windows | 3.0 pips | ≥ normal slippage | — | Spec: "3+ inside news windows". |
| Spread | 1.0 pip majors, 2.0 crosses, **marked "placeholder"** | 0–50 | warn while still the placeholder | Spreads vary by broker and hour; the trader replaces them with their own figures. *(Trader: I won't quote "typical" broker spreads as fact; these are deliberately round placeholders.)* |
| Commission | $0 per round-trip lot, marked placeholder | 0–50 | — | Raw-spread accounts charge commission; standard accounts build it into the spread. |
| Swap | 0 per lot per night, long and short | any | — | Only matters for trades held past rollover; the trader enters their broker's figures. |

**What beginners most often get wrong:** risk of 2–5% per trade; no weekly limit; ignoring that two USD pairs are one bet; setting costs to zero because an account is advertised as "zero spread"; stops under 10 pips where the spread is a large share of the risk; targets under 1R paired with a high win rate they haven't measured; and adding a new filter after every loss (overfitting, Level 6).

### 2.6 No-trade rules

| Rule | Parameters | Default |
|---|---|---|
| News window | `enabled` · `impact`: high · `before_min` 0–240 (30) · `after_min` 0–240 (30) · currencies: both currencies of the pair | on, 30/30 |
| Spread limit | `max_spread_pips` | off |
| Rollover | `avoid_rollover`: no new trades 16:45–17:15 New York | on |
| Weekend | `no_new_after_friday` HH:MM New York | 15:00 |
| Other | `time_window` (inverted: "no trades between…") or `free_text` | none |

### 2.7 Banned vague words and phrases

Matched case-insensitively as whole words or phrases in free-text setup conditions and free-text no-trade rules. The idea field and example notes are not checked (they describe, they aren't rules). Each hit shows the question below and links to a structured block.

| # | Word or phrase | The builder asks | Structured route |
|---|---|---|---|
| 1 | strong | "Strong compared with what? A candle range above some multiple of ATR, or an average sloping by some amount?" | `candle_size`, `ma_order` |
| 2 | weak | "Weak by what measure: RSI below a value, or a small candle range?" | `rsi`, `candle_size` |
| 3 | clear / clearly | "What would two people both see? Try a close beyond a level, or a swing structure." | `level`, `structure` |
| 4 | obvious | "What makes it obvious, in prices? Name the level or the pattern." | `level`, `candle_pattern` |
| 5 | good | "Good by which number?" | any |
| 6 | nice | "Which measurable feature makes it nice?" | any |
| 7 | clean | "Clean meaning what: no candle closing through the level for N candles?" | `level` |
| 8 | looks like | "What exactly would it need to be? Name the pattern or the level." | `candle_pattern` |
| 9 | seems / seem | "What would you measure to know?" | any |
| 10 | feels / feel | "Which price fact sits behind the feeling?" | any |
| 11 | significant | "Significant by size (pips or ATR) or by being a prior-day or swing level?" | `level`, `candle_size` |
| 12 | key level | "Which level: prior day high or low, prior week, a swing, or a round number?" | `level` |
| 13 | major level | (same question as key level; "major pair" is allowed) | `level` |
| 14 | big | "How big, in pips or ATR?" | `candle_size` |
| 15 | small | "How small, in pips or ATR?" | `candle_size` |
| 16 | sharp | "Sharp meaning a range above how many ATR?" | `candle_size` |
| 17 | momentum is | "Momentum measured how: RSI above a value, or MACD above its signal?" | `rsi`, `macd` |
| 18 | trending | "Trending by structure (higher highs and lows) or by a moving average?" | `structure`, `price_vs_ma`, `ma_order` |
| 19 | choppy | "Choppy meaning ATR below a value, or no break of structure for N candles?" | `atr` |
| 20 | overextended | "Overextended meaning how far from which average, in pips or ATR?" | `distance` |
| 21 | confirmation / confirms | "What exactly confirms it: a close beyond a level, or a named candle pattern?" | `level`, `candle_pattern` |
| 22 | near | "Within how many pips or ATR?" | `level`, `distance` |
| 23 | close to | "Within how many pips or ATR?" ("closes above/below" is allowed) | `level`, `distance` |
| 24 | around | "Within how many pips of what price?" | `distance` |
| 25 | approximately / roughly / about | "Give the number and the tolerance." | any |
| 26 | enough | "How much is enough, as a number?" | any |
| 27 | a lot / lots | "How many, as a number?" | any |
| 28 | usually / often / sometimes | "A rule applies every time. Which condition decides when?" | any |
| 29 | probably / likely | "Rules don't predict. What do you see on the chart?" | any |
| 30 | should | "Rules describe what you do. Which condition triggers it?" | any |
| 31 | healthy pullback | "A pullback of how much: to which average, or within how many ATR?" | `distance` |
| 32 | solid | "Solid meaning what, in prices?" | any |
| 33 | important | "Which level, defined how?" | `level` |
| 34 | high probability | "Probability is what testing measures. Which conditions define the setup?" | any |
| 35 | textbook / perfect | "Which parts of the definition must be true?" | `candle_pattern` |
| 36 | when it makes sense / at my discretion / gut / intuition | "What would you be looking at when you decide? Describe it in prices." | any |
| 37 | smart money / institutional | "Which price behaviour do you mean? Describe it as levels, structure or candles." | `level`, `structure` |
| 38 | fakeout / fake out | "Define it: a close beyond a level that reverses within N candles?" | `level` |

### 2.8 Discretion rules

- A version is **mechanical** when every setup condition and every no-trade rule is a structured block.
- A version is **discretionary** when it keeps at least one `free_text` rule **with a recorded override**: the user saw the "can this be structured?" prompt and chose "Keep as written", with a reason (10–280 characters). This is the SL-5 override.
- Free text that contains a banned word **can't** be kept by override; it must be reworded first. The override records a choice to stay discretionary, not permission to be vague.
- Entry, stop, exit, risk and costs offer **structured options only**: there is no free text there, so those parts can never make a version discretionary.
- **Making free text mechanical:** the builder scans the text for known terms (EMA, SMA, RSI, MACD, ATR, engulfing, pin bar, inside bar, swing, high, low, session names, times) and offers the matching block pre-filled with whatever numbers it found ("Your rule mentions 'RSI 30'. Use the RSI block: RSI(14) crosses above 30?"). The user confirms; the free text is then removed.

### 2.9 Flagged and left out

| Common online idea | Decision | Reason |
|---|---|---|
| Hand-drawn trendlines, supply/demand zones, manual support/resistance | Free text only (discretionary) | Two people draw them differently. The `level` block covers the objective kinds. |
| Order blocks, liquidity sweeps, "smart money concepts" | Free text only | Definitions vary widely between sources; can't be pinned down without picking one author's version. |
| Fibonacci retracements | Left out for Phase 1 (open question 4) | Objective if the swing is defined, but adds parameters and invites level-shopping; `limit_retrace` covers the common "50%" use. |
| RSI/MACD divergence | Left out for Phase 1 (open question 4) | Definable via confirmed swings, but complex for beginners and slow to confirm. |
| Elliott waves, harmonic patterns | Free text only | Not objectively countable. |
| M1 timeframe | Not offered | Costs dominate; spec warns when average stop < 10 pips. |
| Martingale, grid, averaging down, removing stops | Not offered at all | Contradicts the mandatory stop and Level 2 risk teaching. |
| More than 5 setup conditions | Allowed with a warning | Each extra filter is another chance to fit noise (Level 6). |

### 2.10 Fixtures

Twelve **teaching fixtures** in `docs/strategy-lab/fixtures/`, each labelled `"teachingFixture": true` with the note "Test data for the clarity engine. Not a recommended strategy." Eight are clean (one deliberately discretionary, one with teaching warnings), four are deliberately flawed:

| File | Style | Expected |
|---|---|---|
| `01-trend-pullback-ema.json` | Trend pullback, H4 + H1 | mechanical, no fails |
| `02-prior-day-breakout.json` | Breakout of yesterday's high, London | mechanical, no fails |
| `03-range-rsi.json` | Range, RSI and prior-day levels, H1 | mechanical, no fails |
| `04-london-open-range.json` | Session open, time window, M15 | mechanical, profile-fit warning |
| `05-daily-swing-structure.json` | Swing, D1 structure + engulfing | mechanical, no fails |
| `06-triple-screen.json` | Multi-timeframe W1 → D1 → H4 | mechanical, no fails |
| `07-macd-momentum.json` | Momentum, H4 MACD, risk 1.5% | mechanical, teaching warnings |
| `08-pin-bar-discretionary.json` | Pin bar + free text kept by override | **discretionary**, no fails |
| `09-flawed-vague-words.json` | Free text with banned words | fails `FREE_TEXT_VAGUE`, `FREE_TEXT_UNRESOLVED` |
| `10-flawed-missing-stop.json` | No stop rule | fails `STOP_MISSING` |
| `11-flawed-ignored-costs.json` | Zero costs and a missing cost row | fails `COSTS_ZERO`, `COSTS_MISSING` |
| `12-flawed-conflicting.json` | Contradictory conditions | fails `COND_CONFLICT` |

---

## 3. Engineer: schema, clarity engine, models, API, front end, tests

*Lens: every rule is data, every check is a pure function, the server decides, and the builder costs nothing on first load.*

### 3.1 What I changed in the Trader's draft

| Item | Change | Reason |
|---|---|---|
| `level` with manual zones | Removed from blocks (Trader agreed, 2.9) | Not reproducible from prices. |
| "Strong trend" / "momentum" proposals | Replaced by `ma_order`, `structure`, `rsi`, `macd` | Untestable words. |
| Single-word bans "close", "major" | Banned as phrases instead ("close to", "major level") | "Closes above" and "major pair" are precise. |
| Free text in entry/stop/exit | Removed | Keeps the discretionary path in one place; every trade plan stays codeable. |
| Swing confirmation | Made explicit (confirmed after *k* candles) | The usual source of look-ahead bias. |
| `candle_size` | Added | Replaces "strong/big candle" with a number; the Trader agreed it removes several banned words' main use. |
| `level` `rejection` event | Folded into `within` (wick within tolerance + close on the long side) | Two definitions of nearly the same thing would confuse beginners and the code. |
| Spread defaults | Kept but marked `placeholder: true` | So the cost check can warn until the trader sets real figures. |

### 3.2 Rule schema (version document)

One JSON document per version, `schemaVersion: 1`, stored in three JSONB columns as the spec's data model asks (`rules`, `risk_plan`, `cost_model`). The JSON Schema lives at `backend/apps/strategy/schema/rulebook.v1.json` and is validated with the `jsonschema` package; the TypeScript types below are written by hand and a test checks them against the same JSON Schema using the fixtures (no code generator added to the build).

```ts
export type Timeframe = 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1'
export type Zone = 'Europe/London' | 'America/New_York' | 'Asia/Tokyo' | 'UTC'
export type Distance = { unit: 'pips' | 'atr'; value: number }
type Ma = 'sma' | 'ema'

type Base<T extends string, P> = { id: string; type: T; timeframe: Timeframe; params: P }

export type Condition =
  | Base<'price_vs_ma', { ma: Ma; period: number; relation: 'above' | 'below' }>
  | Base<'ma_cross', { ma: Ma; fast: number; slow: number; direction: 'bullish' | 'bearish'; within_bars: number }>
  | Base<'ma_order', { ma: Ma; fast: number; slow: number; relation: 'above' | 'below' }>
  | Base<'structure', { pattern: 'higher_highs_lows' | 'lower_highs_lows' | 'break_up' | 'break_down'; strength: number }>
  | Base<'level', {
      level: 'prior_day_high' | 'prior_day_low' | 'prior_week_high' | 'prior_week_low' | 'swing_high' | 'swing_low' | 'round_number'
      event: 'within' | 'closes_above' | 'closes_below'; tolerance?: Distance; strength?: number }>
  | Base<'candle_pattern', {
      pattern: 'bullish_engulfing' | 'bearish_engulfing' | 'bullish_pin_bar' | 'bearish_pin_bar' | 'inside_bar'
      ratio?: number; wick_ratio?: number; min_range_atr?: number }>
  | Base<'rsi', { period: number; relation: 'above' | 'below' | 'crosses_above' | 'crosses_below'; value: number }>
  | Base<'macd', { fast: number; slow: number; signal: number; event: MacdEvent }>
  | Base<'atr', { period: number; relation: 'above' | 'below'; value: number }>
  | Base<'distance', { to: 'ma' | 'prior_day_high' | 'prior_day_low'; ma?: Ma; period?: number; relation: 'within' | 'beyond'; unit: 'pips' | 'atr'; value: number }>
  | Base<'time_window', { from: string; to: string; zone: Zone; days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri')[] }>
  | Base<'candle_size', { measure: 'range' | 'body'; relation: 'above' | 'below'; unit: 'pips' | 'atr'; value: number }>
  | Base<'free_text', { text: string; override?: { reason: string; recorded_at?: string } }>

export type Rules = {
  schemaVersion: 1
  idea: string                      // one sentence, not a rule; never checked for vague words
  direction: 'long' | 'short' | 'both'
  market: { instruments: string[]; timeframes: Timeframe[]; sessions: ('asia' | 'london' | 'new_york')[] }
  setup: { conditions: Condition[] }
  entry: { timeframe: Timeframe; trigger: EntryTrigger } | null
  stop: { rule: StopRule; skip_if_wider_than?: Distance } | null
  exit: { target: Target; breakeven?: { at_r: number }; partial?: { at_r: number; percent: number };
          trailing?: Trailing; time_exit?: TimeExit } | null
  no_trade: { news: { enabled: boolean; before_min: number; after_min: number }; max_spread_pips?: number;
              avoid_rollover: boolean; no_new_after_friday?: string; other: Condition[] }
}

export type RiskPlan = {
  risk_pct: number; daily_loss_r: number; weekly_loss_r: number; max_drawdown_r: number
  max_open_trades: number; max_trades_per_day: number; max_currency_risk_pct: number
  losing_streak: { losses: number; action: 'stop_day' | 'halve_risk' | 'stop_review' }
}

export type CostModel = Record<string, {   // key: instrument, e.g. "EUR/USD"
  spread_pips: number; commission_per_lot: number; slippage_pips: number; news_slippage_pips: number
  swap_long: number; swap_short: number; placeholder: boolean
}>
```

`EntryTrigger`, `StopRule`, `Target`, `Trailing` and `TimeExit` are discriminated unions of the options in 2.4. Condition `id`s are stable short strings (`c1`, `c2`…) because examples and overrides refer to them. Unknown keys are rejected by the schema (`additionalProperties: false`), and a `schemaVersion` bump will ship with a migration function `migrate(doc) → doc` on both sides.

### 3.3 Clarity engine

`checkRulebook(version, examples) → { passed: boolean; kind: 'mechanical' | 'discretionary'; items: Check[] }`, where each `Check` is `{ code, severity: 'fail' | 'warn', path, message, fix: StepKey }`. It is pure and deterministic: no clock, no network, no randomness. `passed` is true when there are no `fail` items. The **Python copy** (`apps/strategy/clarity.py`) is the source of truth: Gate 3 is granted only after the server runs it. The **TypeScript copy** (`src/features/strategy-lab/clarity.ts`) gives instant feedback. Both run against all twelve fixtures in their test suites, and each fixture states the exact expected `fails` and `warns`, so the two copies can't drift without a test failing.

| Code | Severity | Rule | Message (describes, doesn't instruct) | Path |
|---|---|---|---|---|
| `NAME_MISSING` | fail | Strategy has a name (3–60 chars) | "This strategy has no name yet." | `name` |
| `MARKET_NO_INSTRUMENT` | fail | 1–6 instruments | "No pairs chosen." | `market.instruments` |
| `MARKET_NO_TIMEFRAME` | fail | 1–3 distinct timeframes | "No timeframe chosen." | `market.timeframes` |
| `MARKET_NO_SESSION` | fail | ≥ 1 session | "No trading session chosen." | `market.sessions` |
| `SETUP_EMPTY` | fail | ≥ 1 setup condition | "The setup has no conditions, so any candle would qualify." | `setup.conditions` |
| `COND_PARAM_MISSING` | fail | Required parameter present | "This condition is missing its {param}." | `setup.conditions[i].params.{p}` |
| `COND_PARAM_RANGE` | fail | Parameter within the allowed range (2.2) | "{param} is {value}; the allowed range is {min}–{max}." | same |
| `COND_TIMEFRAME_UNKNOWN` | fail | Condition timeframe is one of the market timeframes | "This condition uses {tf}, which isn't one of your timeframes." | `…timeframe` |
| `COND_CONFLICT` | fail | No two conditions can't both be true on the same timeframe (see below) | "These two conditions can't both be true: {a} and {b}." | both paths |
| `COND_DUPLICATE` | fail | No identical condition twice | "This condition appears twice." | path |
| `FREE_TEXT_TOO_SHORT` | fail | Free text 15–280 chars | "This rule is too short to follow: {n} characters." | `…params.text` |
| `FREE_TEXT_VAGUE` | fail | No banned word or phrase (2.7) | "Your rule uses '{word}'. {question}" | `…params.text` |
| `FREE_TEXT_UNRESOLVED` | fail | Free text either converted or kept with an override reason | "This rule is written in your own words and has no override recorded. It can become a building block, or be kept as written with a reason." | `…params` |
| `ENTRY_MISSING` | fail | Entry trigger chosen | "There's no entry rule yet." | `entry` |
| `ENTRY_TIMEFRAME` | fail | Entry timeframe is a market timeframe and no condition uses a lower one | "The entry uses {tf}, but a condition uses a lower timeframe, {low}." | `entry.timeframe` |
| `ENTRY_PARAM` | fail | Entry parameters in range | "{param} is outside {min}–{max}." | `entry.trigger.{p}` |
| `STOP_MISSING` | fail | Initial stop rule chosen | "There's no initial stop. Every trade needs one before it opens." | `stop` |
| `STOP_PARAM` | fail | Stop parameters in range | "{param} is outside {min}–{max}." | `stop.rule.{p}` |
| `EXIT_MISSING` | fail | A target, or a trailing stop or time exit when target is `none` | "Nothing closes a winning trade: no target, trailing stop or time exit." | `exit` |
| `EXIT_ORDER` | fail | Breakeven and partial levels sit below an R-multiple target | "The partial close at +{a}R comes after the +{t}R target." | `exit.partial.at_r` |
| `EXIT_PARAM` | fail | Target, management and time-exit parameters in range | "{param} is outside {min}–{max}." | `exit.{part}.{p}` |
| `NOTRADE_PARAM` | fail | News minutes 0–240, spread limit 0.1–50 pips, Friday time HH:MM, other rules are time windows or free text | "News windows are 0–240 minutes either side." | `no_trade.{field}` |
| `RISK_INCOMPLETE` | fail | Every risk field filled and in range (2.5) | "{field} is missing or outside {min}–{max}." | `risk_plan.{f}` |
| `RISK_LIMITS_ORDER` | fail | weekly ≥ daily loss limit; daily ≥ 1R | "The weekly loss limit ({w}R) is lower than the daily one ({d}R)." | `risk_plan.weekly_loss_r` |
| `COSTS_MISSING` | fail | Every instrument has a cost row | "{pair} has no costs set." | `cost_model.{pair}` |
| `COSTS_ZERO` | fail | Spread + slippage > 0 for every instrument | "{pair} has no spread or slippage, so tests would show results no account could get." | `cost_model.{pair}` |
| `EXAMPLES_VALID_MISSING` | fail | Each setup condition has ≥ 1 valid example | "'{rule}' has no example of a chart where it's true." | `examples.{id}` |
| `EXAMPLES_INVALID_MISSING` | fail | Each setup condition has ≥ 1 invalid example | "'{rule}' has no example of a chart where it's false." | `examples.{id}` |
| `W_RISK_ABOVE_1` | warn | risk_pct > 1 | "Each trade risks {r}%. Twenty losses in a row would leave about {left}% of the account." | `risk_plan.risk_pct` |
| `W_MANY_CONDITIONS` | warn | > 5 setup conditions | "The setup has {n} conditions. Each extra filter is another chance to fit past noise." | `setup.conditions` |
| `W_STOP_NO_BUFFER` | warn | swing or setup-candle stop with 0 buffer | "Your stop rule has no buffer, so the spread alone can reach it." | `stop.rule.buffer` |
| `W_STOP_FIXED` | warn | fixed-pip stop | "A fixed {p}-pip stop is the same in quiet and busy markets." | `stop.rule` |
| `W_TARGET_BELOW_1R` | warn | R target < 1 | "The target is +{r}R; the break-even win rate before costs is {be}%." | `exit.target.r` |
| `W_COSTS_PLACEHOLDER` | warn | any cost row still `placeholder` | "{pair} still uses placeholder costs." | `cost_model.{pair}` |
| `W_NO_NEWS_RULE` | warn | news window off | "There's no news window, so trades can open into high-impact releases." | `no_trade.news` |
| `W_LOW_TF` | warn | lowest timeframe M5 or M15 | "On {tf} charts, the spread is a bigger share of each stop." | `market.timeframes` |
| `W_WINDOW_OUTSIDE_SESSION` | warn | a time window overlaps none of the chosen sessions in either winter or summer time (fixed offsets: London 0/+1, New York −5/−4, Tokyo +9; no clock, so the engine stays pure) | "The {from}–{to} window falls outside the sessions you chose." | condition path |
| `W_DAILY_LIMIT_HIGH` | warn | daily_loss_r > 5 | "A {d}R daily limit allows a long losing run in one day." | `risk_plan.daily_loss_r` |
| `W_CURRENCY_RISK_HIGH` | warn | max_currency_risk_pct > 3 | "Up to {c}% can ride on one currency at once." | `risk_plan.max_currency_risk_pct` |

**Conflict rules** (same timeframe, after applying direction): `price_vs_ma` above vs below the same MA and period; `rsi` above *x* with below *y* where *x* ≥ *y*; `atr` or `candle_size` above *x* with below *y* where *x* ≥ *y*; opposite `structure` patterns; a bullish and a bearish `candle_pattern` on the same candle; `ma_order` fast above slow vs fast below slow with the same pair; `macd` line above vs below signal. Anything else is allowed (the engine flags only contradictions it can prove).

**Kind:** `discretionary` if any `free_text` (setup or no-trade) has an override; otherwise `mechanical`.

### 3.4 Profile fit check (SL-2)

`profileFit(rules, profile) → Fit[]` (warnings only, never blocking), with `profile = { weekly_hours, sessions, timezone }` from onboarding.

| Code | Rule | Message |
|---|---|---|
| `FIT_HOURS_TF` | lowest timeframe needs more weekly hours than the profile has: M5 ≥ 15 h, M15 ≥ 10 h, M30/H1 ≥ 6 h, H4 ≥ 3 h, D1/W1 ≥ 1 h | "This strategy uses 15-minute charts. Your plan has 5 hours a week; 15-minute strategies usually need about 10." |
| `FIT_SESSIONS` | a strategy session isn't in the profile's sessions (only when lowest timeframe ≤ H4) | "This strategy trades the New York session. Your profile lists Asia and London." |
| `FIT_WINDOW_LOCAL` | a time window falls between 23:00 and 06:00 in the user's own time zone | "07:00–10:00 London time is 23:00–02:00 where you are." |
| `FIT_NO_PROFILE` | no weekly hours saved | "Add your weekly hours in your profile to check fit." |

### 3.5 Django models and migrations (`apps/strategy`)

```python
class Strategy(OwnedModel):
    name = CharField(max_length=60)
    status = CharField(choices=["active", "archived"], default="active")   # SL-10: ≤ 5 active, enforced in a service + DB check on create

class StrategyVersion(OwnedModel):
    strategy = ForeignKey(Strategy, related_name="versions", on_delete=CASCADE)
    number = PositiveIntegerField()                # 1, 2, 3…; unique per strategy
    reason = CharField(max_length=280, blank=True)  # required for number > 1
    rules = JSONField()                            # validated against rulebook.v1.json on every save
    risk_plan = JSONField()
    cost_model = JSONField()
    kind = CharField(choices=["mechanical", "discretionary"], default="mechanical")   # set by the server's clarity run
    clarity_status = CharField(choices=["unchecked", "failing", "passing"], default="unchecked")
    clarity_report = JSONField(default=dict)       # last server run, for the checklist
    locked = BooleanField(default=False)           # true once Gate 3 passes; never false again
    locked_at = DateTimeField(null=True)
    revision = PositiveIntegerField(default=0)     # optimistic concurrency for autosave
    # unique (strategy, number)

class RuleExample(OwnedModel):
    version = ForeignKey(StrategyVersion, related_name="examples", on_delete=CASCADE)
    rule_key = CharField(max_length=16)            # condition id, e.g. "c2"
    valid = BooleanField()
    image_key = CharField(max_length=255)          # confirmed UploadIntent, reusing the journal's upload flow
    note = CharField(max_length=280)               # required: why it counts or doesn't
    annotations = JSONField(default=list)          # [{"shape": "arrow"|"box", "x1".."y2": 0–1 normalised}]
```

Changes elsewhere:

- `gates.GatePass` gets `strategy_version` (nullable FK). The single partial unique constraint becomes two: one active pass per `(user, gate)` where the version is null (gates 1–2), and one per `(user, gate, strategy_version)` where it isn't (gates 3–6).
- `testing.Trade` gets `strategy_version` (nullable FK, `PROTECT`). JR-1: draft (unlocked) versions can be linked; such trades are excluded from verdicts.
- Migrations are written by hand (the project's existing practice) and include a data-safe default for existing GatePass rows.

**Immutability:** a locked version rejects any change to `rules`, `risk_plan` or `cost_model` (serializer + model `save()` guard). Examples can be **added** to a locked version (they don't change the rules) but not removed. Deleting a strategy with locked versions or linked trades is refused; archiving is the path.

### 3.6 API (`/api/v1/`)

| Method and path | Purpose | Guards |
|---|---|---|
| `GET /strategies` | List with latest version summary (number, locked, kind, clarity status) | Owner only |
| `POST /strategies` | Create strategy + version 1 draft with defaults | `CanDraft` (Level 2 passed or placed); 409 `strategy_limit` at 5 active |
| `GET/PATCH /strategies/{id}` | Rename; archive / unarchive (unarchive re-checks the limit) | Owner |
| `GET /strategies/{id}/versions` | Version history | Owner |
| `POST /strategies/{id}/versions` | New draft from the latest version `{reason}` (10–280 chars) | Latest must be locked; otherwise 409 `draft_exists` |
| `GET /versions/{id}` | Full document + examples + last clarity report + profile fit | Owner |
| `PATCH /versions/{id}` | Autosave `{rules?, risk_plan?, cost_model?, revision}` | 409 `version_locked`; 409 `stale_revision` with the server copy |
| `POST /versions/{id}/clarity-check` | Run the server engine, store report, return it | Owner |
| `POST /versions/{id}/examples` · `PATCH/DELETE /examples/{id}` | Attach example (confirmed upload key), edit note/annotations, remove | No delete on locked versions |
| `POST /versions/{id}/gate-3` | Re-run clarity; if passing, lock the version and grant Gate 3 for it | `CanDraft`; 409 `clarity_failing` with the report; idempotent if already locked |

Permissions are server-side classes; the UI lock is only a convenience. Every queryset is filtered by the user (existing `OwnedViewSetMixin`).

**Drafting permission:** opens once the lessons in `STRATEGY_LAB_REQUIRED_LESSONS` are complete (founder decision, §6), or always on a development build (`OPEN_GATES`). Locked responses are `409 lab_locked` with the `required` lessons, which the Lab shows as its nudge. Gate 2 stays "all published level exams" and will be required for test runs in Phase 2.

**Journal tie-in (SL-8):** the log-trade form gets a "Strategy" select (active strategies' latest version). With a version chosen, the rule checklist becomes that version's rules as sentences (setup conditions, entry, stop, exit and no-trade rules), and the trade response includes `plan_warnings`: risk above plan (and above 1.25× plan), daily loss limit reached, weekly limit reached, max trades per day, max open trades, currency risk above the cap, losing-streak rule reached. Warnings never block logging (DE-2's principle).

### 3.7 Front-end architecture

- Feature folder `src/features/strategy-lab/`, all routes lazy-loaded (`/lab`, `/lab/new`, `/lab/:strategyId`, `/lab/:strategyId/v/:number/:step`, `/lab/:strategyId/history`). The builder adds nothing to the first-load bundle.
- **State:** one typed reducer over the version document (`useReducer`), with each step reading and writing its slice. **No React Hook Form or Zod** (see cross-review E1): the builder autosaves instead of submitting, and the clarity engine is the validation, so a form library would duplicate it and add weight.
- **Autosave:** 800 ms debounce after the last change. Every change is written to `localStorage` first (`edgeproof.strategy-draft.{versionId}`), then `PATCH`ed with the `revision`. Offline or waking, it retries on `online` and visibility change (the journal outbox pattern). A `409 stale_revision` shows a choice: "Keep this device's version" (re-PATCH with the new revision) or "Use the other version".
- **Clarity:** the TS engine runs on every change (memoised, < 1 ms for these sizes); the server report replaces it after each save, and the Gate 3 button always uses the server's answer.
- **Shared code:** `vocabulary.ts` (blocks, ranges, defaults, preview sentences), `clarity.ts`, `fit.ts`, `mirror.ts` (long → short), `describe.ts` (plain-language preview), `banned.ts`. All pure, all unit-tested.
- **Uploads:** example images reuse `features/journal/images.ts` (compress to WebP, presign, confirm). Annotation is an SVG overlay on the image; shapes are stored normalised (0–1), so they scale with the image.
- **New UI pieces** (proposed additions to `DESIGN.md` §7): Step rail, Bottom sheet (already in the inventory, first build, on Radix Dialog which is installed), Condition card, Annotation overlay. No new colours or sizes.

### 3.8 Test plan

| Suite | What it proves |
|---|---|
| `backend/tests/test_rulebook_schema.py` | All 12 fixtures validate against the JSON Schema; unknown keys, wrong types and bad enums are rejected. |
| `backend/tests/test_clarity.py` | Each fixture returns exactly its expected `fails`, `warns` and `kind`; the four flawed fixtures fail with their codes; banned-word matching (phrases, case, "major pair" allowed). |
| `backend/tests/test_strategy_api.py` | Cross-user access returns 404; sixth active strategy returns 409; unarchive at the limit returns 409; PATCH on a locked version returns 409; stale revision returns 409 with the server copy; Gate 3 refused while failing (and not grantable by any client field); Gate 3 locks and grants per version; new version needs a reason and copies the document; drafting refused before Level 2. |
| `backend/tests/test_plan_warnings.py` | Journal warnings for each risk limit. |
| `frontend/.../clarity.test.ts` | Same 12 fixtures, same expected codes (parity with Python). |
| `frontend/.../vocabulary.test.ts`, `describe.test.ts`, `mirror.test.ts`, `fit.test.ts` | Every block has defaults in range and a preview sentence; mirroring is its own inverse; fit thresholds. |
| Playwright at **360 px** and 1280 px | New strategy → all steps → checklist shows fails with working fix links → examples uploaded → Gate 3 passes and locks → edit creates version 2 with reason; limit-reached state at 5; offline edits sync; no browser errors. |

### 3.9 Pine Script readiness (Phase 2 note, not built)

A mechanical version maps to a Pine v5 `strategy()` script as follows. *I'm confident about the core `ta.*` functions and `request.security`; anything marked "unsure" needs checking against current Pine documentation before Phase 2.*

| Block | Pine mapping | Notes |
|---|---|---|
| `price_vs_ma`, `ma_order`, `ma_cross` | `ta.sma` / `ta.ema`, `ta.crossover` / `ta.crossunder`, `ta.barssince` | Direct. |
| Other timeframes | `request.security(sym, tf, expr[1], lookahead=barmerge.lookahead_on)` | The `[1]` + lookahead pattern reads only closed higher-timeframe candles; must be generated exactly this way to avoid repainting. |
| `structure`, swing levels | `ta.pivothigh(k, k)` / `ta.pivotlow(k, k)` | Pivots confirm *k* bars late, matching our definition; the script must use the confirmed value, not plot it back in time. |
| `level` prior day/week | `request.security(sym, "D", high[1], lookahead_on)` | Pine's daily session boundary may not be 17:00 New York for every data feed (unsure); flag in the script header. |
| `candle_pattern`, `candle_size` | Plain expressions on `open/high/low/close` and `ta.atr` | Direct. |
| `rsi`, `macd`, `atr` | `ta.rsi`, `ta.macd`, `ta.atr` | Pine's RSI uses Wilder smoothing (`ta.rma`), matching our definition. |
| `time_window` | `time(timeframe.period, "0700-1000", "Europe/London")` | Direct. |
| Entries | `strategy.entry` with `limit=` / `stop=`; expiry via `strategy.cancel` after N bars | Direct. |
| Stops, targets, partials, trailing | `strategy.exit(qty_percent=, stop=, limit=, trail_points=)` | Breakeven needs custom state logic. |
| Costs | `commission_value`, `slippage` in `strategy()` | Spread isn't modelled natively (unsure of current options); fold spread into slippage. |
| `free_text` | **Can't map** | The reason discretionary versions are excluded from the helper. |
| News windows | **Can't map reliably** | No economic calendar in Pine that I can confirm; flagged in the script header. |
| Risk limits (daily loss, streak) | Partly: `strategy.risk.max_intraday_loss`, custom counters | Currency-exposure caps across pairs can't map (one script, one symbol). |

---

## 4. Designer: flow, screens, states, copy, interaction

*Lens: a beginner on a 360 px phone with a slow connection should finish a first draft in one sitting and understand every word.*

### 4.1 What I asked of the Trader and Engineer

| Request | Outcome |
|---|---|
| Fewer blocks on first view | Picker shows the 6 groups, not 13 items; search finds any block by name or by plain words ("trend", "news"). Accepted. |
| Defaults pre-filled everywhere | Every block opens with valid defaults so a new condition is never an error. Accepted. |
| No form library modal stacks | One part per step; conditions edit inline in a card. Accepted. |
| Name and idea first, unchecked | The idea field is never checked for vague words; it's a place to think. Accepted. |
| Examples last, and optional until the checklist | Examples are a step of their own after the rules, because rules change while drafting. Accepted. |
| Direction mirroring visible | Preview shows the short side under "Shorts mirror this:" when `both`. Accepted. |
| Warnings never red | Warnings use the `warning` banner tone and the word "Note"; only fails block. Accepted. |

### 4.2 Flow map

```
Lab (list) ──"New strategy"──▶ [Level 2 not passed → locked card: "Drafting opens after the Level 2 exam" → Learn]
     │                         [5 active → limit state: archive one first]
     ▼
1 Name & idea → 2 Market → 3 Setup ⇄ (condition picker sheet) → 4 Entry → 5 Stop → 6 Exit
     → 7 Risk → 8 Costs → 9 No-trade rules → 10 Examples → Check (clarity checklist)
                                   │                                  │
     free-text rule ──▶ "Can this be structured?" ──▶ convert to block    every fail has "Fix" → jumps to step + field
                          └──▶ "Keep as written" + reason → discretionary label
                                                                      │
     profile-fit notes appear on Market and Check (never block)       ▼
                                                     all checks pass → "Lock version 1" (Gate 3 passes)
                                                                      ▼
                         Strategy page (read-only rulebook, Gate 3 card, version history)
                                                                      │
                         "Edit rules" → reason sheet → version 2 draft → same steps → Check → Lock version 2
```

Steps are free to visit in any order (the rail is navigation, not a gate); the checklist is the only gate.

### 4.3 Screen specs

**Lab list** — desktop 1280: page header "Strategy Lab", description, primary "New strategy". Cards in a 2-column grid: name, "Version 2 · Mechanical", status chip (Draft · 3 checks left / Locked · Gate 3 passed / Archived), last edited. Archived strategies collapse under "Archived (2)". Mobile 360: one column, primary button full width under the header.

**Builder** — desktop: three columns inside the app shell: step rail (200 px, numbered steps with a status dot: empty, in progress, done, has a fail), the step form (max 640 px), and the live preview (sticky, 360 px). Top of the form: "Step 3 of 10" (caption), step title (H1), one-line "why this matters" (body small, muted). Bottom action bar aligned to the form: Back (ghost) · save status ("Saved" / "Saved on this device · Syncing") · primary "Next: Entry". Mobile: rail becomes a thin progress bar and a step title button that opens the step list in a bottom sheet; preview is a "Preview" toggle in the top bar opening a bottom sheet; the action bar is fixed above the safe area.

**Condition picker** — mobile: bottom sheet at 90% height, search field focused, groups as rows with a one-line description; tapping a group lists its blocks with their preview sentence. Desktop: a Radix Dialog anchored as a right-side sheet (480 px). One primary action per block row ("Add"). "Write my own" sits last, with the note "Rules in your own words make the strategy discretionary unless they become a building block."

**Condition card** — header: preview sentence (body, the card's title, live as parameters change); timeframe select; parameters as labelled inputs in a 2-column grid (1 column at 360 px), numeric inputs mono; "Remove" (ghost, icon + word). Fails show inline under the field; the card border uses `--danger` only while a fail is open.

**Free-text card** — textarea with a character count, banned words underlined with a dotted `--warning` line and the question beneath ("Your rule uses 'strong'. Strong compared with what?…"), suggested blocks as secondary buttons ("Use the RSI block"), and, when clean, two choices: "Turn into a building block" (secondary) and "Keep as written" (secondary; opens the reason field). One primary action stays on the action bar.

**Live preview** — the rulebook as numbered plain sentences grouped by part, each with its timeframe; fails shown as a small "1 check" link by the part. Title: the strategy name and "Version 1 · Draft".

**Check (clarity checklist)** — GitHub-checks style list grouped by part: ✓ passed (muted), ✕ failing (word "Fails" + icon), ! note (word "Note"). Each failing item has "Fix" (link) that routes to the step and focuses the field. Summary line on top: "4 checks fail · 3 notes". Profile-fit notes in their own group "Fit with your plan". When everything passes: a Gate card ("Gate 3: rules are clear enough to test" with criteria all ✓) and the primary "Lock version 1". Below it, plain text: "Locking fixes these rules. Tests and journal trades attach to this version. Changes later become version 2."

**Examples** — one section per setup condition (its sentence as heading) with two slots: "True on this chart" and "False on this chart". Each slot: image (16:9), annotation tools (Arrow, Box, Undo, Clear) as a segmented row, note field (required, 280 chars). Upload: "Add screenshot" (file or paste). Mobile: tools become a row of 44 px buttons under the image.

**Version history** — list: "Version 3 · 12 Oct · Locked · Gate 3 passed · 14 trades" with its reason quoted; the current draft first. "Edit rules" on a locked latest version opens a bottom sheet (mobile) / dialog (desktop) titled "Save as new version", one required field "What's changing and why?" and primary "Create version 4".

**Strategy page (read-only)** — the rulebook as the preview's sentences, the Gate 3 card, examples gallery, "Edit rules", "Archive". Locked fields never render as inputs.

### 4.4 States

| Screen | Empty / first run | Partial | Error | Offline / syncing | Saving | Read-only | Limit |
|---|---|---|---|---|---|---|---|
| Lab list | Empty state: "No strategies yet. Write your first rulebook, one part at a time." + "New strategy". Before Level 2: "Drafting opens after the Level 2 exam." + "Go to Level 2" | Cards with "3 checks left" | Banner: "Couldn't load your strategies." + reason | Last list from the device + "Showing what's saved on this device" | — | Archived cards muted | Primary disabled; banner: "5 strategies are active, the most allowed. Archive one to start another." |
| Builder step | Defaults filled; first-run hint on step 1 only | Rail dots show progress | Inline field errors; save failure: "Couldn't save. Your changes are on this device and will sync." | "Saved on this device · Syncing" | "Saving…" (text, no spinner) | Locked version: fields as text + banner "Version 2 is locked. Edit rules to start version 3." | — |
| Setup | "No conditions yet. Add the first thing that must be true before a trade." + "Add condition" | Cards | Card-level fails | as above | as above | as above | — |
| Picker | Search with no match: "Nothing called '{q}'. Try 'trend', 'level', 'RSI' or write your own." | — | — | Works offline (static) | — | — | — |
| Examples | Two empty slots per rule with dashed outlines | Some slots filled | "Couldn't upload. Screenshots need a connection." | Upload disabled + "Screenshots need a connection" | "Uploading…" in the slot | Add-only on locked versions | Up to 3 examples per slot |
| Check | — | Fails listed | Server unreachable: TS results shown + "Checked on this device. Locking needs the server." | Lock button disabled with that line | "Checking…" | Gate card shows "Passed" and date | — |
| Conflict (409 stale) | — | — | Dialog: "This draft changed on another device." · "Keep this device's version" / "Use the other version" | — | — | — | — |

### 4.5 Copy deck

| Key | Copy |
|---|---|
| Lab description | "Write your own rulebook, one part at a time. Clear rules can be tested; vague ones can't." |
| New strategy button | "New strategy" → toast "Strategy created" |
| Step 1 title / why | "Name and idea" / "The idea is for you. The rules come next, in parts a computer could follow." |
| Idea field | Label "Your idea in one sentence" · helper "For example: buy pullbacks in an uptrend on the 4-hour chart. This isn't checked; it's a note to yourself." |
| Step 2 | "Market" / "Which pairs, which charts and which hours. Fewer pairs are easier to test." |
| Direction | Label "Direction" · options "Buys only", "Sells only", "Both (sells mirror buys)" |
| Timeframes | Label "Charts you use" · helper "Up to three. Conditions and the entry each use one of these." |
| Step 3 | "Setup" / "Everything that must be true before a trade. All conditions must be true at once." |
| Add condition | "Add condition" |
| Step 4 | "Entry" / "How the trade opens once the setup is true." |
| Step 5 | "Stop" / "Where the trade is wrong. It's set before entry and never moved further away." |
| Step 6 | "Exit" / "How winning trades close. Management rules change your results, so they're part of the test." |
| Step 7 | "Risk" / "Limits you set while calm, for when you aren't." |
| Step 8 | "Costs" / "Spread, commission, slippage and swap for each pair. Tests without costs show results no account gets." |
| Placeholder cost | "Placeholder. Replace with your broker's figures." |
| Step 9 | "No-trade rules" / "Times and conditions when no new trade opens." |
| Step 10 | "Examples" / "One chart where each condition is true and one where it's false, so the rule means the same thing every time." |
| Example note | Label "Why this counts" / "Why this doesn't count" |
| Check title | "Check" · summary "{n} checks fail · {m} notes" or "All checks pass" |
| Fix link | "Fix" (screen-reader: "Fix: {message}") |
| Lock | "Lock version {n}" → toast "Version {n} locked. Gate 3 passed." |
| Keep as written | Button "Keep as written" · reason label "Why keep this in your own words?" · note "Kept rules make this version discretionary. Discretionary results need more trades before a verdict." |
| Discretionary label | "Discretionary · lower reliability" (with glossary link) |
| New version sheet | Title "Save as new version" · field "What's changing and why?" · button "Create version {n}" |
| Limit | "5 strategies are active, the most allowed. Archive one to start another." |
| Drafting locked | "Drafting opens after the Level 2 exam. Level 2 covers the probability and risk this builder uses." |
| Save status | "Saved" · "Saving…" · "Saved on this device · Syncing" |
| Fit note example | "This strategy uses 15-minute charts. Your plan has 5 hours a week; 15-minute strategies usually need about 10." |

All copy follows `DESIGN.md` §2: sentence case, describes rather than instructs, no "signal", "winning", "proven" or "profitable" anywhere, numbers with units and signs.

### 4.6 Interaction and accessibility

- **Keyboard (desktop):** `Alt+→` / `Alt+←` next and previous step; `/` focuses picker search when the picker is open; `Ctrl/⌘+Enter` adds the highlighted block; `Esc` closes sheets. Shortcuts are listed in a "Keyboard" popover in the step rail.
- **Touch:** every control ≥ 44 px; sheets have a drag handle and a visible "Close" button; numeric fields use `inputmode="decimal"`.
- **Motion:** step changes use the existing `ep-screen-in` (fade + 8 px, 200 ms; opacity only with reduced motion); sheets slide 250 ms; nothing else animates.
- **Focus order:** step title → why line → fields in reading order → action bar. Moving to a step focuses its H1. "Fix" moves focus to the field and announces the message (`aria-describedby`).
- **Screen readers:** condition cards are `<fieldset>` with the preview sentence as `<legend>` (updates are `aria-live="polite"`, debounced); the checklist is a list where each item's text starts with "Passes", "Fails" or "Note"; annotation overlays are decorative and the required note carries the meaning; the step rail is `<nav aria-label="Rulebook steps">` with `aria-current="step"`.
- **One primary action per screen:** "Next: {step}" on steps, "Add" in the picker, "Lock version {n}" on Check, "Create version {n}" in the sheet.

---

## 5. Cross-review log

| # | Objection | Raised by → owner | Resolution |
|---|---|---|---|
| E1 | The brief asks for React Hook Form + Zod; the builder autosaves and never submits, the clarity engine already validates, and the app uses no form library elsewhere. Two libraries would add weight and a second validation path. | Engineer → brief | **Changed:** typed reducer + clarity engine. Designer agrees (no submit step). Founder to confirm (open question 1). |
| E2 | Manual support/resistance zones can't be coded. | Engineer → Trader | **Accepted:** free text only; `level` covers objective levels. |
| E3 | "Rejection" and "touch" were two near-identical level events. | Engineer → Trader | **Changed:** one `within` event with a close-side rule. |
| E4 | Free text allowed in stops/exits would make most strategies discretionary by accident. | Engineer → Trader | **Accepted:** structured options only there. |
| E5 | Two clarity engines could drift. | Engineer → Engineer | **Resolved:** shared fixtures with exact expected codes in both test suites; the server copy decides. |
| T1 | Without a mandatory buffer, swing stops sit exactly where spreads trigger them. | Trader → Engineer | **Changed:** warning `W_STOP_NO_BUFFER`, not a fail; some traders deliberately use 0 with a stop-limit. |
| T2 | Beginners will leave costs at the placeholders and believe the test. | Trader → Designer | **Changed:** placeholders are labelled in the step and raise `W_COSTS_PLACEHOLDER` on Check; zero total cost is a hard fail. |
| T3 | Allowing 13 blocks and unlimited conditions invites curve-fitting. | Trader → Designer | **Accepted with a warning** above 5 conditions; no hard cap (some valid MTF rulebooks use 6). |
| T4 | "Both" direction must show the mirrored short rules, or traders assume asymmetries that aren't there. | Trader → Designer | **Accepted:** preview shows "Shorts mirror this" sentences. |
| T5 | Prior-day levels need a fixed day boundary. | Trader → Engineer | **Accepted:** 17:00 New York, stated in the block's help text. |
| D1 | The example requirement (valid + invalid per rule) is heavy for a first draft and could stall beginners. | Designer → spec | **Kept** (spec SL-3), but placed last and explained; each example needs only one screenshot and a sentence. |
| D2 | Annotation drawing is hard on small touch screens and not usable by everyone. | Designer → Engineer | **Changed:** annotations optional; the note is required and carries the meaning. |
| D3 | A 10-step wizard feels long. | Designer → Designer | **Mitigated:** steps are free to visit, defaults are pre-filled (steps 7–9 can be accepted as-is), and the rail shows progress. |
| D4 | Free-text vague-word errors can feel like scolding. | Designer → Trader | **Changed:** each banned word comes with a question and a one-tap block suggestion; tone describes ("Your rule uses 'strong'"). |
| D5 | Gate language ("Gate 3") is opaque. | Designer → spec | **Changed:** shown as "Gate 3: rules are clear enough to test", with the glossary link. |

---

## 6. Open questions for the founder

**Answered 2026-10-17:** proceed with every recommendation below, with two changes from the founder:

- **When drafting opens (Q2):** the builder opens only after the Level 6 strategy lessons ("From an idea to a rulebook" and "Writing rules anyone could follow"), not after Level 2. The lesson list is one setting, `STRATEGY_LAB_REQUIRED_LESSONS`.
- **Development builds:** every gate (lesson order, exams, the Lab, future features) is open while developing and gated when deployed. One switch, `OPEN_GATES`, works only with `DJANGO_DEBUG` on; tests always run gated. The app reports it on `/me` (`gates_open`) and shows an "Open for development" note wherever a deployed build would lock, with the unlock nudge it would show.

The original questions, for the record:


1. **Form library:** OK to drop React Hook Form + Zod in favour of the typed reducer and clarity engine (E1)?
2. **When drafting opens:** after the Level 2 exam (or placement) as the spec's "after Level 2" suggests, even though Gate 2 now means all seven published level exams? Gate 2 would still be required for test runs in Phase 2.
3. **Spread placeholders:** keep round placeholders (1.0 / 2.0 pips) with a warning, or leave spreads empty and make the trader enter them (stricter, slower)?
4. **Fibonacci retracements and RSI/MACD divergence:** leave out of Phase 1 (current plan), or add as blocks with strict definitions?
5. **Examples on locked versions:** allow adding examples after locking (current plan) — fine?
6. **Session times and DST:** onboarding session hours are fixed UTC; time-window blocks follow daylight saving. Acceptable mismatch for Phase 1?
7. **Journal link:** may practice trades link to **draft** (unlocked) versions, per JR-1 (current plan), or only to locked ones?
8. **The word "signal":** `DESIGN.md` §2 bans it. Our own term is now "setup candle" (was "signal candle"). MACD's "signal line" is the indicator's standard name and appears in the MACD block only, with a glossary entry. Accept this one exception, or rename it ("MACD average line")?

---

## 7. Build plan

Order follows the brief; each stage ends with its tests passing.

| Stage | Files | Tests |
|---|---|---|
| **1. Schema and clarity engine** | `backend/apps/strategy/schema/rulebook.v1.json`, `apps/strategy/{vocabulary,banned,clarity,fit,mirror}.py`; `frontend/src/features/strategy-lab/{types,vocabulary,banned,clarity,fit,mirror,describe}.ts`; add `jsonschema` to backend requirements | `test_rulebook_schema.py`, `test_clarity.py`, `clarity.test.ts`, `vocabulary.test.ts`, `describe.test.ts`, `mirror.test.ts`, `fit.test.ts` (all 12 fixtures, parity) |
| **2. Models, migrations, API** | `apps/strategy/{models,serializers,services,permissions,views}.py`, migrations (strategy 0001, gates GatePass version FK, testing Trade version FK), `config/urls.py`, journal `plan_warnings` | `test_strategy_api.py`, `test_plan_warnings.py`, existing suites stay green |
| **3. Front-end builder** | `features/strategy-lab/{LabPage,BuilderLayout,StepRail,steps/*,ConditionPicker,ConditionCard,FreeTextCard,Preview,Checklist,ExamplesStep,AnnotationOverlay,HistoryPage,StrategyPage,draft.ts,api.ts}`, `components/ui/BottomSheet.tsx`, router, journal form strategy select | unit tests for reducer and draft sync; type-check, lint, build within budget |
| **4. End-to-end** | `e2e` Playwright script at 360 px and 1280 px | full flow, limit, offline sync, version 2, no browser errors |
| **5. Docs** | `DESIGN.md` §7 additions and §12 recipes for the Lab | — |

Estimated size: about 25 new files on each side. I'll stop after this document for your approval and answers to §6.
