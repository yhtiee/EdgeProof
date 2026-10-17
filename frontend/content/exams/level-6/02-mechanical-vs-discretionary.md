---
module: mechanical-vs-discretionary
level: 6
---
::question{id="md-1" lesson="l6-mechanical-and-discretionary-strategies"}
A mechanical strategy is one where:
- [x] Every decision follows fixed rules that a computer could apply
- [ ] The trader decides each trade by feel
- [ ] Trades are placed by a robot you can't see
? Mechanical rules leave no room for judgement.
::
::question{id="md-2" lesson="l6-mechanical-and-discretionary-strategies"}
A discretionary strategy:
- [x] Uses rules, but leaves some decisions to the trader's judgement
- [ ] Has no rules at all
- [ ] Is always more profitable
? Discretion means part of the decision is a human call within a framework.
::
::question{id="md-3" lesson="l6-mechanical-and-discretionary-strategies"}
Why do discretionary strategies need more trades before a verdict?
- [x] Judgement varies, so results carry extra noise and are harder to repeat
- [ ] They trade less often by law
- [ ] They always have lower costs
? Extra variability means you need more evidence to trust the result.
::
::question{id="md-4" lesson="l6-mechanical-and-discretionary-strategies"}
What is a main advantage of a mechanical strategy?
- [x] It can be tested exactly on past data and followed the same way every time
- [ ] It never has losing streaks
- [ ] It adapts to every market by itself
? Exact rules make testing and consistent execution possible.
::
::question{id="md-5" lesson="l6-keeping-discretion-honest"}
How can you keep discretionary decisions honest?
- [x] Log every setup you see, including the ones you skip, with a reason
- [ ] Only record the trades you take
- [ ] Decide after the trade whether it counted
? Logging skipped setups exposes whether your filtering adds anything.
::
::question{id="md-6" lesson="l6-keeping-discretion-honest"}
You skip many setups and the ones you take do well. What should you check?
- [x] Whether the skipped setups would have done better or worse than the ones you took
- [ ] Nothing; your judgement is clearly good
- [ ] Only the trades you took
? If skipped setups did just as well, your discretion isn't adding value.
::
::question{id="md-7" lesson="l6-keeping-discretion-honest"}
Which is a sign discretion is hurting results?
- [x] Rule-breaking trades lose more, on average, than rule-following ones
- [ ] You follow your rules on most trades
- [ ] You take a break after hitting your loss limit
? Compare the two groups in R to measure the cost of discretion.
::
::question{id="md-8" lesson="l6-keeping-discretion-honest"}
Even in a discretionary strategy, what should stay fixed by rule?
- [x] The stop and the position size
- [ ] Nothing at all
- [ ] Only the profit target
? Judgement can choose setups, but risk must stay defined.
::
