"""Scanner scoring rules (spec "Scoring methodology"): every factor rule, the formulas and the worked example."""

from datetime import date, timedelta

import pytest

from apps.scanner.reference import DEFAULT_CONFIG
from apps.scanner.scoring import (
    FactorResult,
    Obs,
    agreement,
    currency_score,
    label_for,
    pair_score,
    rank,
    score_business,
    score_cot,
    score_growth,
    score_inflation,
    score_labour,
    score_rates,
    score_retail,
    score_trend,
)

CFG = {k: v[2] for k, v in DEFAULT_CONFIG.items()}
WEIGHTS = {k: v[0] for k, v in DEFAULT_CONFIG.items() if k in ("cot", "rates", "inflation", "growth", "labour", "business")}


def monthly(values, start=date(2026, 1, 1), freq="M"):
    out, d = [], start
    for v in values:
        out.append(Obs(d, v, freq))
        step = 3 if freq == "Q" else 1
        d = date(d.year + (d.month - 1 + step) // 12, (d.month - 1 + step) % 12 + 1, 1)
    return out


@pytest.mark.parametrize(("current", "expected"), [(52, 2), (40, 1), (25, 0), (12, -1), (1, -2)])
def test_cot_percentiles(current, expected):
    # 51 weeks of positions 1..51, then this week's value.
    weeks = [Obs(date(2025, 1, 7) + timedelta(weeks=i), float(i + 1), "W") for i in range(51)]
    weeks.append(Obs(date(2026, 1, 6), float(current), "W"))
    assert score_cot(weeks, CFG["cot"]).score == expected


def rate_path(changes, as_of):
    """Daily-ish series: 4.0 flat, with (days_before_as_of, new_rate) steps."""
    series, rate = [], 4.0
    start = as_of - timedelta(days=900)
    steps = sorted(((as_of - timedelta(days=d)), r) for d, r in changes)
    d = start
    while d <= as_of:
        for when, r in steps:
            if when == d:
                rate = r
        series.append(Obs(d, rate, "D"))
        d += timedelta(days=30)
    return series


@pytest.mark.parametrize(
    ("changes", "expected", "cycle"),
    [
        ([(60, 4.25)], 2, "hiked recently"),
        ([(300, 4.25)], 1, "holding after hikes"),
        ([], 0, "no change in the data"),
        ([(300, 3.75)], -1, "holding after cuts"),
        ([(60, 3.75)], -2, "cut recently"),
        ([(840, 3.75)], 0, "holding, no clear cycle"),
    ],
)
def test_rates_cycle(changes, expected, cycle):
    as_of = date(2026, 10, 17)
    # Align the change days with the 30-day grid.
    grid = {(as_of - (as_of - timedelta(days=900) + timedelta(days=30 * k))).days for k in range(31)}
    aligned = [(min(grid, key=lambda g: abs(g - d)), r) for d, r in changes]
    r = score_rates(rate_path(aligned, as_of), CFG["rates"], as_of)
    assert (r.score, r.detail["cycle"]) == (expected, cycle)


@pytest.mark.parametrize(
    ("values", "target", "expected"),
    [
        ([3.0, 3.1, 3.2, 3.5], 2.0, 2),  # above target and rising
        ([3.8, 3.6, 3.4, 3.2], 2.0, 1),  # above target, falling
        ([2.1, 2.0, 2.2, 2.4], 2.0, 0),  # within ±0.5 of target
        ([0.8, 1.0, 1.1, 1.2], 2.0, -1),  # below target, rising
        ([1.4, 1.2, 1.1, 0.9], 2.0, -2),  # below target and falling
        ([0.9, 0.9, 1.0, 1.4], 1.0, 0),  # CHF target 1%
    ],
)
def test_inflation(values, target, expected):
    assert score_inflation(monthly(values), CFG["inflation"], target).score == expected


def test_inflation_quarterly_looks_back_one_quarter():
    r = score_inflation(monthly([3.2, 3.6], freq="Q"), CFG["inflation"], 2.5)
    assert r.score == 2 and r.detail["earlier"] == 3.2


@pytest.mark.parametrize(("q", "expected"), [((0.6, 0.6), 2), ((0.3, 0.3), 1), ((0.1, 0.1), 0), ((-0.1, -0.1), -1), ((-0.4, -0.3), -2)])
def test_growth(q, expected):
    assert score_growth(monthly(list(q), freq="Q"), CFG["growth"]).score == expected


@pytest.mark.parametrize(("delta", "expected"), [(-0.4, 2), (-0.2, 1), (0.0, 0), (0.05, 0), (0.2, -1), (0.3, -2)])
def test_labour(delta, expected):
    assert score_labour(monthly([4.0, 4.0, 4.0, 4.0 + delta]), CFG["labour"]).score == expected


@pytest.mark.parametrize(("prev", "cur", "expected"), [(100.3, 100.5, 2), (100.6, 100.4, 1), (100.1, 100.0, 0), (99.2, 99.5, -1), (99.6, 99.4, -2)])
def test_business(prev, cur, expected):
    assert score_business(monthly([prev, cur]), CFG["business"]).score == expected


def closes(values):
    return [Obs(date(2025, 1, 1) + timedelta(days=i), v, "D") for i, v in enumerate(values)]


def test_trend_signals():
    up = closes([1.0 + i * 0.001 for i in range(260)])
    down = closes([2.0 - i * 0.001 for i in range(260)])
    assert score_trend(up, CFG["trend"]).score == 2
    assert score_trend(down, CFG["trend"]).score == -2
    # Long uptrend then a shallow pullback: below the 20-day only. Whatever the mix, the score follows the net rule.
    pullback = closes([1.0 + i * 0.001 for i in range(250)] + [1.245 - i * 0.0005 for i in range(10)])
    r = score_trend(pullback, CFG["trend"])
    rule = {4: 2, 3: 1, 2: 1, 1: 0, 0: 0, -1: 0, -2: -1, -3: -1, -4: -2}
    assert r.detail["above_20"] is False and r.detail["above_200"] is True
    assert r.score == rule[r.detail["net"]]
    assert score_trend(closes([1.0] * 100), CFG["trend"]).score is None


@pytest.mark.parametrize(("long_pct", "expected"), [(20, 2), (35, 1), (50, 0), (65, -1), (80, -2), (25, 2), (40, 1), (60, -1), (75, -2)])
def test_retail_contrarian(long_pct, expected):
    r = score_retail(Obs(date(2026, 10, 17), long_pct, "D", extra={"sample": 1200}), CFG["retail"])
    assert r.score == expected and r.detail["small_sample"] is False


def test_retail_small_sample_flag():
    assert score_retail(Obs(date(2026, 10, 17), 50, "D", extra={"sample": 120}), CFG["retail"]).detail["small_sample"] is True


def fr(factor, score, stale=False):
    return FactorResult(factor, score, None, stale)


def test_currency_formula_and_renormalisation():
    full = {f: fr(f, 2) for f in WEIGHTS}
    assert currency_score(full, WEIGHTS) == (10.0, 6)
    mixed = {"cot": fr("cot", 2), "rates": fr("rates", 1), "inflation": fr("inflation", 0), "growth": fr("growth", -1), "labour": fr("labour", 1), "business": fr("business", 0)}
    # (1.5·2 + 1.5·1 + 0 − 1 + 1 + 0) / (2 · 7) × 10 = 4.5 / 14 × 10
    assert currency_score(mixed, WEIGHTS)[0] == pytest.approx(3.21, abs=0.01)
    # A stale factor is dropped and the weights renormalise.
    mixed["growth"] = fr("growth", -1, stale=True)
    assert currency_score(mixed, WEIGHTS) == (pytest.approx(5.5 / 12 * 10, abs=0.01), 5)
    # More than two missing: insufficient data.
    for f in ("growth", "labour", "business"):
        mixed[f] = fr(f, None)
    assert currency_score(mixed, WEIGHTS) == (None, 3)


def test_spec_worked_example_gbpusd():
    # GBP −4.3, USD +5.7, trend −2, retail −1 (65% long) → P = −5.75, Bearish.
    p, detail = pair_score(-4.3, 5.7, fr("trend", -2), fr("retail", -1))
    assert p == -5.75 and label_for(p) == "bearish"
    assert detail["components"] == {"difference": -5.0, "trend": -10, "retail": -5}


def test_pair_renormalises_missing_pair_factors_and_skips_insufficient():
    p, detail = pair_score(4.0, 0.0, fr("trend", 2), fr("retail", None))
    # (0.7·2 + 0.15·10) / 0.85
    assert p == pytest.approx((0.7 * 2 + 0.15 * 10) / 0.85, abs=0.01) and detail["weights_used"] == 0.85
    assert pair_score(None, 1.0, fr("trend", 1), fr("retail", 1))[0] is None


@pytest.mark.parametrize(("score", "label"), [(6, "very_bullish"), (5.99, "bullish"), (2, "bullish"), (1.99, "neutral"), (-1.99, "neutral"), (-2, "bearish"), (-5.99, "bearish"), (-6, "very_bearish"), (None, "insufficient")])
def test_labels(score, label):
    assert label_for(score) == label


def test_ranking_by_absolute_score_then_change():
    order = rank({"EURUSD": (3.0, 0.5), "GBPUSD": (-5.75, 1.0), "USDJPY": (3.0, 2.0), "AUDNZD": (None, 0.0)})
    assert order == {"GBPUSD": 1, "USDJPY": 2, "EURUSD": 3}


def test_agreement_counts_factors_pointing_the_same_way():
    base = {"cot": fr("cot", 2), "rates": fr("rates", 1), "inflation": fr("inflation", 0)}
    quote = {"cot": fr("cot", -1), "rates": fr("rates", 2), "inflation": fr("inflation", 0)}
    a = agreement(4.0, base, quote, fr("trend", 1), fr("retail", -1))
    assert a == {"agree": 2, "of": 4}  # cot and trend agree; rates and retail don't; inflation is level
