"""
Central bank publications (evidence panel): press releases, decisions, minutes and
speeches from each bank's own RSS or Atom feed. Primary sources only, no news API.
Each item is tagged with the factors it speaks to; untagged items are dropped.
"""

import html
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

from ..reference import CENTRAL_BANK_FEEDS, CURRENCIES, NEWS_EXCLUDE, NEWS_TOPICS
from . import SourceError, get

BANK = {code: bank for code, _, bank, _, _ in CURRENCIES}
TAGS = re.compile(r"<[^>]+>")
SPACE = re.compile(r"\s+")
DATE_PREFIX = re.compile(r"^\d{4}-\d{2}-\d{2}\s*-\s*")  # SNB titles start "2026-10-01 - "
TOPIC_RE = {f: re.compile(r"\b(?:" + "|".join(re.escape(w) for w in words) + r")\b") for f, words in NEWS_TOPICS.items()}


@dataclass
class Item:
    currency: str
    title: str
    url: str
    published_at: datetime
    summary: str = ""
    topics: list[str] = field(default_factory=list)
    source: str = ""


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _text(el) -> str:
    return SPACE.sub(" ", html.unescape(TAGS.sub(" ", "".join(el.itertext()) if el is not None else ""))).strip()


def _date(text: str) -> datetime | None:
    text = (text or "").strip()
    if not text:
        return None
    try:
        d = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def topics_for(text: str) -> list[str]:
    lower = text.lower()
    if any(word in lower for word in NEWS_EXCLUDE):
        return []
    return [f for f, rx in TOPIC_RE.items() if rx.search(lower)]


def parse(xml: bytes, currency: str) -> list[Item]:
    """Items from an RSS 2.0, RSS 1.0 (RDF) or Atom document."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        raise SourceError(f"{currency} feed: not XML ({exc})") from exc
    out = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        fields = {_local(c.tag): c for c in el}
        title = DATE_PREFIX.sub("", _text(fields.get("title")))
        link_el = fields.get("link")
        url = ""
        if link_el is not None:
            url = (link_el.get("href") or link_el.text or "").strip()
        if not url:
            url = (el.get("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about") or "").strip()
        if url.startswith("http://"):
            url = "https://" + url[7:]  # the Bank of Japan's feed links over http; its site serves https
        when = None
        for name in ("pubdate", "date", "published", "updated"):
            if name in fields:
                when = _date(fields[name].text or "")
                if when:
                    break
        # Not `a or b`: an Element with no children is falsy.
        body = next((fields[k] for k in ("description", "summary", "content") if fields.get(k) is not None), None)
        summary = _text(body)
        if not title or not url.startswith("https://") or not when:
            continue
        if summary.lower().startswith(title.lower()[:60]):
            summary = ""  # some feeds repeat the title as the description
        if len(summary) > 400:
            summary = summary[:400].rsplit(" ", 1)[0] + "…"
        out.append(Item(currency, title[:300], url[:500], when, summary, topics_for(f"{title} {summary}"), BANK[currency]))
    return out


def fetch_all() -> tuple[list[Item], list[str]]:
    """Every item from every feed, and the feeds that failed (one failure doesn't stop the rest)."""
    items, errors = [], []
    for code, urls in CENTRAL_BANK_FEEDS.items():
        for url in urls:
            try:
                items.extend(parse(get(url, timeout=30), code))
            except SourceError as exc:
                errors.append(str(exc)[:200])
    return items, errors
