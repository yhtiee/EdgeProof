"""Practice journal (JR-1 to JR-11), uploads and reviews."""

import io
import uuid

import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.testing.services import safe_cell

pytestmark = pytest.mark.django_db


def make_client(email):
    c = APIClient()
    body = {"first_name": "A", "last_name": "B", "email": email, "password": "a-long-passphrase-42", "over_18": True}
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {c.post('/api/v1/auth/register', body, format='json').json()['access']}")
    return c


@pytest.fixture
def client():
    return make_client("j@example.com")


@pytest.fixture
def account(client):
    return client.get("/api/v1/me/trading-accounts").json()[0]  # created on first visit (USD demo)


def trade(client, account, **kw):
    body = {
        "account": account["id"], "instrument": "EUR/USD", "side": "buy", "entry": "1.1000", "initial_stop": "1.0950",
        "size": "0.1", "opened_at": "2026-03-02T09:00:00Z", "closed_at": "2026-03-02T15:00:00Z", "exit_price": "1.1100",
        "rule_checks": [{"rule": "Setup", "followed": True}],
    }
    body.update(kw)
    return client.post("/api/v1/me/trades", {k: v for k, v in body.items() if v is not None}, format="json")


def test_first_visit_creates_a_practice_account_and_rules(client):
    accounts = client.get("/api/v1/me/trading-accounts").json()
    assert [a["name"] for a in accounts] == ["Practice"] and accounts[0]["currency"] == "USD"
    assert len(client.get("/api/v1/me/practice-rules").json()) == 5


def test_r_from_prices_with_costs(client, account):
    # 0.1 lot = 10,000 units; risk 50 pips = $50; gross +100 pips = $100; net 100 − 2 − 1 = $97.
    t = trade(client, account, fees="2", swap="-1").json()
    assert t["initial_risk_ccy"] == "50.00" and t["gross_pnl"] == "100.00" and t["pnl"] == "97.00"
    assert t["r_result"] == pytest.approx(1.94) and not t["r_estimated"]
    assert t["outcome"] == "win" and t["market_session"] == "london" and t["rules_followed"]


def test_other_quote_currency_needs_money_figures(client, account):
    est = trade(client, account, instrument="usdjpy", entry="150.00", initial_stop="149.50", exit_price="149.75").json()
    assert est["instrument"] == "USD/JPY" and est["r_estimated"] and est["r_result"] == pytest.approx(-0.5)
    exact = trade(client, account, instrument="USD/JPY", entry="150.00", initial_stop="149.50", exit_price="149.75",
                  initial_risk_ccy="33.40", gross_pnl="-16.70").json()
    assert not exact["r_estimated"] and exact["r_result"] == pytest.approx(-0.5) and exact["outcome"] == "loss"


def test_no_stop_is_a_rule_break(client, account):
    t = trade(client, account, initial_stop=None).json()
    assert t["r_result"] is None and not t["rules_followed"] and t["broken_rules"] == ["No initial stop"]
    unticked = trade(client, account, rule_checks=[{"rule": "Session", "followed": False}]).json()
    assert unticked["broken_rules"] == ["Session"]


def test_stop_validation_and_immutability(client, account):
    bad = trade(client, account, initial_stop="1.1050")
    assert bad.status_code == 400 and "below" in bad.json()["fields"]["initial_stop"][0]
    t = trade(client, account).json()
    res = client.patch(f"/api/v1/me/trades/{t['id']}", {"initial_stop": "1.0900"}, format="json")
    assert res.status_code == 400 and "initial_stop" in res.json()["fields"]
    # Other fields can change; P&L follows the new exit.
    res = client.patch(f"/api/v1/me/trades/{t['id']}", {"exit_price": "1.0950", "initial_stop": "1.0950"}, format="json")
    assert res.status_code == 200 and res.json()["r_result"] == pytest.approx(-1) and res.json()["gross_pnl"] == "-50.00"


def test_offline_resend_updates_instead_of_duplicating(client, account):
    cid = uuid.uuid4().hex
    first = trade(client, account, client_id=cid)
    again = trade(client, account, client_id=cid, notes="edited offline")
    assert first.status_code == 201 and again.status_code == 200
    assert first.json()["id"] == again.json()["id"] and again.json()["notes"] == "edited offline"
    assert len(client.get("/api/v1/me/trades").json()["results"]) == 1


def test_after_loss_flag_follows_order(client, account):
    loss = trade(client, account, exit_price="1.0950", opened_at="2026-03-02T09:00:00Z", closed_at="2026-03-02T10:00:00Z").json()
    nxt = trade(client, account, opened_at="2026-03-02T11:00:00Z", closed_at="2026-03-02T12:00:00Z").json()
    assert loss["outcome"] == "loss"
    assert client.get(f"/api/v1/me/trades/{nxt['id']}").json()["after_loss"] is True
    client.delete(f"/api/v1/me/trades/{loss['id']}")
    assert client.get(f"/api/v1/me/trades/{nxt['id']}").json()["after_loss"] is False


def test_partial_closes_merge(client, account):
    t = trade(client, account, size="0.2", exit_price=None, exits=[{"price": "1.1050", "size": "0.1"}, {"price": "1.1150", "size": "0.1"}]).json()
    assert t["exit_price"].startswith("1.1100") and t["r_result"] == pytest.approx(2)
    bad = trade(client, account, size="0.2", exit_price=None, exits=[{"price": "1.1", "size": "0.1"}])
    assert bad.status_code == 400 and "exits" in bad.json()["fields"]


