from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ActivityEvent
from apps.gates.permissions import RequiresGate
from apps.gates.services import evaluate_gate_2, grant_gate

from .models import Exam, ExamAttempt, Lesson, LessonProgress, Level, Question
from .serializers import (
    AttemptSerializer,
    ExamSerializer,
    LessonProgressSerializer,
    LevelSerializer,
    QuestionReportSerializer,
    SubmitSerializer,
)
from .services import (
    CooldownActive,
    ExamLocked,
    exam_status,
    lesson_blocker,
    start_attempt,
    submit_attempt,
)


class LevelListView(generics.ListAPIView):
    """GET /levels"""

    serializer_class = LevelSerializer
    pagination_class = None
    queryset = Level.objects.filter(status=Level.Status.PUBLISHED).order_by("order")


class LessonProgressView(APIView):
    """
    POST /lessons/{slug}/progress: saves completed screens (AC-10). The client
    saves locally first and sends the full set again when it reconnects, so
    this merges and is safe to repeat.
    """

    permission_classes = [RequiresGate(1)]

    def post(self, request, slug):
        lesson = get_object_or_404(Lesson, slug=slug)
        serializer = LessonProgressSerializer(data=request.data, context={"lesson": lesson})
        serializer.is_valid(raise_exception=True)
        progress = LessonProgress.objects.filter(user=request.user, lesson=lesson).first()
        if progress is None:
            # Lessons open in order (spec §5). Already-started lessons can always be saved.
            blocker = lesson_blocker(request.user, lesson)
            if blocker:
                return Response(
                    {
                        "code": "lesson_locked",
                        "message": f"Finish \"{blocker.title}\" first. The path opens in order.",
                        "fields": {},
                        "next": {"kind": blocker.kind, "key": blocker.key},
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            progress = LessonProgress.objects.create(user=request.user, lesson=lesson)
        before = set(progress.completed_blocks)
        merged = before | set(serializer.validated_data["completed_blocks"])
        progress.completed_blocks = sorted(merged)
        if merged != before:
            ActivityEvent.objects.create(user=request.user, type="lesson_progress", ref=lesson.slug)
        if len(merged) >= lesson.block_count and not progress.completed_at:
            progress.completed_at = timezone.now()
            ActivityEvent.objects.create(user=request.user, type="lesson_completed", ref=lesson.slug)
        progress.save()
        return Response(LessonProgressSerializer(progress).data)


class MyLessonProgressView(generics.ListAPIView):
    """GET /me/lesson-progress: every lesson the user has started."""

    serializer_class = LessonProgressSerializer
    pagination_class = None

    def get_queryset(self):
        return LessonProgress.objects.owned_by(self.request.user).select_related("lesson")


def _published_exam(key):
    return get_object_or_404(Exam.objects.select_related("level", "module"), key=key, status=Exam.Status.PUBLISHED)


class MyExamsView(APIView):
    """GET /me/exams: every published exam with this learner's status (Learn page)."""

    def get(self, request):
        exams = list(Exam.objects.filter(status=Exam.Status.PUBLISHED).select_related("level", "module"))
        return Response(exam_status(request.user, exams))


class ExamDetailView(APIView):
    """GET /exams/{key}: one exam with this learner's status."""

    def get(self, request, key):
        return Response(exam_status(request.user, [_published_exam(key)])[0])


class StartAttemptView(APIView):
    """
    POST /exams/{key}/attempts: draws questions on the server and returns
    prompts and options only. Resumes an unfinished attempt if there is one.
    """

    permission_classes = [RequiresGate(1)]

    def post(self, request, key):
        exam = _published_exam(key)
        try:
            attempt = start_attempt(request.user, exam)
        except ExamLocked as exc:
            b = exc.blocker
            return Response(
                {"code": "exam_locked", "message": str(exc.detail), "fields": {}, "next": {"kind": b.kind, "key": b.key}},
                status=status.HTTP_409_CONFLICT,
            )
        except CooldownActive as exc:
            return Response(
                {"code": "exam_cooldown", "message": str(exc.detail), "fields": {}, "cooldown_until": exc.until},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(AttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class SubmitAttemptView(APIView):
    """POST /attempts/{id}/submit: graded on the server."""

    def post(self, request, pk):
        attempt = get_object_or_404(ExamAttempt.objects.select_related("exam__level"), pk=pk, user=request.user)
        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = submit_attempt(attempt, serializer.validated_data["answers"])
        ActivityEvent.objects.create(user=request.user, type="exam_attempt", ref=attempt.exam.key or str(attempt.exam_id))

        if result["passed"] and attempt.exam.scope in (Exam.Scope.LEVEL, Exam.Scope.PLACEMENT):
            gate2 = evaluate_gate_2(request.user)
            if gate2["met"]:
                grant_gate(request.user, gate=2, evidence=gate2)
            result["gate_2_passed"] = gate2["met"]
        return Response(result)


class ReportQuestionView(APIView):
    """POST /questions/{id}/report (AC-8)."""

    def post(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        serializer = QuestionReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, question=question)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
