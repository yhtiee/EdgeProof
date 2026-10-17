---
module: overfitting
level: 6
---
::question{id="of-1" lesson="l6-what-overfitting-is"}
Overfitting means:
- [x] Tuning rules so closely to past data that they fit its noise, not a real edge
- [ ] Trading too many lots
- [ ] Testing on too much data
? An overfitted strategy looks great on the past and fails on new data.
::
::question{id="of-2" lesson="l6-what-overfitting-is"}
Which is a warning sign of overfitting?
- [x] Many rules and finely tuned settings, such as a 47-period average that tested best
- [ ] A simple rule with round values
- [ ] A test with lots of trades
? Lots of tuned settings give many chances to fit noise.
::
::question{id="of-3" lesson="l6-what-overfitting-is"}
A strategy has a near-perfect equity curve in the backtest. What should you suspect first?
- [x] It may be overfitted to that data
- [ ] It has found a guaranteed edge
- [ ] The broker will pay a bonus
? Results that look too good often are.
::
::question{id="of-4" lesson="l6-what-overfitting-is"}
If you test 100 random strategies, some will look profitable. Why?
- [x] By chance alone, some random results will look good
- [ ] Random strategies have real edges
- [ ] Tests always favour random rules
? Testing many versions makes lucky winners likely, which is why attempts must be counted.
::
::question{id="of-5" lesson="l6-avoiding-overfitting"}
Which habit helps avoid overfitting?
- [x] Keep few rules and settings, with round, sensible values
- [ ] Add a new filter every time a trade loses
- [ ] Pick whichever settings tested best
? Simplicity leaves fewer chances to fit noise.
::
::question{id="of-6" lesson="l6-avoiding-overfitting"}
"Decide before you look" means:
- [x] Write the rules from your idea, then test them, rather than tuning to the data
- [ ] Look at the data first and then write rules that fit
- [ ] Never test at all
? Rules shaped by the data you test on will look better than they are.
::
::question{id="of-7" lesson="l6-avoiding-overfitting"}
Why count every version of a strategy you test, even the ones you discard?
- [x] Each version is another try, which raises the chance a good result is luck
- [ ] To make the report longer
- [ ] Because brokers ask for it
? Many attempts make a lucky winner more likely, so the bar for evidence rises.
::
::question{id="of-8" lesson="l6-avoiding-overfitting"}
A rule works only for one pair, in one year, with one exact setting. That suggests:
- [x] The result is fragile and probably fitted to noise
- [ ] It's a very strong edge
- [ ] It should be traded with big size
? Robust edges hold up across nearby settings and periods.
::
