---
id: l6-avoiding-overfitting
level: 6
module: overfitting
order: 2
title: Avoiding overfitting
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

You can't remove the risk of overfitting, but you can keep it small. Researchers suggest discounting backtest results by more the more strategies you've tried [@harvey-liu-backtesting]. In practice, a few habits help most.

---

**Habits that limit overfitting:**

- **Few rules and settings.** Every extra condition is another chance to fit noise.
- **Round, sensible values.** A 50-day average is easier to trust than a 47-day one picked because it tested best.
- **Decide before you look.** Write the rules from your idea, then test, rather than tuning to the data.
- **Count your attempts.** Every version you test is a try, even the ones you throw away.

---

EdgeProof counts your validation attempts for you. Each strategy gets a maximum of three, and once you've made more than three across your strategies, the bar for a passing verdict rises.

---

::question{type="mc"}
Which change makes a strategy less likely to be overfit?
- [ ] Adding a filter that removed the three biggest losers in the backtest
- [x] Replacing a 37-period average, chosen because it tested best, with a round 50-period one decided in advance
- [ ] Testing 100 more versions and keeping the best
? Choosing settings in advance, and keeping them simple, avoids tuning to past noise. The other two fit the past more tightly.
::

---

::takeaway
Keep rules few and simple, choose settings before testing, and count every attempt. The more you tune to the data, the less a good backtest means.
::
