"""
News (docs/news.md): the economic calendar and official headlines. Read-only, signed-in
learners, no gate (founder decision 20 Nov 2026). Built from the tables the scanner's
jobs fill: CalendarEvent (Forex Factory weekly feed, all impacts), Release (official
actuals) and Publication (central bank and statistics agency feeds).
"""

from datetime import datetime, timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.scanner.models import CalendarEvent, DataSource, Publication
from apps.scanner.reference import (
    CALENDAR_LINK,
    CURRENCIES,
    NEWS_IMPACTS,
    NEWS_KIND_TEXT,
    NEWS_TOPICS,
    ORDER,
)
from apps.testing.models import Trade

from . import reading

CODES = set(ORDER)
MAX_RANGE_DAYS = 15
HEADLINES_PAGE = 30
DISCLAIMER = "Educational information, not trading advice. Forecasts are other people's estimates."
CACHE_SECONDS = 10 * 60  # the calendar changes only when the feed is fetched (four times a day)


def _when(text: str | None, name: str) -> datetime | None:
    if not text:
        return None
    try:
        d = datetime.fromisoformat(text.replace(" ", "+").replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError({name: ["Use an ISO date and time, for example 2026-11-16T00:00:00+01:00."]}) from exc
    return d if d.tzinfo else d.replace(tzinfo=timezone.get_current_timezone())


def _codes(text: str | None, name: str) -> list[str]:
    codes = [c.strip().upper() for c in (text or "").split(",") if c.strip()]
    bad = [c for c in codes if c not in CODES]
    if bad:
        raise ValidationError({name: [f"Unknown currency: {', '.join(bad)}."]})
    return codes


def _my_currencies(user) -> list[str]:
    """The currencies in the pairs this learner has journaled ("EUR/USD" → EUR and USD)."""
    seen = set()
    for inst in Trade.objects.owned_by(user).values_list("instrument", flat=True).distinct():
        letters = "".join(ch for ch in (inst or "").upper() if ch.isalpha())
        seen.update(c for c in (letters[:3], letters[3:6]) if c in CODES)
    return [c for c in ORDER if c in seen]


def _event(e: CalendarEvent) -> dict:
    code = e.currency.code
    return {
        "id": str(e.id), "currency": code, "title": e.title, "at": e.at.isoformat(), "impact": e.impact,
        "forecast": e.forecast, "previous": e.previous, "actual": e.actual, "actual_source": e.actual_source,
        "surprise": reading.surprise(e.actual, e.forecast), "effect": reading.effect(e.actual, e.forecast, e.title, e.factor, e.indicator),
        "factor": e.factor, "indicator": e.indicator, **reading.about(e.factor), **reading.links(code, e.factor),
    }


class CalendarView(APIView):
    """
    GET /news/calendar?from=&to=&currency=USD,EUR&impact=High,Medium&mine=1
    Scheduled releases between two times (at most 15 days apart; the client sends its own week in
    the learner's time zone), with actual, forecast, previous, how the actual compared and links.
    """

    def get(self, request):
        q = request.query_params
        now = timezone.now()
        start = _when(q.get("from"), "from") or now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
        end = _when(q.get("to"), "to") or start + timedelta(days=7)
        if end <= start or end - start > timedelta(days=MAX_RANGE_DAYS):
            raise ValidationError({"to": [f"Use a range of up to {MAX_RANGE_DAYS} days after 'from'."]})
        impacts = [i.strip().capitalize() for i in (q.get("impact") or "").split(",") if i.strip()]
        if any(i not in NEWS_IMPACTS for i in impacts):
            raise ValidationError({"impact": [f"Use any of {', '.join(NEWS_IMPACTS)}."]})
        codes = _codes(q.get("currency"), "currency")
        mine = _my_currencies(request.user)
        if q.get("mine") in ("1", "true"):
            codes = [c for c in (codes or ORDER) if c in mine]

        key = f"news:calendar:v1:{start.isoformat()}:{end.isoformat()}"
        events = cache.get(key)
        if events is None:
            rows = CalendarEvent.objects.filter(at__gte=start, at__lt=end).select_related("currency").order_by("at", "currency__code", "title")
            events = [_event(e) for e in rows]
            cache.set(key, events, CACHE_SECONDS)
        if codes or q.get("mine") in ("1", "true"):
            events = [e for e in events if e["currency"] in codes]
        if impacts:
            events = [e for e in events if e["impact"] in impacts]
        source = DataSource.objects.filter(name="calendar").first()
        return Response({
            "from": start.isoformat(), "to": end.isoformat(), "events": events, "my_currencies": mine,
            "currencies": ORDER, "impacts": list(NEWS_IMPACTS),
            "fetched_at": source.last_success_at.isoformat() if source and source.last_success_at else None,
            "link": {"label": CALENDAR_LINK[0], "url": CALENDAR_LINK[1]}, "disclaimer": DISCLAIMER,
        })


class HeadlinesView(APIView):
    """
    GET /news/headlines?currency=USD&topic=rates&kind=speech&publisher=bank&before=<iso>
    Official publications, newest first, 30 at a time; `before` is the previous page's `next`.
    """

    def get(self, request):
        q = request.query_params
        codes = _codes(q.get("currency"), "currency")
        topic, kind, publisher = q.get("topic") or "", q.get("kind") or "", q.get("publisher") or ""
        if topic and topic not in NEWS_TOPICS:
            raise ValidationError({"topic": [f"Use one of {', '.join(NEWS_TOPICS)}."]})
        if kind and kind not in NEWS_KIND_TEXT:
            raise ValidationError({"kind": [f"Use one of {', '.join(NEWS_KIND_TEXT)}."]})
        if publisher and publisher not in ("bank", "statistics"):
            raise ValidationError({"publisher": ["Use bank or statistics."]})
        qs = Publication.objects.select_related("currency").order_by("-published_at", "-id")
        if codes:
            qs = qs.filter(currency__code__in=codes)
        if kind:
            qs = qs.filter(kind=kind)
        if publisher:
            qs = qs.filter(publisher=publisher)
        before = _when(q.get("before"), "before")
        if before:
            qs = qs.filter(published_at__lt=before)
        items: list[Publication] = []
        for p in qs.iterator(chunk_size=200):  # topics live in a JSON list: filtered here so it works on every database
            if topic and topic not in (p.topics or []):
                continue
            items.append(p)
            if len(items) > HEADLINES_PAGE:
                break
        more = len(items) > HEADLINES_PAGE
        items = items[:HEADLINES_PAGE]
        source = DataSource.objects.filter(name="news").first()
        return Response({
            "items": [{"id": str(p.id), "title": p.title, "url": p.url, "published_at": p.published_at.isoformat(), "summary": p.summary,
                       "currency": p.currency.code, "source": p.source, "publisher": p.publisher, "kind": p.kind or "press",
                       "kind_text": NEWS_KIND_TEXT.get(p.kind or "press", "Press release"), "topics": p.topics or []} for p in items],
            "next": items[-1].published_at.isoformat() if more and items else None,
            "topics": {t: t.capitalize() for t in NEWS_TOPICS} | {"labour": "Jobs", "business": "Business"},
            "kinds": NEWS_KIND_TEXT, "currencies": ORDER,
            "banks": {c: bank for c, _, bank, _, _ in CURRENCIES},
            "fetched_at": source.last_success_at.isoformat() if source and source.last_success_at else None,
            "disclaimer": DISCLAIMER,
        })
