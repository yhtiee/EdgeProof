import json

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.academy.models import Lesson, Level, Module
from apps.gates.services import grant_gate

pytestmark = pytest.mark.django_db

INDEX = {
    "levels": [
        {
            "order": 1,
            "slug": "foundations",
            "title": "Foundations",
            "phase": 1,
            "modules": [
                {
                    "order": 1,
                    "slug": "how-forex-works",
                    "title": "How forex works",
                    "lessons": [
                        {"slug": "l1-a", "title": "A", "order": 1, "minutes": 4, "status": "published", "screens": 3},
                        {"slug": "l1-b", "title": "B", "order": 2, "minutes": 4, "status": "draft", "screens": 2},
                        {"slug": "l1-c", "title": "C", "order": 3, "minutes": 4, "status": "published", "screens": 2},
                    ],
                },
                {"order": 2, "slug": "pairs", "title": "Pairs", "lessons": []},
            ],
        },
        {"order": 3, "slug": "psychology", "title": "Psychology", "phase": 2, "modules": []},
    ]
}


@pytest.fixture
def index_file(tmp_path):
    path = tmp_path / "index.json"
    path.write_text(json.dumps(INDEX))
    return path


def user_client(email="a@example.com", gate1=True):
    c = APIClient()
    body = {"first_name": "A", "last_name": "B", "email": email, "password": "a-long-passphrase-42", "over_18": True}
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {c.post('/api/v1/auth/register', body, format='json').json()['access']}")
    if gate1:
        from apps.accounts.models import User

        grant_gate(User.objects.get(email=email), gate=1, evidence={})
    return c


def test_sync_mirrors_index_and_publication(index_file):
    call_command("sync_curriculum", str(index_file))
    assert Level.objects.get(slug="foundations").status == "published"
    assert Level.objects.get(slug="psychology").status == "draft"
    assert Module.objects.get(slug="pairs").status == "draft"
    assert Lesson.objects.get(slug="l1-a").block_count == 3
    assert Lesson.objects.get(slug="l1-b").status == "draft"

    # Idempotent, and lessons dropped from the index retire to draft.
    INDEX2 = json.loads(index_file.read_text())
    INDEX2["levels"][0]["modules"][0]["lessons"] = INDEX2["levels"][0]["modules"][0]["lessons"][1:]
    index_file.write_text(json.dumps(INDEX2))
    call_command("sync_curriculum", str(index_file))
    assert Lesson.objects.get(slug="l1-a").status == "draft"
    assert Lesson.objects.count() == 3


def test_progress_merges_and_completes(index_file):
    call_command("sync_curriculum", str(index_file))
    c = user_client()
    assert c.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [0]}, format="json").status_code == 200
    # Offline replay sends the full set again; it merges.
    res = c.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [0, 1, 2]}, format="json").json()
    assert res["completed_blocks"] == [0, 1, 2] and res["completed_at"] is not None
    listing = c.get("/api/v1/me/lesson-progress").json()
    assert listing == [{"lesson": "l1-a", "completed_blocks": [0, 1, 2], "completed_at": res["completed_at"]}]


def test_progress_rejects_out_of_range_and_unknown(index_file):
    call_command("sync_curriculum", str(index_file))
    c = user_client()
    assert c.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [3]}, format="json").status_code == 400
    assert c.post("/api/v1/lessons/nope/progress", {"completed_blocks": [0]}, format="json").status_code == 404


def test_progress_needs_gate_1_and_is_private(index_file):
    call_command("sync_curriculum", str(index_file))
    locked = user_client("locked@example.com", gate1=False)
    assert locked.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [0]}, format="json").status_code == 403
    a, b = user_client("a@example.com"), user_client("b@example.com")
    a.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [0]}, format="json")
    assert b.get("/api/v1/me/lesson-progress").json() == []


def test_lessons_open_in_order(index_file):
    call_command("sync_curriculum", str(index_file))
    c = user_client()
    # l1-c comes after l1-a (l1-b is a draft, so it's not in the sequence).
    res = c.post("/api/v1/lessons/l1-c/progress", {"completed_blocks": [0]}, format="json")
    assert res.status_code == 409
    assert res.json()["code"] == "lesson_locked" and res.json()["next"] == "l1-a"

    c.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [0, 1]}, format="json")
    assert c.post("/api/v1/lessons/l1-c/progress", {"completed_blocks": [0]}, format="json").status_code == 409
    c.post("/api/v1/lessons/l1-a/progress", {"completed_blocks": [2]}, format="json")
    assert c.post("/api/v1/lessons/l1-c/progress", {"completed_blocks": [0]}, format="json").status_code == 200
