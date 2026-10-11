---
id: l1-slippage-and-execution-speed
level: 1
module: brokers-and-execution
order: 2
title: Slippage and execution speed
status: published
minutes: 5
generated: gemini-3.8-flash 2026-10-11
review: done
---
The price displayed on a trading chart shows the latest transaction or the current quote sent by your [[broker]]. It is an invitation to trade at that moment, not a guarantee that an order will fill at that exact number.

When an order leaves your computer or phone, it travels over network cables to an execution server. In that fraction of a second, other market participants continue to buy and sell. By the time your trade request arrives, the quotes on the book may already have changed.

---

The difference between the price requested and the price where the order actually executes is called slippage [@babypips-pipsology].

Slippage occurs because a standard market order instructs the [[broker]] to fill the trade immediately at the best available price, whatever that price happens to be. If the resting orders at your selected price are already filled by someone else, your trade is matched against the next available price in the market.

---

Slippage can move in either direction depending on market momentum and available liquidity:

- Negative slippage happens when an order fills at a worse price than requested. For example, an order to buy at 1.0850 that fills at 1.0852 costs 2 extra [[pip|pips]].
- Positive slippage happens when an order fills at a better price than requested. For example, an order to buy at 1.0850 that fills at 1.0848 saves 2 [[pip|pips]].

Limit orders set a maximum price you are willing to pay or a minimum price you are willing to accept, which prevents negative slippage but risks not getting filled at all.

---

Execution speed and liquidity determine how often slippage occurs. High liquidity means many buyers and sellers are waiting at each price level, making prices more stable.

During major news releases or over weekend gaps, liquidity can thin out rapidly. At the same time, incoming volume may push prices dozens of [[pip|pips]] within milliseconds. When few orders sit on the order book, market orders must reach across wide price gaps to find matching volume.

Network latency, the time data takes to travel between your device and the broker's servers, adds to this delay. In fast conditions, a delay of 200 milliseconds can mean the difference between filling at the requested price, receiving a requote, or filling several [[pip|pips]] away.

---

::question{type="mc"}
Why can an order fill at a different price than the quote shown on the chart?
- [ ] Charts always display quotes that are several minutes out of date
- [x] Prices can move while the order travels to the server, and orders at the old price may already be filled
- [ ] Brokers adjust every client execution price by a fixed percentage
? Market orders fill at the best available price when the server processes them, which can shift during transmission.
::

---

Trade planning accounts for execution delays and price friction. When a [[stop-loss]] triggers, it converts into a market order. In a thin or fast market, that exit might fill slightly past the chosen line.

Accounting for a wider [[spread]] and potential slippage helps keep risk estimates realistic, especially during volatile market sessions.

::takeaway
A displayed quote is only the latest offer; market orders fill at the next available price, which can slip during fast or thin markets.
::
