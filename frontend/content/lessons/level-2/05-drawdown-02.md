---
id: l2-risk-of-ruin
level: 2
module: drawdown-and-risk-of-ruin
order: 2
title: Risk of ruin
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

[[risk of ruin|Risk of ruin]] is the chance that losses take your account down so far that you can't, or won't, carry on. For most people, ruin starts well before zero: a 30% or 50% drawdown is often enough to make them quit or start breaking rules.

---

Three things decide it:

- Your [[edge]]: how much you make per trade on average.
- Your risk per trade.
- How deep a drawdown you'd call ruin.

A small edge with big risk can still lead to ruin, because a bad run can arrive before the edge has time to show.

---

The simulator runs your settings 2,000 times over 200 trades and counts how often the account hits your ruin level. Start at 2% risk, then try 5%, and then set the win rate so the expectancy is zero or below.

::simulator{kind="risk-of-ruin"}

---

Notice two things. With no edge, ruin is only a matter of time at any risk level. With a real edge, cutting the risk per trade cuts the risk of ruin sharply.

---

::question{type="mc"}
A strategy has a small positive edge. What lowers its risk of ruin the most?
- [ ] Trading more often
- [x] Risking a smaller share of the account per trade
- [ ] Raising the risk after a losing streak to win it back
? Smaller risk per trade makes each loss smaller, so a bad run does less damage. Raising risk after losses does the opposite.
::

---

::takeaway
Risk of ruin grows quickly with risk per trade. A real edge is the first requirement; small enough risk to survive the bad runs is the second.
::
