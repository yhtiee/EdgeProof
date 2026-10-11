---
id: l7-diagnosing-a-strategy-that-slips
level: 7
module: performance-review
order: 2
title: Diagnosing a strategy that slips
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

Sooner or later, live results drift below what testing showed. The hard question is why. EdgeProof sorts the cause into three groups, using your own data:

- **Discipline:** rule-following below 90%.
- **Execution:** spreads and slippage per trade worse than your cost model.
- **Strategy:** neither of the above, so the edge itself may have weakened.

---

Don't judge too early. EdgeProof shows rolling results every 10 trades, but doesn't flag a drift before 30 forward trades. After that, it flags when the last 30 trades' expectancy falls below the lower end of your validation range, or when drawdown passes 1.5 times the backtest's maximum.

---

Each cause has a different fix:

- **Discipline:** go back to your routines, limits and never-again list.
- **Execution:** check your broker's costs, trading hours and order types.
- **Strategy:** stop, review, and return to the Lab with a new version and new data.

---

Sometimes the honest answer is that the edge has gone. After three strategies end in "No edge found yet", EdgeProof offers a structured pause or a review of the fundamentals. Stepping back is a valid result, not a failure.

---

::question{type="mc"}
After 40 forward trades, expectancy is below the validation range. Rule-following is 96%, and spreads match your cost model. What's the likely cause?
- [ ] Discipline
- [ ] Execution
- [x] The strategy itself
? Rules were followed and costs were as expected, so neither discipline nor execution explains it. The edge itself may have weakened.
::

---

::takeaway
When results slip, check discipline first, then execution, then the strategy. Wait for enough trades before deciding, and treat stepping back as a valid, evidence-based choice.
::
