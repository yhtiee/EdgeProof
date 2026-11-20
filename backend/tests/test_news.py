"""News (docs/news.md): reading releases, the calendar's actuals, and the calendar and headlines API. No network."""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.news import reading
from apps.news import views as news_views
from apps.scanner import evidence, releases
from apps.scanner.models import CalendarEvent, Currency, Publication, Release

pytestmark = pytest.mark.django_db
NOW = timezone.now().replace(microsecond=0)


@pytest.fixture
def api():
    cache.clear()
    c = APIClient()
    c.force_authenticate(User.objects.create_user(email="news@example.com", password="pw-123456789"))
    return c


def event(code, title, at, impact="High", forecast="", previous="", factor="", indicator=""):
    return CalendarEvent.objects.create(currency=Currency.objects.get(code=code), title=title, at=at, impact=impact,
                                        forecast=forecast, previous=previous, factor=factor, indicator=indicator)


# --- Reading a release --------------------------------------------------------------------------


@pytest.mark.parametrize(("actual", "forecast", "expected"), [
    ("194K", "200K", -1), ("0.3%", "0.3%", 0), ("3.6%", "3.5%", 1), ("0.31%", "0.3%", 0),  # compared at the forecast's precision
    ("", "0.3%", None), ("0.3%", "", None),
])
def test_surprise(actual, forecast, expected):
    assert reading.surprise(actual, forecast) == expected


def test_effect_for_the_currency():
    assert reading.effect("3.6%", "3.5%", "CPI y/y", "inflation", "cpi") == "good"  # hotter prices: tighter policy
    assert reading.effect("4.3%", "4.1%", "Unemployment Rate", "labour", "unemp") == "bad"
    assert reading.effect("225K", "230K", "Unemployment Claims", "labour", "") == "good"  # fewer claims than expected
    assert reading.effect("-60.1B", "-58.0B", "Trade Balance", "", "") is None  # direction not judged
    assert reading.effect("", "", "Fed Chair Powell Speaks", "rates", "") is None
    assert reading.effect("3.6%", "3.6%", "CPI y/y", "inflation", "cpi") is None  # in line


def test_about_and_links():
    assert reading.about("inflation")["lesson"] == "l5-actual-versus-expected"
    assert reading.about("")["lesson"] == "l5-the-economic-calendar" and reading.about("")["factor_name"] == ""
    assert reading.links("USD", "inflation")["official"]["url"].startswith("https://www.bls.gov")
    assert reading.links("USD", "")["official"] is None


# --- Actuals ------------------------------------------------------------------------------------


def test_format_like_matches_the_calendar():
    assert releases.format_like(194000, "200K") == "194K"
    assert releases.format_like(0.31, "0.3%") == "0.3%"
    assert releases.format_like(7210000, "7.20M") == "7.21M"
    assert releases.format_like(1.234, "") == "1.23"


def test_calendar_actuals_from_official_prints_then_the_next_release():
    nfp_at = NOW - timedelta(days=2)
    nfp = event("USD", "Non-Farm Employment Change", nfp_at, forecast="200K", previous="150K", factor="labour", indicator="nfp")
    Release.objects.create(currency=nfp.currency, indicator="nfp", title=nfp.title, at=nfp_at, actual=194000.0,
                           forecast=200000.0, actual_source="FRED PAYEMS, first print")
    cpi = event("GBP", "CPI y/y", NOW - timedelta(days=30), forecast="3.5%", previous="3.4%", factor="inflation")
    event("GBP", "CPI y/y", NOW + timedelta(days=1), forecast="3.4%", previous="3.6%", factor="inflation")
    speech = event("GBP", "BOE Gov Bailey Speaks", NOW - timedelta(days=1), factor="rates")
    holiday = event("JPY", "Bank Holiday", NOW - timedelta(days=3), impact="Holiday")
    assert releases.fill_calendar_actuals() == 2
    nfp.refresh_from_db()
    cpi.refresh_from_db()
    assert (nfp.actual, nfp.actual_source) == ("194K", "FRED PAYEMS, first print")
    assert cpi.actual == "3.6%" and cpi.actual_source.startswith("previous figure on the")
    speech.refresh_from_db()
    holiday.refresh_from_db()
    assert speech.actual == "" and holiday.actual == ""
    assert releases.fill_calendar_actuals() == 0  # nothing changes on a second pass


# --- API ------------------------------------------------------------------------------------------


def test_news_needs_sign_in():
    assert APIClient().get("/api/v1/news/calendar").status_code == 401
    assert APIClient().get("/api/v1/news/headlines").status_code == 401


