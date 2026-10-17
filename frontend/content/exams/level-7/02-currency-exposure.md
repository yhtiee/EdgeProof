---
module: currency-exposure
level: 7
---
::question{id="cx-1" lesson="l7-adding-up-risk-by-currency"}
You buy EUR/USD and buy GBP/USD. Your exposure to the US dollar is:
- [x] Short dollars on both trades
- [ ] Long dollars on both trades
- [ ] Zero
? Buying a XXX/USD pair sells the dollar, so both trades are short USD.
::
::question{id="cx-2" lesson="l7-adding-up-risk-by-currency"}
You buy EUR/USD and sell USD/JPY. Your dollar exposure is:
- [x] Short dollars on both trades
- [ ] Long dollars on one, short on the other
- [ ] Long dollars on both
? Buying EUR/USD sells USD; selling USD/JPY also sells USD.
::
::question{id="cx-3" type="numeric" answer="3" tolerance="0" unit="%" lesson="l7-adding-up-risk-by-currency"}
You have three trades open, each risking 1%, and each is short the US dollar. What is your total risk to a sharp dollar rally, in %?
? All three lose together if the dollar rallies: 1% + 1% + 1% = 3%.
::
::question{id="cx-4" lesson="l7-adding-up-risk-by-currency"}
What's a sensible rule for currency exposure?
- [x] Add up risk per currency, not per trade, and keep each currency within a limit
- [ ] Only count risk per trade
- [ ] Ignore currencies and look only at pairs
? Several trades can be one big bet on the same currency.
::
::question{id="cx-5" lesson="l7-hidden-correlation"}
Hidden correlation means:
- [x] Trades that look different are driven by the same thing and can lose together
- [ ] Your broker hides prices
- [ ] Two pairs that never move
? Different symbols can share a common driver.
::
::question{id="cx-6" lesson="l7-hidden-correlation"}
You buy AUD/USD and NZD/USD at 1% each. Why might your risk be closer to 2% on one idea?
- [x] Both are commodity-linked currencies against the dollar and often move together
- [ ] The broker doubles your risk
- [ ] They always move in opposite directions
? Closely linked pairs stack the same risk.
::
::question{id="cx-7" lesson="l7-hidden-correlation"}
When do correlations between pairs often rise sharply?
- [x] In stress, when many traders exit risk at the same time
- [ ] On quiet holiday days
- [ ] Never
? In sell-offs, assets that usually move separately tend to fall together.
::
::question{id="cx-8" lesson="l7-hidden-correlation"}
Which action reduces hidden correlation risk?
- [x] Cap total risk per currency and per theme, such as "risk-on"
- [ ] Open more pairs at full risk each
- [ ] Remove stops on correlated pairs
? Limits on shared drivers prevent one move from hitting everything.
::
