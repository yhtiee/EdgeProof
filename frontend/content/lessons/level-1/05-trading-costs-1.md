---
id: l1-spreads-and-commissions
level: 1
module: trading-costs
order: 1
title: Spreads and commissions
status: published
minutes: 5
generated: gemini-3.8-flash 2026-10-11
review: done
---
Every [[currency pair]] quote displays two prices at the same time: the bid and the ask [@babypips-pipsology].

The bid is the price at which the [[broker]] buys from you when you sell. The ask is the price at which the broker sells to you when you buy. The ask is always slightly higher than the bid.

The gap between these two prices is the [[spread]], measured in [[pip|pips]]. Because you buy at the higher ask price and sell at the lower bid price, every position opens with a small unrealised loss equal to that spread.

---

Brokers generally offer two common fee structures:

- **Spread-only accounts**: The broker widens the gap between the bid and ask to include their markup, charging zero separate commission per trade.
- **Raw or commission-based accounts**: The broker offers narrower spreads, sometimes close to zero, but charges a separate cash commission per [[lot]].

Both structures cover the broker's cost of handling your trade, but they collect that payment in different ways.

---

A commission is usually quoted as a round-trip fee, which covers both entering and closing the trade.

For instance, a broker might charge $7 per standard lot round trip. You pay this amount regardless of whether the trade ends in a profit or a loss.

To find the direct cash cost of opening and closing any position, add the cash value of the spread to the commission:

**Direct cost = (spread in pips × pip value) + commission**

---

::question{type="numeric" answer="11" tolerance="0.1" unit="$"}
You open 1 standard lot of EUR/USD, where 1 pip equals $10. Your raw account has a spread of 0.4 pips and charges a $7 round-trip commission. What is the total direct cost in dollars?
? The spread costs 0.4 pips × $10 = $4. Adding the $7 round-trip commission gives a total direct cost of $4 + $7 = $11.
::

---

::question{type="mc"}
A trader opens 1 standard lot of EUR/USD, where 1 pip equals $10. Account A has a 1.5-pip spread and no commission. Account B has a 0.3-pip spread and an $8 round-trip commission. Which account is cheaper?
- [ ] Account A, by $3
- [x] Account B, by $4
- [ ] Both accounts cost the same
? Account A costs 1.5 × $10 = $15. Account B costs (0.3 × $10) + $8 = $11. Account B is cheaper by $15 − $11 = $4.
::

---

::takeaway
Every trade begins with a small cost from the spread, commissions, or both, which you can calculate in cash before placing an order.
::
