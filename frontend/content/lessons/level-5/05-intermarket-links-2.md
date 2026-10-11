---
id: l5-pairs-that-move-together
level: 5
module: intermarket-links
order: 2
title: Pairs that move together
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

The US dollar is everywhere. It was on one side of 89% of all FX trades in April 2025 [@bis-triennial-2025]. So pairs that share the dollar often move together when dollar news hits.

That shared movement is called [[correlation]]. A correlation near +1 means two pairs tend to move the same way; near −1, opposite ways; near 0, no clear link.

---

EUR/USD and GBP/USD often move in the same direction, because both are priced against the dollar. EUR/USD and USD/CHF often move in opposite directions, because the dollar sits on different sides of each pair.

---

This matters for your risk. Buying EUR/USD and buying GBP/USD can feel like two separate trades. In practice, much of it is one bet: against the US dollar.

Tick both and see what you're really exposed to.

::simulator{kind="currency-exposure"}

---

::question{type="mc"}
You buy EUR/USD and buy GBP/USD, risking 1% on each. What's your exposure to the US dollar?
- [ ] Long USD, 2%
- [x] Short USD, about 2%
- [ ] No USD exposure, because the trades cancel out
? Buying either pair means selling dollars. Both trades lose if the dollar strengthens, so you're short USD with about 2% at risk.
::

---

::takeaway
Pairs that share a currency often move together. Two trades on different pairs can be one bet on the same currency, so add up your risk per currency, not just per trade.
::
