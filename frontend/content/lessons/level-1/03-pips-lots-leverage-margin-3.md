---
id: l1-how-leverage-and-margin-work
level: 1
module: pips-lots-leverage-margin
order: 3
title: How leverage and margin work
status: published
minutes: 5
generated: gemini-3.8-flash 2026-10-11
review: done
---
When you open a trade, your [[broker]] sets aside a portion of your account balance. This cash deposit is called [[margin]].

Margin is not a fee or a transaction cost like the [[spread]]. It is collateral, held as a security deposit to keep your trade open while the position is active [@babypips-pipsology].

Once you close the trade, the broker releases the locked margin back into your account balance.

---

[[leverage|Leverage]] expresses the ratio between the total trade size and the cash deposit required to hold it.

It allows a trader to control a larger trade with a smaller cash deposit. For example, leverage of 30:1 means the trade size is 30 times larger than the required deposit.

---

Consider a position with 30:1 leverage.

Opening a position worth $30,000 requires a broker margin deposit of $1,000 ($30,000 ÷ 30 = $1,000).

If the leverage were higher, say 100:1, holding that same $30,000 position would require only $300 of margin.

::simulator{kind="leverage"}

---

::question{type="numeric" answer="500" tolerance="5" unit="$"}
At 30:1 leverage, how much margin does a broker set aside to hold a position worth $15,000?
? $15,000 ÷ 30 = $500. The broker requires a $500 cash deposit to hold that trade.
::

---

Higher leverage reduces the margin required to open a trade, but it magnifies both percentage gains and losses relative to account equity.

Suppose an account has $1,000 and opens a $30,000 position using 30:1 leverage. A market movement of 1% against the trade equals a $300 loss.

That single 1% adverse market move produces a −30% [[drawdown]] on the $1,000 account balance.

---

Because large positions leave very little margin to absorb price swings, normal volatility can rapidly wipe out an account.

Regulators often restrict retail leverage to limit these severe outcomes [@esma-cfd-restrictions-2018]. Many authorities cap retail leverage on major [[currency pair|currency pairs]] to 30:1 so trades have more room to withstand market fluctuations.

---

::takeaway
Margin is a collateral deposit held by your broker, while leverage multiplies percentage gains and losses relative to your account balance.
::
