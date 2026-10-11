---
id: l6-development-and-validation-data
level: 6
module: out-of-sample-testing
order: 1
title: Development and validation data
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

The cure for overfitting is simple to say: test on data your strategy has never seen. That data is called [[out-of-sample]].

EdgeProof splits your history in two:

- **Development data**, where you build and adjust your rules.
- **Validation data**, a later period you keep untouched until the rules are final.

---

The minimum lengths: development needs at least 3 years for intraday strategies and 8 years for swing strategies. Validation needs at least 12 months, placed after the development period.

Putting validation after development matters. It mimics real life: rules built on the past, tested on what came next.

---

Here's the rule that makes it work: **each validation window can be used only once per strategy.** Once you've looked at the results, that data has influenced you. If you change the rules, you need a new, unseen window, or you go straight to forward testing on live demo prices.

Each strategy gets at most three validation attempts.

---

Replay happens in outside tools, so EdgeProof can't physically hide the data. The lock works on honesty, and the interface says so. Breaking it only fools yourself.

---

::question{type="mc"}
Your strategy failed validation. You tweak one rule. Can you test the new version on the same validation data?
- [ ] Yes, as long as the change is small
- [x] No: that window has been used, so you need a new unseen window or a forward test
- [ ] Yes, but only once
? Once you've seen a validation period's results, it's no longer unseen. Re-using it turns validation into more development.
::

---

::takeaway
Build on development data, then test once on later, unseen validation data. A used validation window is burned: new versions need new data or a forward test.
::
