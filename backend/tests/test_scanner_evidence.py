"""Scanner evidence (official prints, central bank news, Forex Factory calendar) and "Explain it simply". No network, no real AI."""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps.ai import providers
from apps.ai.models import AIInteraction
from apps.scanner import evidence, explain
from apps.scanner.models import (
    CalendarEvent,
    Currency,
    DataSource,
    Explanation,
    Publication,
    RawObservation,
)
from apps.scanner.sources import calendar, news
from tests.test_scanner_api import TODAY, client, seeded  # noqa: F401 (fixture)

pytestmark = pytest.mark.django_db

RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>Bank</title>
<item><title>Monetary policy statement</title><link>http://www.boj.or.jp/en/mopo/a.htm</link><pubDate>Thu, 15 Oct 2026 10:30:00 +0900</pubDate><description>&lt;p&gt;The Board decided to raise the policy rate.&lt;/p&gt;</description></item>
<item><title>New banknote design and monetary policy</title><link>https://example.org/b</link><pubDate>Thu, 15 Oct 2026 10:30:00 +0900</pubDate></item>
<item><title>Staff party</title><link>https://example.org/c</link><pubDate>Thu, 15 Oct 2026 10:30:00 +0900</pubDate></item>
</channel></rss>"""
ATOM = b"""<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>2026-09-24 - Monetary policy assessment of 24 September 2026</title>
<link href="https://www.snb.ch/en/a"/><updated>2026-09-24T07:30:00Z</updated><summary>Inflation is expected to stay low.</summary></entry></feed>"""


def test_feed_parsing_tags_and_cleans():
    items = news.parse(RSS, "JPY")
    first = items[0]
    assert first.url == "https://www.boj.or.jp/en/mopo/a.htm"  # http upgraded
    assert first.summary == "The Board decided to raise the policy rate."
    assert first.topics == ["rates"]
    assert items[1].topics == []  # housekeeping excluded even with a topic word
    assert items[2].topics == []
    atom = news.parse(ATOM, "CHF")[0]
    assert atom.title == "Monetary policy assessment of 24 September 2026"  # SNB date prefix stripped
    assert set(atom.topics) == {"rates", "inflation"}
    assert atom.source == "Swiss National Bank"


def test_calendar_parsing_and_factors():
    events = calendar.parse([
        {"title": "CPI y/y", "country": "USD", "date": "2026-10-14T08:30:00-04:00", "impact": "High", "forecast": "3.6%", "previous": "3.4%"},
        {"title": "BOE Gov Bailey Speaks", "country": "GBP", "date": "2026-10-16T03:00:00+01:00", "impact": "High"},
        {"title": "Bank Holiday", "country": "JPY", "date": "2026-10-12T00:00:00-04:00", "impact": "Holiday"},
        {"title": "Trade Balance", "country": "CNY", "date": "2026-10-12T00:00:00-04:00", "impact": "High"},
        {"title": "Flash Manufacturing PMI", "country": "EUR", "date": "2026-10-23T04:00:00-04:00", "impact": "Medium"},
    ])
    assert [(e.currency, e.factor) for e in events] == [("USD", "inflation"), ("GBP", "rates"), ("EUR", "business")]
    assert events[0].forecast == "3.6%" and events[0].at.utcoffset() == timedelta(hours=-4)


def test_rate_history_reads_as_decisions(seeded):  # noqa: F811 (fixture)
    obs, _ = evidence.rate_decisions("USD")
    assert [o["value"] for o in obs] == [4.5, 4.0]
    assert obs[0]["change"] == 0.5 and obs[0]["current_as_of"] == (TODAY - timedelta(days=1)).isoformat()


@pytest.fixture
def extras(seeded):  # noqa: F811 (fixture)
    usd = Currency.objects.get(code="USD")
    Publication.objects.create(currency=usd, title="FOMC statement", url="https://www.federalreserve.gov/a", published_at=timezone.now() - timedelta(days=3),
                               summary="The Committee raised the target range.", topics=["rates"], source="Federal Reserve")
    Publication.objects.create(currency=usd, title="Old speech", url="https://www.federalreserve.gov/b", published_at=timezone.now() - timedelta(days=400),
                               topics=["rates"], source="Federal Reserve")
    CalendarEvent.objects.create(currency=usd, title="CPI y/y", at=timezone.now() + timedelta(days=3), impact="High", forecast="3.6%", previous="3.5%", factor="inflation")
    cache.clear()
    return seeded


def test_factor_evidence_endpoint(extras):
    c = client()
    body = c.get("/api/v1/scanner/factor/EURUSD/rates").json()
    eur, usd = body["sides"]
    assert (eur["code"], usd["code"]) == ("EUR", "USD")
    assert usd["official"]["url"].startswith("https://www.federalreserve.gov/")
    assert [n["title"] for n in usd["news"]] == ["FOMC statement"]  # recent only
    assert usd["observations"][0]["value"] == 4.5
    assert body["calendar_link"]["url"] == "https://www.forexfactory.com/calendar"

    infl = c.get("/api/v1/scanner/factor/USD/inflation").json()
    assert infl["calendar"][0]["title"] == "CPI y/y" and infl["calendar"][0]["upcoming"] is True
    assert len(infl["sides"]) == 1 and infl["sides"][0]["observations"][0]["period"] < TODAY.isoformat()

    usd = Currency.objects.get(code="USD")
    CalendarEvent.objects.create(currency=usd, title="Retail Sales m/m", at=timezone.now() - timedelta(hours=2), impact="High", factor="growth")
    cal = c.get("/api/v1/scanner/calendar/EURUSD").json()
    assert [e["title"] for e in cal["events"]] == ["CPI y/y"]  # coming up only: the release two hours ago is left out
    assert cal["link"]["url"].endswith("/calendar")

    trend = c.get("/api/v1/scanner/factor/EURUSD/trend").json()
    assert len(trend["sides"][0]["observations"]) == 30
    assert c.get("/api/v1/scanner/factor/EUR/trend").status_code == 404
    assert c.get("/api/v1/scanner/factor/EUR/vibes").status_code == 404
    assert c.get("/api/v1/scanner/factor/ABCDEF/rates").status_code == 404


def test_context_is_public_data_only(extras):
    from apps.scanner.views import latest_run

    text = explain.context(latest_run(), "EURUSD", "rates")
    assert "EUR/USD" in text and "FOMC statement" in text
    assert "scan@example.com" not in text
    assert TODAY.isoformat() not in text  # dates are written out ("17 October 2026")


GOOD = "**The data leans to the US dollar.**\n\n**What the data shows**\n- The Fed raised rates.\n\n**Keep in mind:** The scanner shows where the data leans, not what the price will do."
BAD = "EUR/USD will fall, so sell it now."


@pytest.fixture
def fake_ai(monkeypatch, settings):
    log = {"queue": [], "sent": []}

    def fake_stream(system, user, temperature=0.3):
        log["sent"].append((system, user))
        text = log["queue"].pop(0)
        if isinstance(text, Exception):
            raise text
        for i in range(0, len(text), 25):
            yield ("text", text[i:i + 25])
        yield ("usage", providers.Usage("gemini", "gemini-3.5-flash", input_tokens=900, output_tokens=150))

    monkeypatch.setattr(providers, "stream", fake_stream)
    return log


def events(res):
    import json

    return [json.loads(line[6:]) for line in b"".join(res.streaming_content).decode().split("\n\n") if line.startswith("data: ")]


def test_explain_streams_caches_and_counts(extras, fake_ai):
    c = client()
    fake_ai["queue"] = [GOOD]
    res = c.post("/api/v1/scanner/explain", {"subject": "eurusd"}, format="json", HTTP_ACCEPT="text/event-stream")
    assert res.status_code == 200
    ev = events(res)
    assert ev[0] == {"type": "meta", "remaining": 19, "cached": False}
    assert ev[-1]["type"] == "done" and ev[-1]["answer"] == GOOD
    system, prompt = fake_ai["sent"][0]
    assert "12-year-old" in system and "<scanner_data>" in prompt and "scan@example.com" not in prompt

    # Another learner gets the cached answer: no provider call, no count against their limit.
    other = client("other@example.com")
    ev = events(other.post("/api/v1/scanner/explain", {"subject": "EURUSD"}, format="json", HTTP_ACCEPT="text/event-stream"))
    assert ev[-1]["cached"] is True and len(fake_ai["sent"]) == 1
    assert other.get("/api/v1/scanner/explain/status").json()["remaining"] == 20
    assert Explanation.objects.get().hits == 1
    assert AIInteraction.objects.filter(feature="scanner_explain").count() == 2


def test_explain_rewrites_then_refuses_predictions(extras, fake_ai):
    c = client()
    fake_ai["queue"] = [BAD, BAD]
    ev = events(c.post("/api/v1/scanner/explain", {"subject": "EURUSD", "factor": "rates"}, format="json", HTTP_ACCEPT="text/event-stream"))
    assert [e["type"] for e in ev if e["type"] != "text"] == ["meta", "reset", "reset", "refused"]
    assert not Explanation.objects.exists()
    assert "broke a rule" in fake_ai["sent"][1][0]


def test_explain_blocks(extras, fake_ai, settings):
    c = client()
    assert c.post("/api/v1/scanner/explain", {"subject": "EUR", "factor": "trend"}, format="json").status_code == 404
    c.patch("/api/v1/me/settings/ai", {"ai_enabled": False}, format="json")
    res = c.post("/api/v1/scanner/explain", {"subject": "EUR"}, format="json")
    assert res.status_code == 409 and res.json()["code"] == "ai_disabled"
    c.patch("/api/v1/me/settings/ai", {"ai_enabled": True}, format="json")
    settings.AI = {**settings.AI, "scanner_daily_limit": 0}
    res = c.post("/api/v1/scanner/explain", {"subject": "EUR"}, format="json")
    assert res.status_code == 429 and res.json()["code"] == "explain_limit"
    assert c.get("/api/v1/scanner/explain/status").json()["available"] is True  # the limit only blocks new answers


def test_news_and_calendar_ingest(monkeypatch, seeded):  # noqa: F811 (fixture)
    monkeypatch.setattr(news, "fetch_all", lambda: (news.parse(RSS, "JPY"), []))
    monkeypatch.setattr(calendar, "fetch_all", lambda: (calendar.parse([
        {"title": "CPI y/y", "country": "USD", "date": "2026-10-14T08:30:00-04:00", "impact": "High", "forecast": "3.6%", "previous": "3.4%"},
    ]), []))
    from apps.scanner import ingest

    first = ingest.run_job("fetch_news")
    assert [r["ok"] for r in first] == [True, True]
    assert Publication.objects.count() == 1  # untagged items dropped
    again = ingest.run_job("fetch_news")
    assert again[0]["new"] == 0 and again[1]["updated"] == 1
    assert DataSource.objects.get(name="news").last_success_at is not None
    assert RawObservation.objects.exists()


def test_tidy_puts_labels_on_their_own_line():
    assert explain.tidy("**Why it matters for the pair** A higher rate...") == "**Why it matters for the pair**\nA higher rate..."
    assert explain.tidy("**What the data shows**\n- one") == "**What the data shows**\n- one"
