import pytest
from rest_framework.test import APIClient

from apps.accounts.models import NeverAgainItem
from apps.accounts.services import suggest_style
from apps.gates.models import GatePass

pytestmark = pytest.mark.django_db

SIGNUP = {
    "first_name": "Chidi",
    "last_name": "Okafor",
    "email": "chidi@example.com",
    "password": "a-long-passphrase-42",
    "over_18": True,
}
TIME = {"weekly_hours": 6, "timezone": "Africa/Lagos", "sessions": ["london"]}
EXPERIENCE = {
    "years_trading": "1to3",
    "accounts_blown": 2,
    "prop_challenges": 1,
    "usual_mistakes": ["no_stop", "revenge"],
    "other_mistake": "",
}


@pytest.fixture
def client():
    c = APIClient()
    access = c.post("/api/v1/auth/register", SIGNUP, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return c


def test_register_stores_names_and_starts_onboarding(client):
    me = client.get("/api/v1/me").json()
    assert (me["first_name"], me["last_name"]) == ("Chidi", "Okafor")
    assert me["onboarding_step"] == 2
    assert me["plan_accepted_at"] is None


def test_full_onboarding_flow_passes_gate_1(client):
    assert client.put("/api/v1/me/onboarding/time", TIME, format="json").status_code == 200
    assert client.put("/api/v1/me/onboarding/experience", EXPERIENCE, format="json").status_code == 200

    plan = client.get("/api/v1/me/plan").json()
    assert plan["style"]["key"] == "swing"  # 6 hours a week
    assert plan["sessions"][0]["key"] == "london"
    assert plan["time_to_lab"]["weeks"] == 5  # 26 hours at 6 a week
    assert plan["placement"]["offered"] is True
    assert len(plan["never_again"]) == 2

    assert client.post("/api/v1/me/plan/accept").status_code == 200
    assert GatePass.objects.filter(gate=1, revoked_at__isnull=True).count() == 1
    assert client.get("/api/v1/me").json()["onboarding_step"] == 5


def test_steps_cannot_be_skipped(client):
    assert client.put("/api/v1/me/onboarding/experience", EXPERIENCE, format="json").status_code == 409
    assert client.get("/api/v1/me/plan").status_code == 409
    assert client.post("/api/v1/me/plan/accept").status_code == 409


def test_never_again_seeding_does_not_duplicate(client):
    client.put("/api/v1/me/onboarding/time", TIME, format="json")
    client.put("/api/v1/me/onboarding/experience", EXPERIENCE, format="json")
    client.put("/api/v1/me/onboarding/experience", EXPERIENCE, format="json")
    assert NeverAgainItem.objects.count() == 2


def test_profile_section_updates_user_and_profile(client):
    res = client.patch("/api/v1/me", {"first_name": "Chidinma", "timezone": "Europe/London"}, format="json")
    assert res.status_code == 200 and res.json()["first_name"] == "Chidinma"
    assert client.patch("/api/v1/me", {"timezone": "Mars/Base"}, format="json").status_code == 400
    assert client.patch("/api/v1/me", {"email": "x@example.com"}, format="json").json()["email"] == SIGNUP["email"]

    res = client.patch("/api/v1/me/profile", {"weekly_hours": 16, "sessions": ["new_york"]}, format="json")
    assert res.status_code == 200 and res.json()["weekly_hours"] == 16


def test_users_cannot_see_each_others_profile(client):
    other = APIClient()
    access = other.post("/api/v1/auth/register", {**SIGNUP, "email": "b@example.com"}, format="json").json()["access"]
    other.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    client.patch("/api/v1/me/profile", {"weekly_hours": 20}, format="json")
    assert other.get("/api/v1/me/profile").json()["weekly_hours"] is None


@pytest.mark.parametrize(
    ("hours", "sessions", "style"),
    [
        (3, ["london"], "position"),
        (6, ["london", "new_york"], "swing"),
        (20, ["asia"], "swing"),  # no major-session overlap
        (10, ["london"], "swing"),
        (15, ["new_york"], "day"),
    ],
)
def test_style_suggestion_follows_spec(hours, sessions, style):
    assert suggest_style(hours, sessions) == style
