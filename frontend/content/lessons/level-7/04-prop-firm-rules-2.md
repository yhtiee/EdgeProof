---
id: l7-prop-firm-risks
level: 7
module: prop-firm-rules
order: 2
title: Prop firm risks
status: published
minutes: 6
generated: claude-opus-5-5 2026-10-11
review: done
---

Prop challenges carry three kinds of risk, and only one is about your trading.

**1. The rules versus your strategy.** A strategy with a real edge can still fail a challenge, because a normal [[drawdown]] can break a 5% daily or 10% overall limit before the edge shows up.

---

**2. Fees add up.** Many traders pay for challenge after challenge. Each fee feels small; together they can become a large cost. EdgeProof suggests setting a yearly fee budget in advance, for example no more than two challenge fees per quarter, and pausing to review when you reach it.

---

**3. The firm itself.** You're relying on a company to pay you. In September 2023 the CFTC charged the prop firm My Forex Funds with fraudulently taking over $300 million from customers, and a court froze its assets [@cftc-my-forex-funds-2023]. Firms have also closed, changed their rules, or refused payouts.

---

Use the risk-of-ruin tool to see how often a drawdown of 10% happens with your risk per trade and win rate.

::simulator{kind="risk-of-ruin"}

---

EdgeProof's path puts the evidence first: a passed out-of-sample test, a forward test on demo, then a small real-money step at 0.25% risk per trade for 30 or more trades, before any paid challenge.

::question{type="mc"}
A strategy risks 2% per trade, and its tests show losing streaks of six trades are common. The challenge has a 10% maximum drawdown. What does the data suggest?
- [ ] The challenge is a good fit
- [x] A common losing streak would come close to the limit, so the risk is too high for these rules
- [ ] Losing streaks don't matter in challenges
? Six losses at 2% is about an 11% drawdown, past the 10% limit. Either the risk per trade needs to drop, or this challenge doesn't fit the strategy.
::

---

::takeaway
Prop challenges can fail good strategies through tight limits, fees add up, and the firm itself is a risk. Check your data against the rules, set a fee budget, and prove your edge before paying.
::
