"""
The scoring engine (spec "Scoring methodology"): pure functions, no database.
Observations go in; factor scores (−2…+2), currency scores and pair scores
(−10…+10), labels and ranks come out. The run builder (services.py) feeds it
only data available on the run's `as_of` date, so the same code scores today
and replays history without look-ahead.
"""

import calendar
from dataclasses import dataclass, field
from datetime import date, timedelta
from itertools import pairwise

from .reference import FACTORS_CURRENCY, LABEL_TEXT, RELEASE_LAG_DAYS

PAIR_WEIGHTS = {"difference": 0.7, "trend": 0.15, "retail": 0.15}


@dataclass(frozen=True)
class Obs:
    period: date
    value: float
    freq: str = "M"  # D, W, M or Q
    released: date | None = None
    extra: dict = field(default_factory=dict, hash=False, compare=False)

    def period_end(self) -> date:
        if self.freq == "M":
            return self.period.replace(day=calendar.monthrange(self.period.year, self.period.month)[1])
        if self.freq == "Q":
            month = ((self.period.month - 1) // 3) * 3 + 3
            return date(self.period.year, month, calendar.monthrange(self.period.year, month)[1])
        return self.period

    def available(self, factor: str) -> date:
        """When the market could know this value: its release date, or an estimate from the period end."""
        return self.released or self.period_end() + timedelta(days=RELEASE_LAG_DAYS.get(factor, 0))


@dataclass
class FactorResult:
    factor: str
    score: int | None
    raw: float | None
    stale: bool = False
    detail: dict = field(default_factory=dict)


# --- Factor rules ------------------------------------------------------------------------


def score_cot(series: list[Obs], cfg: dict) -> FactorResult:
    """52-week percentile of the net non-commercial position."""
    window = series[-cfg.get("lookback_weeks", 52):]
    if len(window) < 10:
        return FactorResult("cot", None, None, detail={"reason": "fewer than 10 weekly reports"})
    current = window[-1].value
    below = sum(1 for o in window if o.value < current)
    equal = sum(1 for o in window if o.value == current)
    pct = (below + 0.5 * equal) / len(window) * 100
    p20, p40, p60, p80 = cfg.get("percentiles", [20, 40, 60, 80])
    score = 2 if pct >= p80 else 1 if pct >= p60 else 0 if pct >= p40 else -1 if pct >= p20 else -2
    return FactorResult("cot", score, current, detail={"percentile": round(pct, 1), "weeks": len(window), "as_of": window[-1].period.isoformat(), **window[-1].extra})


def score_rates(series: list[Obs], cfg: dict, as_of: date) -> FactorResult:
    """Hiked/cut within ~6 months = ±2; holding after a hike/cut = ±1; no change in 2 years = 0."""
    if not series:
        return FactorResult("rates", None, None)
    min_move = cfg.get("min_move", 0.05)
    last_change = None
    for prev, cur in pairwise(series):
        if abs(cur.value - prev.value) >= min_move:
            last_change = (cur.period, cur.value - prev.value)
    current = series[-1].value
    detail = {"rate": current, "as_of": series[-1].period.isoformat()}
    if not last_change:
        return FactorResult("rates", 0, current, detail={**detail, "cycle": "no change in the data"})
    when, move = last_change
    age = (as_of - when).days
    detail.update({"last_change": when.isoformat(), "change": round(move, 3)})
    if age > cfg.get("cycle_days", 730):
        return FactorResult("rates", 0, current, detail={**detail, "cycle": "holding, no clear cycle"})
    recent = age <= cfg.get("recent_days", 183)
    if move > 0:
        return FactorResult("rates", 2 if recent else 1, current, detail={**detail, "cycle": "hiked recently" if recent else "holding after hikes"})
    return FactorResult("rates", -2 if recent else -1, current, detail={**detail, "cycle": "cut recently" if recent else "holding after cuts"})


def _back(series: list[Obs], months: int) -> Obs | None:
    """The observation about `months` earlier (one step back per quarter for quarterly series)."""
    if not series:
        return None
    steps = max(1, months // 3) if series[-1].freq == "Q" else months
    return series[-1 - steps] if len(series) > steps else None


def score_inflation(series: list[Obs], cfg: dict, target: float) -> FactorResult:
    if len(series) < 2:
        return FactorResult("inflation", None, None)
    current, earlier = series[-1], _back(series, cfg.get("lookback_months", 3))
    if earlier is None:
        return FactorResult("inflation", None, current.value)
    band = cfg.get("band", 0.5)
    rising = current.value > earlier.value
    gap = current.value - target
    if abs(gap) <= band:
        score = 0
    elif gap > 0:
        score = 2 if rising else 1
    else:
        score = -1 if rising else -2
    return FactorResult("inflation", score, current.value, detail={
        "target": target, "earlier": earlier.value, "earlier_period": earlier.period.isoformat(),
        "rising": rising, "as_of": current.period.isoformat(),
    })


def score_growth(series: list[Obs], cfg: dict) -> FactorResult:
    if len(series) < 2:
        return FactorResult("growth", None, None)
    avg = (series[-1].value + series[-2].value) / 2
    c1, c2, c3, c4 = cfg.get("cuts", [-0.2, 0.0, 0.2, 0.5])
    score = 2 if avg > c4 else 1 if avg >= c3 else 0 if avg >= c2 else -1 if avg >= c1 else -2
    return FactorResult("growth", score, round(avg, 3), detail={
        "quarters": [series[-2].value, series[-1].value], "as_of": series[-1].period.isoformat(),
    })


def score_labour(series: list[Obs], cfg: dict) -> FactorResult:
    if len(series) < 2:
        return FactorResult("labour", None, None)
    earlier = _back(series, 3)
    if earlier is None:
        return FactorResult("labour", None, series[-1].value)
    change = round(series[-1].value - earlier.value, 2)
    small, large = cfg.get("cuts", [0.1, 0.3])
    if change <= -large:
        score = 2
    elif change <= -small:
        score = 1
    elif change < small:
        score = 0
    elif change < large:
        score = -1
    else:
        score = -2
    return FactorResult("labour", score, change, detail={
        "rate": series[-1].value, "earlier": earlier.value, "earlier_period": earlier.period.isoformat(), "as_of": series[-1].period.isoformat(),
    })


def score_business(series: list[Obs], cfg: dict) -> FactorResult:
    if len(series) < 2:
        return FactorResult("business", None, None)
    current, prev = series[-1].value, series[-2].value
    rising = current > prev
    lo, hi = cfg.get("neutral_low", 99.8), cfg.get("neutral_high", 100.2)
    if current > hi:
        score = 2 if rising else 1
    elif current >= lo:
        score = 0
    else:
        score = -1 if rising else -2
    return FactorResult("business", score, current, detail={"previous": prev, "rising": rising, "as_of": series[-1].period.isoformat()})


def sma(values: list[float], n: int, offset: int = 0) -> float | None:
    end = len(values) - offset
    if end < n:
        return None
    return sum(values[end - n:end]) / n


def score_trend(closes: list[Obs], cfg: dict) -> FactorResult:
    values = [o.value for o in closes]
    m20, m50, m200 = (sma(values, n) for n in cfg.get("mas", [20, 50, 200]))
    m50_then = sma(values, 50, cfg.get("slope_lag", 10))
    if None in (m20, m50, m200, m50_then):
        return FactorResult("trend", None, values[-1] if values else None, detail={"reason": "fewer than 210 daily closes"})
    last = values[-1]
    signals = {
        "above_20": last > m20, "above_50": last > m50, "above_200": last > m200, "slope_50_up": m50 > m50_then,
    }
    net = sum(1 if v else -1 for v in signals.values())
    score = 2 if net == 4 else 1 if net >= 2 else 0 if net >= -1 else -1 if net >= -3 else -2
    return FactorResult("trend", score, last, detail={
        "net": net, **signals, "sma20": round(m20, 5), "sma50": round(m50, 5), "sma200": round(m200, 5), "as_of": closes[-1].period.isoformat(),
    })


def score_retail(obs: Obs | None, cfg: dict) -> FactorResult:
    """Contrarian: a crowd heavily long scores bearish."""
    if obs is None:
        return FactorResult("retail", None, None)
    long_pct = obs.value
    a, b, c, d = cfg.get("long_cuts", [25, 40, 60, 75])
    score = 2 if long_pct <= a else 1 if long_pct <= b else 0 if long_pct < c else -1 if long_pct < d else -2
    sample = obs.extra.get("sample")
    return FactorResult("retail", score, long_pct, detail={
        "long_pct": long_pct, "sample": sample, "small_sample": bool(sample is not None and sample < cfg.get("small_sample", 500)),
        "as_of": obs.period.isoformat(),
    })


# --- Combining ------------------------------------------------------------------------


def label_for(score: float | None) -> str:
    if score is None:
        return "insufficient"
    s = round(score, 2)
    if s >= 6:
        return "very_bullish"
    if s >= 2:
        return "bullish"
    if s > -2:
        return "neutral"
    if s > -6:
        return "bearish"
    return "very_bearish"


def currency_score(results: dict[str, FactorResult], weights: dict[str, float], max_missing: int = 2) -> tuple[float | None, int]:
    """C = Σ w·f / (2·Σ w) × 10 over the factors present; more than `max_missing` missing → insufficient."""
    used = {f: r for f, r in results.items() if f in weights and r.score is not None and not r.stale}
    missing = len(FACTORS_CURRENCY) - len(used)
    if missing > max_missing or not used:
        return None, len(used)
    total_w = sum(weights[f] for f in used)
    c = sum(weights[f] * r.score for f, r in used.items()) / (2 * total_w) * 10
    return round(c, 2), len(used)


def pair_score(c_base: float | None, c_quote: float | None, trend: FactorResult, retail: FactorResult) -> tuple[float | None, dict]:
    """P = 0.7·(C_base − C_quote)/2 + 0.15·5T + 0.15·5R, renormalising if T or R is missing."""
    if c_base is None or c_quote is None:
        return None, {"reason": "insufficient data for one currency"}
    parts = {"difference": (c_base - c_quote) / 2}
    for r in (trend, retail):
        if r.score is not None and not r.stale:
            parts[r.factor] = 5 * r.score
    total_w = sum(PAIR_WEIGHTS[k] for k in parts)
    p = sum(PAIR_WEIGHTS[k] * v for k, v in parts.items()) / total_w
    contrib = {k: round(PAIR_WEIGHTS[k] * v / total_w, 3) for k, v in parts.items()}
    return round(p, 2), {"components": {k: round(v, 3) for k, v in parts.items()}, "contributions": contrib, "weights_used": round(total_w, 2)}


def agreement(score: float | None, base: dict[str, FactorResult], quote: dict[str, FactorResult], trend: FactorResult, retail: FactorResult) -> dict:
    """How many factors point the same way as the pair score (analyst addition; display only)."""
    if not score:
        return {"agree": 0, "of": 0}
    direction = 1 if score > 0 else -1
    signs = []
    for f, r in base.items():
        q = quote.get(f)
        if r.score is not None and not r.stale and q and q.score is not None and not q.stale and r.score != q.score:
            signs.append(1 if r.score > q.score else -1)
    for r in (trend, retail):
        if r.score and not r.stale:
            signs.append(1 if r.score > 0 else -1)
    return {"agree": sum(1 for s in signs if s == direction), "of": len(signs)}


def rank(pairs: dict[str, tuple[float | None, float | None]]) -> dict[str, int]:
    """Rank by |score|, highest first; ties go to the larger |week-on-week change|."""
    scored = [(sym, s, c) for sym, (s, c) in pairs.items() if s is not None]
    scored.sort(key=lambda t: (-abs(t[1]), -abs(t[2] or 0), t[0]))
    return {sym: i + 1 for i, (sym, _, _) in enumerate(scored)}


__all__ = ["LABEL_TEXT", "FactorResult", "Obs", "agreement", "currency_score", "label_for", "pair_score", "rank"]
