---
id: l7-adding-up-risk-by-currency
level: 7
module: currency-exposure
order: 1
title: Adding up risk by currency
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Every forex position is two positions at once. Buying EUR/USD means you're long the euro and short the US dollar. Selling USD/JPY means you're short the dollar and long the yen.

So the real question isn't "how many trades do I have?", but "how much am I risking on each currency?"

---

Add it up like this. For each open trade, put its risk against both currencies, with a sign: plus for the currency you bought, minus for the one you sold. Then total each currency.

Try opening different combinations below.

::simulator{kind="currency-exposure"}

---

EdgeProof's rulebook has a limit for exactly this: maximum total risk per currency, with a default of 2%. Your journal and pre-trade checklist warn you when a new trade would push any currency over it.

---

::question{type="mc"}
You buy EUR/USD, buy AUD/USD and sell USD/JPY, risking 1% on each. What's your US dollar exposure?
- [ ] Long USD, 1%
- [ ] Neutral, because the trades balance out
- [x] Short USD, 3%
? All three trades sell dollars: buying EUR/USD and AUD/USD sells USD, and so does selling USD/JPY. That's 3% at risk on one currency.
::

---

::takeaway
Each trade is long one currency and short another. Add up risk per currency, not per trade, and keep each currency within your limit.
::
