---
id: l1-understanding-lot-sizes
level: 1
module: pips-lots-leverage-margin
order: 2
title: Understanding lot sizes
status: published
minutes: 5
generated: gemini-3.8-flash 2026-10-11
review: done
---
Currencies are not traded one unit at a time in the retail market. Instead, trades are placed in standardized order sizes called a [[lot]] [@babypips-pipsology].

Trading in standardized bundles keeps trade execution and accounting uniform across different currency markets.

---

The standard sizes are standard, mini, and micro lots:
- A standard [[lot]] equals 100,000 units of the [[base currency]].
- A mini lot equals 10,000 units (0.10 lots).
- A micro lot equals 1,000 units (0.01 lots).

For example, buying 1.00 standard lot of EUR/USD means purchasing 100,000 euros using US dollars. Buying 1 micro lot of the same [[currency pair]] controls 1,000 euros.

---

A retail [[broker|broker]] usually allows fractional trade sizes. Entering 0.15 lots controls 15,000 units of the [[base currency]] (0.15 × 100,000 units).

Choosing a lot size sets the cash value of every [[pip]] move. On pairs where the US dollar is the [[quote currency]], one pip equals:
- $10 on a standard lot (1.00 lot)
- $1 on a mini lot (0.10 lots)
- $0.10 on a micro lot (0.01 lots)

Adjusting your [[position size]] in lots decides the financial impact of every pip the price moves. Try different sizes and moves:

::simulator{kind="pip-value"}

---

::question{type="numeric" answer="25000" tolerance="0" unit="units"}
A trader opens a position of 0.25 lots on EUR/USD. How many units of the base currency does this position control?
? One standard lot equals 100,000 units. Multiplying 0.25 lots by 100,000 units gives 25,000 units of EUR.
::

---

::takeaway
Lot sizes set the total unit volume of a trade, which directly controls the cash impact of every pip move.
::
