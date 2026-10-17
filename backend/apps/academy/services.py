"""
Academy services: the learning path, and exams.

Exams are drawn and graded on the server; answers never reach the client
(AC-5). Retake rules (AC-6): after a first failure the user may retake once
immediately with different questions; from the second consecutive failure a
cooldown applies.

The path (spec §5): within each level, every module's lessons are followed by
its module exam, and the level ends with its level exam. Items open in order.
A passed placement exam (90%+) counts as that level's pass, so the whole
level is treated as done.
"""

import random
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.exceptions import Conflict
from apps.gates.services import gates_open

from .models import Exam, ExamAttempt, Lesson, LessonProgress, Level, Module, Question

PUBLISHED = Lesson.Status.PUBLISHED


# --- The learning path -------------------------------------------------------


@dataclass(frozen=True)
class PathItem:
    kind: str  # "lesson" | "exam"
    id: object
    key: str  # lesson slug or exam key
    title: str
    level: int
    done: bool


def passed_exam_ids(user) -> set:
    return set(ExamAttempt.objects.filter(user=user, passed=True).values_list("exam_id", flat=True))


def academy_path(user) -> list[PathItem]:
    """Every lesson and module/level exam in order, with whether the user has done it."""
    done_lessons = set(
        LessonProgress.objects.filter(user=user, completed_at__isnull=False).values_list("lesson_id", flat=True)
    )
    passed = passed_exam_ids(user)
    exams = list(Exam.objects.filter(status=PUBLISHED).select_related("module", "level"))
    module_exam = {e.module_id: e for e in exams if e.scope == Exam.Scope.MODULE}
    level_exam = {e.level_id: e for e in exams if e.scope == Exam.Scope.LEVEL}
    placement = {e.level_id: e for e in exams if e.scope == Exam.Scope.PLACEMENT}

    lessons_by_module: dict = {}
    for lesson in Lesson.objects.filter(status=PUBLISHED).order_by("order"):
        lessons_by_module.setdefault(lesson.module_id, []).append(lesson)

    items: list[PathItem] = []
    for level in Level.objects.filter(status=PUBLISHED).order_by("order"):
        placed = placement.get(level.id) is not None and placement[level.id].id in passed
        level_passed = level_exam.get(level.id) is not None and level_exam[level.id].id in passed
        skip = placed or level_passed
        for module in Module.objects.filter(level=level, status=PUBLISHED).order_by("order"):
            for lesson in lessons_by_module.get(module.id, []):
                items.append(PathItem("lesson", lesson.id, lesson.slug, lesson.title, level.order, skip or lesson.id in done_lessons))
            exam = module_exam.get(module.id)
            if exam:
                items.append(PathItem("exam", exam.id, exam.key or str(exam.id), exam.title, level.order, skip or exam.id in passed))
        exam = level_exam.get(level.id)
        if exam:
            items.append(PathItem("exam", exam.id, exam.key or str(exam.id), exam.title, level.order, placed or exam.id in passed))
    return items


def blocker_for(items: list[PathItem], kind: str, item_id) -> PathItem | None:
    """The first unfinished item before this one, or None if it's open."""
    for item in items:
        if item.kind == kind and item.id == item_id:
            return None
        if not item.done:
            return item
    return None


def placement_blocker(items: list[PathItem], level_order: int) -> PathItem | None:
    """A placement exam opens once every earlier level is done."""
    return next((i for i in items if i.level < level_order and not i.done), None)


def would_block_exam(user, exam: Exam, items: list[PathItem] | None = None) -> PathItem | None:
    """What blocks this exam on a deployed build, even when development opens every gate."""
    items = items if items is not None else academy_path(user)
    if exam.scope == Exam.Scope.PLACEMENT:
        return placement_blocker(items, exam.level.order)
    return blocker_for(items, "exam", exam.id)


def exam_blocker(user, exam: Exam, items: list[PathItem] | None = None) -> PathItem | None:
    return None if gates_open() else would_block_exam(user, exam, items)


def lesson_blocker(user, lesson: Lesson) -> PathItem | None:
    return None if gates_open() else blocker_for(academy_path(user), "lesson", lesson.id)


# --- Exams ----------------------------------------------------------------------


class ExamLocked(Conflict):
    default_code = "exam_locked"

    def __init__(self, blocker: PathItem):
        super().__init__(f"Finish \"{blocker.title}\" first. The path opens in order.")
        self.blocker = blocker


class CooldownActive(Conflict):
    default_code = "exam_cooldown"

    def __init__(self, until):
        super().__init__("You can take this exam again after the cooldown. Review the lessons you missed first.")
        self.until = until


