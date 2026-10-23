"""
Scoreboard releases (docs/scanner/scoreboard.md): the forecast and the actual behind each
macro cell.

- Forecasts come from the Forex Factory weekly feed. Each run refreshes a release's
  forecast until its release time, then it is frozen: what the market expected.
- Actuals: the official first print where we fetch one (FRED for US releases, matched by
  the day FRED published it), otherwise the "previous" the feed lists on the next release
  of the same series (the first print as the calendar recorded it).
- Free surveys that stand in for licensed PMIs (Philadelphia Fed, EC business surveys)
  have no forecast; they're stored as releases and scored on change.
"""

import logging
import re
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from itertools import pairwise
from zoneinfo import ZoneInfo

from django.utils import timezone

from .models import Currency, Release
from .reference import FRED_ACTUALS, RELEASE_INDEX, SURVEY_SERIES
from .scoreboard import parse_number
from .sources import SourceError
from .sources.providers import (
    eurostat_survey,
    fred_first_releases,
    fred_vintage,
    fred_vintage_dates,
)

log = logging.getLogger(__name__)
NEW_YORK = ZoneInfo("America/New_York")
KEEP_DAYS = 200  # long enough for a quarterly series' previous release


def match(currency: str, title: str) -> str | None:
    return RELEASE_INDEX.get((currency, title.strip().lower()))


def capture(raw_events: list[dict]) -> dict:
    """Upsert the feed's events for mapped titles. Forecasts and previous figures update only before release time."""
    currencies = {c.code: c for c in Currency.objects.all()}
    now = timezone.now()
    new = updated = 0
    for e in raw_events:
        code, title = e.get("country", ""), (e.get("title") or "").strip()
        indicator = match(code, title)
        if not indicator or code not in currencies:
            continue
        try:
            at = datetime.fromisoformat(e["date"])
        except (KeyError, ValueError):
            continue
        forecast = parse_number(e.get("forecast") or "")
        previous = parse_number(e.get("previous") or "")
        r, created = Release.objects.get_or_create(
            currency=currencies[code], title=title[:120], at=at,
            defaults={"indicator": indicator, "forecast": forecast[0] if forecast else None, "forecast_text": (e.get("forecast") or "")[:40],
                      "previous": previous[0] if previous else None, "forecast_source": "Forex Factory" if forecast else ""},
        )
        if created:
            new += 1
        elif at > now:  # still ahead: the consensus can move until the release
            r.forecast, r.forecast_text = (forecast[0] if forecast else r.forecast), ((e.get("forecast") or "")[:40] or r.forecast_text)
            r.previous = previous[0] if previous else r.previous
            r.forecast_source = r.forecast_source or ("Forex Factory" if forecast else "")
            r.save(update_fields=["forecast", "forecast_text", "previous", "forecast_source", "updated_at"])
            updated += 1
    Release.objects.filter(at__lt=now - timedelta(days=KEEP_DAYS)).delete()
    return {"rows": len(raw_events), "new": new, "updated": updated}


# --- Actuals ----------------------------------------------------------------------------------


def _transform(points: list[tuple], kind: str, scale: float) -> float | None:
    values = [v for _, v in sorted(points)]
    if kind == "level":
        return values[-1] * scale if values else None
    if kind == "diff":
        return (values[-1] - values[-2]) * scale if len(values) >= 2 else None
    if kind == "mom":
        return (values[-1] / values[-2] - 1) * 100 if len(values) >= 2 and values[-2] else None
    if kind == "yoy":
        return (values[-1] / values[-13] - 1) * 100 if len(values) >= 13 and values[-13] else None
    raise ValueError(kind)


