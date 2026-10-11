---
id: l7-hidden-correlation
level: 7
module: currency-exposure
order: 2
title: Hidden correlation
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Some doubled-up risk is easy to see, like buying both EUR/USD and GBP/USD. Some is hidden by the way pairs are quoted.

EUR/USD and USD/CHF tend to move in opposite directions, because the dollar sits on opposite sides. So buying EUR/USD and selling USD/CHF looks like opposite trades, but both are bets against the dollar.

---

Correlation also changes. Pairs that move together for months can drift apart, and pairs that usually move oppositely can briefly move together, especially around big news. A correlation figure from last year is a guide, not a promise.

That's why the per-currency method is useful: it works from the currencies in each pair, which never change, rather than from past correlation numbers.

---

::question{type="mc"}
You buy EUR/USD and sell USD/CHF, risking 1% on each. What are you exposed to?
- [ ] Two opposite trades that cancel out
- [x] About 2% short the US dollar
- [ ] About 2% long the US dollar
? Buying EUR/USD sells dollars, and selling USD/CHF sells dollars too. Both lose if the dollar strengthens.
::

---

There's a testing side as well. When two open trades depend on the same currency, they aren't two independent pieces of evidence. EdgeProof groups overlapping trades that share a currency, and counts each group once in your sample size.

::takeaway
Trades that look opposite can be the same bet. Work out exposure from the currencies in each pair, keep each currency within your limit, and remember correlated trades count as one piece of evidence.
::