def test_open_trade_and_close_time_rules(client, account):
    open_t = trade(client, account, exit_price=None, closed_at=None).json()
    assert open_t["outcome"] == "open" and open_t["r_result"] is None
    res = trade(client, account, closed_at=None)
    assert res.status_code == 400 and "closed_at" in res.json()["fields"]


def test_search_and_filters(client, account):
    trade(client, account, notes="Chased the London open", tags=["FOMO"])
    trade(client, account, instrument="GBP/USD", entry="1.2700", initial_stop="1.2650", exit_price="1.2650")
    get = lambda q: client.get(f"/api/v1/me/trades?{q}").json()["results"]
    assert len(get("q=london")) == 1 and len(get("q=fomo")) == 1
    assert len(get("outcome=loss")) == 1 and len(get("instrument=GBP/USD")) == 1


def test_users_cannot_see_each_other(client, account):
    t = trade(client, account).json()
    other = make_client("other@example.com")
    assert other.get(f"/api/v1/me/trades/{t['id']}").status_code == 404
    other_account = other.get("/api/v1/me/trading-accounts").json()[0]
    res = trade(client, other_account)
    assert res.status_code == 400 and "account" in res.json()["fields"]


def test_csv_export_escapes_formulas(client, account):
    trade(client, account, notes="=HYPERLINK(\"http://x\")", setup_key="+breakout")
    res = client.get("/api/v1/me/trades/export.csv")
    text = res.content.decode()
    assert res["Content-Type"].startswith("text/csv")
    assert "'=HYPERLINK" in text and "'+breakout" in text
    assert safe_cell(-1.5) == "-1.5" and safe_cell("-cmd") == "'-cmd" and safe_cell("@x") == "'@x"


def test_metrics_and_activity(client, account):
    for i in range(3):
        trade(client, account, opened_at=f"2026-03-0{i + 2}T09:00:00Z", closed_at=f"2026-03-0{i + 2}T10:00:00Z")
    trade(client, account, exit_price="1.0950", opened_at="2026-03-06T09:00:00Z", closed_at="2026-03-06T10:00:00Z")
    m = client.get("/api/v1/me/journal/metrics").json()
    assert m["trades"] == 4 and m["win_rate"] == pytest.approx(0.75)
    assert m["expectancy"] == pytest.approx((2 * 3 - 1) / 4)
    assert m["risk_per_trade_pct"] == 1.0 and m["breakdowns"]["instrument"][0]["key"] == "EUR/USD"
    act = client.get("/api/v1/me/journal/activity").json()
    assert act["logged_today"] and act["streak"] == 1 and act["total_trades"] == 4


def png_bytes():
    out = io.BytesIO()
    img = Image.new("RGB", (2400, 1200), "navy")
    exif = Image.Exif()
    exif[0x010E] = "secret description"
    img.save(out, "PNG", exif=exif)
    return out.getvalue()


def test_screenshot_upload_reencodes_and_stays_private(client, account, settings, tmp_path):
    settings.STORAGES = {**settings.STORAGES, "default": {"BACKEND": "django.core.files.storage.FileSystemStorage", "OPTIONS": {"location": str(tmp_path)}}}
    data = png_bytes()
    assert client.post("/api/v1/uploads/presign", {"content_type": "application/pdf", "size": 10}, format="json").status_code == 400
    assert client.post("/api/v1/uploads/presign", {"content_type": "image/png", "size": 6 * 1024 * 1024}, format="json").status_code == 400
    p = client.post("/api/v1/uploads/presign", {"content_type": "image/png", "size": len(data)}, format="json").json()
    assert p["url"].endswith("/local") and p["auth"] is True
    put = client.generic("PUT", p["url"], data, content_type="image/png")
    assert put.status_code == 204
    # Not attachable before it's confirmed.
    assert trade(client, account, images=[{"key": p["key"], "kind": "before"}]).status_code == 400
    conf = client.post(f"/api/v1/uploads/{p['key']}/confirm").json()
    assert conf["width"] == 1600 and conf["height"] == 800
    img = client.get(f"/api/v1/uploads/{p['key']}")
    assert img["Content-Type"] == "image/webp"
    decoded = Image.open(io.BytesIO(img.content))
    assert decoded.format == "WEBP" and not decoded.getexif()
    t = trade(client, account, images=[{"key": p["key"], "kind": "before"}]).json()
    assert t["images"] == [{"key": p["key"], "kind": "before"}]
    assert make_client("spy@example.com").get(f"/api/v1/uploads/{p['key']}").status_code == 404
    # Removing it from the trade deletes the file.
    client.patch(f"/api/v1/me/trades/{t['id']}", {"images": []}, format="json")
    assert client.get(f"/api/v1/uploads/{p['key']}").status_code == 404


def test_reviews_save_once_per_period(client):
    body = {"kind": "daily", "period": "2026-03-02", "answers": {"q1": "Yes", "q2": "", "q3": "Same again"}}
    assert client.post("/api/v1/me/reviews", body, format="json").status_code == 201
    body["answers"]["q1"] = "Mostly"
    assert client.post("/api/v1/me/reviews", body, format="json").status_code == 200
    listing = client.get("/api/v1/me/reviews?kind=daily").json()
    assert len(listing["results"]) == 1 and listing["results"][0]["answers"]["q1"] == "Mostly"
    assert len(listing["questions"]["weekly"]) == 5
    weekly = client.post("/api/v1/me/reviews", {"kind": "weekly", "period": "2026-03-05", "answers": {"q5": "Patience"}}, format="json")
    assert weekly.json()["period"] == "2026-03-02"  # stored on the week's Monday
    assert client.post("/api/v1/me/reviews", {"kind": "daily", "period": "2026-03-03", "answers": {"q9": "x"}}, format="json").status_code == 400
