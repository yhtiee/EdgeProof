---
id: l1-how-costs-eat-into-every-trade
level: 1
module: trading-costs
order: 3
title: How costs eat into every trade
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

You now know three costs: the [[spread]], commission and [[swap]]. There's a fourth one you can't see on the price list: [[slippage]], when an order fills a little worse than the price you asked for.

Each one is small. The question is: small compared with what?

---

Compare costs with your risk. If your [[stop-loss]] is 10 pips away, a 1-pip spread is a tenth of everything you risked, before the trade has done anything. With a 100-pip stop, the same spread is a hundredth.

That's why short-term strategies with tight stops pay far more in costs, as a share of each trade, than slower ones.

---

Move the stop distance and watch the cost as a share of your risk. EdgeProof measures results in R, where 1R is the money you risked, so here the cost is shown in R too.

::simulator{kind="trading-cost"}

---

::question{type="numeric" answer="0.17" tolerance="0.005" unit="R"}
Your spread is 1 pip and your commission is $7 per lot. Your stop is 10 pips, and one pip is worth $10 per lot. What do costs take from each trade, in R? Ignore slippage.
? Cost per lot: 1 pip × $10 + $7 = $17. Risk per lot: 10 pips × $10 = $100. $17 ÷ $100 = 0.17R.
::

---

A strategy has to earn more than its costs on every trade, on average, just to break even. When costs are more than about 20% of the risk, that becomes very hard. EdgeProof warns you at that point when you test a strategy.

::takeaway
Judge costs against your risk, not in pips alone. Tight stops make the same spread and commission a much bigger share of every trade.
::
