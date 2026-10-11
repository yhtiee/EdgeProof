---
id: l7-breakeven-partials-and-trailing-stops
level: 7
module: trade-management
order: 1
title: Breakeven, partials and trailing stops
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

Trade management is what you do after entry. Three tools are common:

- **Breakeven:** moving the [[stop-loss]] to the entry price once the trade has moved in your favour.
- **Partial close:** closing part of the position at a first target, and letting the rest run.
- **Trailing stop:** moving the stop behind price as it moves your way, to lock in part of the gain.

---

Each one changes the shape of your results:

- Breakeven turns some would-be losers into zero-results, but also stops out some trades that would have dipped and then gone on to win.
- Partials raise the win rate but cut the size of the biggest wins.
- Trailing stops protect gains but can exit early in choppy moves.

None of them is free. Each one trades something away.

---

That's why "always move to breakeven" isn't automatically good advice. Whether a management rule helps depends on the strategy, and only testing can tell.

Use the expectancy tool to see how a higher win rate with smaller wins can come out better, worse or the same.

::simulator{kind="expectancy"}

---

::question{type="mc"}
A trader adds a partial close at +1R. Their win rate rises from 40% to 55%. What else must be checked before calling it an improvement?
- [ ] Nothing, because a higher win rate is always better
- [x] Whether the expectancy rose too, since partials usually shrink the average win
- [ ] Whether it feels more comfortable
? Partials trade bigger wins for more frequent ones. Only expectancy, after costs, shows whether the trade-off helped.
::

---

::takeaway
Breakeven stops, partial closes and trailing stops each trade something away. Judge a management rule by its effect on expectancy, not on win rate or comfort.
::
