"""Source and factor health (spec `check_health` and `GET /scanner/status`)."""

from datetime import timedelta

from django.utils import timezone

from .models import DataSource, ScoringRun
from .sources.providers import SOURCES

# A source is overdue when it hasn't succeeded within this many days.
EXPECTED_DAYS = {"cftc": 8, "bis": 2, "oecd": 3, "eurostat": 3, "fred": 3, "snb": 3, "dbnomics": 3, "twelvedata": 2, "myfxbook": 2, "news": 2, "calendar": 2}


def health() -> dict:
    now = timezone.now()
    sources = []
    known = {s.name: s for s in DataSource.objects.all()}
    for name in SOURCES:
        s = known.get(name)
        overdue = not s or not s.last_success_at or now - s.last_success_at > timedelta(days=EXPECTED_DAYS[name])
        failing = bool(s and s.last_error and (not s.last_success_at or (s.last_error_at and s.last_error_at > s.last_success_at)))
        sources.append({
            "name": name,
            "ok": not overdue and not failing,
            "last_success_at": s.last_success_at.isoformat() if s and s.last_success_at else None,
            "last_error": (s.last_error if failing else "") if s else "Never fetched",
        })
    latest = ScoringRun.objects.filter(is_replay=False).order_by("-finished_at").first()
    return {
        "last_run_at": latest.finished_at.isoformat() if latest and latest.finished_at else None,
        "as_of": latest.as_of.isoformat() if latest else None,
        "stale": (latest.notes or {}).get("stale", []) if latest else [],
        "insufficient": (latest.notes or {}).get("insufficient", []) if latest else [],
        "sources": sources,
    }
