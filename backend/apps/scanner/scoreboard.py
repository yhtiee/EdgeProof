"""
The scoreboard engine (docs/scanner/scoreboard.md): pure functions, no database.
It follows a published retail method so its ranking can be checked against that
product: 18 whole-number columns summed per pair. Technical and sentiment
columns are scored per pair; macro columns per currency (−1, 0, +1), then base
minus quote. The momentum score and the final blend with the regime model are
here too, and so is the comparison against a benchmark table.
"""

from dataclasses import dataclass, field
from datetime import date, datetime

from .reference import (
    BOARD_COLUMNS,
    BOARD_LABELS,
    BOARD_MACRO,
    INDICATORS,
    MERGE,
    US_ONLY,
)


@dataclass
class Cell:
    """One currency's (or one pair's) value in one column, with what it was built from."""

    score: int | None
    status: str = "ok"  # ok | pending (no scored release yet) | none (no free source) | stale | missing
    detail: dict = field(default_factory=dict)


def _sign(x: float) -> int:
    return (x > 0) - (x < 0)


def _sma(values: list[float], n: int, offset: int = 0) -> float | None:
    end = len(values) - offset
    return sum(values[end - n:end]) / n if end >= n else None


# --- Technical and sentiment columns ------------------------------------------------------------


def trend(closes: list[float], cfg: dict) -> Cell:
    """3-day SMA above the 14-day = +2 (below = −2); a 14-day slope against the cross moves it one point to ±1."""
    fast, slow, lag = cfg.get("fast", 3), cfg.get("slow", 14), cfg.get("slope_lag", 5)
    f, s, s_then = _sma(closes, fast), _sma(closes, slow), _sma(closes, slow, lag)
    if None in (f, s, s_then):
        return Cell(None, "missing", {"reason": f"fewer than {slow + lag} daily closes"})
    rising = s > s_then
    score = (2 if rising else 1) if f > s else (-1 if rising else -2)
    return Cell(score, detail={"sma_fast": round(f, 5), "sma_slow": round(s, 5), "slow_rising": rising})


def seasonality(monthly: list[tuple[date, float, float]], month: int, as_of: date, cfg: dict) -> Cell:
    """+1 when the pair's average move in this calendar month (open to close) over the last N completed years is up, else −1."""
    years = cfg.get("years", 10)
    rets = [close / open_ - 1 for period, open_, close in monthly
            if period.month == month and as_of.year - years <= period.year < as_of.year and open_]
    if len(rets) < years // 2:
        return Cell(None, "missing", {"reason": f"{len(rets)} years of {month:02d} history"})
    avg = sum(rets) / len(rets)
    return Cell(1 if avg > 0 else -1, detail={"avg_pct": round(avg * 100, 3), "years": len(rets)})


def long_share(long_: float, short_: float) -> float | None:
    return long_ / (long_ + short_) if long_ + short_ else None


def cot_change(reports: list[dict]) -> Cell:
    """Per currency: +1 when speculators' long share (long ÷ long+short) rose on the week, −1 when it fell."""
    shares = [(r["period"], long_share(r["long"], r["short"])) for r in reports[-2:] if r.get("long") is not None]
    if len(shares) < 2 or None in (shares[0][1], shares[1][1]):
        return Cell(None, "missing", {"reason": "fewer than two weekly reports"})
    (_, a), (p1, b) = shares
    return Cell(_sign(b - a), detail={"long_share": round(b * 100, 2), "previous": round(a * 100, 2), "as_of": p1.isoformat()})


def cot_gold(reports: list[dict]) -> Cell:
    """Gold: the weekly change (±1) plus the side of the net position (±1), so −2…+2."""
    change = cot_change(reports)
    if change.score is None:
        return change
    last = reports[-1]
    net = _sign(last["long"] - last["short"])
    return Cell(change.score + net, detail={**change.detail, "net": last["long"] - last["short"]})


def crowd(long_pct: float | None, cfg: dict) -> Cell:
    """Contrarian: 60% or more long = −1, 40% or less long = +1, otherwise 0."""
    if long_pct is None:
        return Cell(None, "missing", {"reason": "no sentiment reading"})
    hi, lo = cfg.get("long", 60), cfg.get("short", 40)
    return Cell(-1 if long_pct >= hi else 1 if long_pct <= lo else 0, detail={"long_pct": round(long_pct, 1)})


# --- Macro columns (per currency) ---------------------------------------------------------------


SUFFIX = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}


def parse_number(text: str) -> tuple[float, float, int] | None:
    """A calendar figure → (value in base units, unit multiplier, decimals shown): "7.20M" → (7200000.0, 1e6, 2); "0.3%" → (0.3, 1, 1)."""
    t = (text or "").strip().replace(",", "").replace("%", "").lstrip("<>")
    if not t:
        return None
    mult = SUFFIX.get(t[-1].upper(), 1)
    if mult != 1:
        t = t[:-1]
    try:
        v = float(t)
    except ValueError:
        return None
    return v * mult, mult, len(t.split(".")[1]) if "." in t else 0


