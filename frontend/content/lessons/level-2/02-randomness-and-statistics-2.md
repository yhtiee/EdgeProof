---
id: l2-why-30-trades-prove-nothing
level: 2
module: randomness-and-statistics
order: 2
title: Why 30 trades prove nothing
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

How many trades do you need before you can trust a result? Most people's gut says "not many". Researchers have shown that people expect small samples to look like the whole picture, and so read too much into a few results [@tversky-kahneman-small-numbers].

---

Try it. Set a strategy that truly wins 40% of the time with wins twice as big as losses. Its true [[expectancy]] is +0.20R per trade. Now look at what you might measure after 30 trades.

::simulator{kind="sample-size"}

---

After 30 trades, the range of results you could measure is huge: it includes losing strategies and strategies twice as good as the real one. Slide the number of trades up to 300 and the range narrows.

This is what [[sample size]] means in practice: small samples are noisy, and noise looks like information.

---

::question{type="mc"}
A strategy shows +0.4R per trade over its first 30 trades. What's the honest reading?
- [ ] It has a strong edge of about +0.4R
- [x] It might have an edge, no edge, or a negative one: 30 trades is too few
- [ ] It will lose money from now on
? With 30 trades, the possible range is far too wide to separate a real edge from luck. More trades, tested properly, are needed.
::

---

::takeaway
Small samples can show almost anything. Thirty trades are a start, not a verdict, which is why EdgeProof asks for at least 100 development and 50 validation trades before judging a strategy.
::
