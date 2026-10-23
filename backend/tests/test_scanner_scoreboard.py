"""Scoreboard (docs/scanner/scoreboard.md): every column rule, releases, the merge, the API and the benchmark comparison. No network."""

import csv
from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone
from pathlib import Path

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.scanner import releases, scoreboard, services
from apps.scanner.models import (
    CentralBankOutlook,
    Currency,
    DataSource,
    Pair,
    PairScore,
    RawObservation,
    Release,
)
from apps.scanner.reference import BOARD_COLUMNS, BOARD_CONFIG
from apps.scanner.scoreboard import Cell

BENCHMARK = Path(__file__).parent / "fixtures" / "scoreboard_benchmark_2026-10-23.csv"
UTC = dt_timezone.utc


def bench_rows():
    with open(BENCHMARK, newline="", encoding="utf-8") as f:
        return {("XAUUSD" if r["symbol"] == "GOLD" else r["symbol"]): {k: int(v) for k, v in r.items() if k != "symbol"} for r in csv.DictReader(f)}


# --- Technical and sentiment columns ------------------------------------------------------------


@pytest.mark.parametrize(("closes", "expected"), [
    ([1 + i * 0.01 for i in range(30)], 2),                                # rising: fast above slow, slow rising
    ([1 - i * 0.01 for i in range(30)], -2),                               # falling
    ([1 + i * 0.01 for i in range(30)] + [1.20] * 3, -1),                 # just dipped below, slow still rising
    ([1 - i * 0.01 for i in range(30)] + [0.80] * 3, 1),                  # just popped above, slow still falling
])
def test_trend(closes, expected):
    assert scoreboard.trend(closes, BOARD_CONFIG["trend"]).score == expected


def test_trend_needs_enough_closes():
    assert scoreboard.trend([1.0] * 10, BOARD_CONFIG["trend"]).status == "missing"


def test_seasonality_uses_ten_completed_years():
    monthly = [(date(y, 10, 1), 1.0, 1.01 if y >= 2016 else 0.5) for y in range(2005, 2027)]  # old years down, last 10 up
    cell = scoreboard.seasonality(monthly, 10, date(2026, 10, 23), {"years": 10})
    assert cell.score == 1 and cell.detail["years"] == 10  # 2016–2025; 2026 is unfinished


def test_cot_change_uses_long_share_not_net():
    # Net short both weeks, but the long share rose: +1 (CHF on 13 Oct 2026).
    reports = [{"period": date(2026, 10, 6), "long": 27818, "short": 51558}, {"period": date(2026, 10, 13), "long": 27447, "short": 49525}]
    assert scoreboard.cot_change(reports).score == 1


def test_cot_gold_adds_net_side():
    reports = [{"period": date(2026, 10, 6), "long": 200, "short": 100}, {"period": date(2026, 10, 13), "long": 190, "short": 100}]
    assert scoreboard.cot_gold(reports).score == 0  # long share fell (−1), still net long (+1)


@pytest.mark.parametrize(("long_pct", "expected"), [(60, -1), (75, -1), (59.9, 0), (40.1, 0), (40, 1), (20, 1), (None, None)])
def test_crowd(long_pct, expected):
    assert scoreboard.crowd(long_pct, BOARD_CONFIG["crowd"]).score == expected


# --- Releases and macro cells ------------------------------------------------------------------


@pytest.mark.parametrize(("text", "expected"), [
    ("200K", (200000.0, 1e3, 0)), ("7.20M", (7200000.0, 1e6, 2)), ("0.3%", (0.3, 1, 1)), ("-17", (-17.0, 1, 0)),
    ("-0.26T", (-0.26e12, 1e12, 2)), ("", None), ("n/a", None),
])
def test_parse_number(text, expected):
    assert scoreboard.parse_number(text) == expected


