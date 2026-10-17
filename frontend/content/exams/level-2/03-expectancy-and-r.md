---
module: expectancy-and-r
level: 2
---
::question{id="er-1" lesson="l2-expectancy-in-r"}
"1R" means:
- [x] The amount you risk on a trade (the distance to your stop, in money)
- [ ] One round of trading
- [ ] One pip of profit
? R is your planned risk per trade. A 2R win made twice what you risked.
::
::question{id="er-2" type="numeric" answer="3" tolerance="0" unit="R" lesson="l2-expectancy-in-r"}
You risk $50 on a trade and make $150. How many R did you win?
? $150 ÷ $50 = 3R.
::
::question{id="er-3" type="numeric" answer="0.5" tolerance="0.01" unit="R" lesson="l2-expectancy-in-r"}
A strategy wins 50% of trades. Wins average 2R and losses are 1R. What is its expectancy per trade, in R?
? Expectancy = (0.5 × 2) − (0.5 × 1) = 1 − 0.5 = 0.5R.
::
::question{id="er-4" type="numeric" answer="-0.2" tolerance="0.01" unit="R" lesson="l2-expectancy-in-r"}
A strategy wins 60% of trades. Wins average 1R and losses average 2R. What is its expectancy per trade, in R?
? Expectancy = (0.6 × 1) − (0.4 × 2) = 0.6 − 0.8 = −0.2R. A high win rate can still lose money.
::
::question{id="er-5" lesson="l2-expectancy-in-r"}
Why measure results in R rather than money?
- [x] It lets you compare trades and strategies even when position size changes
- [ ] It hides your losses
- [ ] Brokers require it
? R normalises results to the risk you took.
::
::question{id="er-6" type="numeric" answer="25" tolerance="0" unit="%" lesson="l2-win-rate-against-payoff"}
Your wins average 3R and losses average 1R. What is your break-even win rate, in %?
? Break-even win rate = average loss ÷ (average win + average loss) = 1 ÷ (3 + 1) = 25%.
::
::question{id="er-7" lesson="l2-win-rate-against-payoff"}
Which is true about win rate?
- [ ] A higher win rate always means more profit
- [x] Win rate only matters together with how big wins are compared with losses
- [ ] Profitable strategies always win more than half their trades
? Plenty of profitable strategies win less than half the time because their wins are larger.
::
::question{id="er-8" lesson="l2-win-rate-against-payoff"}
You move your target closer so you win more often. What else changes?
- [ ] Nothing else
- [x] Your average win shrinks, so your break-even win rate rises
- [ ] Your losses get smaller automatically
? Win rate and payoff trade off. Changing one moves the other.
::
