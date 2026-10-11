---
id: l2-what-an-edge-is-worth
level: 2
module: realistic-returns
order: 2
title: What an edge is worth in practice
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

So what can a real [[edge]] earn? Work it out from three numbers: [[expectancy]] per trade, number of trades, and risk per trade.

Suppose a strategy has a tested expectancy of +0.20R, takes 100 trades a year, and risks 1% per trade.

---

The sum is simple:

- 100 trades × +0.20R = +20R a year, on average.
- At 1% risk, 1R is 1% of the account, so +20R is roughly +20%, before compounding.

That's a strong result, and it's an average. Some years would be better, some worse, some negative.

---

::question{type="numeric" answer="15" tolerance="0.5" unit="%"}
A strategy has an expectancy of +0.15R, takes 200 trades a year, and risks 0.5% per trade. Roughly what yearly return is that, in percent, before compounding?
? 200 × 0.15R = 30R. Each R is 0.5% of the account, so 30 × 0.5% = 15%.
::

---

Notice what raises the return: a bigger edge, more trades, or more risk. Only the first two improve the strategy. Raising the risk raises the drawdowns just as fast, and with them the [[risk of ruin]].

---

Doing more isn't the same as doing better, either. In a large US study, the households that traded most earned 11.4% a year, while the market returned 17.9% [@barber-odean-trading-hazardous].

::takeaway
An edge's value is expectancy × trades × risk. Honest numbers are modest and uneven. Big promises need big risk or big luck, and neither lasts.
::
