---
id: l1-broker-models-and-order-types
level: 1
module: brokers-and-execution
order: 1
title: Broker models and order types
status: published
minutes: 5
generated: gemini-3.8-flash 2026-10-11
review: done
---
Individual traders cannot trade directly on the interbank network where global banks exchange currencies. An individual trading balance is too small for institutional settlement systems.

A retail [[broker]] provides access to that liquidity. The broker provides trading software, calculates [[margin]] requirements, and allows trades in smaller amounts, such as a micro or mini [[lot]].

Without a broker, an individual would need direct credit lines and large cash reserves with international banks to trade a [[currency pair]].

---

Retail brokers generally use two main execution models: dealing desk and non-dealing desk [@babypips-pipsology].

A dealing desk broker acts as a market maker. When you buy, they may sell to you directly from their own inventory or match your trade with another customer. Because they can take the other side of client trades, a client's loss can be the broker's gain. That conflict of interest is worth knowing about when you choose a broker.

A non-dealing desk broker passes client orders directly to external liquidity providers, such as major banks or electronic networks. These brokers generally earn revenue through a flat commission or an added markup on the [[spread]].

---

::question{type="mc"}
How does a dealing desk broker handle a client buy order?
- [ ] They must send every order directly to an external bank network.
- [x] They can take the other side of the trade directly or match it with another client.
- [ ] They reject the trade if they do not hold external currency reserves.
? A dealing desk broker acts as a market maker and can take the opposite side of your trade internally rather than routing it outside.
::

---

Once connected to a broker, you choose how to enter or exit using different order types [@babypips-pipsology].

A market order instructs the broker to execute immediately at the best available current price. Market orders prioritize immediate execution over price control. In volatile market conditions, the executed price can differ slightly from the quote visible when the order was submitted.

A pending order tells the broker to execute only if the market reaches a chosen price later:
- A limit order requests execution at your chosen price or a better one. For example, a buy limit sits below the current market price.
- A stop order triggers a trade once price reaches a set level. This is often used to enter on momentum or as a [[stop-loss]] to exit and cap risk.

---

::question{type="mc"}
Which order type prioritizes immediate execution at the next available price rather than waiting for a specific price level?
- [ ] A buy limit order
- [x] A market order
- [ ] A sell stop order
? A market order requests an immediate fill at the next available price, while pending limit and stop orders wait for price to reach a set level.
::

---

The route an order takes depends on the broker model and the order instructions you submit.

A dealing desk broker can fill your trade internally, while a non-dealing desk broker routes it out to third parties. Meanwhile, choosing between market and pending orders balances the need for immediate execution against control over your entry price.

Understanding these mechanics helps clarify why execution speeds, spreads, and fill prices can shift under different market conditions.

::takeaway
Brokers route trades either internally or to external liquidity, while order types let you choose between immediate execution and price control.
::
