---
id: l2-how-drawdowns-compound
level: 2
module: drawdown-and-risk-of-ruin
order: 1
title: How drawdowns compound
status: published
minutes: 5
---

A [[drawdown]] is the fall from your account's highest point to its lowest point after it. Losing streaks happen to every strategy, including good ones.

---

Losses compound. Risk 2% per trade and lose 10 in a row, and you're not down 20%. Each loss is 2% of a smaller account, so you're down about 18.3%.

The harder part is the way back. **After a 50% drawdown you need a 100% gain just to break even.**

---

Move the risk per trade and the losing streak. Watch the gain you'd need just to get back to where you started.

::simulator{kind="drawdown"}

---

::question{type="numeric" answer="25" tolerance="0.5" unit="%"}
Your account falls 20%. What gain, in percent, takes it back to where it was?
? After a 20% fall you have 80% left. 80 × 1.25 = 100, so you need a 25% gain.
::

---

::takeaway
Smaller risk per trade keeps a normal losing streak survivable. Recovery maths punishes big drawdowns.
::
