---
id: l1-weekend-and-news-gaps
level: 1
module: gaps
order: 1
title: Weekend and news gaps
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Forex trades around the clock on weekdays, from Sunday evening to Friday evening, New York time. At the weekend it stops.

The world doesn't stop, though. News, elections and decisions still happen on Saturday and Sunday. When trading starts again, the first price can be far from Friday's last price. That jump is called a [[gap]].

---

Gaps also happen during the week, around big news such as an [[interest rate]] decision. For a few seconds, buyers and sellers pull their orders, [[liquidity]] dries up, and the price can jump straight from one level to another with no trades in between.

On a chart, a gap looks like an empty space between two candles.

---

Here's why gaps matter. A [[stop-loss]] isn't a guaranteed price. When the market reaches your stop, it becomes an order to close at the next available price.

If the market jumps past your stop, there was no price in between to fill at. Your order fills wherever trading restarts, which can be much further away.

---

Set a 20-pip stop, then make the market open 30 pips beyond it.

::simulator{kind="gap"}

---

::question{type="numeric" answer="2.5" tolerance="0.05" unit="R"}
Your stop is 20 pips away. Over the weekend, the market gaps and opens 30 pips past your stop. How big is the loss, in R? Write it as a positive number.
? The stop fills 20 + 30 = 50 pips away. 50 ÷ 20 = 2.5 times the planned loss, so 2.5R instead of 1R.
::

---

::takeaway
A gap is a jump in price with no trading in between. A stop can't fill inside a gap, so a loss can be bigger than you planned, especially over weekends and big news.
::
