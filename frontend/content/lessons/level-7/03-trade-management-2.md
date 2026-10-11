---
id: l7-testing-management-rules
level: 7
module: trade-management
order: 2
title: Testing management rules
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Management rules are part of your strategy, so they belong in your rulebook and your tests, written as precisely as your entry rules.

"Trail the stop when it looks good" can't be tested. "Once the trade reaches +1R, move the stop to entry; after +2R, trail it 1 × ATR behind the highest close" can.

---

**R with partials:** when you close part of a trade at different prices, EdgeProof combines the pieces into one trade with a weighted R. If half closes at +1R and the rest at +3R, the trade is +2R.

That keeps every trade comparable, however you managed it.

---

::question{type="numeric" answer="1.5" tolerance="0.01" unit="R"}
You close half a position at +1R, and the other half at +2R. What's the trade's result, in R?
? Each half carries half the risk: 0.5 × 1R + 0.5 × 2R = 0.5R + 1R = +1.5R.
::

---

A common mistake: changing management in the middle of a test, or in live trading, after a few annoying trades. Every change creates a new strategy version in EdgeProof, with a reason, and results start counting again for that version. Changing on a whim resets your evidence.

---

::question{type="mc"}
After three trades that reversed just before target, you want to add a trailing stop. What does EdgeProof do?
- [ ] Adds it to the current version and keeps counting
- [x] Creates a new version with your reason, and its results are counted separately
- [ ] Blocks the change
? Any rule change is a new version, so you can compare versions fairly. Three trades are also far too few to judge a rule.
::

---

::takeaway
Write management rules as precisely as entries, measure partial closes as one weighted R, and remember that every change creates a new version with fresh evidence.
::
