---
id: l5-no-trade-windows
level: 5
module: news-risk
order: 2
title: No-trade windows
status: published
minutes: 4
generated: claude-opus-5-5 2026-10-11
review: done
---

You can't control the news, but you can decide in advance how you'll treat it. The simplest tool is a no-trade window: a period around high-impact events when your rules say no new trades.

---

A no-trade rule needs three parts to be testable:

- **Which events:** for example, high-impact events for either currency in the pair.
- **How long:** for example, from 30 minutes before to 30 minutes after.
- **What happens to open trades:** keep them with their stops, reduce size, or close them before the event.

---

There's no single right answer. Closing before news avoids the jump but also misses any move in your favour. Keeping trades open accepts the risk. What matters is choosing once, writing it down, and testing the strategy with that rule in place.

EdgeProof's rulebook has a no-trade section for this, and your pre-trade checklist reminds you of it.

---

::question{type="mc"}
Which no-trade rule can be tested?
- [ ] "Be careful around news"
- [ ] "Avoid big news if it looks risky"
- [x] "No new trades from 30 minutes before to 30 minutes after high-impact events for either currency in the pair"
? Only the last one gives the same answer every time, so it can be applied the same way in testing and in live trading.
::

---

::takeaway
A no-trade window turns news risk into a clear rule: which events, how long, and what happens to open trades. Write it down and test with it, like any other rule.
::
