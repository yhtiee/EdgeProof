"""Scanner API (docs/scanner/fundamental-bias-scanner.md): no gate, filters, scorecard maths, history, evidence, signed jobs. No network."""

import hashlib
import hmac
import time
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.scanner import services
from apps.scanner.models import (
    Currency,
    DataSource,
    Pair,
    PairScore,
    RawObservation,
    ScoringRun,
)

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()
# Per currency: (CPI y/y now, earlier), (GDP q/q), (unemployment now, earlier), (BCI now, prev), (rate before, after), COT trend sign
PROFILE = {
    "USD": ((3.5, 3.0), (0.6, 0.6), (4.0, 4.5), (101.0, 100.5), (4.0, 4.5), 1),
    "EUR": ((1.2, 1.5), (-0.3, -0.2), (6.5, 6.0), (99.0, 99.5), (3.0, 2.5), -1),
    "GBP": ((2.2, 2.1), (0.1, 0.1), (4.2, 4.2), (100.0, 100.0), (4.0, 4.0), 0),
    "JPY": ((2.0, 2.0), (0.1, 0.1), (2.5, 2.5), (100.0, 100.0), (0.5, 0.5), 0),
    "AUD": ((2.5, 2.5), (0.1, 0.1), (4.0, 4.0), (100.0, 100.0), (4.0, 4.0), 0),
    "NZD": ((2.0, 2.0), (0.1, 0.1), (5.0, 5.0), (100.0, 100.0), (3.0, 3.0), 0),
    "CAD": ((2.0, 2.0), (0.1, 0.1), (6.0, 6.0), (100.0, 100.0), (2.5, 2.5), 0),
    "CHF": ((1.0, 1.0), (0.1, 0.1), (2.5, 2.5), (100.0, 100.0), (0.0, 0.0), 0),
}


def month_start(d, back):
    y, m = d.year, d.month - back
    while m <= 0:
        y, m = y - 1, m + 12
    return d.replace(year=y, month=m, day=1)


def obs(source, factor, subject, period, value, freq, series="", extra=None):
    kw = {"currency": Currency.objects.get(code=subject)} if len(subject) == 3 else {"pair": Pair.objects.get(symbol=subject)}
    RawObservation.objects.create(
        source=source, factor=factor, series=series, period_date=period, value=value,
        extra={"freq": freq, **(extra or {})}, released_at=min(TODAY, period + timedelta(days=35)), **kw,
    )


@pytest.fixture
def seeded():
    src = DataSource.objects.create(name="test")
    for code, (cpi, gdp, unemp, bci, rate, cot) in PROFILE.items():
        for i in range(12):  # weekly COT, rising for USD and falling for EUR
            obs(src, "cot", code, TODAY - timedelta(weeks=12 - i, days=-1), 1000 + cot * i * 100, "W")
        for back, value in ((4, cpi[1]), (3, cpi[1]), (2, cpi[1]), (1, cpi[0])):
            obs(src, "inflation", code, month_start(TODAY, back), value, "M")
        for back, value in ((4, unemp[1]), (3, unemp[1]), (2, unemp[1]), (1, unemp[0])):
            obs(src, "labour", code, month_start(TODAY, back), value, "M")
        obs(src, "business", code, month_start(TODAY, 2), bci[1], "M")
        obs(src, "business", code, month_start(TODAY, 1), bci[0], "M")
        obs(src, "growth", code, month_start(TODAY, 6), gdp[0], "Q")
        obs(src, "growth", code, month_start(TODAY, 3), gdp[1], "Q")
        obs(src, "rates", code, TODAY - timedelta(days=400), rate[0], "D")
        obs(src, "rates", code, TODAY - timedelta(days=30), rate[1], "D")
        obs(src, "rates", code, TODAY - timedelta(days=1), rate[1], "D")  # the latest daily print
    for i in range(260):  # EURUSD falling steadily: every trend signal bearish
        obs(src, "trend", "EURUSD", TODAY - timedelta(days=260 - i), 1.20 - i * 0.0005, "D", series="close")
    obs(src, "retail", "EURUSD", TODAY, 80.0, "D", extra={"sample": 300})  # crowd long → contrarian bearish
    cache.clear()
    return services.run_scoring(TODAY, snapshot=True)


def client(email="scan@example.com"):
    c = APIClient()
    body = {"first_name": "A", "last_name": "B", "email": email, "password": "a-long-passphrase-42", "over_18": True}
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {c.post('/api/v1/auth/register', body, format='json').json()['access']}")
    c.user = User.objects.get(email=email)
    return c


def test_sign_in_required_but_no_gate(seeded):
    assert APIClient().get("/api/v1/scanner/pairs").status_code == 401
    res = client().get("/api/v1/scanner/pairs")  # a brand-new user with no lessons or gates
    assert res.status_code == 200
    body = res.json()
    assert len(body["pairs"]) == 29  # 28 pairs and gold
    assert body["disclaimer"].startswith("Educational analysis")
    assert body["as_of"] == TODAY.isoformat()


def test_not_run_yet_is_a_clear_404():
    res = client().get("/api/v1/scanner/pairs")
    assert res.status_code == 404


