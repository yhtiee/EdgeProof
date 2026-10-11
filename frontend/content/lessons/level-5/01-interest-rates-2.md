---
id: l5-the-carry-trade
level: 5
module: interest-rates
order: 2
title: The carry trade
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

In Level 1 you met the [[swap]]: the daily charge or credit for holding a position overnight. It comes from the gap between two currencies' interest rates.

A [[carry trade]] tries to earn that gap: buying a high-interest currency against a low-interest one, and collecting a swap credit each night.

---

It sounds like free money. It isn't, for two reasons:

- **Exchange rate risk.** The swap credit is small. A modest move in the pair against you can wipe out months of credit in a day.
- **Crowding.** When many traders hold the same carry trade and markets get nervous, they can all rush to close it at once. That can cause sharp, fast moves against the position.

---

Try it with the swap calculator: set a credit of +$4 per lot per night, held for 30 nights.

::simulator{kind="swap"}

---

::question{type="numeric" answer="40" tolerance="0" unit="pips"}
Your carry trade earns +$4 per night on 1 lot, and you hold it for 100 charged nights: $400 in total. One pip is worth $10 on 1 lot. How many pips against you would cancel out all of that credit?
? $400 ÷ $10 per pip = 40 pips. A 40-pip move against you erases about three months of swap credit.
::

---

::takeaway
A carry trade earns the interest gap through swaps, but the exchange rate risk is much bigger than the credit. Treat it as a currency trade first, not as interest income.
::
