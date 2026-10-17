"""
Ingestion (spec pipeline: ingest → store raw). Runs each source, upserts its
rows into RawObservation and records the source's health. A row first seen
by a live fetch is stamped with today's date as its release date; rows from
a backfill keep released_at empty and use the estimated publication lag.
"""

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import (
    CalendarEvent,
    Currency,
    DataSource,
    Pair,
    Publication,
    RawObservation,
)
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
        currency = currencies.get(r.subject) if len(r.subject) == 3 else None
        pair = pairs.get(r.subject) if len(r.subject) == 6 else None
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


NEWS_KEEP_DAYS = 180


def run_news(source: DataSource) -> dict:
    """Upsert central bank publications by URL and drop ones older than six months."""
    items, errors = news.fetch_all()
    if not items and errors:
        raise SourceError("; ".join(errors))
    items = [i for i in items if i.topics]  # only items that back a factor
    currencies = {c.code: c for c in Currency.objects.all()}
    known = set(Publication.objects.filter(url__in=[i.url for i in items]).values_list("url", flat=True))
    new = [
        Publication(currency=currencies[i.currency], title=i.title, url=i.url, published_at=i.published_at,
                    summary=i.summary, topics=i.topics, source=i.source)
        for i in {i.url: i for i in items}.values() if i.url not in known
    ]
    Publication.objects.bulk_create(new, ignore_conflicts=True)
    Publication.objects.filter(published_at__lt=timezone.now() - timedelta(days=NEWS_KEEP_DAYS)).delete()
    return {"rows": len(items), "new": len(new), "updated": 0, "feed_errors": errors}


def run_calendar(source: DataSource) -> dict:
    """Upsert this week's (and next week's) scheduled releases; keep eight weeks."""
    events, errors = calendar.fetch_all()
    if errors:
        raise SourceError("; ".join(errors))
    currencies = {c.code: c for c in Currency.objects.all()}
    new = updated = 0
    for e in events:
        _, created = CalendarEvent.objects.update_or_create(
            currency=currencies[e.currency], title=e.title, at=e.at,
            defaults={"impact": e.impact, "forecast": e.forecast, "previous": e.previous, "factor": e.factor},
        )
        new, updated = new + created, updated + (not created)
    CalendarEvent.objects.filter(at__lt=timezone.now() - timedelta(weeks=8)).delete()
    return {"rows": len(events), "new": new, "updated": updated}


def run_source(name: str, *, backfill: bool = False, years: int = 3) -> dict:
    fn, url, takes_start = SOURCES[name]
    source, _ = DataSource.objects.get_or_create(name=name, defaults={"base_url": url})
    if name in ("news", "calendar"):
        try:
            result = run_news(source) if name == "news" else run_calendar(source)
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
        result = _store(source, rows, backfill)
        source.last_success_at, source.last_error = timezone.now(), ""
        source.save(update_fields=["last_success_at", "last_error", "updated_at"])
        log.info("scanner source %s ok %s", name, result)
        return {"source": name, "ok": True, **result}
    except (SourceError, KeyError, ValueError, TypeError) as exc:
        source.last_error, source.last_error_at = str(exc)[:500], timezone.now()
        source.save(update_fields=["last_error", "last_error_at", "updated_at"])
        log.warning("scanner source %s failed: %s", name, exc)
        return {"source": name, "ok": False, "error": str(exc)[:300]}


def run_job(job: str, *, backfill: bool = False) -> list[dict]:
    return [run_source(name, backfill=backfill) for name in JOBS[job]]