def test_release_score_rules():
    assert scoreboard.release_score("cpi", 3.5, 3.4, 3.1, "3.4%") == 1
    assert scoreboard.release_score("cpi", 3.42, 3.4, 3.1, "3.4%") == 0  # compared at the forecast's precision
    assert scoreboard.release_score("jolts", 7_195_000, 7_200_000, None, "7.20M") == 0  # 7.195M rounds to 7.20M
    assert scoreboard.release_score("unemp", 4.2, 4.1, 4.1, "4.1%") == -1  # higher unemployment is worse
    assert scoreboard.release_score("claims", 194_000, 200_000, None, "200K") == 1
    assert scoreboard.release_score("mpmi", 20.9, None, 37.8) == -1  # surveys: against the month before
    assert scoreboard.release_score("gdp", 0.5, None, 0.4) is None  # a surprise needs a forecast


def test_macro_cell_takes_latest_scored_release():
    now = datetime(2026, 10, 23, 22, tzinfo=UTC)
    rel = [
        {"title": "CPI y/y", "at": now - timedelta(days=40), "actual": 3.0, "forecast": 3.2, "forecast_text": "3.2%", "previous": 3.1},
        {"title": "CPI y/y", "at": now - timedelta(days=2), "actual": None, "forecast": 3.4, "forecast_text": "3.4%", "previous": 3.1},
        {"title": "CPI y/y", "at": now + timedelta(days=20), "actual": None, "forecast": 3.5, "forecast_text": "3.5%", "previous": 3.4},
    ]
    cell = scoreboard.macro_cell("cpi", rel, now, 75)
    assert cell.score == -1 and cell.detail["age_days"] == 40  # the newest release has no actual yet
    assert scoreboard.macro_cell("cpi", rel, now, 30).status == "stale"
    assert scoreboard.macro_cell("cpi", rel[1:], now, 75).status == "pending"
    assert scoreboard.macro_cell("cpi", [], now, 75).status == "missing"


def test_rate_outlook_priority():
    cfg = BOARD_CONFIG["rates"]
    assert scoreboard.rate_outlook({"direction": -1}, {"forecast": 4.0}, 3.5, 3.9, cfg).score == -1  # house view first
    assert scoreboard.rate_outlook(None, {"forecast": 4.0, "previous": 3.75}, 3.75, 3.0, cfg).score == 1  # then a listed decision
    assert scoreboard.rate_outlook(None, {"forecast": 3.75}, 3.75, 4.0, cfg).score == 1  # hold listed: fall through to the market
    assert scoreboard.rate_outlook(None, None, 2.5, 2.64, cfg).score == 1   # EUR: 3-month 0.14 above
    assert scoreboard.rate_outlook(None, None, 0.0, -0.04, cfg).score == 0  # CHF: within the band
    assert scoreboard.rate_outlook(None, None, None, None, cfg).status == "missing"


def test_gold_rates():
    assert scoreboard.gold_rates([4.70, 4.72, 4.74, 4.76, 4.77, 4.79, 4.81], {"ma_days": 7}).score == -1
    assert scoreboard.gold_rates([4.90, 4.88, 4.86, 4.84, 4.82, 4.80, 4.70], {"ma_days": 7}).score == 1


# --- Pair rows, labels and ranking --------------------------------------------------------------


def _macro(values: dict[str, dict[str, int]]) -> dict[str, dict[str, Cell]]:
    out: dict[str, dict[str, Cell]] = {}
    for ind, by_ccy in values.items():
        for ccy, v in by_ccy.items():
            out.setdefault(ccy, {})[ind] = Cell(v)
    return out


def test_pair_row_rebuilds_the_benchmark_gbpjpy():
    """GBPJPY = 13 on the benchmark: tech columns as shown, and per-currency macro scores solved from all 29 rows."""
    b = bench_rows()["GBPJPY"]
    tech = {c: Cell(b[c]) for c in ("trend", "seasonality", "crowd", "cot")}
    macro = _macro({
        "gdp": {"GBP": 1, "JPY": 1}, "mpmi": {"GBP": 1, "JPY": 0}, "spmi": {"GBP": 1, "JPY": -1}, "retail": {"GBP": 1, "JPY": -1},
        "cconf": {"GBP": 1, "JPY": -1}, "cpi": {"GBP": 1, "JPY": -1}, "ppi": {"GBP": -1, "JPY": 1}, "pce": {"GBP": 0, "JPY": -1},
        "rates": {"GBP": 1, "JPY": 0}, "unemp": {"GBP": 1, "JPY": -1},
    })
    row = scoreboard.pair_row("GBP", "JPY", tech, macro)
    assert {c: row["columns"][c]["score"] for c in BOARD_COLUMNS} == {c: b[c] for c in BOARD_COLUMNS}
    assert row["score"] == 13 and row["label"] == "very_bullish"


