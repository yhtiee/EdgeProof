import json

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.gates.models import GatePass
from apps.gates.services import grant_gate

pytestmark = pytest.mark.django_db


def lesson(slug, order, screens=2):
    return {"slug": slug, "title": slug.upper(), "order": order, "minutes": 3, "status": "published", "screens": screens}


INDEX = {
    "levels": [
        {
            "order": 1, "slug": "foundations", "title": "Foundations", "phase": 1,
            "modules": [
                {"order": 1, "slug": "mod-a", "title": "A", "lessons": [lesson("a1", 1), lesson("a2", 2)]},
                {"order": 2, "slug": "mod-b", "title": "B", "lessons": [lesson("b1", 1)]},
            ],
        },
        {
            "order": 2, "slug": "risk", "title": "Risk", "phase": 1,
            "modules": [{"order": 1, "slug": "mod-c", "title": "C", "lessons": [lesson("c1", 1)]}],
        },
    ]
}


def bank(prefix, lesson_slug, n=4):
    return [
        {
            "key": f"{prefix}-{i}",
            "type": "mc",
            "prompt": f"{prefix} question {i}?",
            "options": [{"key": "a", "text": "No"}, {"key": "b", "text": "Yes"}],
            "answer": "b",
            "explanation": "Because.",
            "lessons": [lesson_slug],
        }
        for i in range(1, n + 1)
    ]


EXAMS = {
    "questions": bank("qa", "a1") + bank("qb", "b1") + bank("qc", "c1"),
    "exams": [
        {"key": "m-mod-a", "scope": "module", "level": 1, "module": "mod-a", "title": "A exam", "draw": 2, "pass_mark": 0.8,
         "bank": [f"qa-{i}" for i in range(1, 5)]},
        {"key": "m-mod-b", "scope": "module", "level": 1, "module": "mod-b", "title": "B exam", "draw": 2, "pass_mark": 0.8,
         "bank": [f"qb-{i}" for i in range(1, 5)]},
        {"key": "l-1", "scope": "level", "level": 1, "title": "Level 1 exam", "draw": 4, "pass_mark": 0.8,
         "bank": [f"q{m}-{i}" for m in "ab" for i in range(1, 5)]},
        {"key": "p-1", "scope": "placement", "level": 1, "title": "Level 1 placement", "draw": 4, "pass_mark": 0.9,
         "bank": [f"q{m}-{i}" for m in "ab" for i in range(1, 5)]},
        {"key": "m-mod-c", "scope": "module", "level": 2, "module": "mod-c", "title": "C exam", "draw": 2, "pass_mark": 0.8,
         "bank": [f"qc-{i}" for i in range(1, 5)]},
    ],
}


@pytest.fixture
def synced(tmp_path):
    idx, ex = tmp_path / "index.json", tmp_path / "exams.json"
    idx.write_text(json.dumps(INDEX))
    ex.write_text(json.dumps(EXAMS))
    call_command("sync_curriculum", str(idx))
    call_command("sync_exams", str(ex))


@pytest.fixture
def client(synced):
    c = APIClient()
    body = {"first_name": "A", "last_name": "B", "email": "a@example.com", "password": "a-long-passphrase-42", "over_18": True}
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {c.post('/api/v1/auth/register', body, format='json').json()['access']}")
    grant_gate(User.objects.get(email="a@example.com"), gate=1, evidence={})
    return c


def finish(c, slug, screens=2):
    return c.post(f"/api/v1/lessons/{slug}/progress", {"completed_blocks": list(range(screens))}, format="json")


def take(c, key, right=True):
    attempt = c.post(f"/api/v1/exams/{key}/attempts").json()
    answers = {q["id"]: ("b" if right else "a") for q in attempt["questions"]}
    return attempt, c.post(f"/api/v1/attempts/{attempt['id']}/submit", {"answers": answers}, format="json").json()


def keys_in(obj):
    if isinstance(obj, dict):
        return set(obj) | {k for v in obj.values() for k in keys_in(v)}
    if isinstance(obj, list):
        return {k for v in obj for k in keys_in(v)}
    return set()