def test_eurusd_is_bearish_and_ranked(seeded):
    pairs = client().get("/api/v1/scanner/pairs").json()["pairs"]
    eurusd = next(p for p in pairs if p["symbol"] == "EURUSD")
    assert eurusd["score"] < -6 and eurusd["label"] == "very_bearish"
    assert eurusd["rank"] == 1  # the strongest bias in this seeded world
    ranks = [p["final_rank"] for p in pairs if p["final_rank"] is not None]
    assert ranks == sorted(ranks)  # the list runs most bullish to most bearish on the final bias
    assert eurusd["final_label"] == "very_bearish" and eurusd["momentum"] is None  # no releases yet: final = regime


def test_filters(seeded):
    c = client()
    assert {p["symbol"] for p in c.get("/api/v1/scanner/pairs?currency=chf").json()["pairs"]} == {
        s for s in Pair.objects.values_list("symbol", flat=True) if "CHF" in s
    }
    strong = c.get("/api/v1/scanner/pairs?strong=1").json()["pairs"]
    assert strong and all(p["label"] in ("very_bullish", "very_bearish") for p in strong)
    assert all(p["label"] == "very_bearish" for p in c.get("/api/v1/scanner/pairs?label=very_bearish").json()["pairs"])


def test_currency_board(seeded):
    body = client().get("/api/v1/scanner/currencies").json()
    codes = [b["code"] for b in body["currencies"]]
    assert codes[0] == "USD" and codes[-1] == "EUR"  # sorted strongest first
    usd = body["currencies"][0]
    assert set(usd["factors"]) == {"cot", "rates", "inflation", "growth", "labour", "business"}
    assert usd["factors"]["rates"]["score"] == 2 and usd["factors"]["rates"]["source"] == ""  # "test" isn't a named source
    assert body["factor_text"]["cot"]["lesson"]


def test_scorecard_contributions_add_up(seeded):
    body = client().get("/api/v1/scanner/pairs/eurusd").json()
    assert body["symbol"] == "EURUSD"
    total = sum(v for v in body["contributions"].values() if v is not None)
    assert total == pytest.approx(body["score"], abs=0.1)
    assert body["pair_factors"]["retail"]["detail"]["small_sample"] is True
    assert body["pair_factors"]["trend"]["score"] == -2
    assert "EUR/USD is" in body["summary"] and "%" in body["summary"]
    assert client("other@example.com").get("/api/v1/scanner/pairs/XXXYYY").status_code == 404


def test_history_and_week_on_week(seeded):
    # A snapshot a week later sees the same data: the change is zero, and history has two points.
    services.run_scoring(TODAY + timedelta(days=7), snapshot=True)
    cache.clear()
    c = client()
    hist = c.get("/api/v1/scanner/pairs/EURUSD/history?weeks=all").json()["points"]
    assert [p["as_of"] for p in hist] == [TODAY.isoformat(), (TODAY + timedelta(days=7)).isoformat()]
    assert len(c.get("/api/v1/scanner/pairs/EURUSD/history?weeks=1").json()["points"]) == 1
    assert c.get("/api/v1/scanner/pairs/EURUSD/history?weeks=abc").status_code == 400
    latest = c.get("/api/v1/scanner/pairs").json()
    assert next(p for p in latest["pairs"] if p["symbol"] == "EURUSD")["change_wow"] == 0


def test_snapshot_is_idempotent(seeded):
    services.run_scoring(TODAY, snapshot=True)
    assert ScoringRun.objects.filter(is_weekly_snapshot=True, as_of=TODAY).count() == 1


def test_missing_data_is_insufficient_not_zero(seeded):
    RawObservation.objects.filter(currency__code="CHF").exclude(factor__in=["rates", "cot"]).delete()
    run = services.run_scoring(TODAY, snapshot=False)
    assert "CHF" in run.notes["insufficient"]
    assert PairScore.objects.get(run=run, pair__symbol="USDCHF").score is None
    cache.clear()
    pairs = client().get("/api/v1/scanner/pairs").json()["pairs"]
    assert pairs[-1]["rank"] is None  # unscored pairs sort last


def test_status_and_evidence(seeded):
    c = client()
    status = c.get("/api/v1/scanner/status").json()
    assert status["as_of"] == TODAY.isoformat()
    assert {s["name"] for s in status["sources"]} >= {"cftc", "twelvedata", "myfxbook"}
    assert all(not s["ok"] for s in status["sources"])  # nothing fetched in tests
    ev = c.get("/api/v1/scanner/evidence").json()
    assert ev["snapshots"] == 1 and set(ev["horizons"]) == {"1", "4", "12"}


def sign(body=b""):
    ts = str(int(time.time()))
    return {"HTTP_X_SWEEP_TIMESTAMP": ts, "HTTP_X_SWEEP_SIGNATURE": hmac.new(b"test-sweep-secret", f"{ts}.".encode() + body, hashlib.sha256).hexdigest()}


def test_scheduled_job_needs_a_signature(seeded, monkeypatch):
    started = []
    monkeypatch.setattr("apps.scanner.views.threading.Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: started.append(args)})())
    client()  # a user to own the job record
    anon = APIClient()
    assert anon.post("/internal/scanner/run_scoring").status_code in (401, 403)
    assert anon.post("/internal/scanner/drop_tables", **sign()).status_code == 404
    res = anon.post("/internal/scanner/run_scoring", **sign())
    assert res.status_code == 202 and started and started[0][1] == "run_scoring"
