---
id: l2-choosing-a-risk-you-can-live-with
level: 2
module: risk-comfort
order: 2
title: Choosing a risk you can live with
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Here's a practical way to choose your risk per trade. Work backwards from the drawdown you could sit through without breaking your rules.

Ask yourself honestly: at what loss would I start doubting everything, or stop trading? There's no right answer. It's personal, and it's usually smaller than people expect before they've lived through one.

---

Then plan for a losing streak longer than you think is likely, say 10 or 15 losses in a row, and pick a risk where that streak stays inside your limit.

Try it: set the streak to 15 and find the highest risk per trade that keeps the drawdown under 20%.

::simulator{kind="drawdown"}

---

::question{type="mc"}
Your limit is a 20% drawdown, and you plan for 15 losses in a row. Which risk per trade keeps you inside it?
- [ ] 3% per trade
- [ ] 2% per trade
- [x] 1% per trade
? 15 losses at 1% leave 0.99¹⁵ ≈ 86% of the account, a drawdown of about 14%. At 2% the drawdown is about 26%, and at 3% about 37%.
::

---

Write the number into your rulebook, along with your maximum drawdown. Later, when you test your strategy, EdgeProof checks whether the drawdowns it's likely to produce fit inside your plan.

::takeaway
Choose your risk per trade from the drawdown you can live with and a losing streak longer than you expect. Then write it down before you trade.
::
