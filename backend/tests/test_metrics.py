"""Core metrics against known datasets (spec §8: deterministic, unit-tested)."""

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from apps.analytics.metrics import (
    TradeRecord,
    block_bootstrap,
    clusters,
    compute,
    longest_losing_streak,
    max_drawdown,
    monte_carlo,
)

T0 = datetime(2026, 1, 5, 9, tzinfo=UTC)  # a Monday


def rec(r, i, followed=True, instrument="EUR/USD", hours=1, **kw):
    opened = T0 + timedelta(days=i)
    return TradeRecord(r=r, opened_at=opened, closed_at=opened + timedelta(hours=hours), rules_followed=followed, instrument=instrument, **kw)


def test_hand_checked_summary():
    rs = [2, -1, -1, 2, 0.05, -1]
    m = compute([rec(r, i) for i, r in enumerate(rs)])
    assert (m["trades"], m["wins"], m["losses"], m["breakevens"]) == (6, 2, 3, 1)
    assert m["win_rate"] == pytest.approx(2 / 6)
    assert m["expectancy"] == pytest.approx(1.05 / 6)
    assert m["profit_factor"] == pytest.approx(4 / 3)
    assert m["total_r"] == pytest.approx(1.05)
    # Curve 0, 2, 1, 0, 2, 2.05, 1.05: the worst fall is 2 → 0.
    assert m["max_drawdown_r"] == pytest.approx(2)
    assert m["longest_losing_streak"] == 2
    assert m["expectancy_range"] is None  # fewer than 20 trades


def test_drawdown_and_streak_helpers():
    assert max_drawdown(np.array([-1.0, -1.0, 3.0])) == pytest.approx(2)  # falls from the starting 0
    assert max_drawdown(np.array([])) == 0
    assert longest_losing_streak(np.array([-1, -1, 0.05, -1, -1, -1, 2])) == 3  # a breakeven ends a run


def test_trades_without_stop_only_count_for_rules():
    records = [rec(1.0, 0), rec(None, 1, followed=False), rec(-1.0, 2, followed=False)]
    m = compute(records)
    assert m["trades"] == 2 and m["excluded_no_stop"] == 1
    assert m["rule_following_rate"] == pytest.approx(1 / 3)
    assert m["rule_breaking_cost_r"] == pytest.approx(-1.0)


def test_open_trades_are_not_in_the_sample():
    open_trade = TradeRecord(r=None, opened_at=T0, closed_at=None, rules_followed=True)
    m = compute([open_trade, rec(1.0, 1)])
    assert m["trades"] == 1 and m["open"] == 1


def test_costs_share_warning():
    # Net +0.5R each after 0.5R of costs: gross 1R, costs half of it.
    m = compute([rec(0.5, i, cost_r=0.5, stop_pips=8) for i in range(4)])
    assert m["costs_share"] == pytest.approx(0.5)
    assert "costs_high" in m["warnings"] and "stops_small" in m["warnings"]


def test_clusters_share_a_currency_and_overlap():
    a = rec(1, 0, instrument="EUR/USD", hours=5)
    b = TradeRecord(r=1, opened_at=a.opened_at + timedelta(hours=1), closed_at=a.opened_at + timedelta(hours=2), rules_followed=True, instrument="GBP/USD")
    c = TradeRecord(r=1, opened_at=a.opened_at + timedelta(hours=1), closed_at=a.opened_at + timedelta(hours=2), rules_followed=True, instrument="AUD/JPY")
    d = rec(1, 3)
    assert clusters([a, b, c, d]) == 3  # a+b share USD and overlap; c shares nothing; d is later


def test_ranges_are_deterministic_and_sensible():
    rng_data = np.random.default_rng(7)
    rs = rng_data.choice([2.0, -1.0], size=120, p=[0.45, 0.55])
    records = [rec(float(r), i) for i, r in enumerate(rs)]
    first, second = compute(records), compute(records)
    assert first["expectancy_range"] == second["expectancy_range"]  # fixed seed
    rg = first["expectancy_range"]
    assert rg["low"] < first["expectancy"] < rg["high"]
    assert rg["lower_bound_90"] >= rg["low"]
    exp = first["expected"]
    assert exp["drawdown_r"][0] <= exp["drawdown_r"][1] <= exp["drawdown_r"][2]
    assert exp["drawdown_r"][2] >= first["max_drawdown_r"] * 0.5


def test_no_edge_share_is_high_for_a_coin_flip():
    rs = np.array([1.0, -1.0] * 30 + [1.0])  # a hair above zero
    weeks = np.arange(rs.size) // 5
    out = block_bootstrap(rs, weeks, np.random.default_rng(1), resamples=4000)
    assert out["no_edge_pct"] > 30


def test_monte_carlo_streak_matches_a_known_order():
    out = monte_carlo(np.array([-1.0, -1.0, -1.0]), np.random.default_rng(0), paths=50)
    assert out["losing_streak"] == [3, 3, 3]
    assert out["drawdown_r"] == [3.0, 3.0, 3.0]


def test_breakdowns_group_and_sort():
    records = [rec(2, 0, session="london"), rec(-1, 1, session="asia"), rec(1, 2, session="london")]
    rows = compute(records)["breakdowns"]["session"]
    assert [r["key"] for r in rows] == ["london", "asia"]
    assert rows[0]["trades"] == 2 and rows[0]["total_r"] == pytest.approx(3)
