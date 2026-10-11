---
id: l3-why-losses-hurt-more
level: 3
module: fear-and-greed
order: 1
title: Why losses hurt more than wins feel good
status: published
minutes: 5
generated: claude-opus-5-5 2026-10-11
review: done
---

Losing $100 feels worse than winning $100 feels good. Psychologists call this loss aversion. Daniel Kahneman and Amos Tversky showed that people weigh losses more heavily than equal gains [@kahneman-tversky-prospect-theory].

---

They found something else that matters for traders. Facing a sure loss, people tend to gamble to avoid it. Facing a sure gain, they tend to grab it.

In trading, that turns into two classic habits:

- **Holding losers too long**, hoping they come back, because closing makes the loss real.
- **Cutting winners too early**, to lock in the good feeling before it disappears.

---

Together, these habits flip the payoff the wrong way: small wins and large losses. You've seen in Level 2 what that does to [[expectancy]].

Try it: set a win rate of 60% with wins of 0.5R and losses of 1.2R.

::simulator{kind="expectancy"}

---

::question{type="mc"}
A trader closes winners at +0.5R "to be safe" but lets losers run past the stop to −1.5R. Win rate is 60%. What's the result?
- [ ] A small profit, because most trades win
- [x] A loss over time: 0.6 × 0.5R − 0.4 × 1.5R = −0.3R per trade
- [ ] Break-even
? 0.6 × 0.5R = 0.3R, and 0.4 × 1.5R = 0.6R. 0.3R − 0.6R = −0.3R per trade, even though 60% of trades win.
::

---

::takeaway
Losses feel bigger than wins, which pushes people to hold losers and cut winners. Fixed stops and targets written in advance protect your payoff from those feelings.
::
