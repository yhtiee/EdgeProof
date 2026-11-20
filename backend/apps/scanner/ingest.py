"""
Ingestion (spec pipeline: ingest → store raw). Runs each source, upserts its
rows into RawObservation and records the source's health. A row first seen
by a live fetch is stamped with today's date as its release date; rows from
a backfill keep released_at empty and use the estimated publication lag.
"""

import logging
from datetime import timedelta

from django.db import connection, transaction
from django.utils import timezone

from . import releases
from .models import (
    CalendarEvent,
    Currency,
    DataSource,
    Pair,
    Publication,
    RawObservation,
)
from .reference import ALL_PAIRS
from .sources import Row, SourceError, calendar, news
from .sources.providers import JOBS, SOURCES

log = logging.getLogger(__name__)


def _store(source: DataSource, rows: list[Row], backfill: bool) -> dict:
    currencies = {c.code: c for c in Currency.objects.all()}
    pairs = {p.symbol: p for p in Pair.objects.all()}
    existing = {}
    for o in RawObservation.objects.filter(factor__in={r.factor for r in rows}, source=source).select_related(None):
        subject = o.currency_id or o.pair_id
        existing[(o.factor, o.series, subject, o.period_date)] = o
    today = timezone.localdate()
    new, changed = [], []
    for r in rows:
        currency = currencies.get(r.subject)
        pair = None if currency else pairs.get(r.subject)  # a pair, gold, or an index, stock or coin
        if not currency and not pair:
            continue
        key = (r.factor, r.series, (currency or pair).id, r.period)
        extra = {"freq": r.freq, **r.extra}
        obs = existing.get(key)
        if obs is None:
            new.append(RawObservation(
                factor=r.factor, series=r.series, currency=currency, pair=pair, period_date=r.period, value=r.value,
                extra=extra, released_at=None if backfill else today, source=source,
            ))
        elif obs.value != r.value or obs.extra != extra:
            obs.value, obs.extra = r.value, extra  # revisions overwrite; the release date stays the first sighting
            changed.append(obs)
    with transaction.atomic():
        RawObservation.objects.bulk_create(new, batch_size=1000, ignore_conflicts=True)
        RawObservation.objects.bulk_update(changed, ["value", "extra", "updated_at"], batch_size=1000)
    return {"rows": len(rows), "new": len(new), "updated": len(changed)}


NEWS_KEEP_DAYS = 365  # the News headlines keep a year; the scanner's evidence looks back 150 days


def run_news(source: DataSource) -> dict:
    """
    Upsert official publications by URL and drop ones older than a year. Every item except
    housekeeping is kept for the News headlines; the scanner's evidence reads only the bank
    items tagged with a factor.
    """
    items, errors = news.fetch_all()
    if not items and errors:
        raise SourceError("; ".join(errors))
    items = [i for i in items if not i.housekeeping]
    currencies = {c.code: c for c in Currency.objects.all()}
    by_url = {i.url: i for i in items}
    known = {p.url: p for p in Publication.objects.filter(url__in=list(by_url))}
    new = [
        Publication(currency=currencies[i.currency], title=i.title, url=i.url, published_at=i.published_at, summary=i.summary,
                    topics=i.topics, source=i.source, kind=i.kind, publisher=i.publisher)
        for i in by_url.values() if i.url not in known
    ]
    # Rows stored before headlines had kinds get one now.
    stale = [p for url, p in known.items() if not p.kind]
    for p in stale:
        p.kind, p.publisher, p.source = by_url[p.url].kind, by_url[p.url].publisher, by_url[p.url].source
    Publication.objects.bulk_create(new, ignore_conflicts=True)
    Publication.objects.bulk_update(stale, ["kind", "publisher", "source", "updated_at"])
    Publication.objects.filter(published_at__lt=timezone.now() - timedelta(days=NEWS_KEEP_DAYS)).delete()
    return {"rows": len(items), "new": len(new), "updated": len(stale), "feed_errors": errors}


