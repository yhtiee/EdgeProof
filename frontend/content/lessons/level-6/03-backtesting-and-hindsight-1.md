---
id: l6-ways-to-backtest
level: 6
module: backtesting-and-hindsight
order: 1
title: Ways to backtest a strategy
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

A [[backtest]] applies your rules to past prices to see how they would have done. There are two main ways.

---

**Manual replay.** A replay tool hides the future and reveals candles one at a time. You trade as if it were live, and log every trade. Free tools such as The Free Chart and TradingView's Bar Replay do this. It works for any strategy, including discretionary ones, but it's slow and open to bias.

**Coded testing.** You write the rules as code, for example in TradingView's Pine Script, and a tester applies them to years of data in seconds. It only works for fully mechanical rules.

---

Either way, EdgeProof records the results, adds your costs, and does the statistics. It doesn't run the backtest itself, and it says so, because results from manual replay usually look better than real trading.

---

::question{type="mc"}
Your strategy includes judgement about which setups to take. Which testing method fits?
- [x] Manual replay, logging every setup you see
- [ ] Coded testing in a strategy tester
- [ ] No test is possible
? Coded testers need fully mechanical rules. Replay lets you apply judgement, as long as you log every setup you see, including the ones you skip.
::

---

::takeaway
Backtests replay your rules on past data, either by hand in a replay tool or as code. Manual replay is flexible but slower and more prone to bias.
::
