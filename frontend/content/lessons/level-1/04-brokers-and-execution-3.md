---
id: l1-margin-calls-and-stop-outs
level: 1
module: brokers-and-execution
order: 3
title: Margin calls and stop-outs
status: published
minutes: 5
generated: gemini-3.8-flash 2026-10-11
review: done
---
When you hold open trades, your account balance stays fixed, but your account equity changes with every price tick. Equity is your balance plus or minus floating profits and losses.

Your [[broker]] tracks your safety cushion using a figure called the **margin level**. This is calculated as your equity divided by your used [[margin]], expressed as a percentage:

**Margin level = (equity ÷ used margin) × 100%**

When trades move against you into a [[drawdown]], equity falls. Because your used [[margin]] stays the same, your margin level drops.

---

A **margin call** is an alert from your [[broker]] that your account is running out of usable funds [@babypips-pipsology]. It occurs when your margin level drops to a specific threshold set by the firm, often 100%.

At a 100% margin level, your equity exactly equals your used [[margin]]. You have zero free cash left to open new trades or absorb further price swings.

Historically, brokers called clients by telephone to demand more cash. Today, trading platforms usually trigger an automated warning banner or an email alert notifying you that positions are at risk.

---

If prices keep moving against you and you take no action, the broker steps in with a **stop-out** [@babypips-pipsology].

A stop-out is an automatic liquidation of your open trades. When your margin level drops to the stop-out threshold, the platform begins closing your positions automatically. Which position closes first depends on the broker's rules, and many start with the biggest loser.

The platform executes this without waiting for your permission. Its sole purpose is to close positions before losses wipe out all remaining equity or plunge the account balance below zero.

---

To shield retail traders from extreme losses, financial watchdogs set mandatory minimums for these cut-offs. Under European rules, brokers must close out retail client positions as soon as equity drops to 50% of the required [[margin]] [@esma-cfd-restrictions-2018].

Different regions and brokers may set the exact trigger at different percentages, but the underlying mechanic is the same everywhere.

Relying on a stop-out as a risk plan is dangerous. By the time a broker forces a liquidation, you have already absorbed a severe loss that a well-placed [[stop-loss]] was designed to prevent.

---

::question{type="numeric" answer="50" tolerance="0.5" unit="%"}
Your account requires $300 in used [[margin]] for an open trade. A market move pulls your equity down to $150. What is your current margin level?
? Margin level is calculated as (equity ÷ used margin) × 100%. Here, ($150 ÷ $300) × 100% = 50%.
::

---

Managing your [[position size]] keeps a comfortable margin buffer between your equity and the liquidation line.

When you keep used [[margin]] to a small share of your total capital, normal market fluctuations will not threaten your account with a forced close-out.

::takeaway
A margin call warns that capital is running dry, while a stop-out liquidates open trades to stop losses from exceeding account equity.
::
