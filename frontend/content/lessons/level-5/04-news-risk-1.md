---
id: l5-what-happens-around-big-news
level: 5
module: news-risk
order: 1
title: What happens around big news
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

In the seconds around a high-impact release, the market changes character. Three things happen at once:

- **Spreads widen.** Banks pull their prices until they see the number, so the [[spread]] can jump to many times its normal size.
- **[[slippage|Slippage]] grows.** Orders fill further from the price you saw.
- **Prices can [[gap]].** The next trade can be far from the last one, with nothing in between.

---

Put together, these can hurt a trade that was fine a minute earlier. A [[stop-loss]] can be hit by a spread spike, or fill well beyond its level, as you saw in Level 1.

Try the gap simulator again with a 15-pip stop and a 25-pip jump past it.

::simulator{kind="gap"}

---

That's also why EdgeProof's default cost model assumes much more slippage inside news windows: 3 pips or more, instead of a fraction of a pip in normal conditions.

---

::question{type="mc"}
A high-impact release is due in two minutes, and your trade has a stop 8 pips away. What's the main risk?
- [ ] The release will be ignored by the market
- [x] Wider spreads or a gap could hit the stop, or fill it well beyond 8 pips
- [ ] The broker will close the trade at a profit
? Around big releases, spreads widen and prices can jump. Tight stops are the most exposed.
::

---

::takeaway
Around big news, spreads widen, slippage grows and prices can gap. A trade's risk can be far bigger than its stop distance suggests in those moments.
::
