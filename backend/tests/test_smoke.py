import hashlib
import hmac
import time

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def refresh(client):
    return client.post("/api/v1/auth/refresh", HTTP_X_CSRFTOKEN=client.cookies["ep_csrf"].value)

SIGNUP = {"first_name": "Ada", "last_name": "Obi", "email": "ada@example.com", "password": "a-long-passphrase-42", "over_18": True}


def test_register_refresh_and_me():
    client = APIClient()
    res = client.post("/api/v1/auth/register", SIGNUP, format="json")
    assert res.status_code == 201
    assert "ep_refresh" in res.cookies

    res = refresh(client)
    assert res.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.json()['access']}")
    assert client.get("/api/v1/me").json()["email"] == "ada@example.com"


def test_reused_refresh_token_revokes_sessions():
    client = APIClient()
    client.post("/api/v1/auth/register", SIGNUP, format="json")
    old = client.cookies["ep_refresh"].value
    csrf = client.cookies["ep_csrf"].value
    assert refresh(client).status_code == 200

    thief = APIClient()
    thief.cookies["ep_refresh"] = old
    thief.cookies["ep_csrf"] = csrf
    assert thief.post("/api/v1/auth/refresh", HTTP_X_CSRFTOKEN=csrf).status_code == 401
    # The legitimate, rotated session is revoked too.
    assert refresh(client).status_code == 401


def test_refresh_requires_csrf_header():
    client = APIClient()
    client.post("/api/v1/auth/register", SIGNUP, format="json")
    assert client.post("/api/v1/auth/refresh").status_code == 403


def test_signup_requires_age_statement():
    res = APIClient().post("/api/v1/auth/register", {**SIGNUP, "over_18": False}, format="json")
    assert res.status_code == 400
    assert res.json()["code"] and "over_18" in res.json()["fields"]


def test_sweep_requires_valid_signature(settings):
    client = APIClient()
    assert client.post("/internal/jobs/sweep").status_code in (401, 403)
    ts = str(int(time.time()))
    sig = hmac.new(settings.SWEEP_HMAC_SECRET.encode(), f"{ts}.".encode(), hashlib.sha256).hexdigest()
    res = client.post("/internal/jobs/sweep", HTTP_X_SWEEP_TIMESTAMP=ts, HTTP_X_SWEEP_SIGNATURE=sig)
    assert res.status_code == 200
