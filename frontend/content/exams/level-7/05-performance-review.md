---
module: performance-review
level: 7
---
::question{id="pr-1" lesson="l7-the-numbers-that-matter"}
Profit factor is:
- [x] Gross profit divided by gross loss
- [ ] Win rate times average win
- [ ] Total profit divided by the number of trades
? Above 1 means wins outweigh losses; higher is better.
::
::question{id="pr-2" type="numeric" answer="1.5" tolerance="0.01" unit="" lesson="l7-the-numbers-that-matter"}
A strategy's winning trades made $3,000 in total and its losing trades lost $2,000. What is its profit factor?
? $3,000 ÷ $2,000 = 1.5.
::
::question{id="pr-3" lesson="l7-the-numbers-that-matter"}
Why review expectancy with its range, not just the average?
- [x] The range shows how sure you can be that the edge is still there
- [ ] Ranges look more professional
- [ ] The average is always wrong
? A positive average with a range that includes zero is weak evidence.
::
::question{id="pr-4" lesson="l7-the-numbers-that-matter"}
What does the rule-following rate measure?
- [x] The share of trades that followed every rule
- [ ] How often the market follows your predictions
- [ ] The number of rules you have
? It separates strategy results from execution mistakes.
::
::question{id="pr-5" lesson="l7-diagnosing-a-strategy-that-slips"}
Live results are worse than the test and rule-following is 75%. What's the most likely cause?
- [x] Discipline: too many trades broke the rules
- [ ] The edge has definitely disappeared
- [ ] The broker is cheating
? Rule-following below 90% points first to discipline.
::
::question{id="pr-6" lesson="l7-diagnosing-a-strategy-that-slips"}
Rule-following is 97%, but spreads and slippage are much worse than your cost model. The likely problem is:
- [x] Execution: your trading costs are higher than planned
- [ ] Discipline
- [ ] The weather
? Check your broker's costs, trading hours and order types.
::
::question{id="pr-7" lesson="l7-diagnosing-a-strategy-that-slips"}
Discipline and execution both look fine, yet results keep slipping. What might that mean?
- [x] The edge itself may have weakened, so it may need re-testing
- [ ] You should double your size
- [ ] Nothing can be learned
? When the other causes are ruled out, the strategy itself is the suspect.
::
::question{id="pr-8" lesson="l7-diagnosing-a-strategy-that-slips"}
Why diagnose in a fixed order (discipline, then execution, then strategy)?
- [x] The first two are common and fixable, so you don't abandon a working strategy by mistake
- [ ] It's the alphabetical order
- [ ] Strategies never fail
? Most slips come from behaviour and costs, not a broken edge.
::
