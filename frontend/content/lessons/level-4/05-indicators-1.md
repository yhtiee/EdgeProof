---
id: l4-moving-averages
level: 4
module: indicators
order: 1
title: Moving averages
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

An indicator is a calculation drawn on a chart from past prices. The simplest and most common is the [[moving average]].

A 20-period simple moving average is the average of the last 20 closing prices. When a new candle closes, the oldest price drops out and the newest comes in, so the average "moves" along with the chart.

---

Moving averages smooth out the zig-zags, which makes the general direction easier to see. The cost is delay: because they're built from past prices, they always turn after price has already turned.

Try it: change the length and watch the smoothness and the delay change together.

::simulator{kind="moving-average"}

---

There's also an exponential moving average, which gives more weight to recent prices. It reacts a little sooner, but it still lags. No setting removes the delay.

---

::question{type="numeric" answer="1.0840" tolerance="0.00005" unit=""}
The last 5 closing prices were 1.0820, 1.0830, 1.0840, 1.0850 and 1.0860. What's the 5-period simple moving average?
? Add them: 1.0820 + 1.0830 + 1.0840 + 1.0850 + 1.0860 = 5.4200. Divide by 5: 5.4200 ÷ 5 = 1.0840.
::

---

::takeaway
A moving average is the average of recent closes. Longer averages are smoother but later; shorter ones react sooner but zig-zag more. All of them lag price.
::
