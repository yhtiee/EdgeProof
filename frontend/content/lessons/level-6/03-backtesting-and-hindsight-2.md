---
id: l6-hindsight-bias-in-replay
level: 6
module: backtesting-and-hindsight
order: 2
title: Hindsight bias in replay
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

Hindsight bias is the feeling, after something happens, that you knew it all along. Daniel Kahneman discusses it among the biases that distort how we judge past decisions [@kahneman-thinking-fast-slow].

In manual replay, it creeps in quietly.

---

**How it gets in:**

- You remember how a famous week played out, and trade it "better" than you would have live.
- You skip setups that look like losers in a way you couldn't have known in the moment.
- You pick the start date yourself, often a period you know went well.

---

EdgeProof builds in defences:

- **A random start date**, chosen inside your test period, so you can't pick a good stretch.
- **A log of every setup you see**, including the ones you skip, with a reason. The share of skipped setups is shown, so heavy skipping is visible.
- **Minimum test lengths:** at least 3 years of development data for intraday strategies and 8 years for swing strategies.

---

::question{type="mc"}
In a replay, you skip 40% of valid setups because they "didn't feel right". What does that suggest?
- [ ] Your judgement is excellent
- [x] Hindsight may be filtering out losers, so the results may look better than live trading would
- [ ] Skipping doesn't affect results
? A high skip rate is a warning sign. Unless your skip reasons are listed and testable, you may be using knowledge you wouldn't have live.
::

---

::takeaway
Replay results are inflated by hindsight. Random start dates, logging every setup you see and long test periods keep the bias small, and the skip rate shows how much you filtered.
::
