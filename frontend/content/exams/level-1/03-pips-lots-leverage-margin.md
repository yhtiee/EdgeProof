---
module: pips-lots-leverage-margin
level: 1
---
::question{id="plm-1" lesson="l1-what-a-pip-is-worth"}
For EUR/USD, one pip is a move of:
- [ ] 0.01
- [x] 0.0001
- [ ] 1.0
? For most pairs a pip is the fourth decimal place. Yen pairs are the exception, where it is the second.
::
::question{id="plm-2" type="numeric" answer="25" tolerance="0" unit="pips" lesson="l1-what-a-pip-is-worth"}
EUR/USD moves from 1.0850 to 1.0875. How many pips is that?
? 1.0875 − 1.0850 = 0.0025, and 0.0025 ÷ 0.0001 = 25 pips.
::
::question{id="plm-3" type="numeric" answer="10" tolerance="0" unit="$" lesson="l1-what-a-pip-is-worth"}
You hold one standard lot (100,000 units) of EUR/USD. What is one pip worth in US dollars?
? 100,000 × 0.0001 = $10 per pip.
::
::question{id="plm-4" lesson="l1-understanding-lot-sizes"}
How many units of the base currency is a mini lot?
- [ ] 1,000
- [x] 10,000
- [ ] 100,000
? Standard = 100,000, mini = 10,000, micro = 1,000.
::
::question{id="plm-5" type="numeric" answer="20" tolerance="0" unit="$" lesson="l1-understanding-lot-sizes"}
You trade 0.2 lots of EUR/USD (20,000 units). The price moves 10 pips in your favour. How much do you make, in dollars?
? 20,000 × 0.0001 = $2 per pip. 10 pips × $2 = $20.
::
::question{id="plm-6" lesson="l1-how-leverage-and-margin-work"}
What does leverage of 30:1 mean?
- [ ] You can lose at most 1/30 of your account
- [x] You can control a position up to 30 times the margin you put up
- [ ] Your broker pays you 30 times your profits
? Leverage lets a small deposit (margin) control a much larger position, which magnifies gains and losses alike.
::
::question{id="plm-7" type="numeric" answer="1000" tolerance="0" unit="$" lesson="l1-how-leverage-and-margin-work"}
At 30:1 leverage, how much margin do you need to open a $30,000 position?
? Margin = position size ÷ leverage = $30,000 ÷ 30 = $1,000.
::
::question{id="plm-8" lesson="l1-how-leverage-and-margin-work"}
Which statement about leverage is true?
- [ ] Higher leverage lowers your risk because you need less margin
- [x] Leverage changes how big a position you can open, so it magnifies losses as much as gains
- [ ] Leverage only affects profits, never losses
? Risk comes from position size. Leverage makes large positions possible, so the same price move costs far more.
::