def release_score(indicator: str, actual: float | None, forecast: float | None, previous: float | None, forecast_text: str = "") -> int | None:
    """A single release: beat (+1), in line (0) or miss (−1) on the column's rule; inverted where lower is better."""
    rule, better = INDICATORS[indicator]
    if actual is None:
        return None
    if rule == "surprise":
        if forecast is None:
            return None
        shown = parse_number(forecast_text)
        if shown:  # compare at the forecast's precision, in its units: 7.195M against "7.20M" is in line
            _, mult, decimals = shown
            diff = round(actual / mult, decimals) - round(forecast / mult, decimals)
        else:
            diff = actual - forecast
    else:
        if previous is None:
            return None
        diff = actual - previous
    s = _sign(round(diff, 6))
    return -s if better == "lower" else s


def macro_cell(indicator: str, releases: list[dict], as_of: datetime, max_age_days: int) -> Cell:
    """The latest release up to `as_of` that can be scored; pending when none can yet; stale when it's too old."""
    seen_pending = False
    for r in sorted(releases, key=lambda r: r["at"], reverse=True):
        if r["at"] > as_of:
            continue
        s = release_score(indicator, r.get("actual"), r.get("forecast"), r.get("previous"), r.get("forecast_text", ""))
        if s is None:
            seen_pending = True
            continue
        age = (as_of - r["at"]).days
        detail = {k: r.get(k) for k in ("title", "actual", "forecast", "forecast_text", "previous", "actual_source")}
        detail.update(at=r["at"].isoformat(), age_days=age)
        if age > max_age_days:
            return Cell(None, "stale", detail)
        return Cell(s, detail=detail)
    return Cell(None, "pending" if seen_pending or releases else "missing", {})


def rate_outlook(outlook: dict | None, upcoming: dict | None, policy: float | None, market_3m: float | None, cfg: dict) -> Cell:
    """
    Expected direction of the policy rate over the next quarter. A set house view wins; else the
    next listed decision's forecast against the current rate; else the 3-month market rate
    against the policy rate (±band). 0 when nothing points either way.
    """
    if outlook is not None:
        return Cell(outlook["direction"], detail={"basis": "house view", **outlook})
    if upcoming and upcoming.get("forecast") is not None and policy is not None and round(upcoming["forecast"] - policy, 4):
        return Cell(_sign(upcoming["forecast"] - policy), detail={"basis": "next decision forecast", "rate": policy, **upcoming})
    if policy is None or market_3m is None:
        return Cell(0, "missing", {"reason": "no outlook, forecast or market rate"})
    spread = market_3m - policy
    band = cfg.get("band", 0.10)
    return Cell(_sign(spread) if abs(spread) > band else 0, detail={"basis": "3-month rate vs policy rate", "rate": policy,
                                                                    "market_3m": round(market_3m, 3), "spread": round(spread, 3)})


def gold_rates(yields: list[float], cfg: dict) -> Cell:
    """Gold: the US 2-year yield above its 7-day average = −1 (higher yields weigh on gold), below = +1."""
    n = cfg.get("ma_days", 7)
    if len(yields) < n:
        return Cell(None, "missing", {"reason": "fewer than 7 days of US 2-year yields"})
    ma = sum(yields[-n:]) / n
    last = yields[-1]
    return Cell(-_sign(last - ma), detail={"us2y": last, "ma": round(ma, 3), "basis": "US 2-year yield vs its 7-day average"})


# --- Pair rows ------------------------------------------------------------------------------------


def pair_row(base: str, quote: str, tech: dict[str, Cell], macro: dict[str, dict[str, Cell]], gold_rate: Cell | None = None) -> dict:
    """
    The 18 columns for one pair. Macro columns are base minus quote; a missing side counts 0
    (US-only data is 0 for the other currency). Gold (base XAU) has no macro of its own, so its
    macro columns are the USD side reversed, except rates, which has gold's own rule.
    """
    cols: dict[str, dict] = {}
    for c in ("trend", "seasonality", "crowd"):
        cell = tech.get(c) or Cell(None, "missing")
        cols[c] = {"score": cell.score, "status": cell.status, "detail": cell.detail}
    cot = tech.get("cot") or Cell(None, "missing")
    cols["cot"] = {"score": cot.score, "status": cot.status, "detail": cot.detail}
    for ind in BOARD_MACRO:
        if ind == "rates" and gold_rate is not None:
            cols[ind] = {"score": gold_rate.score, "status": gold_rate.status, "detail": gold_rate.detail}
            continue
        b = macro.get(base, {}).get(ind)
        q = macro.get(quote, {}).get(ind)
        sides = {"base": _side(b), "quote": _side(q)}
        if ind in US_ONLY and "USD" not in (base, quote):
            cols[ind] = {"score": 0, "status": "na", "sides": sides}  # US-only data: not part of this pair
            continue
        if (b is None or b.score is None) and (q is None or q.score is None):
            known = [c for c in (b, q) if c is not None]
            status = "none" if known and all(c.status == "none" for c in known) else "pending"
            cols[ind] = {"score": None, "status": status, "sides": sides}
            continue
        score = (b.score if b and b.score is not None else 0) - (q.score if q and q.score is not None else 0)
        cols[ind] = {"score": score, "status": "ok", "sides": sides}
    total = sum(c["score"] for c in cols.values() if c["score"] is not None)
    return {"columns": cols, "score": total, "label": board_label(total),
            "filled": sum(1 for c in cols.values() if c["score"] is not None and c["status"] == "ok")}


