---
id: l6-when-costs-kill-a-strategy
level: 6
module: strategy-costs
order: 2
title: When costs kill a strategy
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Some strategies look good before costs and lose after them. The usual cause is small stops: when the stop is tiny, the spread and slippage are a big share of every trade's risk.

---

EdgeProof measures **costs as a share of gross results**, and warns you in two cases:

- When costs take more than 20% of the strategy's gross R.
- When the average stop is under 10 pips, where costs dominate quickly.

These aren't failures. They're signs that a small change in real costs could erase the edge.

---

A strategy that's close to the line has two honest options: trade a slower timeframe with bigger stops, so costs shrink as a share of risk, or accept that the edge is too thin to trade.

Try a 6-pip stop in the calculator, then a 30-pip stop.

::simulator{kind="trading-cost"}

---

::question{type="numeric" answer="25" tolerance="0.5" unit="%"}
Before costs, a strategy made +40R over its test. Costs added up to 10R. What share of the gross result did costs take, in percent?
? 10R ÷ 40R = 0.25, so costs took 25% of the gross result, which is above EdgeProof's 20% warning level.
::

---

::takeaway
Tight stops make costs a large share of every trade. When costs pass 20% of the gross result, or stops average under 10 pips, the edge is fragile.
::
