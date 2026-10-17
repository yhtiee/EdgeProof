"""
Core metrics (spec §8). Deterministic code over plain trade records, with
no database access, so it can be tested against known datasets. AI may
explain these numbers but never computes them.

All results are in R (JR-4). The sample for R-based metrics is every closed
trade with an initial stop; trades without one are rule breaks and only
count toward rule-following.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np

BREAKEVEN_R = 0.1
RESAMPLES = 10_000
SEED = 20_241  # fixed so the same trades always give the same ranges
MIN_FOR_RANGES = 20  # below this, ranges would mislead more than inform
COSTS_WARNING_SHARE = 0.20
SMALL_STOP_PIPS = 10


@dataclass
class TradeRecord:
    r: float | None
    opened_at: datetime
    closed_at: datetime | None
    rules_followed: bool
    instrument: str = ""
    session: str = ""
    setup: str = ""
    emotion: str = ""
    account: str = ""
    cost_r: float = 0.0  # fees and swap paid, in R (≥ 0 is a cost)
    stop_pips: float | None = None
    weekday: int | None = None  # in the user's timezone, Monday = 0
    tags: list = field(default_factory=list)


def classify(r: float) -> str:
    if abs(r) < BREAKEVEN_R:
        return "breakeven"
    return "win" if r > 0 else "loss"


def max_drawdown(rs: np.ndarray) -> float:
    """Largest peak-to-trough fall of the cumulative R curve, starting from 0."""
    if rs.size == 0:
        return 0.0
    curve = np.concatenate([[0.0], np.cumsum(rs)])
    return float(np.max(np.maximum.accumulate(curve) - curve))


def longest_losing_streak(rs: np.ndarray) -> int:
    best = run = 0
    for r in rs:
        run = run + 1 if r <= -BREAKEVEN_R else 0
        best = max(best, run)
    return best


def monte_carlo(rs: np.ndarray, rng: np.random.Generator, paths: int = RESAMPLES) -> dict:
    """Shuffles trade order: what drawdown and losing streak to expect (5th/50th/95th percentiles)."""
    n = rs.size
    orders = rng.permuted(np.tile(rs, (paths, 1)), axis=1)
    curves = np.concatenate([np.zeros((paths, 1)), np.cumsum(orders, axis=1)], axis=1)
    drawdowns = np.max(np.maximum.accumulate(curves, axis=1) - curves, axis=1)
    losses = orders <= -BREAKEVEN_R
    idx = np.arange(n)
    last_break = np.maximum.accumulate(np.where(~losses, idx, -1), axis=1)
    streaks = np.max(np.where(losses, idx - last_break, 0), axis=1)
    pct = lambda a: [float(np.percentile(a, p)) for p in (5, 50, 95)]
    return {"drawdown_r": pct(drawdowns), "losing_streak": [round(x) for x in pct(streaks)]}


def block_bootstrap(rs: np.ndarray, weeks: np.ndarray, rng: np.random.Generator, resamples: int = RESAMPLES) -> dict:
    """
    Expectancy range from a weekly block bootstrap (spec §8): whole weeks are
    resampled, so streaks inside a week stay together. Also estimates how
    often results this good could appear with no edge at all.
    """
    labels, inverse = np.unique(weeks, return_inverse=True)
    sums = np.bincount(inverse, weights=rs)
    counts = np.bincount(inverse)
    b = labels.size
    picks = rng.integers(0, b, size=(resamples, b))
    means = sums[picks].sum(axis=1) / counts[picks].sum(axis=1)
    # No-edge world: the same trades shifted so their average is exactly 0.
    centred = sums - counts * rs.mean()
    null_means = centred[picks].sum(axis=1) / counts[picks].sum(axis=1)
    observed = float(rs.mean())
    return {
        "low": float(np.percentile(means, 5)),
        "median": float(np.percentile(means, 50)),
        "high": float(np.percentile(means, 95)),
        "lower_bound_90": float(np.percentile(means, 10)),  # one-sided 90%
        "no_edge_pct": float(np.mean(null_means >= observed) * 100) if observed > 0 else None,
        "blocks": int(b),
    }


def clusters(records: list[TradeRecord]) -> int:
    """Trades that overlap in time and share a currency count once (spec §8)."""
    items = sorted((r for r in records if r.closed_at), key=lambda r: r.opened_at)
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(items):
        ccy_a = {a.instrument[:3], a.instrument[-3:]}
        for j in range(i + 1, len(items)):
            b = items[j]
            if b.opened_at >= a.closed_at:
                break
            if ccy_a & {b.instrument[:3], b.instrument[-3:]}:
                parent[find(j)] = find(i)
    return len({find(i) for i in range(len(items))})


def summarise(rs: np.ndarray) -> dict:
    wins, losses = rs[rs >= BREAKEVEN_R], rs[rs <= -BREAKEVEN_R]
    n = int(rs.size)
    return {
        "trades": n,
        "wins": int(wins.size),
        "losses": int(losses.size),
        "breakevens": n - int(wins.size) - int(losses.size),
        "win_rate": float(wins.size / n) if n else None,
        "expectancy": float(rs.mean()) if n else None,
        "total_r": float(rs.sum()),
        "avg_win": float(wins.mean()) if wins.size else None,
        "avg_loss": float(losses.mean()) if losses.size else None,
        "profit_factor": float(wins.sum() / abs(losses.sum())) if losses.size else None,
    }


def breakdown(records: list[TradeRecord], key) -> list[dict]:
    groups: dict = defaultdict(list)
    for r in records:
        k = key(r)
        if k not in (None, ""):
            groups[k].append(r.r)
    rows = []
    for k, rs in groups.items():
        arr = np.array(rs, dtype=float)
        s = summarise(arr)
        rows.append({"key": str(k), "trades": s["trades"], "total_r": s["total_r"], "expectancy": s["expectancy"], "win_rate": s["win_rate"]})
    return sorted(rows, key=lambda row: row["total_r"], reverse=True)


def compute(records: list[TradeRecord], seed: int = SEED) -> dict:
    closed = [r for r in records if r.closed_at is not None]
    sample = sorted((r for r in closed if r.r is not None), key=lambda r: r.closed_at)
    rs = np.array([r.r for r in sample], dtype=float)
    rng = np.random.default_rng(seed)

    out = summarise(rs)
    out["closed"] = len(closed)
    out["open"] = len(records) - len(closed)
    out["excluded_no_stop"] = len(closed) - len(sample)
    out["independent_trades"] = clusters(sample)
    out["max_drawdown_r"] = max_drawdown(rs)
    out["longest_losing_streak"] = longest_losing_streak(rs)

    out["rule_following_rate"] = float(np.mean([r.rules_followed for r in closed])) if closed else None
    broken = [r.r for r in sample if not r.rules_followed]
    out["rule_breaking_cost_r"] = float(sum(broken))
    out["rule_broken_trades"] = sum(1 for r in closed if not r.rules_followed)

    costs = float(sum(r.cost_r for r in sample))
    gross = float(rs.sum()) + costs
    out["costs_r"] = costs
    out["costs_share"] = costs / gross if gross > 0 else None
    stops = [r.stop_pips for r in sample if r.stop_pips]
    out["avg_stop_pips"] = float(np.mean(stops)) if stops else None
    out["warnings"] = []
    if out["costs_share"] is not None and out["costs_share"] > COSTS_WARNING_SHARE:
        out["warnings"].append("costs_high")
    if out["avg_stop_pips"] is not None and out["avg_stop_pips"] < SMALL_STOP_PIPS:
        out["warnings"].append("stops_small")

    if rs.size >= MIN_FOR_RANGES:
        weeks = np.array([r.closed_at.isocalendar()[:2] for r in sample]).dot([100, 1])
        out["expectancy_range"] = block_bootstrap(rs, weeks, rng)
        out["expected"] = monte_carlo(rs, rng)
    else:
        out["expectancy_range"] = None
        out["expected"] = None
    out["min_for_ranges"] = MIN_FOR_RANGES

    out["curve"] = [{"t": r.closed_at.isoformat(), "r": float(c)} for r, c in zip(sample, np.cumsum(rs))]
    followed = lambda r: "followed" if r.rules_followed else "broken"
    out["breakdowns"] = {
        "instrument": breakdown(sample, lambda r: r.instrument),
        "session": breakdown(sample, lambda r: r.session),
        "weekday": breakdown(sample, lambda r: r.weekday),
        "setup": breakdown(sample, lambda r: r.setup),
        "year": breakdown(sample, lambda r: r.closed_at.year),
        "emotion": breakdown(sample, lambda r: r.emotion),
        "rules": breakdown(sample, followed),
        "account": breakdown(sample, lambda r: r.account),
    }
    out["seed"] = seed
    return out
