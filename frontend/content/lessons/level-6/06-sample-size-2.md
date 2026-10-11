---
id: l6-when-trades-are-not-independent
level: 6
module: sample-size
order: 2
title: When trades aren't independent
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Statistics assume each trade is a separate piece of evidence. Sometimes they aren't.

If you buy EUR/USD and GBP/USD at the same time, both largely depend on the US dollar. When the dollar moves, both win or both lose. That's closer to one bet than two.

---

EdgeProof handles this by grouping. Trades that overlap in time and share a currency form one cluster, and a cluster counts once toward the minimum number of trades. Ten overlapping dollar trades don't count as ten pieces of evidence.

---

Time can concentrate results too. If one year of your test produced most of the profit, the edge may belong to that year's conditions, not to your rules. EdgeProof shows results year by year, and warns when a single year produces more than 50% of the total R.

---

::question{type="mc"}
A test shows +30R over 6 years, and +24R of it came from one year. What does that suggest?
- [ ] The strategy is very strong
- [x] The result depends heavily on one period, so it may not repeat
- [ ] The other years don't matter
? 24R is 80% of the total from one year. That's well above EdgeProof's 50% warning, and a sign the edge may not be general.
::

---

::takeaway
Overlapping trades on the same currency count as one piece of evidence, and results concentrated in one year are fragile. Check both before trusting a total.
::