def run_calendar(source: DataSource) -> dict:
    """Upsert this week's (and next week's) scheduled releases; keep eight weeks. Scoreboard forecasts ride along."""
    raw, errors = calendar.fetch_raw()
    if errors:
        raise SourceError("; ".join(errors))
    releases.capture(raw)  # every impact level: the scoreboard needs low-impact releases too
    events = calendar.parse(raw)
    currencies = {c.code: c for c in Currency.objects.all()}
    new = updated = 0
    for e in events:
        _, created = CalendarEvent.objects.update_or_create(
            currency=currencies[e.currency], title=e.title, at=e.at,
            defaults={"impact": e.impact, "forecast": e.forecast, "previous": e.previous, "factor": e.factor,
                      "indicator": releases.match(e.currency, e.title) or ""},
        )
        new, updated = new + created, updated + (not created)
    CalendarEvent.objects.filter(at__lt=timezone.now() - timedelta(weeks=8)).delete()
    actuals = releases.fill_calendar_actuals()
    return {"rows": len(events), "new": new, "updated": updated, "actuals": actuals}


def monthly_closes_current() -> bool:
    """Seasonality needs last month's close; once it's stored, the monthly fetch can wait for the next month."""
    this_month = timezone.localdate().replace(day=1)
    last_month = (this_month - timedelta(days=1)).replace(day=1)
    rows = RawObservation.objects.filter(factor="monthly")
    listed = set(rows.values_list("pair_id", flat=True).distinct())
    if len(listed) < len(ALL_PAIRS):
        return False  # an instrument has no monthly history yet (just added)
    # Everything that traded before this month has last month's close (a new listing has none to wait for).
    traded = set(rows.filter(period_date__lt=this_month).values_list("pair_id", flat=True).distinct())
    return traded <= set(rows.filter(period_date=last_month).values_list("pair_id", flat=True).distinct())


def _fresh_connection() -> None:
    if not connection.in_atomic_block:  # never inside a caller's transaction (tests, nested jobs)
        connection.close()


def run_source(name: str, *, backfill: bool = False, years: int = 3) -> dict:
    fn, url, takes_start = SOURCES[name]
    source, _ = DataSource.objects.get_or_create(name=name, defaults={"base_url": url})
    if name == "twelvedata_monthly" and not backfill and monthly_closes_current():
        return {"source": name, "ok": True, "skipped": "this month's closes are stored"}
    if name in ("news", "calendar", "releases"):
        try:
            if name == "news":
                result = run_news(source)
            elif name == "calendar":
                result = run_calendar(source)
            else:
                result = releases.resolve_all()
                result["calendar_actuals"] = releases.fill_calendar_actuals()  # new official prints reach the News calendar
        except SourceError as exc:
            source.last_error, source.last_error_at = str(exc)[:500], timezone.now()
            source.save(update_fields=["last_error", "last_error_at", "updated_at"])
            return {"source": name, "ok": False, "error": str(exc)[:300]}
        source.last_success_at, source.last_error = timezone.now(), ""
        source.save(update_fields=["last_success_at", "last_error", "updated_at"])
        return {"source": name, "ok": True, **result}
    start = timezone.localdate() - timedelta(days=365 * years + 400) if backfill else timezone.localdate() - timedelta(days=500)
    try:
        if name == "twelvedata":
            rows = fn(1000 if backfill else 260)  # trend needs 210+ closes; 260 also covers holidays
        else:
            rows = fn(start) if takes_start else fn()
        # A fetch can take minutes (Twelve Data's free plan waits a minute per batch); the database pooler
        # may have dropped the idle connection meanwhile, so start a fresh one before writing.
        _fresh_connection()
        result = _store(source, rows, backfill)
        source.last_success_at, source.last_error = timezone.now(), ""
        source.save(update_fields=["last_success_at", "last_error", "updated_at"])
        log.info("scanner source %s ok %s", name, result)
        return {"source": name, "ok": True, **result}
    except (SourceError, KeyError, ValueError, TypeError) as exc:
        _fresh_connection()  # same reason: the failure may come after a long wait
        source.last_error, source.last_error_at = str(exc)[:500], timezone.now()
        source.save(update_fields=["last_error", "last_error_at", "updated_at"])
        log.warning("scanner source %s failed: %s", name, exc)
        return {"source": name, "ok": False, "error": str(exc)[:300]}


def run_job(job: str, *, backfill: bool = False) -> list[dict]:
    return [run_source(name, backfill=backfill) for name in JOBS[job]]
