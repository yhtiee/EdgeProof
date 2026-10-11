---
id: l6-mechanical-and-discretionary-strategies
level: 6
module: mechanical-vs-discretionary
order: 1
title: Mechanical and discretionary strategies
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

A [[mechanical strategy]] has rules precise enough that two people, or a computer, would take exactly the same trades. A [[discretionary strategy]] leaves some decisions to the trader's judgement in the moment.

---

Discretion isn't wrong. Many experienced traders use it. The problem is testing: when part of the decision happens in your head, the same chart can lead to different trades on different days. The results become harder to trust.

---

That's why EdgeProof treats them differently. A strategy with any free-text rule kept after a clarity override is classed as discretionary. Its verdict needs more trades: 150 development and 100 validation trades instead of 100 and 50. It also carries a "lower reliability" label.

---

::question{type="mc"}
Why does a discretionary strategy need more trades for a verdict?
- [ ] Because discretionary traders trade less often
- [x] Because judgement adds variation, so more evidence is needed to trust the result
- [ ] Because EdgeProof doesn't allow discretion at all
? When decisions vary with the trader's judgement, results are noisier and harder to repeat. A larger sample compensates for part of that.
::

---

::takeaway
Mechanical rules give the same trades every time and are easiest to test. Discretion is allowed but makes results less reliable, so EdgeProof asks for more evidence before a verdict.
::
