"""Strategy Lab API (rulebook-builder.md §3.8): access, limits, isolation, autosave, Gate 3, versions, examples."""

import copy
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academy.models import Lesson, LessonProgress, Level, Module
from apps.accounts.models import User
from apps.core.models import UploadIntent
from apps.gates.models import GatePass

pytestmark = pytest.mark.django_db

FIXTURE = json.loads((Path(__file__).resolve().parents[2] / "docs/strategy-lab/fixtures/01-trend-pullback-ema.json").read_text(encoding="utf-8"))
REQUIRED = ["l6-from-an-idea-to-a-rulebook", "l6-writing-rules-anyone-could-follow"]


def make_client(email):
    c = APIClient()
    body = {"first_name": "A", "last_name": "B", "email": email, "password": "a-long-passphrase-42", "over_18": True}
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {c.post('/api/v1/auth/register', body, format='json').json()['access']}")
    c.user = User.objects.get(email=email)
    return c


@pytest.fixture
def lessons():
    level = Level.objects.create(order=6, slug="strategy-design", title="Strategy design", status="published")
    module = Module.objects.create(level=level, order=1, slug="ideas-to-rules", title="Ideas to rules", status="published")
    return [Lesson.objects.create(module=module, order=i, slug=s, title=s, status="published", block_count=2) for i, s in enumerate(REQUIRED)]


def complete(user, lessons):
    for lesson in lessons:
        LessonProgress.objects.create(user=user, lesson=lesson, completed_blocks=[0, 1], completed_at=timezone.now())


@pytest.fixture
def client(lessons):
    c = make_client("lab@example.com")
    complete(c.user, lessons)
    return c


def new_strategy(c, name="My first rulebook"):
    res = c.post("/api/v1/strategies", {"name": name}, format="json")
    assert res.status_code == 201, res.json()
    s = res.json()
    return s, c.get(f"/api/v1/versions/{s['latest']['id']}").json()


def fill(c, version):
    """Autosave the fixture's document and add its examples, so every check passes."""
    doc = copy.deepcopy(FIXTURE["version"])
    res = c.patch(f"/api/v1/versions/{version['id']}", {**doc, "revision": version["revision"]}, format="json")
    assert res.status_code == 200, res.json()
    for ex in FIXTURE["examples"]:
        key = f"u/{c.user.id}/{ex['rule_key']}-{ex['valid']}.webp"
        UploadIntent.objects.create(user=c.user, key=key, content_type="image/webp", size=10, confirmed_at=timezone.now())
        res = c.post(f"/api/v1/versions/{version['id']}/examples", {**ex, "image_key": key, "note": "Shows the rule clearly enough."}, format="json")
        assert res.status_code == 201, res.json()
    return res


def test_lab_locked_until_strategy_lessons(lessons):
    c = make_client("new@example.com")
    access = c.get("/api/v1/strategy-lab/access").json()
    assert access == {"open": False, "requirement_met": False, "gates_open": False,
                      "required": [{"slug": s, "title": s, "done": False} for s in REQUIRED]}
    res = c.post("/api/v1/strategies", {"name": "Too early"}, format="json")
    assert res.status_code == 409 and res.json()["code"] == "lab_locked" and len(res.json()["required"]) == 2
    complete(c.user, lessons)
    assert c.get("/api/v1/strategy-lab/access").json()["open"] is True
    assert c.post("/api/v1/strategies", {"name": "Now open"}, format="json").status_code == 201


def test_development_build_opens_the_lab(lessons, settings):
    settings.OPEN_GATES = True
    c = make_client("dev@example.com")
    access = c.get("/api/v1/strategy-lab/access").json()
    assert access["open"] is True and access["requirement_met"] is False and access["gates_open"] is True
    assert c.post("/api/v1/strategies", {"name": "Dev draft"}, format="json").status_code == 201


def test_five_active_strategies_at_most(client):
    ids = [new_strategy(client, f"Strategy {i}")[0]["id"] for i in range(5)]
    res = client.post("/api/v1/strategies", {"name": "Sixth"}, format="json")
    assert res.status_code == 409 and res.json()["code"] == "strategy_limit"
    assert client.patch(f"/api/v1/strategies/{ids[0]}", {"status": "archived"}, format="json").status_code == 200
    assert client.post("/api/v1/strategies", {"name": "Sixth"}, format="json").status_code == 201
    res = client.patch(f"/api/v1/strategies/{ids[0]}", {"status": "active"}, format="json")
    assert res.status_code == 409 and res.json()["code"] == "strategy_limit"


