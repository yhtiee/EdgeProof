"""
Forex Factory weekly calendar (founder request): this week's and next week's scheduled
releases with forecast and previous values. It has no actual figures; those come from
the official sources the scores use. Unofficial feed: fetched at most a few times a day,
cached in our database, shown with a link back.
"""

import json
from dataclasses import dataclass
from datetime import datetime

from ..reference import CALENDAR_FACTORS, CALENDAR_FEEDS, CALENDAR_IMPACTS, ORDER
from . import SourceError, get


@dataclass
class Event:
    currency: str
    title: str
    at: datetime
    impact: str
    forecast: str
    previous: str
    factor: str


def factor_for(title: str) -> str:
    lower = title.lower()
    for factor, words in CALENDAR_FACTORS:
        if any(w in lower for w in words):
            return factor
    return ""


def parse(data: list[dict]) -> list[Event]:
    out = []
    for e in data:
        code, impact, title = e.get("country", ""), e.get("impact", ""), (e.get("title") or "").strip()
        if code not in ORDER or impact not in CALENDAR_IMPACTS or not title:
            continue
        try:
            at = datetime.fromisoformat(e["date"])
        except (KeyError, ValueError):
            continue
        out.append(Event(code, title[:200], at, impact, str(e.get("forecast") or "")[:40], str(e.get("previous") or "")[:40], factor_for(title)))
    return out


def fetch_all() -> tuple[list[Event], list[str]]:
    """This week (required) and next week (only published late in the week; a 404 is normal)."""
    events, errors = [], []
    for i, url in enumerate(CALENDAR_FEEDS):
        try:
            events.extend(parse(json.loads(get(url, timeout=30, retries=0 if i else 1))))
        except (SourceError, ValueError) as exc:
            if i == 0:
                errors.append(str(exc)[:200])
    return events, errors
