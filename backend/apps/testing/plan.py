"""
Plan warnings (SL-8): a strategy version's risk limits, checked against the
trades linked to that version. Warnings describe; they never block logging
(the same principle as DE-2's tilt flags). Computed on read, in one pass over
the user's linked trades, so edits and deletes are always reflected.
"""

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from .models import Trade

LOSS = Trade.Outcome.LOSS


def _currencies(instrument: str) -> set[str]:
    return {instrument[:3], instrument[-3:]}


def _risk_pct(t: Trade) -> float | None:
    if t.initial_risk_ccy is None or not t.account.balance:
        return None
    return float(Decimal(t.initial_risk_ccy) / t.account.balance * 100)


def warnings_by_trade(user, tz) -> dict:
    """{trade_id: [{"code", "message"}]} for every trade linked to a strategy version."""
    trades = list(
        Trade.objects.owned_by(user)
        .filter(strategy_version__isnull=False)
        .select_related("account", "strategy_version")
        .order_by("opened_at")
    )
    by_version = defaultdict(list)
    for t in trades:
        by_version[t.strategy_version_id].append(t)

    out = {}
    for group in by_version.values():
        plan = group[0].strategy_version.risk_plan or {}
        for t in group:
            out[t.id] = _for_trade(t, group, plan, tz)
    return out


def _for_trade(t: Trade, group: list[Trade], plan: dict, tz) -> list[dict]:
    w = []
    day = t.opened_at.astimezone(tz).date()
    week_start = day - timedelta(days=day.weekday())
    before = [o for o in group if o.id != t.id and o.opened_at < t.opened_at]
    closed_before = [o for o in before if o.closed_at and o.closed_at <= t.opened_at and o.r_result is not None]

    risk = _risk_pct(t)
    planned = plan.get("risk_pct")
    if risk is not None and planned:
        if risk > planned * 1.25:
            w.append({"code": "risk_above_plan_x125", "message": f"This trade risked {risk:.1f}%. Your rule allows {planned:g}%; this is more than 1.25× the plan."})
        elif risk > planned + 1e-9:
            w.append({"code": "risk_above_plan", "message": f"This trade risked {risk:.1f}%. Your rule allows {planned:g}% per trade."})

    day_r = sum(o.r_result for o in closed_before if o.closed_at.astimezone(tz).date() == day)
    if plan.get("daily_loss_r") and day_r <= -plan["daily_loss_r"]:
        w.append({"code": "daily_limit", "message": f"This trade opened after a {day_r:+.1f}R day; your daily limit is −{plan['daily_loss_r']:g}R."})
    week_r = sum(o.r_result for o in closed_before if o.closed_at.astimezone(tz).date() >= week_start)
    if plan.get("weekly_loss_r") and week_r <= -plan["weekly_loss_r"]:
        w.append({"code": "weekly_limit", "message": f"This trade opened after a {week_r:+.1f}R week; your weekly limit is −{plan['weekly_loss_r']:g}R."})

    same_day = [o for o in before if o.opened_at.astimezone(tz).date() == day]
    if plan.get("max_trades_per_day") and len(same_day) >= plan["max_trades_per_day"]:
        w.append({"code": "trades_per_day", "message": f"This was trade {len(same_day) + 1} of the day; your rule allows {plan['max_trades_per_day']}."})

    open_then = [o for o in before if not o.closed_at or o.closed_at > t.opened_at]
    if plan.get("max_open_trades") and len(open_then) >= plan["max_open_trades"]:
        w.append({"code": "open_trades", "message": f"{len(open_then)} other trades were open; your rule allows {plan['max_open_trades']} at once."})

    cap = plan.get("max_currency_risk_pct")
    if cap and risk is not None:
        for ccy in sorted(_currencies(t.instrument)):
            total = risk + sum(r for o in open_then if ccy in _currencies(o.instrument) and (r := _risk_pct(o)) is not None)
            if total > cap + 1e-9:
                w.append({"code": "currency_risk", "message": f"Open risk on {ccy} reached {total:.1f}%; your cap is {cap:g}%."})
                break

    streak = plan.get("losing_streak") or {}
    n = streak.get("losses")
    if n and len(closed_before) >= n and all(o.outcome == LOSS for o in sorted(closed_before, key=lambda o: o.closed_at)[-n:]):
        action = {"stop_day": "stop for the day", "halve_risk": "halve the risk", "stop_review": "stop and review"}.get(streak.get("action"), "pause")
        w.append({"code": "losing_streak", "message": f"This trade opened after {n} losses in a row; your rule at that point is to {action}."})
    return w
