---
id: l1-swaps-and-the-triple-swap
level: 1
module: trading-costs
order: 2
title: Swaps and the Wednesday triple swap
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

When you hold a trade overnight, your [[broker]] charges or pays you a small amount called a [[swap]]. It's also called rollover or overnight financing.

It exists because every currency has its own [[interest rate]]. Holding a trade is like borrowing one currency to hold the other, so you pay or earn the difference in their interest rates.

---

Roughly, if the currency you bought has a higher interest rate than the one you sold, you may earn a small credit. If it's lower, you pay. Brokers add their own charge on top, so many swaps are a cost in both directions [@babypips-pipsology].

Swaps are applied once a day at the rollover time, usually 5 p.m. New York time. Brokers publish their swap rates for each pair.

---

Now the strange part. On Wednesday night, most brokers charge three days of swap instead of one.

The reason is settlement. In the wider market, a currency deal settles two working days after it's made. A position held over Wednesday's rollover settles on Monday, so it covers Saturday and Sunday too. Those two weekend days are charged on Wednesday.

---

Try it: set a swap of −$6 per lot per night, hold for 5 nights, and switch the Wednesday rollover on and off.

::simulator{kind="swap"}

---

::question{type="numeric" answer="-42" tolerance="0" unit="USD"}
Your swap is −$6 per lot per night. You hold 1 lot from Monday to Saturday morning: 5 nights, including Wednesday. What's the total swap? Use a minus sign for a cost.
? 5 nights plus 2 extra for Wednesday = 7 charged nights. 7 × −$6 = −$42.
::

---

::takeaway
Holding overnight costs or earns a swap, based on interest rates. Wednesday's rollover usually counts three times, so a trade held all week pays seven nights.
::