def test_benchmark_rows_are_plain_sums_with_fixed_label_cuts():
    labels = {13: "very_bullish", 7: "very_bullish", 6: "bullish", 4: "bullish", 3: "neutral", -3: "neutral", -4: "bearish", -6: "bearish", -7: "very_bearish"}
    for sym, r in bench_rows().items():
        assert sum(r[c] for c in BOARD_COLUMNS) == r["score"], sym
    for score, label in labels.items():
        assert scoreboard.board_label(score) == label


def test_us_only_columns_and_gold_mirror_usd():
    macro = _macro({"nfp": {"USD": -1}, "cpi": {"USD": 1, "EUR": 0}})
    eurgbp = scoreboard.pair_row("EUR", "GBP", {}, macro)
    assert eurgbp["columns"]["nfp"] == {"score": 0, "status": "na", "sides": {"base": None, "quote": None}}
    gold = scoreboard.pair_row("XAU", "USD", {}, macro, Cell(-1))
    assert gold["columns"]["nfp"]["score"] == 1 and gold["columns"]["cpi"]["score"] == -1  # USD reversed
    assert gold["columns"]["rates"]["score"] == -1  # gold's own rates rule
    assert gold["columns"]["gdp"]["status"] == "pending"


def test_no_free_source_cells_say_so():
    macro = {"GBP": {"mpmi": Cell(None, "none")}, "JPY": {"mpmi": Cell(None, "none")}}
    assert scoreboard.pair_row("GBP", "JPY", {}, macro)["columns"]["mpmi"]["status"] == "none"


def test_board_rank_is_signed():
    assert scoreboard.board_rank({"A": -11, "B": 13, "C": 0, "D": None}) == {"B": 1, "C": 2, "A": 3}


def test_momentum_and_final_bias():
    row = {"columns": {c: {"score": None, "status": "pending"} for c in BOARD_COLUMNS}}
    assert scoreboard.momentum(row) is None  # too few macro columns
    for c, v in (("cpi", 2), ("retail", 1), ("unemp", 2), ("nfp", 0)):
        row["columns"][c] = {"score": v, "status": "ok"}
    assert scoreboard.momentum(row) is None  # four columns: still too few
    row["columns"]["gdp"] = {"score": -1, "status": "ok"}
    row["columns"]["seasonality"] = {"score": 1, "status": "ok"}
    assert scoreboard.momentum(row) == round(5 / 11 * 10, 2)
    assert scoreboard.final_bias(4.0, 6.0) == (5.0, False)
    assert scoreboard.final_bias(None, 6.0) == (6.0, False)
    assert scoreboard.final_bias(-3.0, 4.0) == (0.5, True)  # opposite and both at least ±2: mixed
    assert scoreboard.final_bias(None, None) == (None, False)


def test_compare_against_itself_is_perfect():
    bench = bench_rows()
    ours = {s: {"columns": {c: {"score": r[c], "status": "ok"} for c in BOARD_COLUMNS}, "score": r["score"],
                "label": scoreboard.board_label(r["score"])} for s, r in bench.items()}
    r = scoreboard.compare(ours, bench)
    assert r["pairs"] == 29 and r["cell_rate"] == 1.0 and r["label_rate"] == 1.0 and r["spearman"] == 1.0
    assert r["top5_overlap"] == 5 and r["bottom5_overlap"] == 5
    ours["GBPJPY"]["columns"]["trend"]["score"] = -2
    assert scoreboard.compare(ours, bench)["columns"]["trend"]["misses"] == ["GBPJPY: -2 vs 2"]