def test_calendar_window_filters_and_reading(api):
    start = NOW - timedelta(days=1)
    e = event("USD", "CPI y/y", NOW - timedelta(hours=2), forecast="3.5%", previous="3.4%", factor="inflation", indicator="cpi")
    e.actual, e.actual_source = "3.6%", "FRED CPIAUCNS, first print"
    e.save()
    event("EUR", "German Buba Monthly Report", NOW + timedelta(hours=3), impact="Low")
    event("JPY", "Bank Holiday", NOW + timedelta(hours=5), impact="Holiday")
    event("USD", "CPI y/y", NOW + timedelta(days=20), forecast="3.4%")  # outside the window
    params = {"from": start.isoformat(), "to": (start + timedelta(days=7)).isoformat()}
    body = api.get("/api/v1/news/calendar", params).json()
    assert [x["title"] for x in body["events"]] == ["CPI y/y", "German Buba Monthly Report", "Bank Holiday"]
    cpi = body["events"][0]
    assert (cpi["actual"], cpi["surprise"], cpi["effect"]) == ("3.6%", 1, "good")
    assert cpi["official"]["url"].startswith("https://www.bls.gov") and cpi["lesson"] == "l5-actual-versus-expected"
    assert cpi["factor_name"] == "Inflation" and body["link"]["url"].startswith("https://www.forexfactory.com")
    only = api.get("/api/v1/news/calendar", {**params, "currency": "eur,jpy", "impact": "Low"}).json()["events"]
    assert [x["currency"] for x in only] == ["EUR"]
    assert api.get("/api/v1/news/calendar", {**params, "currency": "XYZ"}).status_code == 400
    assert api.get("/api/v1/news/calendar", {**params, "impact": "Huge"}).status_code == 400
    assert api.get("/api/v1/news/calendar", {"from": start.isoformat(), "to": (start + timedelta(days=30)).isoformat()}).status_code == 400
    assert api.get("/api/v1/news/calendar", {"from": "next tuesday"}).status_code == 400


def test_calendar_pairs_i_trade(api, monkeypatch):
    event("USD", "CPI y/y", NOW, forecast="3.5%")
    event("EUR", "CPI Flash Estimate y/y", NOW)
    event("JPY", "Tokyo Core CPI y/y", NOW)
    params = {"from": (NOW - timedelta(days=1)).isoformat(), "to": (NOW + timedelta(days=1)).isoformat(), "mine": "1"}
    monkeypatch.setattr(news_views, "_my_currencies", lambda user: ["EUR", "USD"])
    body = api.get("/api/v1/news/calendar", params).json()
    assert body["my_currencies"] == ["EUR", "USD"] and {x["currency"] for x in body["events"]} == {"EUR", "USD"}
    monkeypatch.setattr(news_views, "_my_currencies", lambda user: [])
    assert api.get("/api/v1/news/calendar", params).json()["events"] == []  # no journal yet: nothing to match


def test_headlines_filters_and_pages(api, monkeypatch):
    usd, gbp = Currency.objects.get(code="USD"), Currency.objects.get(code="GBP")
    for i in range(33):
        Publication.objects.create(currency=usd, title=f"Speech {i}", url=f"https://www.federalreserve.gov/s{i}", published_at=NOW - timedelta(hours=i),
                                   topics=["rates"] if i % 2 else [], source="Federal Reserve", kind="speech", publisher="bank")
    Publication.objects.create(currency=gbp, title="GDP first estimate", url="https://www.ons.gov.uk/gdp", published_at=NOW - timedelta(minutes=30),
                               topics=["growth"], source="Office for National Statistics", kind="data", publisher="statistics")
    first = api.get("/api/v1/news/headlines").json()
    assert len(first["items"]) == 30 and first["next"] and first["items"][1]["title"] == "GDP first estimate"
    rest = api.get("/api/v1/news/headlines", {"before": first["next"]}).json()
    assert len(rest["items"]) == 4 and rest["next"] is None
    assert [x["title"] for x in api.get("/api/v1/news/headlines", {"publisher": "statistics"}).json()["items"]] == ["GDP first estimate"]
    rates = api.get("/api/v1/news/headlines", {"topic": "rates", "currency": "USD"}).json()["items"]
    assert len(rates) == 16 and all("rates" in x["topics"] for x in rates)
    assert api.get("/api/v1/news/headlines", {"kind": "data"}).json()["items"][0]["kind_text"] == "Data release"
    assert api.get("/api/v1/news/headlines", {"topic": "weather"}).status_code == 400


def test_scanner_lists_keep_to_high_and_medium():
    event("USD", "CPI y/y", NOW + timedelta(days=1), factor="inflation")
    event("USD", "Crude Oil Inventories", NOW + timedelta(days=1), impact="Low")
    assert [e["title"] for e in evidence.calendar(["USD"], back_days=0)] == ["CPI y/y"]
