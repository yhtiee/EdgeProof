"""Journal metrics and activity (spec §8 core metrics, DE-9 journaling streak)."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.discipline.models import Review
from apps.testing.models import Trade, TradingAccount
from apps.testing.services import quote_currency
from apps.testing.views import filter_trades, require_account, user_tz

from .metrics import TradeRecord, compute


def pip_size(instrument: str) -> Decimal:
    return Decimal("0.01") if quote_currency(instrument) == "JPY" else Decimal("0.0001")


def records_for(request) -> list[TradeRecord]:
    tz = user_tz(request.user)
    out = []
    for t in filter_trades(request, Trade.objects.owned_by(request.user).select_related("account")):
        cost_r = 0.0
        if t.initial_risk_ccy and t.r_result is not None and not t.r_estimated:
            cost_r = float((t.fees - t.swap) / t.initial_risk_ccy)
        stop_pips = float(abs(t.entry - t.initial_stop) / pip_size(t.instrument)) if t.initial_stop is not None else None
        out.append(
            TradeRecord(
                r=t.r_result if t.initial_stop is not None else None,
                opened_at=t.opened_at,
                closed_at=t.closed_at if t.outcome != Trade.Outcome.OPEN else None,
                rules_followed=t.rules_followed,
                instrument=t.instrument,
                session=t.market_session,
                setup=t.setup_key,
                emotion=t.emotion_before,
                account=t.account.name,
                cost_r=cost_r,
                stop_pips=stop_pips,
                weekday=t.opened_at.astimezone(tz).weekday(),
            )
        )
    return out


class JournalMetricsView(APIView):
    """GET /me/journal/metrics?account=&from=&to=&instrument= : core metrics with breakdowns."""

    def get(self, request):
        require_account(request, request.query_params.get("account"))
        records = records_for(request)
        data = compute(records)
        accounts = TradingAccount.objects.owned_by(request.user)
        account = accounts.filter(id=request.query_params.get("account")).first() if request.query_params.get("account") else None
        risk = account.risk_per_trade_pct if account else (accounts.first().risk_per_trade_pct if accounts.exists() else Decimal(1))
        data["risk_per_trade_pct"] = float(risk)
        data["estimated_r_trades"] = sum(
            1 for t in filter_trades(request, Trade.objects.owned_by(request.user)).filter(r_estimated=True)
        )
        return Response(data)


class JournalBreakdownsView(APIView):
    """GET /me/journal/breakdowns (spec §15): the breakdown part of the metrics."""

    def get(self, request):
        require_account(request, request.query_params.get("account"))
        return Response(compute(records_for(request))["breakdowns"])


class JournalActivityView(APIView):
    """
    GET /me/journal/activity: days with a logged trade or a review, in the
    user's timezone, for the calendar and the journaling streak (DE-9).
    Streaks reward the habit, never profit.
    """

    def get(self, request):
        tz = user_tz(request.user)
        today = datetime.now(tz).date()
        since = today - timedelta(weeks=26)
        days: dict[str, int] = {}
        trades = Trade.objects.owned_by(request.user).filter(created_at__date__gte=since - timedelta(days=2))
        for created in trades.values_list("created_at", flat=True):
            d = created.astimezone(tz).date()
            days[d.isoformat()] = days.get(d.isoformat(), 0) + 1
        for created in Review.objects.owned_by(request.user).filter(created_at__date__gte=since).values_list("created_at", flat=True):
            d = created.astimezone(tz).date().isoformat()
            days.setdefault(d, 0)

        active = {date.fromisoformat(d) for d in days}
        # Today still counts as "on track" until it's over.
        current, day = 0, today if today in active else today - timedelta(days=1)
        while day in active:
            current += 1
            day -= timedelta(days=1)
        best = run = 0
        for i in range((today - since).days + 1):
            d = since + timedelta(days=i)
            run = run + 1 if d in active else 0
            best = max(best, run)
        return Response(
            {
                "today": today.isoformat(),
                "days": {d: n for d, n in sorted(days.items()) if date.fromisoformat(d) >= since},
                "streak": current,
                "best_streak": max(best, current),
                "logged_today": today in active,
                "total_trades": Trade.objects.owned_by(request.user).count(),
            }
        )
