---
module: backtesting-and-hindsight
level: 6
---
::question{id="bh-1" lesson="l6-ways-to-backtest"}
A backtest is:
- [x] Applying a strategy's rules to past price data to see how it would have done
- [ ] A guarantee of future results
- [ ] Trading with real money for the first time
? It estimates past performance under your rules and cost assumptions.
::
::question{id="bh-2" lesson="l6-ways-to-backtest"}
Which backtesting method suits a fully mechanical strategy best?
- [x] An automated test that applies the rules to every candle
- [ ] Scrolling through charts and remembering good trades
- [ ] Asking friends how they think it would have done
? Exact rules can be applied by code with no human bias.
::
::question{id="bh-3" lesson="l6-ways-to-backtest"}
Bar-by-bar replay (stepping through history one candle at a time) is most useful for:
- [x] Testing discretionary strategies without seeing what happens next
- [ ] Making past trades win
- [ ] Skipping losing periods
? Replay hides the future so you decide as you would live.
::
::question{id="bh-4" lesson="l6-ways-to-backtest"}
How much development data does EdgeProof require for an intraday strategy?
- [x] At least 3 years
- [ ] At least 3 weeks
- [ ] At least 30 trades, however long that takes
? Intraday strategies need at least 3 years, and swing strategies at least 8.
::
::question{id="bh-5" lesson="l6-hindsight-bias-in-replay"}
Hindsight bias in backtesting means:
- [x] Knowing what happened next makes setups look clearer than they were in real time
- [ ] Testing on too much data
- [ ] Using a slow computer
? Once you know the outcome, it's hard to judge the setup fairly.
::
::question{id="bh-6" lesson="l6-hindsight-bias-in-replay"}
Why use a random start date for replay testing?
- [x] So you can't pick a period you already know was good
- [ ] Random dates have lower costs
- [ ] It makes the test faster
? A random start stops you choosing a favourable stretch.
::
::question{id="bh-7" lesson="l6-hindsight-bias-in-replay"}
Logging every setup you see, including the ones you skip, helps because:
- [x] It shows if you are quietly skipping setups that would have lost, using hindsight
- [ ] It makes the journal longer
- [ ] Brokers need the list
? A high skip rate is a red flag for hindsight filtering.
::
::question{id="bh-8" lesson="l6-hindsight-bias-in-replay"}
You remember a big trend from two years ago and start your test just before it. What's wrong?
- [x] You've chosen the test period with hindsight, so the result is inflated
- [ ] Nothing, trends are good for testing
- [ ] The test is too short to matter
? Test periods must be chosen without knowledge of the outcome.
::
