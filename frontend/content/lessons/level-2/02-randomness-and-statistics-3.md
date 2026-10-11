---
id: l2-reading-a-confidence-range
level: 2
module: randomness-and-statistics
order: 3
title: Reading a confidence range
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Because samples are noisy, EdgeProof never shows a result as a single number. It shows a [[confidence range]]: the band the true value probably lies in, given your trades.

It's drawn as a range bar: a dot for the measured result, a line for the range, and a mark at zero.

---

Read a range bar in three steps:

- **Where's the dot?** That's what you measured.
- **How wide is the line?** Wider means fewer trades or bigger swings, so less certainty.
- **Does the line cross zero?** If it does, the data can't rule out that there's no edge.

---

Try moving the number of trades and watch the line. The dot stays near the true value, but the line shrinks as the sample grows.

::simulator{kind="sample-size"}

---

::question{type="mc"}
A range bar shows expectancy of +0.15R, with a range from −0.10R to +0.40R. What does it say?
- [ ] The strategy definitely has an edge of +0.15R
- [x] The result is positive, but the range includes zero, so an edge isn't shown yet
- [ ] The strategy loses money
? The range crosses zero, so a true expectancy of zero or below is still possible. EdgeProof would call this "No edge found yet", not a pass.
::

---

::takeaway
A confidence range shows how sure a result is. If the range crosses zero, the data hasn't shown an edge yet, however good the middle number looks.
::
