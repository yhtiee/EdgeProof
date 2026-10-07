"""
Exams are drawn and graded on the server; answers never reach the client
(AC-5). Retake rules (AC-6): after a first failure the user may retake once
immediately with different questions; from the second consecutive failure a
cooldown applies.
"""

import random
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.exceptions import Conflict

from .models import Exam, ExamAttempt, Question


class CooldownActive(Conflict):
    default_code = "exam_cooldown"


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
    until = cooldown_until(user, exam)
    if until:
        raise CooldownActive(f"You can try this exam again after {until:%d %b, %H:%M} UTC. Review the missed concepts first.")

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
    if attempt.submitted_at:
        raise Conflict("This attempt was already submitted.")

    questions = {str(q.id): q for q in Question.objects.filter(id__in=attempt.drawn_question_ids)}
    results = []
    correct = 0
    for qid in attempt.drawn_question_ids:
        q = questions[qid]
        ok = q.is_correct(answers.get(qid))
        correct += ok
        results.append({"question": qid, "correct": ok, "explanation": q.explanation, "concepts": q.concept_tags})

    attempt.answers = answers
    attempt.score = correct / len(attempt.drawn_question_ids)
    attempt.passed = attempt.score >= attempt.exam.pass_mark
    attempt.submitted_at = timezone.now()
    attempt.save()

    missed = sorted({c for r in results if not r["correct"] for c in r["concepts"]})
    return {
        "score": attempt.score,
        "passed": attempt.passed,
        "pass_mark": attempt.exam.pass_mark,
        "results": results,
        "missed_concepts": missed,
        "can_retake_now": cooldown_until(attempt.user, attempt.exam) is None,
    }
