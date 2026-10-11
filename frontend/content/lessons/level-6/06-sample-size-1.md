---
id: l6-how-many-trades-you-need
level: 6
module: sample-size
order: 1
title: How many trades you need
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

In Level 2 you saw that 30 trades can show almost anything. So how many does a strategy test need?

There's no magic number, but there are sensible minimums. EdgeProof's verdict needs at least **100 development trades and 50 validation trades** for a mechanical strategy, and 150 and 100 for a discretionary one.

---

Even those minimums leave a lot of uncertainty. That's why the verdict always shows a range, not just a number. Use the sample-size tool to see how the range shrinks between 100, 300 and 1,000 trades for the same strategy.

::simulator{kind="sample-size"}

---

The size of the edge matters too. A large edge shows up clearly in fewer trades. A small edge, like +0.10R, needs many more trades before its range clears zero.

---

::question{type="mc"}
Two strategies each have 120 trades. One shows +0.50R per trade, the other +0.08R. Which result is more likely to have a range that stays above zero?
- [x] The +0.50R strategy
- [ ] The +0.08R strategy
- [ ] Both, because they have the same number of trades
? With the same sample size, the range is roughly the same width. A bigger average sits further from zero, so its range is more likely to clear it.
::

---

::takeaway
Verdicts need at least 100 development and 50 validation trades, more for discretionary strategies. Small edges need even more trades before the range can clear zero.
::
