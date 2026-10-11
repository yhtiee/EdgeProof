---
id: l4-rsi-and-atr
level: 4
module: indicators
order: 2
title: RSI and ATR
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

Two more widely used indicators were introduced in a 1978 book by J. Welles Wilder [@wilder-new-concepts].

The **[[rsi|RSI]]**, or Relative Strength Index, compares the size of recent up-moves with recent down-moves and scales the result from 0 to 100. Wilder used 14 periods as the default.

---

By convention, RSI above 70 is called "overbought" and below 30 "oversold". Those words mislead beginners. In a strong uptrend, RSI can stay above 70 for a long time while price keeps rising. Selling just because RSI is high can mean selling into a rising market for a long time.

RSI describes how strong recent moves were. It doesn't predict a turn.

---

The **[[atr|ATR]]**, or Average True Range, measures [[volatility]]: the average size of each candle's full range, including any gap from the previous close.

ATR is less about direction and more about scale. It's often used to set stops: a stop placed 1.5 × ATR away adapts to how much the pair is moving right now, rather than using the same pip distance in calm and wild markets.

---

::question{type="numeric" answer="45" tolerance="0" unit="pips"}
EUR/USD's daily ATR is 30 pips. Your rule places the stop 1.5 × ATR from entry. How far away is the stop?
? 1.5 × 30 pips = 45 pips.
::

---

::question{type="mc"}
RSI on your chart reads 78. What can you say for sure?
- [ ] Price is about to fall
- [x] Recent up-moves have been much larger than recent down-moves
- [ ] It's time to sell
? RSI only summarises recent moves. A high reading can persist in a strong trend. Whether it's useful in your strategy is something to test.
::

---

::takeaway
RSI summarises the balance of recent up- and down-moves; ATR measures how much price is moving. Neither predicts the future. ATR is especially useful for sizing stops to current volatility.
::
