---
id: l2-coin-flip-equity-curves
level: 2
module: randomness-and-statistics
order: 1
title: Coin-flip equity curves
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

An [[equity curve]] is a line showing how an account grows or shrinks, trade by trade. Traders love them, because they look like proof.

Here's the catch: pure luck can draw very convincing curves.

---

Below, five traders use exactly the same rules. Each trade wins or loses 1R, at the chance you choose. At 50%, there's no edge at all. Press "Flip again" a few times.

::simulator{kind="coin-flip"}

---

Look at how different the five lines are. Some climb steadily for 50 trades and look like skill. Some fall for weeks. Long winning and losing streaks appear all by themselves.

Now raise the chance of a win to 55%. The lines drift upward over time, but the luck is still there in the short run.

---

::question{type="mc"}
A friend shows you an equity curve that rose steadily over 40 trades. What can you conclude?
- [ ] They definitely have an edge
- [x] Not much yet: a curve like that can come from luck
- [ ] Their strategy will keep rising at the same pace
? Even with no edge at all, some coin-flip traders produce smooth rising curves over 40 trades. You need far more trades, and an honest test, to tell skill from luck.
::

---

::takeaway
Luck alone draws winning streaks, losing streaks and smooth-looking curves. A short equity curve can't show whether someone has an edge.
::