def _side(cell: Cell | None) -> dict | None:
    return None if cell is None else {"score": cell.score, "status": cell.status, "detail": cell.detail}


def board_label(score: int | None) -> str:
    if score is None:
        return "insufficient"
    for cut, label in BOARD_LABELS:
        if score >= cut:
            return label
    return "very_bearish"


def board_rank(scores: dict[str, int | None]) -> dict[str, int]:
    """Signed order: the most bullish first, the most bearish last (ties alphabetical)."""
    ordered = sorted((s, sym) for sym, s in scores.items() if s is not None)
    ordered.sort(key=lambda t: (-t[0], t[1]))
    return {sym: i + 1 for i, (_, sym) in enumerate(ordered)}


# --- Momentum and the final blend --------------------------------------------------------------


def momentum(row: dict, min_columns: int = MERGE["min_macro_columns"]) -> float | None:
    """Macro columns and seasonality from the scoreboard, scaled to −10…+10 over the columns that have data."""
    macro = [row["columns"][c]["score"] for c in BOARD_MACRO if row["columns"][c]["status"] == "ok"]
    if len(macro) < min_columns:
        return None
    season = row["columns"]["seasonality"]["score"]
    parts, span = sum(macro), 2 * len(macro)
    if season is not None:
        parts, span = parts + season, span + 1
    return round(parts / span * 10, 2)


def final_bias(regime: float | None, momentum_: float | None, weights: dict = MERGE) -> tuple[float | None, bool]:
    """Weighted blend; one side missing → the other alone. Mixed when both are at least ±mixed_at and disagree."""
    parts = [(weights["regime"], regime), (weights["momentum"], momentum_)]
    present = [(w, v) for w, v in parts if v is not None]
    if not present:
        return None, False
    score = round(sum(w * v for w, v in present) / sum(w for w, _ in present), 2)
    at = weights.get("mixed_at", 2.0)
    mixed = regime is not None and momentum_ is not None and abs(regime) >= at and abs(momentum_) >= at and _sign(regime) != _sign(momentum_)
    return score, mixed


# --- Comparison against a benchmark table ------------------------------------------------------


def _spearman(a: list[float], b: list[float]) -> float | None:
    def ranks(xs):
        order = sorted(range(len(xs)), key=lambda i: xs[i])
        r = [0.0] * len(xs)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return r

    n = len(a)
    if n < 3:
        return None
    ra, rb = ranks(a), ranks(b)
    ma, mb = sum(ra) / n, sum(rb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va, vb = sum((x - ma) ** 2 for x in ra), sum((y - mb) ** 2 for y in rb)
    return round(cov / (va * vb) ** 0.5, 3) if va and vb else None


def compare(ours: dict[str, dict], bench: dict[str, dict]) -> dict:
    """
    How closely our board matches a benchmark: per-column agreement on cells we have data for,
    label agreement, rank correlation and top/bottom-5 overlap. `ours[sym]` is a pair_row;
    `bench[sym]` maps each column (and "score") to an int.
    """
    syms = sorted(set(ours) & set(bench))
    columns = {}
    for c in BOARD_COLUMNS:
        compared = [s for s in syms if ours[s]["columns"][c]["status"] in ("ok", "na") and ours[s]["columns"][c]["score"] is not None]
        hits = [s for s in compared if ours[s]["columns"][c]["score"] == bench[s][c]]
        columns[c] = {"compared": len(compared), "agree": len(hits), "rate": round(len(hits) / len(compared), 3) if compared else None,
                      "misses": [f"{s}: {ours[s]['columns'][c]['score']} vs {bench[s][c]}" for s in compared if s not in hits]}
    label_hits = sum(1 for s in syms if ours[s]["label"] == board_label(bench[s]["score"]))
    our_scores, their_scores = [ours[s]["score"] for s in syms], [bench[s]["score"] for s in syms]
    top = lambda d, rev: {s for s, _ in sorted(d.items(), key=lambda t: (-t[1] if rev else t[1], t[0]))[:5]}
    ours_map, bench_map = dict(zip(syms, our_scores)), dict(zip(syms, their_scores))
    cells = sum(v["compared"] for v in columns.values())
    return {
        "pairs": len(syms), "columns": columns,
        "cell_rate": round(sum(v["agree"] for v in columns.values()) / cells, 3) if cells else None,
        "label_rate": round(label_hits / len(syms), 3) if syms else None,
        "spearman": _spearman(our_scores, their_scores),
        "top5_overlap": len(top(ours_map, True) & top(bench_map, True)),
        "bottom5_overlap": len(top(ours_map, False) & top(bench_map, False)),
        "score_diffs": {s: ours_map[s] - bench_map[s] for s in syms},
    }
