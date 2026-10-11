---
id: l6-what-overfitting-is
level: 6
module: overfitting
order: 1
title: What overfitting is
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

Imagine trying 200 versions of a strategy on the same data: different moving averages, different stops, different times of day. Then keeping the one with the best result.

That best version will look impressive. The question is whether it found something real, or just the version that happened to fit the past's random wiggles. Fitting the noise is called [[overfitting]].

---

Try it below. Every strategy here has no edge at all: each trade is a coin flip. Move the slider to try more versions on the same data, then see how the "best" one does on new data.

::simulator{kind="overfitting"}

---

The more versions you try, the better the best one looks, even with nothing real behind it. On fresh data it falls back to luck.

Researchers have shown this mathematically: trying many configurations on the same data makes an impressive backtest likely by chance, and such results tend to fail out of sample [@bailey-backtest-overfitting].

---

::question{type="mc"}
You tested 150 variations of a rule on the same 3 years and kept the best, which shows +0.4R per trade. What's the main risk?
- [ ] The result is too modest
- [x] The result may come from fitting noise, and could vanish on new data
- [ ] The rule has too few parameters
? Picking the best of many tries on the same data inflates the result. Only data the rule never saw can show whether it's real.
::

---

::takeaway
Testing many variations and keeping the best produces impressive-looking results by chance. The more you try, the more the best result is luck, unless it's confirmed on new data.
::