def test_module_exam_gates_the_next_module(client):
    finish(client, "a1")
    finish(client, "a2")
    locked = finish(client, "b1")
    assert locked.status_code == 409 and locked.json()["next"] == {"kind": "exam", "key": "m-mod-a"}
    _, result = take(client, "m-mod-a")
    assert result["passed"] is True
    assert finish(client, "b1").status_code == 200


def test_exam_locked_until_its_lessons_are_done(client):
    res = client.post("/api/v1/exams/m-mod-a/attempts")
    assert res.status_code == 409 and res.json()["code"] == "exam_locked"
    assert res.json()["next"] == {"kind": "lesson", "key": "a1"}


def test_answers_never_reach_the_learner(client):
    finish(client, "a1")
    finish(client, "a2")
    attempt, result = take(client, "m-mod-a", right=False)
    for payload in (attempt, result, client.get("/api/v1/me/exams").json()):
        assert not keys_in(payload) & {"answer", "tolerance", "explanation"}
    assert result["passed"] is False
    assert result["review_lessons"] == [{"slug": "a1", "title": "A1"}]


def test_retake_draws_different_questions_then_cooldown(client):
    finish(client, "a1")
    finish(client, "a2")
    first, r1 = take(client, "m-mod-a", right=False)
    assert r1["can_retake_now"] is True
    second, r2 = take(client, "m-mod-a", right=False)
    assert not {q["id"] for q in first["questions"]} & {q["id"] for q in second["questions"]}
    assert r2["can_retake_now"] is False and r2["cooldown_until"]
    res = client.post("/api/v1/exams/m-mod-a/attempts")
    assert res.status_code == 409 and res.json()["code"] == "exam_cooldown"


def test_placement_skips_a_level_and_grants_gate_2_when_all_levels_done(client):
    # Level 2 is locked for a new learner...
    assert finish(client, "c1").status_code == 409
    # ...until a level 1 placement pass, which counts the whole level as done.
    _, result = take(client, "p-1")
    assert result["passed"] is True
    assert finish(client, "c1").status_code == 200
    status = {e["key"]: e for e in client.get("/api/v1/me/exams").json()}
    assert status["p-1"]["passed"] and not status["m-mod-c"]["locked"]
    # Level 2 has no level or placement exam published here, so Gate 2 waits for it.
    assert not GatePass.objects.filter(gate=2).exists()


def test_my_exams_reports_locks_and_scores(client):
    status = {e["key"]: e for e in client.get("/api/v1/me/exams").json()}
    assert status["m-mod-a"]["locked"] and status["m-mod-a"]["blocker"]["key"] == "a1"
    assert not status["p-1"]["locked"]  # placement for level 1 is always open
    assert status["m-mod-c"]["locked"] and status["m-mod-c"]["level"] == 2


def test_development_build_opens_every_gate(client, settings):
    settings.OPEN_GATES = True
    # Lessons and exams out of order are allowed...
    assert finish(client, "c1").status_code == 200
    assert client.post("/api/v1/exams/m-mod-c/attempts").status_code == 201
    # ...while /me/exams still says what would block it on a deployed build.
    status = {e["key"]: e for e in client.get("/api/v1/me/exams").json()}
    assert status["m-mod-a"]["locked"] is False and status["m-mod-a"]["blocker"]["key"] == "a1"
    assert client.get("/api/v1/me").json()["gates_open"] is True


def test_gates_stay_closed_when_debug_is_off():
    import importlib
    import os

    from config.settings import base

    old = os.environ.get("DJANGO_DEBUG"), os.environ.get("OPEN_GATES")
    os.environ.update({"DJANGO_DEBUG": "false", "OPEN_GATES": "true", "DJANGO_SECRET_KEY": os.environ.get("DJANGO_SECRET_KEY", "x" * 50)})
    try:
        assert importlib.reload(base).OPEN_GATES is False
    finally:
        for k, v in zip(("DJANGO_DEBUG", "OPEN_GATES"), old):
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        importlib.reload(base)
