---
module: strategy-costs
level: 6
---
::question{id="sc-1" lesson="l6-building-a-cost-model"}
A realistic cost model includes:
- [x] Spread, commission, slippage and swap
- [ ] Only the spread
- [ ] Only commission
? Every cost that hits a live trade should be in the test.
::
::question{id="sc-2" lesson="l6-building-a-cost-model"}
EdgeProof's default slippage on major pairs is:
- [x] 0.3 pips
- [ ] 0 pips
- [ ] 5 pips
? Defaults are 0.3 pips on majors, 1.0 on crosses, and 3 or more on exotics.
::
::question{id="sc-3" lesson="l6-building-a-cost-model"}
Why use typical spreads rather than the best spread you've ever seen?
- [x] Live trades pay normal and sometimes wider spreads, not the best case
- [ ] Best-case spreads are illegal
- [ ] Typical spreads make results look better
? Optimistic costs make a backtest look better than reality.
::
::question{id="sc-4" type="numeric" answer="1.8" tolerance="0.01" unit="pips" lesson="l6-building-a-cost-model"}
A trade pays a 1.0 pip spread, 0.5 pips of commission and 0.3 pips of slippage. What is the total cost, in pips?
? 1.0 + 0.5 + 0.3 = 1.8 pips.
::
::question{id="sc-5" lesson="l6-when-costs-kill-a-strategy"}
A strategy averages +1.5 pips per trade before costs, and costs are 1.8 pips per trade. After costs it is:
- [x] A losing strategy, at about −0.3 pips per trade
- [ ] Still profitable
- [ ] Break-even
? 1.5 − 1.8 = −0.3 pips. Small edges disappear once costs are counted.
::
::question{id="sc-6" lesson="l6-when-costs-kill-a-strategy"}
Which strategies are most at risk of being killed by costs?
- [x] Ones with many trades and small targets
- [ ] Ones with few trades and large targets
- [ ] Ones that never trade
? Costs are roughly fixed per trade, so small targets suffer most.
::
::question{id="sc-7" lesson="l6-when-costs-kill-a-strategy"}
How can you check whether a strategy is fragile to costs?
- [x] Re-run the test with higher costs and see if the edge survives
- [ ] Remove costs from the test
- [ ] Only test on the cheapest pair
? A strategy that dies with slightly higher costs is unlikely to survive live.
::
::question{id="sc-8" lesson="l6-when-costs-kill-a-strategy"}
Your live costs turn out higher than your cost model. What should you do?
- [x] Update the model and re-test, because the old verdict was too optimistic
- [ ] Ignore it
- [ ] Trade more to make up for it
? The verdict is only as good as its cost assumptions.
::
