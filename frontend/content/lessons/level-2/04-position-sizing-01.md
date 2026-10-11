---
id: l2-sizing-from-the-stop
level: 2
module: position-sizing
order: 1
title: Sizing a trade from its stop
status: published
minutes: 6
---

Most blown accounts don't come from one bad idea. They come from a [[position size]] that was too big for the stop.

Careful sizing starts from the money you're willing to lose if the trade is wrong, then works backwards.

---

Set the account to $1,000 and the risk to 1%. Now widen the stop from 20 to 50 pips. Watch what happens to the size, and to the money at risk.

::simulator{kind="position-size"}

---

**Position size = money at risk ÷ (stop in pips × pip value per lot)**

With $1,000 and 1% risk, the money at risk is $10. A 25-pip [[stop-loss]] on EUR/USD costs $250 per standard lot, so the size is $10 ÷ $250 = 0.04 lots.

---

::question{type="numeric" answer="0.05" tolerance="0.001" unit="lots"}
Your account is $2,000, you risk 1% per trade, and your stop is 40 pips on EUR/USD. What size is that, in lots?
? 1% of $2,000 is $20. A 40-pip stop costs $400 per lot. $20 ÷ $400 = 0.05 lots.
::

---

::takeaway
Decide the risk first, place the stop where the idea is wrong, then let the size fall out of the maths.
::
