---
id: l2-expectancy-in-r
level: 2
module: expectancy-and-r
order: 1
title: Expectancy, in R
status: published
minutes: 6
---

An [[r-multiple]] measures a result against the risk you took. Risk $10 and make $20: that's +2R. Lose the $10: −1R.

Measuring in R lets you compare trades of different sizes, and strategies run on different accounts.

---

[[expectancy|Expectancy]] is the average R per trade. It answers one question: if I keep taking these trades, what do I make or lose on each one, on average?

**Expectancy = win rate × average win − loss rate × average loss**

---

A high [[win rate]] isn't the goal. Try 70% wins with an average win of 0.4R and an average loss of 1R.

::simulator{kind="expectancy"}

---

::question{type="numeric" answer="0.2" tolerance="0.005" unit="R"}
A strategy wins 40% of the time. The average win is 2R and the average loss is 1R. What's the expectancy per trade, in R?
? 0.4 × 2R − 0.6 × 1R = 0.8R − 0.6R = +0.2R per trade.
::

---

Expectancy from a small sample is an estimate, not a fact. Thirty trades can show +0.3R by luck alone. Later in this level you'll see how wide that uncertainty really is.

::takeaway
Judge a strategy by its average R per trade, with its range, not by how often it wins.
::
