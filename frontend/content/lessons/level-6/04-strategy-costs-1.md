---
id: l6-building-a-cost-model
level: 6
module: strategy-costs
order: 1
title: Building a cost model
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

A backtest without costs is a fantasy. Many replay tools and strategy testers start with zero costs, which makes almost every strategy look better than it is.

A cost model fixes that: a written estimate of what each trade really costs, for each pair you trade.

---

**A cost model has four parts per pair:**

- **Spread:** a typical value, in pips.
- **Commission:** per lot, round trip.
- **Slippage:** how far fills tend to be from your price. EdgeProof's defaults are 0.3 pips on major pairs, 1.0 on crosses, and 3 or more inside news windows.
- **Swap:** per night, for trades held overnight.

---

EdgeProof applies your cost model to every test trade, including imported ones that show zero commission. The verdict always uses your model, never the costs the trade happened to show.

Build one now for a typical pair:

::simulator{kind="trading-cost"}

---

::question{type="mc"}
A strategy tester shows +0.25R per trade with zero costs. Your cost model takes 0.15R per trade. What's the realistic expectancy?
- [ ] +0.40R
- [x] +0.10R
- [ ] +0.25R
? Costs come off every trade: +0.25R − 0.15R = +0.10R. A strong-looking strategy can be thin once costs are in.
::

---

::takeaway
Write a cost model for each pair: spread, commission, slippage and swap. Apply it to every test trade, because results without costs can't be trusted.
::