def resolve_fred(now: datetime | None = None) -> int:
    """US actuals from FRED: the series as published on the release day (or the next vintage within 3 days)."""
    now = now or timezone.now()
    pending = Release.objects.filter(currency__code="USD", title__in=list(FRED_ACTUALS), actual__isnull=True, at__lte=now,
                                     at__gte=now - timedelta(days=KEEP_DAYS))
    vintages: dict[str, list] = {}
    done = 0
    for r in pending:
        series, kind, scale = FRED_ACTUALS[r.title]
        day = r.at.astimezone(NEW_YORK).date()
        try:
            if series not in vintages:
                vintages[series] = fred_vintage_dates(series, day - timedelta(days=KEEP_DAYS))
            published = next((v for v in vintages[series] if day <= v <= day + timedelta(days=3)), None)
            if published is None:
                continue  # FRED hasn't posted it yet
            value = _transform(fred_vintage(series, published, day - timedelta(days=430)), kind, scale)
        except SourceError as exc:
            log.warning("FRED actual for %s failed: %s", r.title, exc)
            continue
        if value is None:
            continue
        r.actual, r.actual_source = round(value, 4), f"FRED {series}, first print"
        r.save(update_fields=["actual", "actual_source", "updated_at"])
        done += 1
    return done


_STAGE = re.compile(r"^(advance|prelim(inary)?( flash)?|flash|revised|final)\s+", re.IGNORECASE)


def family(title: str) -> str:
    """'Prelim GDP q/q' and 'Final GDP q/q' are one series; 'CPI Flash Estimate y/y' and 'Final CPI y/y' too."""
    t = _STAGE.sub("", title.strip())
    return t.replace(" Flash Estimate", "").lower()


def resolve_from_next(now: datetime | None = None) -> int:
    """Where no official print is fetched: the next release of the same series lists this one's figure as its previous."""
    now = now or timezone.now()
    done = 0
    for r in Release.objects.filter(actual__isnull=True, at__lte=now).select_related("currency"):
        later = Release.objects.filter(currency=r.currency, indicator=r.indicator, at__gt=r.at, previous__isnull=False).order_by("at")
        nxt = next((x for x in later if family(x.title) == family(r.title)), None)
        if nxt is None:
            continue
        r.actual, r.actual_source = nxt.previous, f"previous figure on the {nxt.at:%d %b} release"
        r.save(update_fields=["actual", "actual_source", "updated_at"])
        done += 1
    return done


def _survey_release(currency, indicator: str, title: str, at: datetime, value: float, previous: float | None, source: str) -> bool:
    _, created = Release.objects.update_or_create(
        currency=currency, title=title, at=at,
        defaults={"indicator": indicator, "actual": value, "previous": previous, "actual_source": source},
    )
    return created


def resolve_surveys(now: datetime | None = None) -> int:
    """Free surveys standing in for licensed PMIs: each new reading is a release scored against the one before."""
    now = now or timezone.now()
    since = (now - timedelta(days=KEEP_DAYS)).date()
    currencies = {c.code: c for c in Currency.objects.filter(code__in={c for c, _ in SURVEY_SERIES})}
    made = 0
    for (code, indicator), (provider, series, title) in SURVEY_SERIES.items():
        try:
            if provider == "fred":
                points = fred_first_releases(series, since)
                previous = None
                for period, value, released in sorted(points):
                    at = datetime.combine(released, time(12), tzinfo=NEW_YORK)
                    if previous is not None:
                        made += _survey_release(currencies[code], indicator, title, at, value, previous, f"FRED {series}, first print")
                    previous = value
            else:
                points = eurostat_survey(series, since - timedelta(days=62))
                for (_, prev), (period, value) in pairwise(points):
                    # The Commission publishes each month's survey at the end of that month.
                    month_end = (period.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                    at = datetime.combine(month_end, time(9), tzinfo=dt_timezone.utc)
                    made += _survey_release(currencies[code], indicator, title, at, value, prev, f"Eurostat {series}")
        except SourceError as exc:
            log.warning("survey %s %s failed: %s", code, series, exc)
    return made


def resolve_all() -> dict:
    surveys = resolve_surveys()
    fred = resolve_fred()
    nxt = resolve_from_next()
    return {"rows": surveys + fred + nxt, "new": surveys, "updated": fred + nxt, "fred": fred, "from_next": nxt}