# --- Release pipeline (database, network faked) -------------------------------------------------



@pytest.mark.django_db
def test_capture_freezes_forecast_after_release(monkeypatch):
    now = timezone.now()
    past, future = (now - timedelta(hours=2)).isoformat(), (now + timedelta(days=2)).isoformat()
    feed = [
        {"title": "CPI y/y", "country": "GBP", "date": past, "impact": "High", "forecast": "3.4%", "previous": "3.1%"},
        {"title": "Retail Sales m/m", "country": "GBP", "date": future, "impact": "Medium", "forecast": "-0.1%", "previous": "0.5%"},
        {"title": "Rightmove HPI m/m", "country": "GBP", "date": future, "impact": "Low", "forecast": "", "previous": "0.7%"},  # not mapped
    ]
    assert releases.capture(feed)["new"] == 2
    feed[0]["forecast"], feed[1]["forecast"] = "9.9%", "0.2%"
    releases.capture(feed)
    assert Release.objects.get(title="CPI y/y").forecast == 3.4  # released: frozen
    assert Release.objects.get(title="Retail Sales m/m").forecast == 0.2  # still ahead: follows the consensus


@pytest.mark.django_db
def test_actual_from_next_release_and_family():
    gbp = Currency.objects.get(code="GBP")
    t0 = timezone.now() - timedelta(days=40)
    Release.objects.create(currency=gbp, indicator="gdp", title="Prelim GDP q/q", at=t0, forecast=0.2, forecast_text="0.2%")
    Release.objects.create(currency=gbp, indicator="gdp", title="Final GDP q/q", at=t0 + timedelta(days=30), forecast=0.3, previous=0.4)
    assert releases.family("Prelim GDP q/q") == releases.family("Final GDP q/q") == "gdp q/q"
    assert releases.family("CPI Flash Estimate y/y") == releases.family("Final CPI y/y")
    assert releases.resolve_from_next() == 1
    r = Release.objects.get(title="Prelim GDP q/q")
    assert r.actual == 0.4 and "previous figure" in r.actual_source


@pytest.mark.django_db
def test_fred_actual_on_release_day(monkeypatch):
    usd = Currency.objects.get(code="USD")
    at = datetime(2026, 10, 2, 8, 30, tzinfo=releases.NEW_YORK)
    Release.objects.create(currency=usd, indicator="nfp", title="Non-Farm Employment Change", at=at, forecast=50_000, forecast_text="50K")
    monkeypatch.setattr(releases, "fred_vintage_dates", lambda s, since: [date(2026, 9, 4), date(2026, 10, 2)])
    monkeypatch.setattr(releases, "fred_vintage", lambda s, day, since: [(date(2026, 8, 1), 159015), (date(2026, 9, 1), 159044)])
    assert releases.resolve_fred(now=at + timedelta(hours=3)) == 1
    r = Release.objects.get(title="Non-Farm Employment Change")
    assert r.actual == 29_000 and r.actual_source == "FRED PAYEMS, first print"
    assert scoreboard.release_score("nfp", r.actual, r.forecast, None, r.forecast_text) == -1


@pytest.mark.django_db
def test_surveys_become_change_releases(monkeypatch):
    monkeypatch.setattr(releases, "fred_first_releases", lambda s, since: [(date(2026, 9, 1), 37.8, date(2026, 9, 18)), (date(2026, 10, 1), 20.9, date(2026, 10, 15))])
    monkeypatch.setattr(releases, "eurostat_survey", lambda s, start: [(date(2026, 8, 1), -5.0), (date(2026, 9, 1), -3.8)])
    releases.resolve_surveys()
    philly = Release.objects.filter(currency__code="USD", indicator="mpmi").get()
    assert (philly.actual, philly.previous) == (20.9, 37.8)
    ec = Release.objects.filter(currency__code="EUR", indicator="mpmi").get()
    assert (ec.actual, ec.previous, ec.at.date()) == (-3.8, -5.0, date(2026, 9, 30))


