---
module: indicators
level: 4
---
::question{id="in-1" lesson="l4-moving-averages"}
A 20-period simple moving average is:
- [x] The average closing price of the last 20 candles
- [ ] The highest price of the last 20 candles
- [ ] A prediction of the next 20 candles
? It smooths price by averaging recent closes.
::
::question{id="in-2" lesson="l4-moving-averages"}
Compared with a 20-period moving average, a 200-period one:
- [x] Reacts more slowly and shows the longer-term direction
- [ ] Reacts faster to every move
- [ ] Is always above price
? Longer averages smooth more, so they lag more.
::
::question{id="in-3" lesson="l4-moving-averages"}
Why do moving averages "lag"?
- [x] They are built from past prices, so they turn after price has turned
- [ ] They are delayed by the broker
- [ ] They only update once a week
? Every indicator built from past data reacts after the move.
::
::question{id="in-4" type="numeric" answer="1.1" tolerance="0.0001" unit="" lesson="l4-moving-averages"}
The last five closes are 1.08, 1.09, 1.10, 1.11 and 1.12. What is the 5-period simple moving average?
? (1.08 + 1.09 + 1.10 + 1.11 + 1.12) ÷ 5 = 5.50 ÷ 5 = 1.10.
::
::question{id="in-5" lesson="l4-rsi-and-atr"}
RSI (Relative Strength Index) moves between:
- [x] 0 and 100
- [ ] −1 and 1
- [ ] 0 and the pair's price
? RSI compares recent gains and losses on a 0–100 scale.
::
::question{id="in-6" lesson="l4-rsi-and-atr"}
RSI is above 70. What does that tell you on its own?
- [ ] Price must fall now
- [x] Recent gains have been strong; in a strong trend it can stay high for a long time
- [ ] The market is closed
? "Overbought" is not a sell signal by itself; trends can stay overbought.
::
::question{id="in-7" lesson="l4-rsi-and-atr"}
ATR (Average True Range) measures:
- [x] How much price typically moves per candle (volatility)
- [ ] The direction of the trend
- [ ] Trading volume
? ATR says nothing about direction, only how much price tends to move.
::
::question{id="in-8" lesson="l4-rsi-and-atr"}
How can ATR help with risk?
- [x] Set stops wider when volatility is high, and size down to keep the same risk
- [ ] It tells you which way to trade
- [ ] It removes the need for stops
? Volatility-based stops avoid being too tight in busy markets.
::
