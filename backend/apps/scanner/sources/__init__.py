"""
Data source adapters (docs/scanner/fundamental-bias-scanner.md §2). Each one
returns plain `Row`s; ingest.py stores them. Standard library only, with
certifi for TLS, a timeout, one retry and a clear User-Agent.
"""

import json
import math
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date

import certifi

USER_AGENT = "Mozilla/5.0 (compatible; EdgeProof-Scanner/1.0; education)"
_CTX = ssl.create_default_context(cafile=certifi.where())


class SourceError(Exception):
    pass


@dataclass
class Row:
    factor: str
    subject: str  # currency code ("EUR") or pair symbol ("EURUSD")
    period: date
    value: float
    freq: str  # D, W, M or Q
    series: str = ""
    extra: dict = field(default_factory=dict)


def get(url: str, *, timeout: int = 60, headers: dict | None = None, retries: int = 1) -> bytes:
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*", **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as res:
                return res.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            if isinstance(exc, urllib.error.HTTPError) and exc.code in (400, 401, 403, 404, 429):  # 429: rate limited, retrying makes it worse
                break
            time.sleep(2 * (attempt + 1))
    raise SourceError(f"{url.split('?')[0]}: {last}")


def get_json(url: str, **kw):
    return json.loads(get(url, **kw))


def get_text(url: str, **kw) -> str:
    return get(url, **kw).decode("utf-8", errors="replace")


def number(text) -> float | None:
    """A finite float, or None for blanks and the 'NaN' some providers use for closed days."""
    try:
        v = float(str(text).strip())
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


def parse_period(text: str) -> tuple[date, str]:
    """'2026-08' → (2026-08-01, M); '2026-Q2' → (2026-04-01, Q); '2026-10-13' → (that day, D)."""
    t = text.strip()
    if "-Q" in t:
        y, q = t.split("-Q")
        return date(int(y), (int(q) - 1) * 3 + 1, 1), "Q"
    parts = t.split("-")
    if len(parts) == 2:
        return date(int(parts[0]), int(parts[1]), 1), "M"
    return date(int(parts[0]), int(parts[1]), int(parts[2])), "D"