def test_users_cannot_reach_each_other(client, lessons):
    s, v = new_strategy(client)
    other = make_client("other@example.com")
    complete(other.user, lessons)
    for method, url in [
        ("get", f"/api/v1/strategies/{s['id']}"),
        ("get", f"/api/v1/versions/{v['id']}"),
        ("patch", f"/api/v1/versions/{v['id']}"),
        ("post", f"/api/v1/versions/{v['id']}/gate-3"),
        ("post", f"/api/v1/versions/{v['id']}/examples"),
        ("post", f"/api/v1/strategies/{s['id']}/versions"),
    ]:
        assert getattr(other, method)(url, {"revision": 0}, format="json").status_code == 404, url
    assert other.get("/api/v1/strategies").json() == []


def test_autosave_validates_and_detects_conflicts(client):
    _, v = new_strategy(client)
    url = f"/api/v1/versions/{v['id']}"
    ok = client.patch(url, {"rules": {**v["rules"], "idea": "Pullbacks in a trend."}, "revision": 0}, format="json")
    assert ok.status_code == 200 and ok.json()["revision"] == 1
    stale = client.patch(url, {"rules": v["rules"], "revision": 0}, format="json")
    assert stale.status_code == 409 and stale.json()["code"] == "stale_revision"
    assert stale.json()["server"]["revision"] == 1 and stale.json()["server"]["rules"]["idea"] == "Pullbacks in a trend."
    bad = copy.deepcopy(v["rules"])
    bad["market"]["timeframes"] = ["H2"]
    res = client.patch(url, {"rules": bad, "revision": 1}, format="json")
    assert res.status_code == 400 and "document" in res.json()["fields"]


def test_gate_3_is_decided_by_the_server(client):
    _, v = new_strategy(client)
    url = f"/api/v1/versions/{v['id']}"
    # Client-sent status fields are ignored; the draft is still failing.
    client.patch(url, {"rules": v["rules"], "revision": 0, "clarity_status": "passing", "locked": True}, format="json")
    res = client.post(f"{url}/gate-3")
    assert res.status_code == 409 and res.json()["code"] == "clarity_failing"
    assert "STOP_MISSING" in {i["code"] for i in res.json()["report"]["items"]}
    assert not GatePass.objects.filter(gate=3).exists()

    v = client.get(url).json()
    fill(client, v)
    report = client.post(f"{url}/clarity-check").json()
    assert report["passed"] is True and report["kind"] == "mechanical"
    locked = client.post(f"{url}/gate-3")
    assert locked.status_code == 200 and locked.json()["locked"] is True
    gate = GatePass.objects.get(gate=3)
    assert str(gate.strategy_version_id) == v["id"] and gate.evidence["clarity"] == "passing"
    assert client.post(f"{url}/gate-3").status_code == 200  # idempotent
    assert GatePass.objects.filter(gate=3).count() == 1
    # Locked: no more autosaves, no deleting examples.
    res = client.patch(url, {"rules": v["rules"], "revision": locked.json()["revision"]}, format="json")
    assert res.status_code == 409 and res.json()["code"] == "version_locked"
    example = locked.json()["examples"][0]["id"]
    assert client.delete(f"/api/v1/examples/{example}").status_code == 409


def test_new_version_needs_a_reason_and_copies_the_rules(client):
    s, v = new_strategy(client)
    res = client.post(f"/api/v1/strategies/{s['id']}/versions", {"reason": "Tighter stop"}, format="json")
    assert res.status_code == 409 and res.json()["code"] == "draft_exists"
    fill(client, v)
    client.post(f"/api/v1/versions/{v['id']}/gate-3")
    assert client.post(f"/api/v1/strategies/{s['id']}/versions", {"reason": "short"}, format="json").status_code == 400
    res = client.post(f"/api/v1/strategies/{s['id']}/versions", {"reason": "Testing a wider stop buffer on swings."}, format="json")
    assert res.status_code == 201
    v2 = res.json()
    assert v2["number"] == 2 and not v2["locked"] and v2["rules"] == FIXTURE["version"]["rules"]
    assert v2["examples"] == []  # examples belong to their version
    history = client.get(f"/api/v1/strategies/{s['id']}/versions").json()
    assert [h["number"] for h in history] == [2, 1] and history[0]["reason"].startswith("Testing")


