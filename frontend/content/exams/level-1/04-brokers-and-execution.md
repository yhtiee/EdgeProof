---
module: brokers-and-execution
level: 1
---
::question{id="be-1" lesson="l1-broker-models-and-order-types"}
A market maker (dealing desk) broker usually:
- [x] Takes the other side of client trades itself
- [ ] Sends every order to a central stock exchange
- [ ] Never charges a spread
? A dealing desk can be the counterparty to your trade, which creates a conflict of interest worth knowing about.
::
::question{id="be-2" lesson="l1-broker-models-and-order-types"}
You want to buy only if the price falls to a lower level first. Which order do you use?
- [x] Buy limit
- [ ] Buy stop
- [ ] Market order
? A limit order buys below (or sells above) the current price. A stop order buys above (or sells below) it.
::
::question{id="be-3" lesson="l1-broker-models-and-order-types"}
A stop-loss order is meant to:
- [ ] Guarantee you never lose more than you planned in any market
- [x] Close your trade automatically if price reaches a level you set
- [ ] Increase your position as price moves against you
? A stop-loss becomes a market order at your level. In a gap it can fill worse than the level.
::
::question{id="be-4" lesson="l1-slippage-and-execution-speed"}
Slippage is:
- [ ] The broker's daily fee for holding a trade
- [x] The difference between the price you expected and the price you actually got
- [ ] A type of chart pattern
? Slippage happens when price moves between sending an order and its fill, especially in fast markets.
::
::question{id="be-5" lesson="l1-slippage-and-execution-speed"}
When is slippage most likely?
- [ ] During a quiet, liquid session with no news
- [x] Right after a major news release
- [ ] When the order is very small and the market is calm
? Around news, liquidity thins and prices jump, so fills often land away from the requested price.
::
::question{id="be-6" lesson="l1-margin-calls-and-stop-outs"}
A margin call happens when:
- [x] Your account equity falls too low relative to the margin your open trades need
- [ ] You make more than 10% in a day
- [ ] You open your first trade
? It is a warning that losses have eaten into the equity supporting your positions.
::
::question{id="be-7" lesson="l1-margin-calls-and-stop-outs"}
What does a stop-out do?
- [ ] Freezes your account until you call support
- [x] Automatically closes your positions when your margin level falls below the broker's threshold
- [ ] Moves your stop-loss further away so the trade can recover
? The platform liquidates trades to stop losses exceeding your equity. It is a last resort, not a risk plan.
::
::question{id="be-8" lesson="l1-margin-calls-and-stop-outs"}
Why is relying on the broker's stop-out as your "stop-loss" a bad plan?
- [x] It only acts after you have lost most of your account's free equity
- [ ] It closes trades too early, when they are in profit
- [ ] It is illegal in most countries
? A stop-out is designed to stop negative balances, not to keep your losses small.
::
