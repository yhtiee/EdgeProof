---
id: l6-reading-your-verdict
level: 6
module: out-of-sample-testing
order: 2
title: Reading your verdict
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

When a strategy version has a validation run, EdgeProof gives it a verdict. There are four, and their names never change:

- **Not enough data:** too few trades, counted by cluster.
- **No edge found yet:** at least one condition below failed.
- **Passed out-of-sample test:** every condition passed.
- **Passed forward test:** all of the above, plus a successful forward test on demo.

---

**To pass out-of-sample, every one of these must hold:**

- Development expectancy of at least +0.10R.
- Validation expectancy of at least +0.10R, and at least half the development figure.
- Validation [[profit factor]] of at least 1.25.
- The lower end of the expectancy range above zero.
- The likely worst drawdown, from 10,000 simulated orderings of your trades, within your plan's maximum.

---

Every verdict also shows the line "Results this good can occur with no real edge X% of the time". It's a reminder that even a pass isn't certainty.

---

"No edge found yet" is a good outcome, honestly. It means the test did its job: it stopped you risking real money on rules that didn't hold up. Many ideas don't survive a fair test, and finding that out on old data is the cheapest way.

---

::question{type="mc"}
Development expectancy is +0.30R. Validation expectancy is +0.12R, with a profit factor of 1.4 and a range from +0.02R to +0.22R. Which condition fails?
- [ ] Validation expectancy is below +0.10R
- [x] Validation expectancy is less than half of development
- [ ] The range includes zero
? Half of +0.30R is +0.15R, and validation is +0.12R. Everything else passes, but this one fails, so the verdict is "No edge found yet".
::

---

::takeaway
A pass needs every condition: positive expectancy in development and validation, validation holding at least half the edge, a profit factor of 1.25, a range above zero, and drawdowns within plan. "No edge found yet" saves you money.
::
