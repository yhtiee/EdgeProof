"""
The learner's whole path in one list (spec §8 gates, DESIGN.md "Progress
path"): Gate 1, each published level with its lessons and level exam, Gate 2,
Strategy Lab drafting, Gate 3, and the next gate still to come. Computed on the
server from the same rules that enforce each gate, so the page can't disagree
with them. Each step says what's done and what's left, so the current one
doubles as the nudge.
"""

from django.db.models import Max

from apps.academy.models import Exam, ExamAttempt, Level
from apps.academy.services import academy_path

from .models import GatePass
from .services import evaluate_gate_2, gates_open, has_gate


def progress(user) -> dict:
    from apps.strategy.services import draft_access

    profile = getattr(user, "profile", None)
    steps = []

    steps.append({
        "kind": "gate", "key": "gate-1", "title": "Gate 1: plan accepted", "unlocks": "The Academy",
        "done": has_gate(user, 1),
        "criteria": [
            {"name": "Account created", "met": True},
            {"name": "Study hours and sessions set", "met": bool(profile and profile.weekly_hours)},
            {"name": "Trading background answered", "met": bool(profile and (profile.answers or {}).get("experience"))},
            {"name": "Plan accepted", "met": bool(profile and profile.plan_accepted_at)},
        ],
        "link": "/onboarding",
    })

    items = academy_path(user)
    best = {
        row["exam__key"]: row["best"]
        for row in ExamAttempt.objects.filter(user=user, submitted_at__isnull=False)
        .values("exam__key").annotate(best=Max("score"))
    }
    passed_keys = set(ExamAttempt.objects.filter(user=user, passed=True).values_list("exam__key", flat=True))
    for level in Level.objects.filter(status=Level.Status.PUBLISHED).order_by("order"):
        lessons = [i for i in items if i.level == level.order and i.kind == "lesson"]
        exams = [i for i in items if i.level == level.order and i.kind == "exam"]
        placed = f"p-{level.order}" in passed_keys
        level_key = f"l-{level.order}"
        next_item = next((i for i in items if i.level == level.order and not i.done), None)
        steps.append({
            "kind": "level", "key": f"level-{level.order}", "title": f"Level {level.order}: {level.title}",
            "done": placed or level_key in passed_keys,
            "placed": placed,
            "lessons_done": sum(1 for i in lessons if i.done),
            "lessons_total": len(lessons),
            "exams_done": sum(1 for i in exams if i.done),
            "exams_total": len(exams),
            "level_exam": {"key": level_key, "passed": level_key in passed_keys, "best_score": best.get(level_key)}
            if Exam.objects.filter(key=level_key, status=Exam.Status.PUBLISHED).exists() else None,
            "next": {"kind": next_item.kind, "key": next_item.key, "title": next_item.title} if next_item else None,
        })

    gate2 = evaluate_gate_2(user)
    steps.append({
        "kind": "gate", "key": "gate-2", "title": "Gate 2: every level passed", "unlocks": "Testing in the Strategy Lab",
        "done": has_gate(user, 2) or gate2["met"],
        "criteria": [{"name": f"Level {c['level']}: {c['title']} exam passed or placed out", "met": c["met"]} for c in gate2["criteria"]],
        "link": "/learn",
    })

    access = draft_access(user)
    steps.append({
        "kind": "milestone", "key": "lab", "title": "Strategy Lab: drafting opens", "unlocks": "Writing your own rulebook",
        "done": access["requirement_met"],
        "criteria": [{"name": f"Lesson: {r['title']}", "met": r["done"], "link": f"/learn/{r['slug']}"} for r in access["required"]],
        "link": "/lab",
    })

    locked = (
        GatePass.objects.owned_by(user).filter(gate=3, revoked_at__isnull=True, strategy_version__isnull=False)
        .select_related("strategy_version__strategy").order_by("-passed_at")
    )
    steps.append({
        "kind": "gate", "key": "gate-3", "title": "Gate 3: rules clear enough to test", "unlocks": "Test runs (per strategy version)",
        "done": locked.exists(),
        "criteria": [{"name": "A strategy version passes every clarity check and is locked", "met": locked.exists()}]
        + [{"name": f"{g.strategy_version.strategy.name}, version {g.strategy_version.number}", "met": True} for g in locked[:5]],
        "link": "/lab",
    })

    steps.append({
        "kind": "gate", "key": "gate-4", "title": "Gate 4: passed out-of-sample test", "unlocks": "Forward testing",
        "done": False, "upcoming": True,
        "criteria": [{"name": "Opens in Phase 2, with test runs and the edge verdict", "met": False}],
        "link": None,
    })

    current = next((s["key"] for s in steps if not s["done"] and not s.get("upcoming")), None)
    return {"steps": steps, "current": current, "gates_open": gates_open()}
