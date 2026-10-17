---
module: sample-size
level: 6
---
::question{id="ss-1" lesson="l6-how-many-trades-you-need"}
EdgeProof's verdict for a mechanical strategy needs at least:
- [x] 100 development trades and 50 validation trades
- [ ] 10 trades in total
- [ ] 30 development trades
? Discretionary strategies need more: 150 and 100.
::
::question{id="ss-2" lesson="l6-how-many-trades-you-need"}
Why does a small edge need more trades than a large one before you can trust it?
- [x] A small edge is easily hidden by noise, so the range takes longer to clear zero
- [ ] Small edges trade less often
- [ ] Large edges don't need testing
? The smaller the edge, the more data you need to separate it from luck.
::
::question{id="ss-3" lesson="l6-how-many-trades-you-need"}
As you go from 100 to 1,000 trades for the same strategy, the expectancy range:
- [x] Gets narrower
- [ ] Gets wider
- [ ] Stays the same
? More trades mean less uncertainty.
::
::question{id="ss-4" lesson="l6-how-many-trades-you-need"}
Meeting the minimum trade count means:
- [x] There's enough data to judge, but uncertainty remains, so the verdict shows a range
- [ ] The strategy is proven
- [ ] You no longer need validation data
? Minimums are a floor, not proof.
::
::question{id="ss-5" lesson="l6-when-trades-are-not-independent"}
Why can overlapping trades on related pairs overstate your sample size?
- [x] They often win or lose together, so they're closer to one bet than several
- [ ] They are counted twice by the broker
- [ ] Overlapping trades never lose
? Linked trades carry less independent information.
::
::question{id="ss-6" lesson="l6-when-trades-are-not-independent"}
In EdgeProof, a cluster is:
- [x] Trades that overlap in time and share a currency, counted once toward the minimum
- [ ] A group of profitable trades
- [ ] Any five trades in a row
? Counting clusters stops related trades from inflating the evidence.
::
::question{id="ss-7" lesson="l6-when-trades-are-not-independent"}
One year of your test produced most of the profit. What might that mean?
- [x] The edge may belong to that year's conditions, not to your rules
- [ ] The strategy is extra strong
- [ ] The other years don't matter
? Check that results are spread across periods, not driven by one.
::
::question{id="ss-8" lesson="l6-when-trades-are-not-independent"}
Two strategies each have 120 trades. Strategy A's trades are spread over 6 years; strategy B's are packed into 3 months of overlapping positions. Which gives stronger evidence?
- [x] Strategy A
- [ ] Strategy B
- [ ] They're exactly equal
? Spread-out, independent trades carry more information than clustered ones.
::