# --- End to end: a scored run and the API -------------------------------------------------------


@pytest.mark.django_db
def test_scoreboard_api_end_to_end():
    src = DataSource.objects.create(name="test")
    today = timezone.localdate()

    def add(factor, subject, period, value, freq, series="", extra=None):
        kw = {"currency": Currency.objects.get(code=subject)} if len(subject) == 3 else {"pair": Pair.objects.get(symbol=subject)}
        RawObservation.objects.create(source=src, factor=factor, series=series, period_date=period, value=value, extra={"freq": freq, **(extra or {})},
                                      released_at=today, **kw)

    for i in range(30):  # GBPUSD rising for a month
        add("trend", "GBPUSD", today - timedelta(days=30 - i), 1.30 + i * 0.002, "D", "close")
    for y in range(today.year - 10, today.year):
        add("monthly", "GBPUSD", date(y, today.month, 1), 1.31, "M", "close", {"open": 1.30})
    for code, (l0, s0, l1, s1) in {"GBP": (100, 100, 120, 100), "USD": (100, 100, 90, 100)}.items():
        add("cot", code, today - timedelta(days=10), l0 - s0, "W", extra={"long": l0, "short": s0})
        add("cot", code, today - timedelta(days=3), l1 - s1, "W", extra={"long": l1, "short": s1})
    add("retail", "GBPUSD", today, 30.0, "D", extra={"sample": 1000})
    usd, gbp = Currency.objects.get(code="USD"), Currency.objects.get(code="GBP")
    at = timezone.now() - timedelta(days=5)
    for ccy, ind, title, a, f in [(gbp, "cpi", "CPI y/y", 3.5, 3.4), (usd, "cpi", "CPI y/y", 3.0, 3.1), (usd, "nfp", "Non-Farm Employment Change", 90_000, 50_000),
                                  (gbp, "unemp", "Unemployment Rate", 4.7, 4.9), (usd, "retail", "Retail Sales m/m", 0.8, 1.2)]:
        Release.objects.create(currency=ccy, indicator=ind, title=title, at=at, actual=a, forecast=f, forecast_text=str(f), actual_source="test")
    CentralBankOutlook.objects.create(currency=gbp, direction=1, set_on=today)
    cache.clear()
    services.run_scoring(today)

    user = User.objects.create_user(email="board@example.com", password="pw-123456789")
    c = APIClient()
    c.force_authenticate(user)
    body = c.get("/api/v1/scanner/scoreboard").json()
    assert len(body["rows"]) == 29 and set(body["columns"]) == set(BOARD_COLUMNS)
    row = next(r for r in body["rows"] if r["symbol"] == "GBPUSD")
    cols = {k: v["score"] for k, v in row["columns"].items()}
    assert cols["trend"] == 2 and cols["seasonality"] == 1 and cols["cot"] == 2 and cols["crowd"] == 1
    assert cols["cpi"] == 2 and cols["nfp"] == -1 and cols["unemp"] == 1 and cols["rates"] == 1  # GBP house view, USD 0
    assert row["columns"]["mpmi"]["status"] in ("pending", "ok")  # GBP has no free PMI; USD survey not fetched here
    assert row["score"] == sum(v for v in cols.values() if v is not None) and row["rank"] == 1
    gold = next(r for r in body["rows"] if r["symbol"] == "XAUUSD")
    assert gold["columns"]["cpi"]["score"] == 1 and gold["columns"]["nfp"]["score"] == -1  # USD CPI missed, payrolls beat: reversed for gold
    pairs = c.get("/api/v1/scanner/pairs").json()["pairs"]
    gbpusd = next(p for p in pairs if p["symbol"] == "GBPUSD")
    assert gbpusd["momentum"] is not None and gbpusd["final_score"] is not None  # five scored macro columns
    assert PairScore.objects.filter(pair__symbol="XAUUSD").exists()
    assert "XAU" not in [b["code"] for b in c.get("/api/v1/scanner/currencies").json()["currencies"]]  # gold isn't a currency
