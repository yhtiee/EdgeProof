"""
How the News calendar reads a release (docs/news.md): pure functions, no database.

A release is "above", "below" or "in line" with its forecast, compared at the precision the
forecast was printed with (the scoreboard's rule). Whether that's good or bad for the currency
is only said where the direction is known: higher prints help a currency (stronger data, or
hotter prices that point to tighter policy) except unemployment and jobless claims, where lower
is better. Releases outside the scanner's factors (trade balances, housing...) get no verdict.
"""

from apps.scanner.reference import FACTOR_LESSON, FACTOR_TEXT, INDICATORS, official_link
from apps.scanner.scoreboard import parse_number

LOWER_IS_BETTER = ("unemployment", "jobless", "claimant", "claims")
DEFAULT_LESSON = "l5-the-economic-calendar"


def surprise(actual: str, forecast: str) -> int | None:
    """+1 above the forecast, −1 below, 0 in line (at the forecast's precision); None without both figures."""
    a, f = parse_number(actual), parse_number(forecast)
    if not a or not f:
        return None
    _, mult, decimals = f
    diff = round(a[0] / mult, decimals) - round(f[0] / mult, decimals)
    diff = round(diff, 6)
    return (diff > 0) - (diff < 0)


def direction(title: str, factor: str, indicator: str) -> int | None:
    """+1 when a higher print helps the currency, −1 when a lower one does, None when we don't say."""
    if indicator in INDICATORS and INDICATORS[indicator][0] == "surprise":
        return -1 if INDICATORS[indicator][1] == "lower" else 1
    if factor not in ("inflation", "growth", "business", "labour", "rates"):
        return None
    if factor == "rates" and "rate" not in title.lower():
        return None  # speeches, minutes and press conferences have no figure
    return -1 if any(w in title.lower() for w in LOWER_IS_BETTER) else 1


def effect(actual: str, forecast: str, title: str, factor: str, indicator: str) -> str | None:
    """"good" or "bad" for the currency, or None when there's no surprise or no known direction."""
    s, d = surprise(actual, forecast), direction(title, factor, indicator)
    if not s or d is None:
        return None
    return "good" if s * d > 0 else "bad"


def about(factor: str) -> dict:
    """What a release measures, which scanner factor it moves, and the lesson that teaches it."""
    name, text = FACTOR_TEXT.get(factor, ("", ""))
    return {"factor_name": name, "factor_about": text, "lesson": FACTOR_LESSON.get(factor, DEFAULT_LESSON)}


def links(code: str, factor: str) -> dict:
    link = official_link(code, factor) if factor and factor != "cot" else None
    return {"official": {"label": link[0], "url": link[1]} if link else None}
