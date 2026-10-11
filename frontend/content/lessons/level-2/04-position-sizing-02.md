---
id: l2-how-much-to-risk-per-trade
level: 2
module: position-sizing
order: 2
title: How much to risk per trade
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

You know how to size a trade from its stop. The other input is the risk: what share of the account you're willing to lose if the trade is wrong.

Most traders use a fixed percentage of the current balance. As the account grows, each trade risks a little more money; as it shrinks, a little less.

---

Why does the percentage matter so much? Because losing streaks are certain to happen. Here's what 10 losses in a row do at different risk levels:

- At 1% per trade, the account is down about 9.6%.
- At 2% per trade, about 18.3%.
- At 5% per trade, about 40.1%.

Ten losses in a row sounds rare, but over hundreds of trades it's quite likely for many strategies.

---

Check those numbers yourself.

::simulator{kind="drawdown"}

---

::question{type="mc"}
Two traders have the same strategy. One risks 1% per trade, the other 5%. What's different about their results?
- [ ] The 5% trader has a better strategy
- [x] Same wins and losses in R, but the 5% trader's swings in money are five times as big
- [ ] Nothing, because position size doesn't matter
? Results in R are identical. Risk per trade only scales how big each win and loss is in money, and how deep the drawdowns get.
::

---

While you're learning, a small risk keeps losing streaks survivable: at 1% per trade, even 20 losses in a row leave about 82% of the account. EdgeProof doesn't tell you what to choose. It asks you to set your own limit in your rulebook, then checks every trade against it.

::takeaway
Risk per trade doesn't change your edge; it changes how hard the swings hit. Choose a level where a normal losing streak is survivable, and write it down.
::
