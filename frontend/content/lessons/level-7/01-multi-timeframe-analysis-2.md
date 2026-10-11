---
id: l7-testable-multi-timeframe-rules
level: 7
module: multi-timeframe-analysis
order: 2
title: Testable multi-timeframe rules
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Multi-timeframe strategies are easy to describe and easy to make vague. "The higher timeframe looks bullish" is exactly the kind of rule that can't be tested.

Each timeframe's job needs a structured condition, just like any other rule.

---

A testable version might read:

- **Direction (daily):** close above the 50-day simple moving average.
- **Setup (4-hour):** price pulls back to touch the 20-period moving average.
- **Entry (1-hour):** a candle closes above the previous candle's high.
- **Stop:** below the most recent 1-hour swing low.

Every line can be checked by anyone, on any chart.

---

Two traps are worth knowing. First, more timeframes means more conditions, and every condition is another chance to overfit. Second, what you see on a higher timeframe depends on when its current candle will close: a daily candle "above the average" at noon may close below it.

So define which candles count: usually only **closed** candles on the higher timeframes.

---

::question{type="mc"}
Your rule says "daily close above the 50-day average". It's mid-afternoon, and today's daily candle is currently above it. Does the rule pass?
- [ ] Yes, because price is above the average right now
- [x] Not yet: the daily candle hasn't closed, so use yesterday's closed candle
- [ ] It depends on how strong the move looks
? Unfinished candles can change. Using only closed candles keeps the rule the same in testing and live trading.
::

---

::takeaway
Give each timeframe a structured condition, use only closed candles on higher timeframes, and keep the number of conditions small to limit overfitting.
::
