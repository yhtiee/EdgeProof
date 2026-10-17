---
module: drawdown-and-risk-of-ruin
level: 2
---
::question{id="dr-1" lesson="l2-how-drawdowns-compound"}
A drawdown is:
- [x] The fall from your account's peak to a later low
- [ ] Money you withdraw from your account
- [ ] The broker's fee for closing trades
? Drawdown measures how far you have fallen from your best point.
::
::question{id="dr-2" type="numeric" answer="100" tolerance="0" unit="%" lesson="l2-how-drawdowns-compound"}
Your account falls 50%. What percentage gain do you need to get back to where you started?
? From half, you must double: a 100% gain.
::
::question{id="dr-3" type="numeric" answer="25" tolerance="0.5" unit="%" lesson="l2-how-drawdowns-compound"}
Your account falls 20%. What percentage gain do you need to recover?
? 1 ÷ 0.8 = 1.25, so you need a 25% gain.
::
::question{id="dr-4" lesson="l2-how-drawdowns-compound"}
Why do deep drawdowns hurt more than they look?
- [ ] They are taxed twice
- [x] The gain needed to recover grows faster than the loss
- [ ] Brokers charge extra during drawdowns
? Losing 10% needs 11% to recover, but losing 50% needs 100%.
::
::question{id="dr-5" lesson="l2-risk-of-ruin"}
Risk of ruin is:
- [x] The chance of losing so much that you can't continue trading
- [ ] The chance of a single losing trade
- [ ] The broker's risk warning percentage
? Ruin is the point where the account is too small, or you are too shaken, to go on.
::
::question{id="dr-6" lesson="l2-risk-of-ruin"}
Which change lowers risk of ruin the most for a strategy with a small edge?
- [ ] Doubling the risk per trade
- [x] Cutting the risk per trade
- [ ] Trading more pairs at once at the same risk each
? Risk of ruin climbs steeply with risk per trade. Smaller risk keeps you in the game.
::
::question{id="dr-7" lesson="l2-risk-of-ruin"}
Can a strategy with a positive edge still go broke?
- [x] Yes, if it risks too much per trade and hits a bad streak
- [ ] No, a positive edge always survives
- [ ] Only if the broker is dishonest
? An edge plays out over many trades. Oversizing can ruin you before it does.
::
::question{id="dr-8" lesson="l2-risk-of-ruin"}
Two traders have the same strategy. One risks 1% per trade, the other 5%. Who is more likely to be ruined by a long losing streak?
- [ ] The one risking 1%
- [x] The one risking 5%
- [ ] Both equally
? Twenty losses at 1% leave about 82% of the account; at 5% they leave about 36%.
::
