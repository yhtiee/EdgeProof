"""
The evidence behind a factor (founder request, docs/scanner §7): the recent official
prints the score was built from, where to read the original release, and what the
central bank has published on the topic lately. Also the input to the AI explanation.
"""

from datetime import timedelta

from django.utils import timezone

from .models import (
    CalendarEvent,
    FactorScore,
    Pair,
    Publication,
    RawObservation,
    ScoringRun,
)
from .reference import (
    CALENDAR_LINK,
    FACTOR_TEXT,
    FACTORS_CURRENCY,
    FACTORS_PAIR,
    RELEASE_LAG_DAYS,
    official_link,
)
from .scoring import Obs

# How many recent prints to show per factor.
HISTORY = {"cot": 12, "rates": 8, "inflation": 13, "growth": 8, "labour": 13, "business": 13, "trend": 30, "retail": 5}
NEWS_DAYS = 150
NEWS_PER_CURRENCY = 5
SOURCE_LABEL = {
    "cftc": "CFTC Commitments of Traders", "bis": "BIS central bank policy rates", "oecd": "OECD Data",
    "eurostat": "Eurostat", "fred": "FRED (HICP index)", "snb": "Swiss National Bank", "dbnomics": "IMF via DBnomics",
    "twelvedata": "Twelve Data", "myfxbook": "Myfxbook Community Outlook",
}
PAIR_LINKS = {
    "retail": ("Myfxbook Community Outlook", "https://www.myfxbook.com/community/outlook"),
    "trend": None,
}


def rate_decisions(code: str) -> tuple[list[dict], str]:
    """Policy rate history as decisions: each level, the date it took effect and the move, newest first; plus the latest print."""
    rows = list(RawObservation.objects.filter(factor="rates", currency__code=code).select_related("source").order_by("period_date"))
    if not rows:
        return [], ""
    levels = []
    for o in rows:
        if not levels or abs(o.value - levels[-1]["value"]) >= 0.005:
            change = round(o.value - levels[-1]["value"], 3) if levels else None
            levels.append({"period": o.period_date.isoformat(), "freq": "D", "value": o.value, "released": o.period_date.isoformat(),
                           "estimated_release": False, "change": change})
    out = list(reversed(levels))[: HISTORY["rates"]]
    out[0] = {**out[0], "current_as_of": rows[-1].period_date.isoformat()}
    return out, SOURCE_LABEL.get(rows[-1].source.name, rows[-1].source.name)


def calendar(codes: list[str], factor: str | None = None, *, back_days: int = 7, ahead_days: int = 14) -> list[dict]:
    """Scheduled releases (Forex Factory) for these currencies, from a week ago to two weeks ahead."""
    now = timezone.now()
    since = now - timedelta(days=back_days) if back_days else now  # back_days=0: upcoming only
    qs = CalendarEvent.objects.filter(currency__code__in=codes, at__gte=since, at__lte=now + timedelta(days=ahead_days))
    if factor:
        qs = qs.filter(factor=factor)
    return [{"currency": e.currency.code if hasattr(e, "currency") else "", "title": e.title, "at": e.at.isoformat(), "impact": e.impact,
             "forecast": e.forecast, "previous": e.previous, "factor": e.factor, "upcoming": e.at >= now}
            for e in qs.select_related("currency")]


def observations(factor: str, *, currency: str | None = None, pair: str | None = None) -> tuple[list[dict], str]:
    """The latest prints of the freshest series for one factor and subject, newest first, and the source name."""
    if factor == "rates" and currency:
        return rate_decisions(currency)
    qs = RawObservation.objects.filter(factor=factor).select_related("source")
    qs = qs.filter(currency__code=currency) if currency else qs.filter(pair__symbol=pair)
    latest = qs.order_by("-period_date").values_list("series", flat=True).first()
    if latest is None:
        return [], ""
    rows = list(qs.filter(series=latest).order_by("-period_date")[: HISTORY[factor] + 1])
    out = []
    for i, o in enumerate(rows[: HISTORY[factor]]):
        freq = (o.extra or {}).get("freq", "M")
        released = o.released_at or Obs(o.period_date, o.value, freq).available(factor)
        item = {"period": o.period_date.isoformat(), "freq": freq, "value": o.value, "released": released.isoformat(),
                "estimated_release": o.released_at is None and RELEASE_LAG_DAYS.get(factor, 0) > 0}
        if factor == "cot":
            item.update({k: (o.extra or {}).get(k) for k in ("long", "short", "open_interest")})
        if factor == "retail":
            item["sample"] = (o.extra or {}).get("sample")
        out.append(item)
    return out, SOURCE_LABEL.get(rows[0].source.name, rows[0].source.name)


def news(code: str, factor: str | None, limit: int = NEWS_PER_CURRENCY) -> list[dict]:
    """Recent central bank publications on this factor (or on any factor when `factor` is None)."""
    qs = Publication.objects.filter(currency__code=code, published_at__gte=timezone.now() - timedelta(days=NEWS_DAYS))
    items = [p for p in qs[:200] if factor is None or factor in p.topics][:limit]
    return [{"title": p.title, "url": p.url, "published_at": p.published_at.isoformat(), "summary": p.summary,
             "source": p.source, "topics": p.topics} for p in items]


def _current(run: ScoringRun, factor: str, *, currency: str | None = None, pair: str | None = None) -> dict | None:
    fs = FactorScore.objects.filter(run=run, factor=factor)
    fs = fs.filter(currency__code=currency) if currency else fs.filter(pair__symbol=pair)
    f = fs.first()
    return {"score": f.score, "raw": f.raw_value, "stale": f.is_stale, "detail": f.detail} if f else None


def factor_evidence(run: ScoringRun, subject: str, factor: str) -> dict:
    """Evidence for one factor of a currency ("EUR") or a pair ("EURUSD")."""
    text = {"name": FACTOR_TEXT[factor][0], "about": FACTOR_TEXT[factor][1]}
    if factor in FACTORS_PAIR:
        obs, source = observations(factor, pair=subject)
        link = PAIR_LINKS.get(factor)
        return {"subject": subject, "factor": factor, **text, "sides": [{
            "code": subject, "current": _current(run, factor, pair=subject), "observations": obs, "data_source": source,
            "official": {"label": link[0], "url": link[1]} if link else None, "news": [],
        }]}
    codes = [subject] if len(subject) == 3 else list(Pair.objects.filter(symbol=subject).values_list("base__code", "quote__code").first() or [])
    sides = []
    for code in codes:
        obs, source = observations(factor, currency=code)
        link = official_link(code, factor)
        sides.append({
            "code": code, "current": _current(run, factor, currency=code), "observations": obs, "data_source": source,
            "official": {"label": link[0], "url": link[1]} if link else None,
            "news": news(code, factor) if factor != "cot" else [],  # positioning has no central bank news
        })
    return {"subject": subject, "factor": factor, **text, "sides": sides,
            "calendar": calendar(codes, factor) if factor != "cot" else [],
            "calendar_link": {"label": CALENDAR_LINK[0], "url": CALENDAR_LINK[1]}}


def valid_factor(subject: str, factor: str) -> bool:
    return factor in FACTORS_CURRENCY or (factor in FACTORS_PAIR and len(subject) == 6)