def test_examples_need_a_confirmed_upload_and_a_note(client):
    _, v = new_strategy(client)
    url = f"/api/v1/versions/{v['id']}/examples"
    res = client.post(url, {"rule_key": "c1", "valid": True, "image_key": "u/nope.webp", "note": "A chart"}, format="json")
    assert res.status_code == 400 and "image_key" in res.json()["fields"]
    key = f"u/{client.user.id}/ok.webp"
    UploadIntent.objects.create(user=client.user, key=key, content_type="image/webp", size=10, confirmed_at=timezone.now())
    res = client.post(url, {"rule_key": "c1", "valid": True, "image_key": key, "note": "ok"}, format="json")
    assert res.status_code == 400 and "note" in res.json()["fields"]
    res = client.post(url, {"rule_key": "c1", "valid": True, "image_key": key, "note": "Closes above the 50 EMA.",
                            "annotations": [{"shape": "arrow", "x1": 0.1, "y1": 0.2, "x2": 0.5, "y2": 0.5}]}, format="json")
    assert res.status_code == 201 and res.json()["annotations"][0]["shape"] == "arrow"
    bad = client.patch(f"/api/v1/examples/{res.json()['id']}", {"annotations": [{"shape": "circle", "x1": 2}]}, format="json")
    assert bad.status_code == 400
    assert client.delete(f"/api/v1/examples/{res.json()['id']}").status_code == 204


def test_plan_warnings_on_linked_trades(client):
    _, v = new_strategy(client)
    fill(client, v)
    account = client.get("/api/v1/me/trading-accounts").json()[0]
    client.patch(f"/api/v1/me/trading-accounts/{account['id']}", {"balance": "1000"}, format="json")
    t0 = datetime(2026, 3, 2, 8, tzinfo=UTC)

    def log(i, exit_price, hours=1):
        opened = t0 + timedelta(hours=i * 2)
        body = {"account": account["id"], "strategy_version": v["id"], "instrument": "EUR/USD", "side": "buy",
                "entry": "1.1000", "initial_stop": "1.0995", "exit_price": exit_price, "size": "0.1",
                "opened_at": opened.isoformat(), "closed_at": (opened + timedelta(hours=hours)).isoformat()}
        res = client.post("/api/v1/me/trades", body, format="json")
        assert res.status_code == 201, res.json()
        return res.json()

    # Risk $5 on $1,000 = 0.5%: within the plan.
    first = log(0, "1.0995")
    assert first["plan_warnings"] == []
    log(1, "1.0995")
    log(2, "1.0995")
    fourth = log(3, "1.1010")
    codes = {w["code"] for w in fourth["plan_warnings"]}
    # Three losses in a row (−3R): the daily limit, the trades-per-day cap and the streak rule all apply.
    assert codes == {"daily_limit", "trades_per_day", "losing_streak"}
    listed = client.get("/api/v1/me/trades").json()["results"]
    assert {w["code"] for w in listed[0]["plan_warnings"]} == codes
    # Oversized trade: 2% risk against a 0.5% plan.
    big = client.post("/api/v1/me/trades", {**{k: v for k, v in fourth.items() if k in ("account", "instrument", "side", "entry", "initial_stop", "exit_price")},
                                            "strategy_version": v["id"], "size": "0.4", "opened_at": "2026-03-09T08:00:00Z",
                                            "closed_at": "2026-03-09T09:00:00Z"}, format="json").json()
    assert {w["code"] for w in big["plan_warnings"]} == {"risk_above_plan_x125"}
    # Unlinked trades never carry plan warnings.
    plain = client.post("/api/v1/me/trades", {"account": account["id"], "instrument": "EUR/USD", "side": "buy", "entry": "1.1",
                                              "initial_stop": "1.09", "size": "1", "opened_at": "2026-03-10T08:00:00Z"}, format="json").json()
    assert plain["plan_warnings"] == [] and plain["strategy_version"] is None
