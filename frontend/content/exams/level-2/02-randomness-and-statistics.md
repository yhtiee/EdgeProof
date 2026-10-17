---
module: randomness-and-statistics
level: 2
---
::question{id="rs-1" lesson="l2-coin-flip-equity-curves"}
Equity curves made from pure coin flips can:
- [x] Look like real trending strategies, with long runs up or down
- [ ] Only ever be flat
- [ ] Never go more than a few trades without a reversal
? Randomness alone makes convincing-looking patterns. A nice curve is not proof of skill.
::
::question{id="rs-2" lesson="l2-coin-flip-equity-curves"}
Ten traders flip coins to "trade". After 20 flips, one is well up. The best explanation is:
- [ ] That trader has real skill
- [x] Luck; with many random players, someone will look good
- [ ] The coin was biased
? Among many random results, some will look impressive by chance.
::
::question{id="rs-3" lesson="l2-why-30-trades-prove-nothing"}
A strategy wins 20 of its first 30 trades. What can you conclude?
- [ ] It definitely has an edge
- [x] Not much yet; 30 trades leave a very wide range of possible true win rates
- [ ] It will win 67% forever
? Small samples are noisy. The true rate could be well below or above what you measured.
::
::question{id="rs-4" lesson="l2-why-30-trades-prove-nothing"}
As the number of trades in a sample grows, the measured win rate:
- [x] Usually gets closer to the true win rate
- [ ] Gets more random
- [ ] Stops mattering
? Larger samples reduce noise, so estimates become more reliable.
::
::question{id="rs-5" lesson="l2-why-30-trades-prove-nothing"}
Which result gives you more confidence in an edge?
- [ ] +0.4R per trade over 30 trades
- [x] +0.2R per trade over 400 trades
- [ ] +2R from one big winning trade
? A smaller but steady result over many trades is much stronger evidence than a short hot streak.
::
::question{id="rs-6" lesson="l2-reading-a-confidence-range"}
A confidence range for your win rate is 38% to 62%. What does it tell you?
- [x] The true win rate is likely somewhere in that range, given the data you have
- [ ] Your win rate is exactly 50%
- [ ] You will win between 38 and 62 of your next trades
? It shows how uncertain your estimate is. Wide ranges mean you need more data.
::
::question{id="rs-7" lesson="l2-reading-a-confidence-range"}
Your break-even win rate is 45% and your confidence range is 38% to 62%. What should you conclude?
- [ ] The strategy is proven profitable
- [x] You can't yet tell whether it beats break-even, because the range includes values below 45%
- [ ] The strategy is proven unprofitable
? An edge is only convincing when the whole range sits above break-even.
::
::question{id="rs-8" lesson="l2-reading-a-confidence-range"}
How do you make a confidence range narrower?
- [ ] Remove the losing trades
- [x] Collect more trades
- [ ] Use a shorter timeframe chart
? More data reduces uncertainty, so the range tightens.
::