def _consecutive_failures(user, exam) -> list[ExamAttempt]:
    fails = []
    for attempt in ExamAttempt.objects.filter(user=user, exam=exam, submitted_at__isnull=False).order_by("-submitted_at"):
        if attempt.passed:
            break
        fails.append(attempt)
    return fails


def cooldown_until(user, exam):
    fails = _consecutive_failures(user, exam)
    if len(fails) < 2:
        return None
    until = fails[0].submitted_at + timedelta(hours=exam.cooldown_hours)
    return until if until > timezone.now() else None


@transaction.atomic
def start_attempt(user, exam: Exam, rng: random.Random | None = None) -> ExamAttempt:
    blocker = exam_blocker(user, exam)
    if blocker:
        raise ExamLocked(blocker)

    until = cooldown_until(user, exam)
    if until:
        raise CooldownActive(until)

    open_attempt = ExamAttempt.objects.filter(user=user, exam=exam, submitted_at__isnull=True).first()
    if open_attempt:
        return open_attempt

    bank = list(exam.bank.filter(status=Question.Status.PUBLISHED, flagged=False).values_list("id", flat=True))
    if len(bank) < exam.draw_count:
        raise ValidationError({"exam": "This exam's question bank isn't ready yet."})

    # Prefer questions the user didn't see in their last attempt (a retake gets different questions).
    last = ExamAttempt.objects.filter(user=user, exam=exam).order_by("-started_at").first()
    seen = {str(q) for q in (last.drawn_question_ids if last else [])}
    fresh = [q for q in bank if str(q) not in seen]
    rng = rng or random.SystemRandom()
    pool = fresh if len(fresh) >= exam.draw_count else bank
    drawn = rng.sample(pool, exam.draw_count)

    return ExamAttempt.objects.create(user=user, exam=exam, drawn_question_ids=[str(q) for q in drawn])


@transaction.atomic
def submit_attempt(attempt: ExamAttempt, answers: dict) -> dict:
    """
    Grade on the server. The result says which questions were right and
    which lessons to review, but never reveals answers or explanations, so a
    retake from the same bank stays fair (AC-5, AC-6).
    """
    if attempt.submitted_at:
        raise Conflict("This attempt was already submitted.")

    questions = {str(q.id): q for q in Question.objects.filter(id__in=attempt.drawn_question_ids)}
    results = []
    correct = 0
    for qid in attempt.drawn_question_ids:
        q = questions[qid]
        ok = q.is_correct(answers.get(qid))
        correct += ok
        results.append({"question": qid, "prompt": q.prompt, "correct": ok, "lessons": q.concept_tags})

    attempt.answers = answers
    attempt.score = correct / len(attempt.drawn_question_ids)
    attempt.passed = attempt.score >= attempt.exam.pass_mark
    attempt.submitted_at = timezone.now()
    attempt.save()

    missed_slugs = list(dict.fromkeys(s for r in results if not r["correct"] for s in r["lessons"]))
    titles = dict(Lesson.objects.filter(slug__in=missed_slugs).values_list("slug", "title"))
    until = cooldown_until(attempt.user, attempt.exam)
    return {
        "score": attempt.score,
        "correct": correct,
        "total": len(attempt.drawn_question_ids),
        "passed": attempt.passed,
        "pass_mark": attempt.exam.pass_mark,
        "results": results,
        "review_lessons": [{"slug": s, "title": titles[s]} for s in missed_slugs if s in titles],
        "can_retake_now": until is None,
        "cooldown_until": until,
    }


def exam_status(user, exams, items: list[PathItem] | None = None) -> list[dict]:
    """Per-exam status for the Learn page: passed, best score, lock, cooldown."""
    items = items if items is not None else academy_path(user)
    attempts: dict = {}
    for a in ExamAttempt.objects.filter(user=user, exam__in=exams).order_by("started_at"):
        attempts.setdefault(a.exam_id, []).append(a)
    out = []
    for exam in exams:
        mine = attempts.get(exam.id, [])
        submitted = [a for a in mine if a.submitted_at]
        blocker = would_block_exam(user, exam, items)
        out.append(
            {
                "key": exam.key,
                "title": exam.title,
                "scope": exam.scope,
                "level": exam.level.order,
                "module": exam.module.slug if exam.module else None,
                "draw_count": exam.draw_count,
                "pass_mark": exam.pass_mark,
                "passed": any(a.passed for a in submitted),
                "best_score": max((a.score for a in submitted), default=None),
                "attempts": len(submitted),
                "in_progress": any(not a.submitted_at for a in mine),
                "cooldown_until": cooldown_until(user, exam),
                "locked": blocker is not None and not gates_open(),
                "blocker": {"kind": blocker.kind, "key": blocker.key, "title": blocker.title} if blocker else None,
            }
        )
    return out
