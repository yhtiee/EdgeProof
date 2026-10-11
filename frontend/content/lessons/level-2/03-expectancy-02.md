---
id: l2-win-rate-against-payoff
level: 2
module: expectancy-and-r
order: 2
title: Win rate against payoff
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

People love a high [[win rate]]. But win rate is only half the story. The other half is the payoff: how big the wins are compared with the losses.

A strategy that wins 80% of the time can still lose money if each loss is much bigger than each win.

---

Every pair of win and loss sizes has a break-even win rate. If wins are 2R and losses 1R, you break even at a win rate of one in three, because 1 × 2R = 2 × 1R.

**Break-even win rate = average loss ÷ (average win + average loss)**

---

Try different combinations and watch the break-even win rate in the result.

::simulator{kind="expectancy"}

---

::question{type="numeric" answer="25" tolerance="0.5" unit="%"}
Your wins average 3R and your losses 1R. What win rate do you need just to break even, in percent?
? Break-even win rate = 1 ÷ (3 + 1) = 0.25, or 25%. Below that, the strategy loses money over time.
::

---

::question{type="mc"}
Strategy A wins 70% with wins of 0.4R and losses of 1R. Strategy B wins 35% with wins of 2.5R and losses of 1R. Which has the better expectancy?
- [ ] Strategy A
- [x] Strategy B
- [ ] They're the same
? A: 0.7 × 0.4 − 0.3 × 1 = −0.02R. B: 0.35 × 2.5 − 0.65 × 1 = +0.225R. The lower win rate wins.
::

---

::takeaway
Win rate means nothing without payoff. Check the break-even win rate for your win and loss sizes, then judge the strategy by its expectancy.
::
